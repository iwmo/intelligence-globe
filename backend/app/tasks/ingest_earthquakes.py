from __future__ import annotations

import asyncio
import logging
import os
from datetime import datetime, timedelta, timezone

import httpx
from sqlalchemy import delete
from sqlalchemy.dialects.postgresql import insert as pg_insert

from app.db import AsyncSessionLocal
from app.models.earthquake import Earthquake

logger = logging.getLogger(__name__)

USGS_URL = "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson"
POLL_INTERVAL_SECONDS = 300


def parse_usgs_feature(feature: dict) -> dict | None:
    props = feature.get("properties") or {}
    geom = feature.get("geometry") or {}
    coords = geom.get("coordinates") or []
    usgs_id = str(feature.get("id") or "").strip()
    if not usgs_id or len(coords) < 2:
        return None
    lon, lat = coords[0], coords[1]
    if lat is None or lon is None:
        return None
    time_ms = props.get("time")
    occurred_at = (
        datetime.fromtimestamp(time_ms / 1000, tz=timezone.utc)
        if isinstance(time_ms, (int, float))
        else datetime.now(timezone.utc)
    )
    return {
        "usgs_id": usgs_id,
        "occurred_at": occurred_at,
        "latitude": float(lat),
        "longitude": float(lon),
        "depth_km": float(coords[2]) if len(coords) > 2 and coords[2] is not None else None,
        "magnitude": props.get("mag"),
        "place": props.get("place"),
        "url": props.get("url"),
    }


async def ingest_earthquakes() -> int:
    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.get(USGS_URL)
        resp.raise_for_status()
        data = resp.json()

    fetched_at = datetime.now(timezone.utc)
    rows = []
    for feature in data.get("features") or []:
        parsed = parse_usgs_feature(feature)
        if parsed:
            parsed["fetched_at"] = fetched_at
            rows.append(parsed)

    async with AsyncSessionLocal() as session:
        if rows:
            stmt = pg_insert(Earthquake).values(rows)
            stmt = stmt.on_conflict_do_update(
                index_elements=["usgs_id"],
                set_={
                    "occurred_at": stmt.excluded.occurred_at,
                    "latitude": stmt.excluded.latitude,
                    "longitude": stmt.excluded.longitude,
                    "depth_km": stmt.excluded.depth_km,
                    "magnitude": stmt.excluded.magnitude,
                    "place": stmt.excluded.place,
                    "url": stmt.excluded.url,
                    "fetched_at": stmt.excluded.fetched_at,
                },
            )
            await session.execute(stmt)
        cutoff = fetched_at - timedelta(hours=48)
        await session.execute(delete(Earthquake).where(Earthquake.occurred_at < cutoff))
        await session.commit()

    logger.info("Upserted %d USGS earthquakes", len(rows))
    return len(rows)


def sync_ingest_earthquakes() -> None:
    try:
        asyncio.run(ingest_earthquakes())
    except Exception as exc:
        logger.exception("USGS earthquake ingest failed: %s", exc)
        raise
    finally:
        from redis import Redis
        from rq import Queue

        conn = Redis.from_url(os.getenv("REDIS_URL", "redis://redis:6379/0"))
        Queue(connection=conn).enqueue_in(
            timedelta(seconds=POLL_INTERVAL_SECONDS), sync_ingest_earthquakes
        )
