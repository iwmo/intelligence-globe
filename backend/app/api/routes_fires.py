from fastapi import APIRouter, Query
from sqlalchemy import func, select

from app.config import settings
from app.db import AsyncSessionLocal
from app.freshness import is_stale
from app.models.fire_detection import FireDetection

router = APIRouter()


@router.get("/status")
async def fire_status():
    return {"available": bool(settings.firms_map_key)}


@router.get("")
@router.get("/")
async def list_fires(
    min_lat: float | None = Query(default=None),
    max_lat: float | None = Query(default=None),
    min_lon: float | None = Query(default=None),
    max_lon: float | None = Query(default=None),
):
    available = bool(settings.firms_map_key)
    if not available:
        return {"available": False, "fetched_at": None, "source_is_stale": True, "cells": []}

    async with AsyncSessionLocal() as session:
        newest = await session.scalar(select(func.max(FireDetection.fetched_at)))
        stmt = select(FireDetection)
        if all(v is not None for v in (min_lat, max_lat, min_lon, max_lon)):
            stmt = stmt.where(
                FireDetection.latitude.between(min_lat, max_lat),
                FireDetection.longitude.between(min_lon, max_lon),
            )
        stmt = stmt.limit(4000)
        rows = (await session.execute(stmt)).scalars().all()

    return {
        "available": True,
        "fetched_at": newest.isoformat() if newest else None,
        "source_is_stale": is_stale(newest, settings.FIRE_STALE_SECONDS),
        "cells": [
            {
                "id": r.id,
                "lat": r.latitude,
                "lon": r.longitude,
                "frp": r.frp,
                "confidence": r.confidence,
            }
            for r in rows
        ],
    }
