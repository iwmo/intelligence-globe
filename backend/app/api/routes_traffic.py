import asyncio

import httpx
import redis
from fastapi import APIRouter, HTTPException, Query

from app.config import settings
from app.lib.geo_budget import (
    clamp_bbox,
    congestion_bucket,
    congestion_ratio,
    sample_grid,
    utc_day_key,
)

router = APIRouter()

TOMTOM_FLOW = "https://api.tomtom.com/traffic/services/4/flowSegmentData/relative0/10/json"


@router.get("/status")
async def traffic_status():
    live = bool(settings.tomtom_api_key)
    return {
        "available": True,
        "mode": "live" if live else "sim",
        "provider": "tomtom" if live else "osm-sim",
    }


def _budget_ok() -> bool:
    limit = settings.tomtom_daily_sample_budget
    if limit <= 0:
        return True
    try:
        client = redis.Redis.from_url(settings.redis_url, socket_timeout=1)
        key = f"tomtom:samples:{utc_day_key()}"
        used = int(client.get(key) or 0)
        return used < limit
    except redis.RedisError:
        return True


def _budget_incr(n: int) -> None:
    if n <= 0:
        return
    try:
        client = redis.Redis.from_url(settings.redis_url, socket_timeout=1)
        key = f"tomtom:samples:{utc_day_key()}"
        pipe = client.pipeline()
        pipe.incrby(key, n)
        pipe.expire(key, 172_800)
        pipe.execute()
    except redis.RedisError:
        return


async def _flow_point(client: httpx.AsyncClient, lat: float, lon: float) -> dict:
    res = await client.get(
        TOMTOM_FLOW,
        params={"point": f"{lat},{lon}", "unit": "KMPH", "key": settings.tomtom_api_key},
    )
    res.raise_for_status()
    data = (res.json() or {}).get("flowSegmentData") or {}
    current = data.get("currentSpeed")
    free = data.get("freeFlowSpeed")
    closed = bool(data.get("roadClosure"))
    ratio = congestion_ratio(
        float(current) if isinstance(current, (int, float)) else None,
        float(free) if isinstance(free, (int, float)) else None,
    )
    return {
        "lat": lat,
        "lon": lon,
        "current_kmh": current,
        "free_kmh": free,
        "closed": closed,
        "ratio": ratio,
        "bucket": congestion_bucket(ratio, closed),
    }


@router.get("/flow")
async def traffic_flow(
    min_lat: float = Query(...),
    max_lat: float = Query(...),
    min_lon: float = Query(...),
    max_lon: float = Query(...),
):
    if not settings.tomtom_api_key:
        return {"mode": "sim", "samples": [], "provider": "osm-sim"}
    if not _budget_ok():
        return {"mode": "sim", "samples": [], "provider": "tomtom", "budget": "exhausted"}

    south, north, west, east = clamp_bbox(min_lat, max_lat, min_lon, max_lon)
    points = sample_grid(south, north, west, east, n=3)

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            samples = await asyncio.gather(*(_flow_point(client, lat, lon) for lat, lon in points))
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"TomTom unreachable: {exc}") from exc

    _budget_incr(len(samples))
    return {
        "mode": "live",
        "samples": list(samples),
        "provider": "tomtom",
        "bbox": {"minLat": south, "maxLat": north, "minLon": west, "maxLon": east},
    }
