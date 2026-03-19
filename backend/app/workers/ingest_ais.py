"""
AIS (Automatic Identification System) ingest worker.

Connects to aisstream.io via WebSocket, parses PositionReport messages,
caches ships in Redis, and batch-flushes to PostgreSQL every 30 seconds.

Exports:
  - parse_ais_message(msg) -> dict | None   — pure function, unit-testable
  - batch_flush_ships_to_pg(redis_client, session_factory) -> int
  - run_ais_worker() -> None                — long-lived async entry point

Entry point:
  python -m app.workers.ingest_ais
"""
import asyncio
import json
import logging
import os
from datetime import datetime, timezone

from sqlalchemy import update as sa_update
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker

from app.models.ship import Ship

logger = logging.getLogger(__name__)

WS_URL = "wss://stream.aisstream.io/v0/stream"
BATCH_INTERVAL = 30  # seconds between PostgreSQL flushes


def parse_time_utc(raw: "str | None") -> "datetime | None":
    """Parse an ISO datetime string from Redis to a timezone-aware datetime.

    Returns None if raw is falsy, unparseable, or raises any error.
    The Ship.last_seen_at column is TIMESTAMPTZ — naive datetimes get UTC attached.
    """
    if not raw:
        return None
    try:
        dt = datetime.fromisoformat(raw)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt
    except (ValueError, TypeError):
        return None


def parse_ais_message(msg: dict) -> dict | None:
    """
    Parse an aisstream.io WebSocket message.

    Returns a dict with ship fields if msg is a PositionReport with valid
    coordinates; returns None for all other message types or missing data.

    This is a pure function — no Redis, no DB, no side effects.
    """
    if msg.get("MessageType") != "PositionReport":
        return None

    meta = msg.get("MetaData", {})
    pos = msg.get("Message", {}).get("PositionReport", {})

    lat = meta.get("latitude")
    lon = meta.get("longitude")
    if lat is None or lon is None:
        return None

    mmsi = meta.get("MMSI")

    return {
        "mmsi": mmsi,
        "ship_name": meta.get("ShipName", "").strip(),
        "latitude": lat,
        "longitude": lon,
        "sog": pos.get("Sog"),
        "cog": pos.get("Cog"),
        "true_heading": pos.get("TrueHeading", 511),
        "nav_status": pos.get("NavigationalStatus"),
        "time_utc": meta.get("time_utc"),
    }


async def batch_flush_ships_to_pg(redis_client, session_factory) -> int:
    """
    Scan Redis for ship:* keys and upsert all ships to PostgreSQL.

    Returns the number of ships upserted.
    Uses pg_insert(...).on_conflict_do_update(index_elements=['mmsi'])
    so re-broadcasting the same ship updates the row rather than failing.
    """
    count = 0
    rows = []
    seen_mmsis = []

    # Scan Redis for all ship keys
    async for key in redis_client.scan_iter("ship:*"):
        data = await redis_client.hgetall(key)
        if not data:
            continue

        # Redis hgetall returns bytes — decode them
        decoded = {
            k.decode() if isinstance(k, bytes) else k: v.decode() if isinstance(v, bytes) else v
            for k, v in data.items()
        }

        mmsi = decoded.get("mmsi")
        if not mmsi:
            continue

        # last_seen_at: prefer AIS time_utc; if missing/unparseable use now so row is visible in API
        seen_at = parse_time_utc(decoded.get("time_utc"))
        if seen_at is None:
            seen_at = datetime.now(timezone.utc)
        row = {
            "mmsi": str(mmsi),
            "vessel_name": decoded.get("ship_name") or None,
            "vessel_type": None,
            "latitude": float(decoded["latitude"]) if decoded.get("latitude") else None,
            "longitude": float(decoded["longitude"]) if decoded.get("longitude") else None,
            "sog": float(decoded["sog"]) if decoded.get("sog") not in (None, "None", "") else None,
            "cog": float(decoded["cog"]) if decoded.get("cog") not in (None, "None", "") else None,
            "true_heading": float(decoded["true_heading"]) if decoded.get("true_heading") not in (None, "None", "") else None,
            "nav_status": int(decoded["nav_status"]) if decoded.get("nav_status") not in (None, "None", "") else None,
            "last_update": decoded.get("time_utc"),
            "last_seen_at": seen_at,
        }
        rows.append(row)
        seen_mmsis.append(str(mmsi))

    if not rows:
        return 0

    # asyncpg caps at 32,767 bind parameters per query; Ship row has 11 value columns
    # (mmsi, vessel_name, vessel_type, lat, lon, sog, cog, true_heading, nav_status, last_update, last_seen_at)
    # 32767 / 11 ≈ 2978 — use 2900 to stay safely under the limit
    CHUNK_SIZE = 2_900
    async with session_factory() as session:
        for i in range(0, len(rows), CHUNK_SIZE):
            chunk = rows[i:i + CHUNK_SIZE]
            stmt = pg_insert(Ship).values(chunk)
            stmt = stmt.on_conflict_do_update(
                index_elements=["mmsi"],
                set_={
                    "vessel_name": stmt.excluded.vessel_name,
                    "latitude": stmt.excluded.latitude,
                    "longitude": stmt.excluded.longitude,
                    "sog": stmt.excluded.sog,
                    "cog": stmt.excluded.cog,
                    "true_heading": stmt.excluded.true_heading,
                    "nav_status": stmt.excluded.nav_status,
                    "last_update": stmt.excluded.last_update,
                    "last_seen_at": stmt.excluded.last_seen_at,
                    "is_active": True,
                },
            )
            await session.execute(stmt)

        # Deactivation sweep: mark ships not in current Redis scan as inactive.
        # Uses MMSI presence in Redis scan (not timestamp arithmetic) per STATE.md decision.
        # Note: NOT IN with large lists is acceptable here — Redis scan at 30s intervals
        # typically yields thousands, not tens of thousands, of ships.
        if seen_mmsis:
            await session.execute(
                sa_update(Ship)
                .where(Ship.mmsi.not_in(seen_mmsis))
                .values(is_active=False)
            )

        await session.commit()
        count = len(rows)

    logger.info("batch_flush_ships_to_pg: upserted %d ships", count)
    return count


