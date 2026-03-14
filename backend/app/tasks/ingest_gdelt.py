"""
GDELT v2 RQ ingest worker.

Fetches lastupdate.txt every 15 minutes, downloads the export ZIP in-memory,
parses tab-delimited rows, applies three deduplication layers:
  1. Redis file-level skip (SADD returns 0 → already processed)
  2. Null-coordinate filter (rows missing lat or lon are dropped)
  3. PostgreSQL ON CONFLICT DO NOTHING (global_event_id unique)

7-day rolling cleanup runs before each upsert batch.

Self-re-enqueues every POLL_INTERVAL_SECONDS (900 s) via enqueue_in in the
finally block, matching the self-re-enqueue pattern from ingest_aircraft.py.
"""
from __future__ import annotations

import asyncio
import csv
import io
import logging
import os
import zipfile
from datetime import datetime, timedelta, timezone
from typing import Any

import httpx
from redis import Redis as SyncRedis
from sqlalchemy import delete
from sqlalchemy.dialects.postgresql import insert as pg_insert

from app.db import AsyncSessionLocal
from app.models.gdelt_event import GdeltEvent

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

GDELT_LASTUPDATE_URL = "http://data.gdeltproject.org/gdeltv2/lastupdate.txt"
POLL_INTERVAL_SECONDS = 900

# GDELT CSV column indices (0-based, tab-delimited, NO header row)
_COL_GLOBALEVENTID = 0
_COL_SQLDATE = 1
_COL_ACTOR1NAME = 6
_COL_ACTOR2NAME = 21
_COL_EVENTCODE = 27
_COL_QUADCLASS = 30
_COL_GOLDSTEINSCALE = 31
_COL_NUMMENTIONS = 32
_COL_AVGTONE = 34
_COL_LAT = 47
_COL_LON = 48
_COL_DATEADDED = 57
_COL_SOURCEURL = 58

# ---------------------------------------------------------------------------
# Pure helpers
# ---------------------------------------------------------------------------


def parse_export_url(text: str) -> str | None:
    """Return the .export.CSV.zip URL from lastupdate.txt content.

    Each line has three whitespace-separated fields:
        <timestamp> <size> <url>

    Returns the URL (third field) from the line whose URL ends with
    '.export.CSV.zip', or None if no such line is found.
    """
    for line in text.splitlines():
        parts = line.split()
        if len(parts) >= 3 and parts[2].endswith(".export.CSV.zip"):
            return parts[2]
    return None


def parse_gdelt_row(row: list[str] | dict[str, str]) -> dict[str, Any] | None:
    """Parse a single GDELT row and return a dict suitable for DB insert.

    Accepts either:
    - a list of strings (from CSV reader, 0-based column positions), or
    - a dict with GDELT field names as keys (used by unit tests).

    Returns None if the row should be skipped (null coords, QuadClass == 1,
    invalid dates, or row too short).
    """
    if isinstance(row, dict):
        return _parse_gdelt_row_dict(row)
    return _parse_gdelt_row_list(row)


def _parse_gdelt_row_list(row: list[str]) -> dict[str, Any] | None:
    """Parse a positional-list GDELT row (from CSV reader)."""
    if len(row) < 59:
        return None

    # Coordinates — skip if missing
    lat_raw = row[_COL_LAT]
    lon_raw = row[_COL_LON]
    try:
        latitude = float(lat_raw) if lat_raw else None
        longitude = float(lon_raw) if lon_raw else None
    except ValueError:
        return None
    if latitude is None or longitude is None:
        return None

    # QuadClass filter — only keep 2 (Verbal Conflict), 3 (Material Conflict),
    # 4 (Material Cooperation); skip 1 (Verbal Cooperation)
    # GDELT publishes QuadClass as a float string (e.g. "4.0"), so parse via float first.
    try:
        quad_class = int(float(row[_COL_QUADCLASS]))
    except (ValueError, IndexError):
        return None
    if quad_class not in {2, 3, 4}:
        return None

    # Temporal fields
    try:
        occurred_at = datetime.strptime(row[_COL_SQLDATE], "%Y%m%d").replace(
            tzinfo=timezone.utc
        )
    except ValueError:
        return None

    dateadded_raw = row[_COL_DATEADDED]
    try:
        discovered_at = (
            datetime.strptime(dateadded_raw, "%Y%m%d%H%M%S").replace(
                tzinfo=timezone.utc
            )
            if dateadded_raw
            else None
        )
    except ValueError:
        discovered_at = None

    # Optional numeric fields
    def _safe_float(val: str) -> float | None:
        try:
            return float(val) if val else None
        except ValueError:
            return None

    def _safe_int(val: str) -> int | None:
        try:
            return int(val) if val else None
        except ValueError:
            return None

    event_code_raw = row[_COL_EVENTCODE]
    event_code = event_code_raw[:4] if event_code_raw else None

    return {
        "global_event_id": row[_COL_GLOBALEVENTID],
        "occurred_at": occurred_at,
        "discovered_at": discovered_at,
        "latitude": latitude,
        "longitude": longitude,
        "quad_class": quad_class,
        "goldstein_scale": _safe_float(row[_COL_GOLDSTEINSCALE]),
        "event_code": event_code,
        "actor1_name": row[_COL_ACTOR1NAME] or None,
        "actor2_name": row[_COL_ACTOR2NAME] or None,
        "source_url": row[_COL_SOURCEURL] or None,
        "avg_tone": _safe_float(row[_COL_AVGTONE]),
        "num_mentions": _safe_int(row[_COL_NUMMENTIONS]),
        "source_is_stale": False,
    }


