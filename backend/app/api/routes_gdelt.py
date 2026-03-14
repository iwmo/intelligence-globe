"""
GDELT events API routes.

Mounted at /api/gdelt-events by main.py.
Delivers GDELT-03 backend — the data infrastructure queried by the
frontend useGdeltEvents hook.

Filtering:
  - bbox: all 4 params (min_lat/max_lat/min_lon/max_lon) required for filter to
    activate — partial bbox silently ignored (VPC-08 pattern from Phase 33).
  - quad_class: optional integer filter (2=Material Cooperation, 3=Material Conflict,
    4=Verbal Conflict — filter class 1 Verbal Cooperation at ingest time).
  - since/until: optional datetime filters on occurred_at column.
"""
import logging
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.models.gdelt_event import GdeltEvent

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("")
@router.get("/")
async def list_gdelt_events(
    db: AsyncSession = Depends(get_db),
    min_lat: Optional[float] = Query(default=None),
    max_lat: Optional[float] = Query(default=None),
    min_lon: Optional[float] = Query(default=None),
    max_lon: Optional[float] = Query(default=None),
    quad_class: Optional[int] = Query(default=None),
    since: Optional[datetime] = Query(default=None),
    until: Optional[datetime] = Query(default=None),
):
    """Return GDELT events with optional bbox, quad_class, and time-range filtering.

    Bbox activates only when all 4 params (min_lat/max_lat/min_lon/max_lon) are
    provided — partial bbox is silently ignored (VPC-08 contract).
    """
    stmt = select(GdeltEvent).where(
        GdeltEvent.latitude.is_not(None),
        GdeltEvent.longitude.is_not(None),
    )

    if all(v is not None for v in (min_lat, max_lat, min_lon, max_lon)):
        stmt = stmt.where(
            GdeltEvent.latitude.between(min_lat, max_lat),
            GdeltEvent.longitude.between(min_lon, max_lon),
        )

    if quad_class is not None:
        stmt = stmt.where(GdeltEvent.quad_class == quad_class)

    if since is not None:
        stmt = stmt.where(GdeltEvent.occurred_at >= since)

    if until is not None:
        stmt = stmt.where(GdeltEvent.occurred_at <= until)

    result = await db.execute(stmt)
    rows = result.scalars().all()

    return [
        {
            "global_event_id": r.global_event_id,
            "occurred_at": r.occurred_at.isoformat(),
            "discovered_at": r.discovered_at.isoformat() if r.discovered_at else None,
            "latitude": r.latitude,
            "longitude": r.longitude,
            "quad_class": r.quad_class,
            "goldstein_scale": r.goldstein_scale,
            "event_code": r.event_code,
            "actor1_name": r.actor1_name,
            "actor2_name": r.actor2_name,
            "source_url": r.source_url,
            "avg_tone": r.avg_tone,
            "num_mentions": r.num_mentions,
            "source_is_stale": r.source_is_stale,
        }
        for r in rows
    ]
