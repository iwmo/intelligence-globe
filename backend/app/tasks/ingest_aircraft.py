"""
OpenSky Network aircraft ingest RQ task.

Fetches an OAuth2 Bearer token from the OpenSky identity server, polls the
/states/all endpoint for all tracked aircraft, and batch-upserts valid records
(those with a known position) into the aircraft table.

The sync wrapper self-re-enqueues every 90 seconds to stay within the
4,000-credit/day OpenSky budget while keeping positions near-live.

IMPORTANT: OpenSky Basic Auth is DEAD as of March 18, 2026.
Only Bearer tokens via the client_credentials grant are accepted.
"""
from __future__ import annotations

import asyncio
import logging
import os
from datetime import datetime, timedelta, timezone

import httpx
from sqlalchemy import select, update as sa_update
from sqlalchemy.dialects.postgresql import insert as pg_insert

from app.db import AsyncSessionLocal
from app.models.aircraft import Aircraft

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

OPENSKY_TOKEN_URL = (
    "https://auth.opensky-network.org/auth/realms/opensky-network"
    "/protocol/openid-connect/token"
)
OPENSKY_STATES_URL = "https://opensky-network.org/api/states/all"
POLL_INTERVAL_SECONDS = 90
TRAIL_MAX_LEN = 20


# ---------------------------------------------------------------------------
# HTTP helpers
# ---------------------------------------------------------------------------


async def fetch_opensky_token(client_id: str, client_secret: str) -> str:
    """Obtain a short-lived Bearer token via the client_credentials grant.

    Args:
        client_id:     Value of OPENSKY_CLIENT_ID environment variable.
        client_secret: Value of OPENSKY_CLIENT_SECRET environment variable.

    Returns:
        The access_token string from the identity server response.

    Raises:
        httpx.HTTPStatusError: When the identity server returns a non-2xx status.
    """
    async with httpx.AsyncClient(timeout=20.0) as client:
        resp = await client.post(
            OPENSKY_TOKEN_URL,
            data={
                "grant_type": "client_credentials",
                "client_id": client_id,
                "client_secret": client_secret,
            },
        )
        resp.raise_for_status()
        return resp.json()["access_token"]


async def get_viewport_bbox() -> tuple[float, float, float, float] | None:
    """Read the last-known viewport bounding box from Redis.

    Returns (lamin, lomin, lamax, lomax) if set and not expired, else None.
    """
    import os
    redis_url = os.getenv("REDIS_URL", "redis://redis:6379/0")
    import redis.asyncio as aioredis
    client = aioredis.from_url(redis_url)
    try:
        raw = await client.get("globe:viewport_bbox")
        if not raw:
            return None
        parts = raw.decode().split(",")
        if len(parts) != 4:
            return None
        lamin, lomin, lamax, lomax = (float(p) for p in parts)
        return lamin, lomin, lamax, lomax
    except Exception:
        return None
    finally:
        await client.aclose()


async def fetch_aircraft_states(token: str) -> tuple[list, int]:
    """Poll the OpenSky /states/all endpoint and return the state-vector list
    together with the response timestamp.

    Uses the stored viewport bounding box (set by the frontend via
    PUT /api/viewport-bounds) when available, falling back to the global
    /states/all query.  Bounding box queries cost ~10x fewer credits.

    Args:
        token: Valid Bearer access token from fetch_opensky_token().

    Returns:
        A 2-tuple of (states, response_time) where:
        - states: List of state vectors (each a 17-element list).  Empty list
          when the API returns no states.
        - response_time: Integer Unix timestamp from the OpenSky `time` field.
          Defaults to 0 if the field is absent.

    Raises:
        RuntimeError: When the server responds with HTTP 429 (rate-limited).
        httpx.HTTPStatusError: For any other non-2xx response.
    """
    bbox = await get_viewport_bbox()
    if bbox:
        lamin, lomin, lamax, lomax = bbox
        url = (
            f"{OPENSKY_STATES_URL}"
            f"?lamin={lamin}&lomin={lomin}&lamax={lamax}&lomax={lomax}"
        )
        logger.info(
            "OpenSky query bounded to viewport: lamin=%.1f lomin=%.1f lamax=%.1f lomax=%.1f",
            lamin, lomin, lamax, lomax,
        )
    else:
        url = OPENSKY_STATES_URL
        logger.info("OpenSky query: global (no viewport bounds stored)")

    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.get(
            url,
            headers={"Authorization": f"Bearer {token}"},
        )

        if resp.status_code == 429:
            retry_after = resp.headers.get("X-Rate-Limit-Retry-After-Seconds", "unknown")
            logger.warning(
                "OpenSky rate-limited (429). Retry-After: %s seconds. "
                "Self-re-enqueue will still fire in %ds.",
                retry_after,
                POLL_INTERVAL_SECONDS,
            )
            raise RuntimeError(
                f"OpenSky returned 429 — retry after {retry_after}s"
            )

        resp.raise_for_status()
        data = resp.json()
        response_time: int = data.get("time", 0)
        states: list = data.get("states") or []
        return states, response_time