def _parse_gdelt_row_dict(row: dict[str, str]) -> dict[str, Any] | None:
    """Parse a dict-keyed GDELT row (used by unit tests)."""
    # Coordinates — skip if missing
    lat_raw = row.get("ActionGeo_Lat", "")
    lon_raw = row.get("ActionGeo_Long", "")
    try:
        latitude = float(lat_raw) if lat_raw else None
        longitude = float(lon_raw) if lon_raw else None
    except ValueError:
        return None
    if latitude is None or longitude is None:
        return None

    # QuadClass filter
    try:
        quad_class = int(row.get("QuadClass", ""))
    except (ValueError, TypeError):
        return None
    if quad_class not in {2, 3, 4}:
        return None

    # Temporal fields
    sqldate = row.get("SQLDATE", "")
    try:
        occurred_at = datetime.strptime(sqldate, "%Y%m%d").replace(
            tzinfo=timezone.utc
        )
    except ValueError:
        return None

    dateadded_raw = row.get("DATEADDED", "")
    try:
        discovered_at = (
            datetime.strptime(dateadded_raw, "%Y%m%d%H%M%S").replace(
                tzinfo=timezone.utc
            )
            if dateadded_raw
            else None
        )
    except ValueError:
        discovered_at = None

    def _safe_float(val: str) -> float | None:
        try:
            return float(val) if val else None
        except ValueError:
            return None

    def _safe_int(val: str) -> int | None:
        try:
            return int(val) if val else None
        except ValueError:
            return None

    event_code_raw = row.get("EventCode", "")
    event_code = event_code_raw[:4] if event_code_raw else None

    return {
        "global_event_id": row.get("GLOBALEVENTID", ""),
        "occurred_at": occurred_at,
        "discovered_at": discovered_at,
        "latitude": latitude,
        "longitude": longitude,
        "quad_class": quad_class,
        "goldstein_scale": _safe_float(row.get("GoldsteinScale", "")),
        "event_code": event_code,
        "actor1_name": row.get("Actor1Name") or None,
        "actor2_name": row.get("Actor2Name") or None,
        "source_url": row.get("SOURCEURL") or None,
        "avg_tone": _safe_float(row.get("AvgTone", "")),
        "num_mentions": _safe_int(row.get("NumMentions", "")),
        "source_is_stale": False,
    }


# ---------------------------------------------------------------------------
# Async pipeline helpers
# ---------------------------------------------------------------------------


def get_redis_client() -> SyncRedis:
    """Return a synchronous Redis client (used for SADD dedup check)."""
    redis_url = os.getenv("REDIS_URL", "redis://redis:6379/0")
    return SyncRedis.from_url(redis_url)


async def download_and_parse_export(url: str) -> list[list[str]]:
    """Download a GDELT export ZIP from *url* and return parsed CSV rows.

    No disk I/O — the ZIP is decompressed entirely in memory.
    Plain HTTP is used (GDELT does not redirect to HTTPS on data.gdeltproject.org).
    """
    async with httpx.AsyncClient(timeout=60.0) as client:
        resp = await client.get(url)
        resp.raise_for_status()

    with zipfile.ZipFile(io.BytesIO(resp.content)) as zf:
        name = zf.namelist()[0]
        raw_bytes = zf.read(name)

    text = raw_bytes.decode("utf-8", errors="replace")
    reader = csv.reader(io.StringIO(text), delimiter="\t")
    return list(reader)


