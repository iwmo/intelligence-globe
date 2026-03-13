"""
Ships API routes.

Mounted at /api/ships by main.py.
Provides vessel positions ingested from aisstream.io via the AIS worker.

Endpoint order matters: /{mmsi} must be last so literal paths are matched first.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.models.ship import Ship
from app.freshness import stale_cutoff, is_stale
from app.config import settings

router = APIRouter()


@router.get("")
@router.get("/")
async def list_ships(db: AsyncSession = Depends(get_db)):
    """Return fresh, active ships with freshness metadata."""
    cutoff = stale_cutoff(settings.SHIP_STALE_SECONDS)
    result = await db.execute(
        select(Ship).where(
            Ship.is_active == True,
            Ship.latitude.is_not(None),
            Ship.longitude.is_not(None),
            Ship.last_seen_at >= cutoff,
        )
    )
    rows = result.scalars().all()
    return [
        {
            "mmsi": r.mmsi,
            "vessel_name": r.vessel_name,
            "vessel_type": r.vessel_type,
            "lat": r.latitude,
            "lon": r.longitude,
            "sog": r.sog,
            "cog": r.cog,
            "heading": r.true_heading,
            "nav_status": r.nav_status,
            "last_update": r.last_update,
            "updated_at": r.updated_at.isoformat() if r.updated_at else None,
            "last_seen_at": r.last_seen_at.isoformat() if r.last_seen_at else None,
            "fetched_at": None,  # Ship model has no fetched_at column — AIS is a stream, not polled
            "is_stale": is_stale(r.last_seen_at, settings.SHIP_STALE_SECONDS),
        }
        for r in rows
    ]


@router.get("/{mmsi}")
async def get_ship(mmsi: str, db: AsyncSession = Depends(get_db)):
    """Return full ship record; raise 404 if MMSI not found."""
    result = await db.execute(select(Ship).where(Ship.mmsi == mmsi))
    ship = result.scalar_one_or_none()
    if ship is None:
        raise HTTPException(status_code=404, detail="Ship not found")
    return {
        "mmsi": ship.mmsi,
        "vessel_name": ship.vessel_name,
        "vessel_type": ship.vessel_type,
        "lat": ship.latitude,
        "lon": ship.longitude,
        "sog": ship.sog,
        "cog": ship.cog,
        "heading": ship.true_heading,
        "nav_status": ship.nav_status,
        "last_update": ship.last_update,
        "updated_at": ship.updated_at.isoformat() if ship.updated_at else None,
    }
