"""
ADSB.lol unified aircraft ingest RQ task.

Polls ADSB.lol for commercial and military aircraft using the same parser,
eliminating OAuth2 auth, credit budget logic, and metres-to-feet conversion.
Bounding box filtering uses ?box= with correct lat/lon coordinate remapping.

Replaces ingest_aircraft.py (OpenSky) and ingest_military.py (airplanes.live).
"""
from __future__ import annotations

import asyncio
import logging
import os
from datetime import datetime, timedelta, timezone

import httpx
from redis import Redis
from sqlalchemy import select, update as sa_update, func
from sqlalchemy.dialects.postgresql import insert as pg_insert

from app.db import AsyncSessionLocal
from app.models.aircraft import Aircraft
from app.models.military_aircraft import MilitaryAircraft

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

POLL_INTERVAL_COMMERCIAL = 15   # seconds
POLL_INTERVAL_MILITARY = 15     # seconds
TRAIL_MAX_LEN = 20

# ---------------------------------------------------------------------------
# Module-level synchronous Redis client (patchable in tests)
# ---------------------------------------------------------------------------

redis_client = Redis.from_url(os.getenv("REDIS_URL", "redis://redis:6379/0"))


# ---------------------------------------------------------------------------
# Pure parsing helper (testable without DB)
# ---------------------------------------------------------------------------


def parse_adsbiol_aircraft(ac: dict) -> dict | None:
    """Parse a single aircraft dict from ADSB.lol response.

    Returns None if lat or lon is missing (record cannot be positioned on map).
    Normalises alt_baro='ground' to None; preserves all numeric alt values as-is
    (ADSB.lol reports altitude in feet — no unit conversion needed).

    Args:
        ac: Raw aircraft dict from ADSB.lol "ac" array.

    Returns:
        Dict of normalised fields ready for upsert, or None to skip.
    """
    if ac.get("lat") is None or ac.get("lon") is None:
        return None

    raw_alt = ac.get("alt_baro")
    alt_baro: float | None = None if raw_alt == "ground" else raw_alt

    flight_raw = ac.get("flight", "") or ""
    callsign: str | None = flight_raw.strip() or None

    return {
        "icao24": ac.get("hex"),
        "callsign": callsign,
        "latitude": ac.get("lat"),
        "longitude": ac.get("lon"),
        "baro_altitude": alt_baro,
        "velocity": ac.get("gs"),
        "true_track": ac.get("track"),
        "vertical_rate": ac.get("baro_rate"),
        "registration": ac.get("r"),
        "type_code": ac.get("t"),
        "emergency": ac.get("emergency"),
        "nav_modes": ac.get("nav_modes"),
        "ias": ac.get("ias"),
        "tas": ac.get("tas"),
        "mach": ac.get("mach"),
        "roll": ac.get("roll"),
    }


# ---------------------------------------------------------------------------
# Viewport bounding box helper
# ---------------------------------------------------------------------------


def get_viewport_bbox() -> str | None:
    """Read the last-known viewport bounding box from Redis.

    Returns a box_param string (e.g. "box=10.0,50.0,20.0,60.0") if set,
    else None.

    Redis stores: "min_lat,min_lon,max_lat,max_lon"
    ADSB.lol expects: ?box=lat_s,lat_n,lon_w,lon_e
    Remapping: box={min_lat},{max_lat},{min_lon},{max_lon}
    """
    try:
        raw = redis_client.get("globe:viewport_bbox")
        if not raw:
            return None
        parts = raw.decode().split(",")
        if len(parts) != 4:
            return None
        min_lat, min_lon, max_lat, max_lon = parts
        return f"box={min_lat},{max_lat},{min_lon},{max_lon}"
    except Exception:
        return None


# ---------------------------------------------------------------------------
# Core ingest functions
# ---------------------------------------------------------------------------