# ---------------------------------------------------------------------------
# Core ingest function
# ---------------------------------------------------------------------------


async def ingest_aircraft() -> int:
    """Fetch all aircraft states from OpenSky and upsert into PostgreSQL.

    Workflow:
    1. Read credentials from environment (raises KeyError with clear message if absent).
    2. Obtain OAuth2 Bearer token.
    3. Poll /states/all — returns (states, response_time) tuple.
    4. Filter state vectors missing a position (sv[5] or sv[6] is None).
    5. Convert response_time to fetched_at datetime; capture last_seen_at = now(UTC).
    6. Pre-fetch existing trails in one SELECT to avoid N+1 queries.
    7. Build updated trail for each aircraft (cap at TRAIL_MAX_LEN).
    8. Batch-upsert into aircraft table with all freshness fields.
    9. Tombstone sweep: set is_active=False for aircraft absent from this snapshot.
    10. Single commit after both the upsert loop and the tombstone sweep.

    Returns:
        Number of aircraft rows upserted.

    Raises:
        KeyError: When OPENSKY_CLIENT_ID or OPENSKY_CLIENT_SECRET is not set.
    """
    client_id = os.environ.get("OPENSKY_CLIENT_ID")
    client_secret = os.environ.get("OPENSKY_CLIENT_SECRET")

    if not client_id:
        raise KeyError(
            "OPENSKY_CLIENT_ID environment variable is not set. "
            "Set it in your .env file or docker-compose.yml."
        )
    if not client_secret:
        raise KeyError(
            "OPENSKY_CLIENT_SECRET environment variable is not set. "
            "Set it in your .env file or docker-compose.yml."
        )

    logger.info("Starting OpenSky aircraft ingest")

    token = await fetch_opensky_token(client_id, client_secret)
    logger.info("OpenSky OAuth2 token obtained")

    raw_states, response_time = await fetch_aircraft_states(token)
    logger.info("Received %d raw state vectors from OpenSky", len(raw_states))

    # Convert OpenSky response timestamp to UTC datetime
    fetched_at = datetime.fromtimestamp(response_time, tz=timezone.utc)
    last_seen_at = datetime.now(timezone.utc)

    # Filter: skip aircraft without a known position
    valid_states = [
        sv for sv in raw_states
        if len(sv) > 6 and sv[5] is not None and sv[6] is not None
    ]
    skipped = len(raw_states) - len(valid_states)
    logger.info(
        "%d aircraft have valid position; %d skipped (null lat/lon)",
        len(valid_states),
        skipped,
    )

    if not valid_states:
        logger.warning("No aircraft with valid position — nothing to upsert")
        return 0

    async with AsyncSessionLocal() as session:
        # Pre-fetch all existing trails in one round-trip to avoid N+1 queries
        existing_result = await session.execute(
            select(Aircraft.icao24, Aircraft.trail)
        )
        trail_map: dict[str, list] = {
            row.icao24: (row.trail or []) for row in existing_result
        }

        for sv in valid_states:
            icao24: str = sv[0]
            callsign: str | None = sv[1].strip() if sv[1] else None
            origin_country: str | None = sv[2] if len(sv) > 2 else None
            last_contact: int | None = sv[4] if len(sv) > 4 else None
            longitude: float = sv[5]
            latitude: float = sv[6]
            baro_altitude: float | None = sv[7] if len(sv) > 7 else None
            on_ground: bool = bool(sv[8]) if len(sv) > 8 and sv[8] is not None else False
            velocity: float | None = sv[9] if len(sv) > 9 else None
            true_track: float | None = sv[10] if len(sv) > 10 else None

            # New fields — length-guarded to handle short state vectors
            time_position: int | None = sv[3] if len(sv) > 3 else None
            vertical_rate: float | None = sv[11] if len(sv) > 11 else None
            geo_altitude: float | None = sv[13] if len(sv) > 13 else None
            position_source: int | None = sv[16] if len(sv) > 16 else None

            new_point = {
                "lon": longitude,
                "lat": latitude,
                "alt": baro_altitude,
                "ts": last_contact,
            }

            # Append new position and cap at TRAIL_MAX_LEN (oldest dropped)
            existing_trail = trail_map.get(icao24) or []
            trail = existing_trail[-(TRAIL_MAX_LEN - 1):] + [new_point]

            stmt = (
                pg_insert(Aircraft)
                .values(
                    icao24=icao24,
                    callsign=callsign,
                    origin_country=origin_country,
                    longitude=longitude,
                    latitude=latitude,
                    baro_altitude=baro_altitude,
                    on_ground=on_ground,
                    velocity=velocity,
                    true_track=true_track,
                    last_contact=last_contact,
                    trail=trail,
                    time_position=time_position,
                    vertical_rate=vertical_rate,
                    geo_altitude=geo_altitude,
                    position_source=position_source,
                    fetched_at=fetched_at,
                    last_seen_at=last_seen_at,
                    is_active=True,
                )
                .on_conflict_do_update(
                    index_elements=["icao24"],
                    set_=dict(
                        callsign=callsign,
                        origin_country=origin_country,
                        longitude=longitude,
                        latitude=latitude,
                        baro_altitude=baro_altitude,
                        on_ground=on_ground,
                        velocity=velocity,
                        true_track=true_track,
                        last_contact=last_contact,
                        trail=trail,
                        time_position=time_position,
                        vertical_rate=vertical_rate,
                        geo_altitude=geo_altitude,
                        position_source=position_source,
                        fetched_at=fetched_at,
                        last_seen_at=last_seen_at,
                        is_active=True,
                    ),
                )
            )
            await session.execute(stmt)

        # Tombstone sweep: mark aircraft absent from this snapshot as inactive.
        # Guard: skip if seen_icao24s is empty to prevent mass false-tombstone.
        seen_icao24s = list({sv[0] for sv in valid_states})
        if seen_icao24s:
            tombstone_stmt = (
                sa_update(Aircraft)
                .where(Aircraft.icao24.not_in(seen_icao24s))
                .values(is_active=False)
            )
            await session.execute(tombstone_stmt)

        # Single commit after both upsert loop and tombstone sweep
        await session.commit()

    logger.info("Upserted %d aircraft records into PostgreSQL", len(valid_states))
    return len(valid_states)


