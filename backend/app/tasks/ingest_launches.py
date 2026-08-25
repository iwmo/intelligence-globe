from __future__ import annotations

import asyncio
import logging
import os
from datetime import datetime, timedelta, timezone

import httpx
from sqlalchemy.dialects.postgresql import insert as pg_insert

from app.config import settings
from app.db import AsyncSessionLocal
from app.models.launch import Launch

logger = logging.getLogger(__name__)

LL2_URL = "https://ll.thespacedevs.com/2.2.0/launch/upcoming/?limit=25"
POLL_INTERVAL_SECONDS = 1800


def parse_ll2_launch(item: dict, fetched_at: datetime) -> dict | None:
    ll2_id = str(item.get("id") or "").strip()
    name = (item.get("name") or "").strip()
    if not ll2_id or not name:
        return None
    raw_pad = item.get("pad")
    pad = raw_pad if isinstance(raw_pad, dict) else {}
    raw_status = item.get("status")
    status = raw_status if isinstance(raw_status, dict) else {}
    pad_name = pad.get("name") if pad else (raw_pad if isinstance(raw_pad, str) else None)
    net_raw = item.get("net")
    net = None
    if isinstance(net_raw, str) and net_raw:
        try:
            net = datetime.fromisoformat(net_raw.replace("Z", "+00:00"))
        except ValueError:
            net = None
    lat = pad.get("latitude")
    lon = pad.get("longitude")
    return {
        "ll2_id": ll2_id,
        "name": name,
        "net": net,
        "status": (status.get("abbrev") or status.get("name") or (raw_status if isinstance(raw_status, str) else None)),
        "pad_name": pad_name,
        "latitude": float(lat) if lat not in (None, "") else None,
        "longitude": float(lon) if lon not in (None, "") else None,
        "fetched_at": fetched_at,
    }


async def ingest_launches() -> int:
    headers = {}
    if settings.ll2_api_token:
        headers["Authorization"] = f"Token {settings.ll2_api_token}"
    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.get(LL2_URL, headers=headers)
        resp.raise_for_status()
        data = resp.json()

    fetched_at = datetime.now(timezone.utc)
    rows = []
    for item in data.get("results") or []:
        parsed = parse_ll2_launch(item, fetched_at)
        if parsed:
            rows.append(parsed)

    async with AsyncSessionLocal() as session:
        if rows:
            stmt = pg_insert(Launch).values(rows)
            stmt = stmt.on_conflict_do_update(
                index_elements=["ll2_id"],
                set_={
                    "name": stmt.excluded.name,
                    "net": stmt.excluded.net,
                    "status": stmt.excluded.status,
                    "pad_name": stmt.excluded.pad_name,
                    "latitude": stmt.excluded.latitude,
                    "longitude": stmt.excluded.longitude,
                    "fetched_at": stmt.excluded.fetched_at,
                },
            )
            await session.execute(stmt)
            await session.commit()

    logger.info("Upserted %d LL2 launches", len(rows))
    return len(rows)


def sync_ingest_launches() -> None:
    try:
        asyncio.run(ingest_launches())
    except Exception as exc:
        logger.exception("LL2 launch ingest failed: %s", exc)
        raise
    finally:
        from redis import Redis
        from rq import Queue

        conn = Redis.from_url(os.getenv("REDIS_URL", "redis://redis:6379/0"))
        Queue(connection=conn).enqueue_in(timedelta(seconds=POLL_INTERVAL_SECONDS), sync_ingest_launches)
