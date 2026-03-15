"""
Viewport bounds endpoint.

The frontend pushes its current camera bounding box here whenever the view
changes.  The aircraft ingest worker reads this key from Redis before each
OpenSky poll so it can query only the visible region, drastically reducing
credit consumption.
"""
from __future__ import annotations

from fastapi import APIRouter
from pydantic import BaseModel

import redis.asyncio as aioredis
from app.config import settings

router = APIRouter()

VIEWPORT_REDIS_KEY = "globe:viewport_bbox"


class ViewportBounds(BaseModel):
    min_lat: float
    max_lat: float
    min_lon: float
    max_lon: float


@router.put("/viewport-bounds", status_code=204)
async def update_viewport_bounds(bounds: ViewportBounds) -> None:
    """Store the current viewport bbox in Redis for the ingest worker."""
    client = aioredis.from_url(settings.redis_url)
    try:
        value = f"{bounds.min_lat},{bounds.min_lon},{bounds.max_lat},{bounds.max_lon}"
        await client.set(VIEWPORT_REDIS_KEY, value, ex=300)  # 5-min TTL
    finally:
        await client.aclose()
