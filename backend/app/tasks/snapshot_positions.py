"""
Snapshot positions RQ task.

Reads all three live entity tables (aircraft, military_aircraft, ships)
every 60 seconds and batch-inserts a position record for each entity with
a valid position into the position_snapshots partitioned table.

Two-session DDL+DML separation pattern (PostgreSQL anti-pitfall):
  Session 1: ensure_partition() — DDL (CREATE TABLE IF NOT EXISTS PARTITION OF) — commit
  Session 2: batch INSERT into parent table — commit
  Never mix DDL and DML in the same transaction.

Self-re-enqueue pattern mirrors ingest_military.py so the snapshot loop
keeps running without relying on RQ Repeat (version-unstable).
"""
from __future__ import annotations

import asyncio
import logging
import os
from datetime import date, datetime, timedelta, timezone

from sqlalchemy import select, text

from app.db import AsyncSessionLocal
from app.models.aircraft import Aircraft
from app.models.military_aircraft import MilitaryAircraft
from app.models.ship import Ship

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

SNAPSHOT_INTERVAL_SECONDS = 300
RETENTION_DAYS = 2


# ---------------------------------------------------------------------------
# Pure snapshot helpers (testable without DB)
#
# These accept either ORM model instances or plain dicts so they can be
# called both from snapshot_positions() (ORM rows) and from unit tests
# (plain dicts).  Attribute access via getattr() handles both cases.
# ---------------------------------------------------------------------------


def snapshot_from_aircraft(row: object, ts: datetime) -> dict:
    """Map an Aircraft row (or dict) to a canonical snapshot dict.

    Args:
        row: Aircraft ORM instance or dict with aircraft fields.
        ts: Snapshot timestamp (UTC).

    Returns:
        Dict ready for batch INSERT into position_snapshots.
    """
    if isinstance(row, dict):
        return {
            "ts": ts,
            "layer_type": "aircraft",
            "entity_id": row["icao24"],
            "latitude": row["latitude"],
            "longitude": row["longitude"],
            "altitude": row.get("baro_altitude"),
            "heading": row.get("true_track"),
            "speed": row.get("velocity"),
        }
    return {
        "ts": ts,
        "layer_type": "aircraft",
        "entity_id": row.icao24,
        "latitude": row.latitude,
        "longitude": row.longitude,
        "altitude": row.baro_altitude,
        "heading": row.true_track,
        "speed": row.velocity,
    }


def snapshot_from_military(row: object, ts: datetime) -> dict:
    """Map a MilitaryAircraft row (or dict) to a canonical snapshot dict.

    Args:
        row: MilitaryAircraft ORM instance or dict with military fields.
        ts: Snapshot timestamp (UTC).

    Returns:
        Dict ready for batch INSERT into position_snapshots.
    """
    if isinstance(row, dict):
        return {
            "ts": ts,
            "layer_type": "military",
            "entity_id": row["hex"],
            "latitude": row["latitude"],
            "longitude": row["longitude"],
            "altitude": row.get("alt_baro"),
            "heading": row.get("track"),
            "speed": row.get("gs"),
        }
    return {
        "ts": ts,
        "layer_type": "military",
        "entity_id": row.hex,
        "latitude": row.latitude,
        "longitude": row.longitude,
        "altitude": row.alt_baro,
        "heading": row.track,
        "speed": row.gs,
    }


def snapshot_from_ship(row: object, ts: datetime) -> dict:
    """Map a Ship row (or dict) to a canonical snapshot dict.

    Ships have no altitude field; altitude is always None.

    Args:
        row: Ship ORM instance or dict with ship fields.
        ts: Snapshot timestamp (UTC).

    Returns:
        Dict ready for batch INSERT into position_snapshots.
    """
    if isinstance(row, dict):
        return {
            "ts": ts,
            "layer_type": "ship",
            "entity_id": str(row["mmsi"]),
            "latitude": row["latitude"],
            "longitude": row["longitude"],
            "altitude": None,
            "heading": row.get("true_heading"),
            "speed": row.get("sog"),
        }
    return {
        "ts": ts,
        "layer_type": "ship",
        "entity_id": str(row.mmsi),
        "latitude": row.latitude,
        "longitude": row.longitude,
        "altitude": None,
        "heading": row.true_heading,
        "speed": row.sog,
    }


# ---------------------------------------------------------------------------
# Partition management helpers
# ---------------------------------------------------------------------------


def ensure_partition_name(today: date) -> str:
    """Return the partition table name for a given date.

    Pure function — no DB access.

    Args:
        today: The date for the desired partition.

    Returns:
        Partition table name, e.g. "position_snapshots_2026_03_12".
    """
    return f"position_snapshots_{today.strftime('%Y_%m_%d')}"