# ---------------------------------------------------------------------------
# RQ sync wrapper
# ---------------------------------------------------------------------------


def sync_ingest_aircraft() -> None:
    """RQ-safe synchronous wrapper around ingest_aircraft().

    Runs the async ingest, then self-re-enqueues this function in
    POLL_INTERVAL_SECONDS (90s) so the aircraft table stays near-live
    without relying on RQ Repeat (version-unstable).

    If the ingest raises (e.g. missing credentials, 429), the exception is
    logged and re-raised so RQ marks the job as failed — but self-re-enqueue
    still fires so the next poll attempt happens at the scheduled interval.
    """
    try:
        asyncio.run(ingest_aircraft())
    except Exception as exc:
        logger.exception("Aircraft ingest failed: %s", exc)
        raise
    finally:
        # Always re-enqueue, even after failure, so the task loop keeps running
        from redis import Redis
        from rq import Queue

        redis_url = os.getenv("REDIS_URL", "redis://redis:6379/0")
        conn = Redis.from_url(redis_url)
        q = Queue(connection=conn)
        q.enqueue_in(timedelta(seconds=POLL_INTERVAL_SECONDS), sync_ingest_aircraft)
        logger.info(
            "Re-enqueued aircraft ingest; next run in %ds",
            POLL_INTERVAL_SECONDS,
        )