async def cleanup_old_events() -> int:
    """Delete gdelt_events rows where occurred_at < now - 7 days.

    Returns the number of rows deleted.
    """
    cutoff = datetime.now(timezone.utc) - timedelta(days=7)
    async with AsyncSessionLocal() as session:
        async with session.begin():
            result = await session.execute(
                delete(GdeltEvent).where(GdeltEvent.occurred_at < cutoff)
            )
            return result.rowcount


async def insert_gdelt_events(rows: list[list[str]]) -> int:
    """Parse *rows* and bulk-insert into gdelt_events with ON CONFLICT DO NOTHING.

    Returns the number of rows passed to the DB (before dedup).
    """
    inserted = 0
    async with AsyncSessionLocal() as session:
        async with session.begin():
            for row in rows:
                row_dict = parse_gdelt_row(row)
                if row_dict is None:
                    continue
                stmt = (
                    pg_insert(GdeltEvent)
                    .values(**row_dict)
                    .on_conflict_do_nothing(index_elements=["global_event_id"])
                )
                await session.execute(stmt)
                inserted += 1
    return inserted


async def ingest_gdelt_file(export_url: str) -> None:
    """Process a single GDELT export file URL.

    Steps:
    1. Redis SADD check — if URL already processed (sadd returns 0), return early.
    2. Download and parse the export ZIP.
    3. Run 7-day cleanup.
    4. Insert parsed rows into gdelt_events.

    Note: get_redis_client() may return either a synchronous redis.Redis or an
    async-compatible mock (in tests).  We call sadd() and await the result only
    if it is a coroutine, so the same code path works under both conditions.
    """
    redis_conn = get_redis_client()
    sadd_result = redis_conn.sadd("gdelt:processed_files", export_url)
    # Support both sync Redis (returns int) and async mocks (returns coroutine)
    if asyncio.iscoroutine(sadd_result):
        added = await sadd_result
    else:
        added = sadd_result
    if added == 0:
        logger.info("GDELT file already processed, skipping: %s", export_url)
        return

    rows = await download_and_parse_export(export_url)
    logger.info("Downloaded %d rows from %s", len(rows), export_url)

    deleted = await cleanup_old_events()
    logger.info("7-day cleanup: deleted %d old events", deleted)

    inserted = await insert_gdelt_events(rows)
    logger.info("Inserted %d GDELT events from %s", inserted, export_url)


async def ingest_gdelt() -> None:
    """Main ingest entry point: fetch lastupdate.txt and process the export file."""
    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.get(GDELT_LASTUPDATE_URL)
        resp.raise_for_status()

    export_url = parse_export_url(resp.text)
    if export_url is None:
        logger.warning("No .export.CSV.zip URL found in lastupdate.txt")
        return

    await ingest_gdelt_file(export_url)


# ---------------------------------------------------------------------------
# RQ sync wrapper
# ---------------------------------------------------------------------------


def sync_ingest_gdelt() -> None:
    """RQ-safe synchronous wrapper around ingest_gdelt().

    Runs the async ingest, then self-re-enqueues this function in
    POLL_INTERVAL_SECONDS (900 s) so the gdelt_events table stays fresh
    without relying on RQ Repeat (version-unstable).

    If the ingest raises, the exception is logged and re-raised so RQ marks
    the job as failed — but self-re-enqueue still fires in the finally block.
    """
    try:
        asyncio.run(ingest_gdelt())
    except Exception as exc:
        logger.exception("GDELT ingest failed: %s", exc)
        raise
    finally:
        from redis import Redis
        from rq import Queue

        redis_url = os.getenv("REDIS_URL", "redis://redis:6379/0")
        conn = Redis.from_url(redis_url)
        q = Queue(connection=conn)
        q.enqueue_in(timedelta(seconds=POLL_INTERVAL_SECONDS), sync_ingest_gdelt)
        logger.info(
            "Re-enqueued GDELT ingest; next run in %ds", POLL_INTERVAL_SECONDS
        )