async def ensure_partition(today: date) -> None:
    """Ensure today's daily partition exists and drop the oldest (>7 days) if present.

    Uses its own session (Session 1) to isolate DDL from the DML INSERT
    that follows in snapshot_positions().  DDL inside a transaction is
    valid in PostgreSQL but must be committed before the next session
    runs its INSERTs.

    Args:
        today: Date for which to ensure a partition exists.
    """
    tomorrow = today + timedelta(days=1)
    partition_name = ensure_partition_name(today)
    old_date = today - timedelta(days=RETENTION_DAYS)
    old_partition_name = ensure_partition_name(old_date)

    async with AsyncSessionLocal() as session:
        await session.execute(
            text(
                f"CREATE TABLE IF NOT EXISTS {partition_name} "
                f"PARTITION OF position_snapshots "
                f"FOR VALUES FROM ('{today} 00:00:00+00') TO ('{tomorrow} 00:00:00+00')"
            )
        )
        await session.execute(
            text(f"DROP TABLE IF EXISTS {old_partition_name}")
        )
        await session.commit()

    logger.info("Partition %s ensured; old partition %s cleaned up", partition_name, old_partition_name)


# ---------------------------------------------------------------------------
# Core snapshot function
# ---------------------------------------------------------------------------


async def snapshot_positions() -> int:
    """Read all three live tables and batch-insert positions into position_snapshots.

    Two-session separation:
    1. ensure_partition() — DDL in its own session (committed before this returns)
    2. Batch INSERT in a separate session — DML only

    Returns:
        Number of snapshot rows inserted.
    """
    today = date.today()
    ts = datetime.now(timezone.utc)

    # Session 1: DDL — ensure today's partition exists
    await ensure_partition(today)

    rows: list[dict] = []

    # Session 2: read live tables and build snapshot rows
    async with AsyncSessionLocal() as session:
        aircraft_result = await session.execute(
            select(Aircraft).where(
                Aircraft.latitude.is_not(None),
                Aircraft.longitude.is_not(None),
            )
        )
        for ac in aircraft_result.scalars().all():
            rows.append(snapshot_from_aircraft(ac, ts))

        military_result = await session.execute(
            select(MilitaryAircraft).where(
                MilitaryAircraft.latitude.is_not(None),
                MilitaryAircraft.longitude.is_not(None),
            )
        )
        for mil in military_result.scalars().all():
            rows.append(snapshot_from_military(mil, ts))

        ship_result = await session.execute(
            select(Ship).where(
                Ship.latitude.is_not(None),
                Ship.longitude.is_not(None),
            )
        )
        for ship in ship_result.scalars().all():
            rows.append(snapshot_from_ship(ship, ts))

    if not rows:
        logger.info("No entities with valid position — nothing to snapshot")
        return 0

    # Session 3 (still Session 2 conceptually — DML only): batch INSERT
    async with AsyncSessionLocal() as session:
        await session.execute(
            text(
                "INSERT INTO position_snapshots "
                "(ts, layer_type, entity_id, latitude, longitude, altitude, heading, speed) "
                "VALUES (:ts, :layer_type, :entity_id, :latitude, :longitude, :altitude, :heading, :speed)"
            ),
            rows,
        )
        await session.commit()

    logger.info("Inserted %d position snapshot rows", len(rows))
    return len(rows)


# ---------------------------------------------------------------------------
# RQ sync wrapper
# ---------------------------------------------------------------------------


def sync_snapshot_positions() -> None:
    """RQ-safe synchronous wrapper around snapshot_positions().

    Runs the async snapshot task, then self-re-enqueues this function in
    SNAPSHOT_INTERVAL_SECONDS (60s) so the snapshot table accumulates data
    without relying on RQ Repeat (version-unstable).

    If the snapshot raises, the exception is logged and re-raised so RQ
    marks the job as failed — but self-re-enqueue still fires so the next
    snapshot attempt happens at the scheduled interval.
    """
    try:
        asyncio.run(snapshot_positions())
    except Exception as exc:
        logger.exception("Snapshot positions task failed: %s", exc)
        raise
    finally:
        # Always re-enqueue, even after failure, so the snapshot loop keeps running
        from redis import Redis
        from rq import Queue

        redis_url = os.getenv("REDIS_URL", "redis://redis:6379/0")
        conn = Redis.from_url(redis_url)
        q = Queue(connection=conn)
        q.enqueue_in(timedelta(seconds=SNAPSHOT_INTERVAL_SECONDS), sync_snapshot_positions)
        logger.info(
            "Re-enqueued snapshot task; next run in %ds",
            SNAPSHOT_INTERVAL_SECONDS,
        )
