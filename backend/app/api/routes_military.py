"""
Military aircraft API routes.

Mounted at /api/military by main.py.
Delivers LAY-01 backend — the data infrastructure queried by the
frontend MilitaryAircraftLayer.

Response keys use short names (lat/lon) to match the test contract
and keep payloads compact for the frontend.
"""
import logging

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.models.military_aircraft import MilitaryAircraft
from app.freshness import stale_cutoff, is_stale
from app.config import settings

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("")
@router.get("/")
async def list_military_aircraft(db: AsyncSession = Depends(get_db)):
    """Return fresh, active military aircraft with freshness metadata."""
    cutoff = stale_cutoff(settings.MILITARY_STALE_SECONDS)
    result = await db.execute(
        select(MilitaryAircraft).where(
            MilitaryAircraft.is_active == True,
            MilitaryAircraft.latitude.is_not(None),
            MilitaryAircraft.longitude.is_not(None),
            MilitaryAircraft.fetched_at >= cutoff,
        )
    )
    rows = result.scalars().all()
    return [
        {
            "hex": r.hex,
            "flight": r.flight,
            "aircraft_type": r.aircraft_type,
            "alt_baro": r.alt_baro,
            "gs": r.gs,
            "track": r.track,
            "lat": r.latitude,
            "lon": r.longitude,
            "squawk": r.squawk,
            "updated_at": r.updated_at.isoformat() if r.updated_at else None,
            "fetched_at": r.fetched_at.isoformat() if r.fetched_at else None,
            "is_stale": is_stale(r.fetched_at, settings.MILITARY_STALE_SECONDS),
        }
        for r in rows
    ]


@router.get("/{hex}")
async def get_military_aircraft(hex: str, db: AsyncSession = Depends(get_db)):
    """Return full military aircraft record; raise 404 if hex not found."""
    result = await db.execute(
        select(MilitaryAircraft).where(MilitaryAircraft.hex == hex)
    )
    aircraft = result.scalar_one_or_none()
    if aircraft is None:
        raise HTTPException(status_code=404, detail="Military aircraft not found")

    return {
        "hex": aircraft.hex,
        "flight": aircraft.flight,
        "aircraft_type": aircraft.aircraft_type,
        "registration": aircraft.registration,
        "alt_baro": aircraft.alt_baro,
        "gs": aircraft.gs,
        "track": aircraft.track,
        "lat": aircraft.latitude,
        "lon": aircraft.longitude,
        "squawk": aircraft.squawk,
        "updated_at": aircraft.updated_at.isoformat() if aircraft.updated_at else None,
    }