async def ingest_commercial_aircraft() -> int:
    """Fetch all aircraft with position from ADSB.lol and upsert into PostgreSQL.

    Workflow:
    1. Read ADSBIO_BASE_URL from env (allows test patching via os.environ).
    2. Check Redis for viewport bbox; append ?box= param if present.
    3. GET /?all_with_pos (+ optional bbox) from ADSB.lol.
    4. Parse "ac" array; filter out records with missing lat/lon.
    5. Pre-fetch existing trails in one SELECT (avoids N+1 queries).
    6. Batch-upsert into aircraft table; cap trail at TRAIL_MAX_LEN.
    7. Tombstone sweep (set is_active=False) only when fetching global feed.
    8. Single commit.

    Returns:
        Number of aircraft rows upserted.
    """
    base_url = os.getenv("ADSBIO_BASE_URL", "https://re-api.adsb.lol")
    box_param = get_viewport_bbox()
    url = f"{base_url}/?all_with_pos" + (f"&{box_param}" if box_param else "")

    logger.info("Fetching commercial aircraft from ADSB.lol: %s", url)

    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.get(url)
        resp.raise_for_status()
        data = resp.json()

    raw_aircraft = data.get("ac") or []
    logger.info("Received %d raw aircraft from ADSB.lol", len(raw_aircraft))

    valid_records = [
        r for r in (parse_adsbiol_aircraft(ac) for ac in raw_aircraft)
        if r is not None
    ]

    skipped = len(raw_aircraft) - len(valid_records)
    logger.info(
        "%d aircraft have valid position; %d skipped (null lat/lon)",
        len(valid_records),
        skipped,
    )

    if not valid_records:
        logger.warning("No commercial aircraft with valid position — nothing to upsert")
        return 0

    fetched_at = datetime.now(timezone.utc)
    last_seen_at = fetched_at

    async with AsyncSessionLocal() as session:
        # Pre-fetch all existing trails in one round-trip
        existing_result = await session.execute(
            select(Aircraft.icao24, Aircraft.trail)
        )
        trail_map: dict[str, list] = {
            row.icao24: (row.trail or []) for row in existing_result
        }

        for record in valid_records:
            icao24 = record["icao24"]
            new_point = {
                "lon": record["longitude"],
                "lat": record["latitude"],
                "alt": record["baro_altitude"],
                "ts": fetched_at.timestamp(),
            }
            existing_trail = trail_map.get(icao24) or []
            trail = existing_trail[-(TRAIL_MAX_LEN - 1):] + [new_point]

            stmt = (
                pg_insert(Aircraft)
                .values(
                    icao24=icao24,
                    callsign=record["callsign"],
                    latitude=record["latitude"],
                    longitude=record["longitude"],
                    baro_altitude=record["baro_altitude"],
                    velocity=record["velocity"],
                    true_track=record["true_track"],
                    vertical_rate=record["vertical_rate"],
                    registration=record["registration"],
                    type_code=record["type_code"],
                    emergency=record["emergency"],
                    nav_modes=record["nav_modes"],
                    ias=record["ias"],
                    tas=record["tas"],
                    mach=record["mach"],
                    roll=record["roll"],
                    trail=trail,
                    fetched_at=fetched_at,
                    last_seen_at=last_seen_at,
                    is_active=True,
                )
                .on_conflict_do_update(
                    index_elements=["icao24"],
                    set_=dict(
                        callsign=record["callsign"],
                        latitude=record["latitude"],
                        longitude=record["longitude"],
                        baro_altitude=record["baro_altitude"],
                        velocity=record["velocity"],
                        true_track=record["true_track"],
                        vertical_rate=record["vertical_rate"],
                        registration=record["registration"],
                        type_code=record["type_code"],
                        emergency=record["emergency"],
                        nav_modes=record["nav_modes"],
                        ias=record["ias"],
                        tas=record["tas"],
                        mach=record["mach"],
                        roll=record["roll"],
                        trail=trail,
                        fetched_at=fetched_at,
                        last_seen_at=last_seen_at,
                        is_active=True,
                    ),
                )
            )
            await session.execute(stmt)

        # Tombstone sweep: only when fetching the global feed (no bbox filter active).
        # Skip tombstoning when bbox is active — partial view must not mark
        # out-of-view aircraft as inactive.
        seen_icao24s = list({r["icao24"] for r in valid_records})
        if seen_icao24s and box_param is None:
            tombstone_stmt = (
                sa_update(Aircraft)
                .where(Aircraft.icao24.not_in(seen_icao24s))
                .values(is_active=False)
            )
            await session.execute(tombstone_stmt)

        await session.commit()

    logger.info("Upserted %d commercial aircraft records into PostgreSQL", len(valid_records))
    return len(valid_records)