async def run_ais_worker() -> None:
    """
    Long-lived AIS WebSocket worker.

    Connects to aisstream.io, subscribes to PositionReport messages for all
    oceans (global bounding box), caches each ship to Redis, and flushes to
    PostgreSQL every BATCH_INTERVAL seconds.

    Reconnects automatically on any exception (including server-initiated
    2-minute disconnects that aisstream.io is known to send).
    """
    # Defer websockets import so the module can be imported in test environments
    # where websockets may not be installed.
    from websockets.asyncio.client import connect  # type: ignore

    import redis.asyncio as aioredis

    redis_url = os.getenv("REDIS_URL", "redis://redis:6379/0")
    database_url = os.getenv("DATABASE_URL", "")
    api_key = os.getenv("AISSTREAM_API_KEY", "")

    redis_client = aioredis.from_url(redis_url)

    engine = create_async_engine(database_url, echo=False)
    session_factory = async_sessionmaker(engine, expire_on_commit=False)

    subscribe_msg = json.dumps({
        "APIKey": api_key,
        "BoundingBoxes": [[[-90, -180], [90, 180]]],
        "FilterMessageTypes": ["PositionReport"],
    })

    last_flush = asyncio.get_event_loop().time()

    logger.info("AIS worker starting — connecting to %s", WS_URL)

    async for websocket in connect(WS_URL, ping_interval=None):
        try:
            # CRITICAL: subscribe MUST be first action within 3 seconds of connection
            await websocket.send(subscribe_msg)
            logger.info("AIS subscribed — waiting for PositionReport messages")

            async for raw in websocket:
                try:
                    msg = json.loads(raw)
                except json.JSONDecodeError:
                    continue

                parsed = parse_ais_message(msg)
                if parsed is None:
                    continue

                mmsi = str(parsed["mmsi"])
                key = f"ship:{mmsi}"

                # Cache to Redis with 10-minute TTL
                await redis_client.hset(key, mapping={k: str(v) if v is not None else "" for k, v in parsed.items()})
                await redis_client.expire(key, 600)

                # Schedule batch flush every BATCH_INTERVAL seconds
                now = asyncio.get_event_loop().time()
                if now - last_flush >= BATCH_INTERVAL:
                    last_flush = now
                    asyncio.create_task(batch_flush_ships_to_pg(redis_client, session_factory))

        except Exception as exc:
            logger.warning("AIS worker connection error: %s — reconnecting", exc)
            continue


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    asyncio.run(run_ais_worker())
