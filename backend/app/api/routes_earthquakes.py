from datetime import datetime, timezone

from fastapi import APIRouter, Query
from sqlalchemy import func, select

from app.config import settings
from app.db import AsyncSessionLocal
from app.freshness import is_stale
from app.models.earthquake import Earthquake

router = APIRouter()


@router.get("")
@router.get("/")
async def list_earthquakes(
    min_lat: float | None = Query(default=None),
    max_lat: float | None = Query(default=None),
    min_lon: float | None = Query(default=None),
    max_lon: float | None = Query(default=None),
    min_mag: float | None = Query(default=None),
):
    async with AsyncSessionLocal() as session:
        newest = await session.scalar(select(func.max(Earthquake.fetched_at)))
        stmt = select(Earthquake)
        if all(v is not None for v in (min_lat, max_lat, min_lon, max_lon)):
            stmt = stmt.where(
                Earthquake.latitude.between(min_lat, max_lat),
                Earthquake.longitude.between(min_lon, max_lon),
            )
        if min_mag is not None:
            stmt = stmt.where(Earthquake.magnitude >= min_mag)
        stmt = stmt.order_by(Earthquake.occurred_at.desc()).limit(800)
        rows = (await session.execute(stmt)).scalars().all()

    stale = is_stale(newest, settings.EARTHQUAKE_STALE_SECONDS)
    return {
        "fetched_at": newest.isoformat() if newest else None,
        "source_is_stale": stale,
        "events": [
            {
                "id": r.usgs_id,
                "occurred_at": r.occurred_at.isoformat() if r.occurred_at else None,
                "lat": r.latitude,
                "lon": r.longitude,
                "depth_km": r.depth_km,
                "mag": r.magnitude,
                "place": r.place,
                "url": r.url,
            }
            for r in rows
        ],
    }