async def ingest_military_aircraft() -> int:
    """Fetch all military aircraft from ADSB.lol and upsert into PostgreSQL.

    Uses the same parser as commercial ingest. Appends &filter_mil to restrict
    response to military transponders. Triggers GPS jamming re-aggregation on
    success.

    Returns:
        Number of military aircraft rows upserted.
    """
    base_url = os.getenv("ADSBIO_BASE_URL", "https://re-api.adsb.lol")
    box_param = get_viewport_bbox()
    url = f"{base_url}/?all_with_pos&filter_mil" + (f"&{box_param}" if box_param else "")

    logger.info("Fetching military aircraft from ADSB.lol: %s", url)

    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.get(url)
        resp.raise_for_status()
        data = resp.json()

    raw_aircraft = data.get("ac") or []
    logger.info("Received %d raw military aircraft from ADSB.lol", len(raw_aircraft))

    valid_records = [
        r for r in (parse_adsbiol_aircraft(ac) for ac in raw_aircraft)
        if r is not None
    ]

    skipped = len(raw_aircraft) - len(valid_records)
    logger.info(
        "%d military aircraft have valid position; %d skipped (null lat/lon)",
        len(valid_records),
        skipped,
    )

    if not valid_records:
        logger.warning("No military aircraft with valid position — nothing to upsert")
        return 0

    fetched_at = datetime.now(timezone.utc)
    last_seen_at = fetched_at

    async with AsyncSessionLocal() as session:
        for record in valid_records:
            mil_record = {
                "hex": record["icao24"],
                "flight": record["callsign"],
                "aircraft_type": record["type_code"],
                "registration": record["registration"],
                "alt_baro": record["baro_altitude"],
                "gs": record["velocity"],
                "track": record["true_track"],
                "latitude": record["latitude"],
                "longitude": record["longitude"],
                "emergency": record["emergency"],
                "nav_modes": record["nav_modes"],
                "ias": record["ias"],
                "tas": record["tas"],
                "mach": record["mach"],
                "roll": record["roll"],
                "fetched_at": fetched_at,
                "last_seen_at": last_seen_at,
                "is_active": True,
            }
            stmt = (
                pg_insert(MilitaryAircraft)
                .values(**mil_record)
                .on_conflict_do_update(
                    index_elements=["hex"],
                    set_={
                        "flight": mil_record["flight"],
                        "aircraft_type": mil_record["aircraft_type"],
                        "registration": mil_record["registration"],
                        "alt_baro": mil_record["alt_baro"],
                        "gs": mil_record["gs"],
                        "track": mil_record["track"],
                        "latitude": mil_record["latitude"],
                        "longitude": mil_record["longitude"],
                        "emergency": mil_record["emergency"],
                        "nav_modes": mil_record["nav_modes"],
                        "ias": mil_record["ias"],
                        "tas": mil_record["tas"],
                        "mach": mil_record["mach"],
                        "roll": mil_record["roll"],
                        "updated_at": func.now(),
                        "fetched_at": fetched_at,
                        "last_seen_at": last_seen_at,
                        "is_active": True,
                    },
                )
            )
            await session.execute(stmt)

        # Tombstone sweep: only when fetching the global feed
        seen_hexes = list({r["icao24"] for r in valid_records})
        if seen_hexes and box_param is None:
            tombstone_stmt = (
                sa_update(MilitaryAircraft)
                .where(MilitaryAircraft.hex.not_in(seen_hexes))
                .values(is_active=False)
            )
            await session.execute(tombstone_stmt)

        await session.commit()

    logger.info("Upserted %d military aircraft records into PostgreSQL", len(valid_records))
    return len(valid_records)


# ---------------------------------------------------------------------------
# RQ sync wrappers (self-re-enqueue pattern)
# ---------------------------------------------------------------------------


def sync_ingest_commercial() -> None:
    """RQ-safe synchronous wrapper around ingest_commercial_aircraft().

    Runs the async ingest, then self-re-enqueues in POLL_INTERVAL_COMMERCIAL
    seconds. Exception is logged and re-raised so RQ marks the job failed,
    but self-re-enqueue still fires so the task loop keeps running.
    """
    try:
        asyncio.run(ingest_commercial_aircraft())
    except Exception as exc:
        logger.exception("Commercial aircraft ingest failed: %s", exc)
        raise
    finally:
        from rq import Queue

        redis_url = os.getenv("REDIS_URL", "redis://redis:6379/0")
        conn = Redis.from_url(redis_url)
        q = Queue(connection=conn)
        q.enqueue_in(timedelta(seconds=POLL_INTERVAL_COMMERCIAL), sync_ingest_commercial)
        logger.info(
            "Re-enqueued commercial aircraft ingest; next run in %ds",
            POLL_INTERVAL_COMMERCIAL,
        )


def sync_ingest_military() -> None:
    """RQ-safe synchronous wrapper around ingest_military_aircraft().

    Runs the async ingest, then self-re-enqueues in POLL_INTERVAL_MILITARY
    seconds. Triggers GPS jamming re-aggregation on success.
    """
    ingest_succeeded = False
    try:
        asyncio.run(ingest_military_aircraft())
        ingest_succeeded = True
    except Exception as exc:
        logger.exception("Military aircraft ingest failed: %s", exc)
        raise
    finally:
        from rq import Queue

        redis_url = os.getenv("REDIS_URL", "redis://redis:6379/0")
        conn = Redis.from_url(redis_url)
        q = Queue(connection=conn)
        q.enqueue_in(timedelta(seconds=POLL_INTERVAL_MILITARY), sync_ingest_military)
        logger.info(
            "Re-enqueued military aircraft ingest; next run in %ds",
            POLL_INTERVAL_MILITARY,
        )

        if ingest_succeeded:
            from app.tasks.ingest_gps_jamming import sync_aggregate_gps_jamming
            q.enqueue(sync_aggregate_gps_jamming)
            logger.info("Enqueued GPS jamming re-aggregation after military ingest")
