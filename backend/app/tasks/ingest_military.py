"""
Military aircraft ingest RQ task.

Polls airplanes.live /v2/mil for all tracked military aircraft and
batch-upserts valid records (those with a known position) into the
military_aircraft table.

The sync wrapper self-re-enqueues every 300 seconds to keep military
aircraft positions near-live.

Altitude is in FEET as received from airplanes.live (not metres).
alt_baro='ground' is normalised to None.
"""
from __future__ import annotations

import asyncio
import logging
import os
from datetime import timedelta

import httpx
from sqlalchemy import func
from sqlalchemy.dialects.postgresql import insert as pg_insert

from app.db import AsyncSessionLocal
from app.models.military_aircraft import MilitaryAircraft

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

AIRPLANES_LIVE_MIL_URL = "http://api.airplanes.live/v2/mil"
POLL_INTERVAL_SECONDS = 300


# ---------------------------------------------------------------------------
# Pure parsing helper (testable without DB)
# ---------------------------------------------------------------------------


def parse_military_aircraft(ac: dict) -> dict | None:
    """Parse a single aircraft dict from airplanes.live /v2/mil response.

    Returns None if lat or lon is missing (record cannot be positioned on map).
    Normalises alt_baro='ground' to None.

    Args:
        ac: Raw aircraft dict from airplanes.live /v2/mil "ac" array.

    Returns:
        Dict of model fields ready for upsert, or None to skip this aircraft.
    """
    if ac.get("lat") is None or ac.get("lon") is None:
        return None

    raw_alt = ac.get("alt_baro")
    alt_baro: float | None = None if raw_alt == "ground" else raw_alt

    flight_raw = ac.get("flight", "") or ""
    flight: str | None = flight_raw.strip() or None

    return {
        "hex": ac.get("hex"),
        "flight": flight,
        "aircraft_type": ac.get("t"),
        "registration": ac.get("r"),
        "alt_baro": alt_baro,
        "gs": ac.get("gs"),
        "track": ac.get("track"),
        "latitude": ac.get("lat"),
        "longitude": ac.get("lon"),
        "squawk": ac.get("squawk"),
    }


# ---------------------------------------------------------------------------
# Core ingest function
# ---------------------------------------------------------------------------


async def ingest_military_aircraft() -> int:
    """Fetch all military aircraft from airplanes.live and upsert into PostgreSQL.

    Workflow:
    1. GET http://api.airplanes.live/v2/mil with 30s timeout.
    2. Parse the "ac" array from the response.
    3. Call parse_military_aircraft() for each entry; skip None results.
    4. Batch-upsert into military_aircraft table using ON CONFLICT DO UPDATE.

    Returns:
        Number of aircraft rows upserted.
    """
    logger.info("Starting military aircraft ingest from airplanes.live /v2/mil")

    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.get(AIRPLANES_LIVE_MIL_URL)
        resp.raise_for_status()
        data = resp.json()

    raw_aircraft = data.get("ac") or []
    logger.info("Received %d raw aircraft from airplanes.live /v2/mil", len(raw_aircraft))

    valid_records = []
    for ac in raw_aircraft:
        parsed = parse_military_aircraft(ac)
        if parsed is not None:
            valid_records.append(parsed)

    skipped = len(raw_aircraft) - len(valid_records)
    logger.info(
        "%d military aircraft have valid position; %d skipped (null lat/lon)",
        len(valid_records),
        skipped,
    )

    if not valid_records:
        logger.warning("No military aircraft with valid position — nothing to upsert")
        return 0

    async with AsyncSessionLocal() as session:
        for record in valid_records:
            stmt = (
                pg_insert(MilitaryAircraft)
                .values(**record)
                .on_conflict_do_update(
                    index_elements=["hex"],
                    set_={
                        "flight": record["flight"],
                        "aircraft_type": record["aircraft_type"],
                        "registration": record["registration"],
                        "alt_baro": record["alt_baro"],
                        "gs": record["gs"],
                        "track": record["track"],
                        "latitude": record["latitude"],
                        "longitude": record["longitude"],
                        "squawk": record["squawk"],
                        "updated_at": func.now(),
                    },
                )
            )
            await session.execute(stmt)

        await session.commit()

    logger.info("Upserted %d military aircraft records into PostgreSQL", len(valid_records))
    return len(valid_records)


# ---------------------------------------------------------------------------
# RQ sync wrapper
# ---------------------------------------------------------------------------


def sync_ingest_military() -> None:
    """RQ-safe synchronous wrapper around ingest_military_aircraft().

    Runs the async ingest, then self-re-enqueues this function in
    POLL_INTERVAL_SECONDS (300s) so the military_aircraft table stays near-live
    without relying on RQ Repeat (version-unstable).

    If the ingest raises, the exception is logged and re-raised so RQ marks
    the job as failed — but self-re-enqueue still fires so the next poll
    attempt happens at the scheduled interval.
    """
    try:
        asyncio.run(ingest_military_aircraft())
    except Exception as exc:
        logger.exception("Military aircraft ingest failed: %s", exc)
        raise
    finally:
        # Always re-enqueue, even after failure, so the task loop keeps running
        from redis import Redis
        from rq import Queue

        redis_url = os.getenv("REDIS_URL", "redis://redis:6379/0")
        conn = Redis.from_url(redis_url)
        q = Queue(connection=conn)
        q.enqueue_in(timedelta(seconds=POLL_INTERVAL_SECONDS), sync_ingest_military)
        logger.info(
            "Re-enqueued military aircraft ingest; next run in %ds",
            POLL_INTERVAL_SECONDS,
        )
