"""
GPS Jamming aggregation RQ task.

Reads military aircraft NIC/NACp accuracy fields and aggregates them into
H3 resolution-5 cells to identify geographic areas with GPS jamming.

Jamming detection formula (from gpsjam.org methodology):
  - is_bad = (nic is not None and nic < 7) or (nac_p is not None and nac_p < 8)
  - Aircraft with both nic=None and nac_p=None → treated as GOOD (no signal)
  - bad_ratio = max(0.0, (bad_count - 1) / total_count)
  - Severity thresholds: red >= 0.3, yellow >= 0.1, green < 0.1

The sync wrapper self-re-enqueues every 86400 seconds (daily) to keep
GPS jamming cell data current.
"""
from __future__ import annotations

import asyncio
import logging
import os
from collections import defaultdict
from datetime import timedelta

import h3
from sqlalchemy.dialects.postgresql import insert as pg_insert

from app.db import AsyncSessionLocal
from app.models.gps_jamming import GpsJammingCell
from app.models.military_aircraft import MilitaryAircraft
from sqlalchemy import select

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

H3_RESOLUTION = 5
POLL_INTERVAL_SECONDS = 86400  # daily

# Severity thresholds
SEVERITY_RED_THRESHOLD = 0.3
SEVERITY_YELLOW_THRESHOLD = 0.1


# ---------------------------------------------------------------------------
# Pure aggregation helper (testable without DB)
# ---------------------------------------------------------------------------


def aggregate_jamming_cells(aircraft_list: list[dict]) -> list[dict]:
    """Aggregate aircraft NIC/NACp data into H3 cells with jamming severity.

    Accepts a list of dicts with keys: lat, lon, nic, nac_p.

    Rules:
    - Aircraft without valid lat AND lon are excluded entirely.
    - Aircraft with both nic=None and nac_p=None are treated as GOOD.
    - is_bad = (nic is not None and nic < 7) or (nac_p is not None and nac_p < 8)
    - bad_ratio = max(0.0, (bad_count - 1) / total_count)
    - Severity: red >= 0.3, yellow >= 0.1, green < 0.1

    Args:
        aircraft_list: List of aircraft dicts from DB or test fixtures.

    Returns:
        List of cell dicts ready for upsert into gps_jamming_cells.
    """
    # Group aircraft by H3 cell
    cell_data: dict[str, dict] = defaultdict(lambda: {"total": 0, "bad": 0})

    for ac in aircraft_list:
        lat = ac.get("lat")
        lon = ac.get("lon")

        # Exclude aircraft without valid position
        if lat is None or lon is None:
            continue

        h3index = h3.latlng_to_cell(lat, lon, H3_RESOLUTION)
        cell_data[h3index]["total"] += 1

        nic = ac.get("nic")
        nac_p = ac.get("nac_p")

        # is_bad: either nic < 7 or nac_p < 8 (None values treated as good)
        is_bad = (nic is not None and nic < 7) or (nac_p is not None and nac_p < 8)
        if is_bad:
            cell_data[h3index]["bad"] += 1

    results = []
    for h3index, counts in cell_data.items():
        total = counts["total"]
        bad = counts["bad"]

        # Formula: max(0.0, (bad - 1) / total) — subtract 1 to reduce false positives
        bad_ratio = max(0.0, (bad - 1) / total) if total > 0 else 0.0

        if bad_ratio >= SEVERITY_RED_THRESHOLD:
            severity = "red"
        elif bad_ratio >= SEVERITY_YELLOW_THRESHOLD:
            severity = "yellow"
        else:
            severity = "green"

        results.append(
            {
                "h3index": h3index,
                "bad_ratio": bad_ratio,
                "severity": severity,
                "aircraft_count": total,
            }
        )

    return results


# ---------------------------------------------------------------------------
# Core ingest function
# ---------------------------------------------------------------------------


async def ingest_gps_jamming() -> int:
    """Read all MilitaryAircraft rows and aggregate GPS jamming cells.

    Workflow:
    1. Select all MilitaryAircraft rows with valid latitude and longitude.
    2. Convert to dicts and call aggregate_jamming_cells().
    3. Batch-upsert results into gps_jamming_cells using ON CONFLICT DO UPDATE.

    Returns:
        Number of cells upserted.
    """
    logger.info("Starting GPS jamming aggregation from military_aircraft table")

    async with AsyncSessionLocal() as session:
        result = await session.execute(
            select(MilitaryAircraft).where(
                MilitaryAircraft.latitude.is_not(None),
                MilitaryAircraft.longitude.is_not(None),
            )
        )
        aircraft_rows = result.scalars().all()

    logger.info("Found %d military aircraft with valid position", len(aircraft_rows))

    aircraft_dicts = [
        {
            "lat": ac.latitude,
            "lon": ac.longitude,
            "nic": ac.nic,
            "nac_p": ac.nac_p,
        }
        for ac in aircraft_rows
    ]

    cells = aggregate_jamming_cells(aircraft_dicts)
    logger.info("Aggregated %d GPS jamming cells", len(cells))

    if not cells:
        logger.warning("No GPS jamming cells produced — nothing to upsert")
        return 0

    async with AsyncSessionLocal() as session:
        for cell in cells:
            stmt = (
                pg_insert(GpsJammingCell)
                .values(**cell)
                .on_conflict_do_update(
                    index_elements=["h3index"],
                    set_={
                        "bad_ratio": cell["bad_ratio"],
                        "severity": cell["severity"],
                        "aircraft_count": cell["aircraft_count"],
                    },
                )
            )
            await session.execute(stmt)
        await session.commit()

    logger.info("Upserted %d GPS jamming cells into PostgreSQL", len(cells))
    return len(cells)


# ---------------------------------------------------------------------------
# RQ sync wrapper
# ---------------------------------------------------------------------------


def sync_aggregate_gps_jamming() -> None:
    """RQ-safe synchronous wrapper around ingest_gps_jamming().

    Runs the async aggregation, then self-re-enqueues this function in
    POLL_INTERVAL_SECONDS (86400s = daily) so the gps_jamming_cells table
    stays current without relying on RQ Repeat (version-unstable).

    If the aggregation raises, the exception is logged and re-raised so RQ
    marks the job as failed — but self-re-enqueue still fires so the next
    aggregation attempt happens at the scheduled interval.
    """
    try:
        asyncio.run(ingest_gps_jamming())
    except Exception as exc:
        logger.exception("GPS jamming aggregation failed: %s", exc)
        raise
    finally:
        # Always re-enqueue, even after failure, so the task loop keeps running
        from redis import Redis
        from rq import Queue

        redis_url = os.getenv("REDIS_URL", "redis://redis:6379/0")
        conn = Redis.from_url(redis_url)
        q = Queue(connection=conn)
        q.enqueue_in(timedelta(seconds=POLL_INTERVAL_SECONDS), sync_aggregate_gps_jamming)
        logger.info(
            "Re-enqueued GPS jamming aggregation; next run in %ds",
            POLL_INTERVAL_SECONDS,
        )
