from __future__ import annotations

import asyncio
import csv
import io
import logging
import os
from datetime import datetime, timedelta, timezone

import httpx
from sqlalchemy import delete
from sqlalchemy.dialects.postgresql import insert as pg_insert

from app.config import settings
from app.db import AsyncSessionLocal
from app.models.fire_detection import FireDetection
from app.tasks.ingest_adsbiol import get_viewport_bbox

logger = logging.getLogger(__name__)

POLL_INTERVAL_SECONDS = 600
MAX_ROWS = 4000
MAX_SPAN_DEG = 10.0


def _bbox_from_redis() -> tuple[float, float, float, float] | None:
    raw = get_viewport_bbox()
    if not raw or not raw.startswith("box="):
        return None
    parts = raw[4:].split(",")
    if len(parts) != 4:
        return None
    min_lat, max_lat, min_lon, max_lon = (float(p) for p in parts)
    if (max_lat - min_lat) > MAX_SPAN_DEG or (max_lon - min_lon) > MAX_SPAN_DEG:
        return None
    return min_lat, max_lat, min_lon, max_lon


def parse_firms_row(row: dict, fetched_at: datetime) -> dict | None:
    try:
        lat = float(row["latitude"])
        lon = float(row["longitude"])
    except (KeyError, TypeError, ValueError):
        return None
    acq_at = None
    date = (row.get("acq_date") or "").strip()
    time = (row.get("acq_time") or "").strip().zfill(4)
    if date and time.isdigit():
        try:
            acq_at = datetime.strptime(f"{date}{time}", "%Y-%m-%d%H%M").replace(tzinfo=timezone.utc)
        except ValueError:
            acq_at = None
    bright = row.get("bright_ti4") or row.get("brightness")
    return {
        "latitude": lat,
        "longitude": lon,
        "brightness": float(bright) if bright not in (None, "") else None,
        "frp": float(row["frp"]) if row.get("frp") not in (None, "") else None,
        "confidence": str(row.get("confidence") or "")[:16] or None,
        "acq_at": acq_at,
        "fetched_at": fetched_at,
    }


async def ingest_fires() -> int:
    if not settings.firms_map_key:
        logger.info("FIRMS_MAP_KEY empty — skipping fire ingest")
        return 0
    bbox = _bbox_from_redis()
    if bbox is None:
        logger.info("FIRMS ingest skipped — no clipped viewport bbox")
        return 0
    min_lat, max_lat, min_lon, max_lon = bbox
    area = f"{min_lon},{min_lat},{max_lon},{max_lat}"
    url = (
        f"https://firms.modaps.eosdis.nasa.gov/api/area/csv/"
        f"{settings.firms_map_key}/VIIRS_SNPP_NRT/{area}/1"
    )
    async with httpx.AsyncClient(timeout=40.0) as client:
        resp = await client.get(url)
        resp.raise_for_status()
        text = resp.text

    fetched_at = datetime.now(timezone.utc)
    reader = csv.DictReader(io.StringIO(text))
    rows = []
    for raw in reader:
        parsed = parse_firms_row(raw, fetched_at)
        if parsed:
            rows.append(parsed)
        if len(rows) >= MAX_ROWS:
            break

    async with AsyncSessionLocal() as session:
        await session.execute(delete(FireDetection))
        if rows:
            await session.execute(pg_insert(FireDetection).values(rows))
        await session.commit()

    logger.info("Replaced FIRMS detections with %d rows", len(rows))
    return len(rows)


def sync_ingest_fires() -> None:
    try:
        asyncio.run(ingest_fires())
    except Exception as exc:
        logger.exception("FIRMS ingest failed: %s", exc)
        raise
    finally:
        from redis import Redis
        from rq import Queue

        conn = Redis.from_url(os.getenv("REDIS_URL", "redis://redis:6379/0"))
        Queue(connection=conn).enqueue_in(timedelta(seconds=POLL_INTERVAL_SECONDS), sync_ingest_fires)
