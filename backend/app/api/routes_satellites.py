"""
Satellite API routes.

Mounted at /api/satellites by main.py.
Endpoint order matters: /freshness must be defined before /{norad_cat_id}
so FastAPI matches the literal path "freshness" before treating it as an int.
"""
from math import pi, sqrt

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.models.satellite import Satellite

router = APIRouter()


_OMM_PROPAGATION_KEYS = {
    "EPOCH", "MEAN_MOTION", "ECCENTRICITY", "INCLINATION",
    "RA_OF_ASC_NODE", "ARG_OF_PERICENTER", "MEAN_ANOMALY",
    "BSTAR", "MEAN_MOTION_DOT", "MEAN_MOTION_DDOT", "OBJECT_NAME",
}

# LEO threshold: mean_motion >= 11.25 rev/day ≈ altitude < 2000 km
_LEO_MIN_MEAN_MOTION = 11.25


@router.get("")
@router.get("/")
async def list_satellites(db: AsyncSession = Depends(get_db)):
    """Return LEO-only satellites with propagation-essential OMM fields only."""
    result = await db.execute(
        select(Satellite.norad_cat_id, Satellite.raw_omm).where(
            Satellite.mean_motion >= _LEO_MIN_MEAN_MOTION
        )
    )
    rows = result.all()
    return [
        {
            "norad_cat_id": r.norad_cat_id,
            "omm": {k: v for k, v in r.raw_omm.items() if k in _OMM_PROPAGATION_KEYS},
        }
        for r in rows
    ]


@router.get("/freshness")
async def tle_freshness(db: AsyncSession = Depends(get_db)):
    """Return the most recent updated_at timestamp across all satellite rows."""
    result = await db.execute(select(func.max(Satellite.updated_at)))
    max_ts = result.scalar_one_or_none()
    return {"last_updated": max_ts.isoformat() if max_ts else None}


@router.get("/{norad_cat_id}")
async def get_satellite(norad_cat_id: int, db: AsyncSession = Depends(get_db)):
    """Return full satellite metadata, including derived altitude and velocity."""
    result = await db.execute(
        select(Satellite).where(Satellite.norad_cat_id == norad_cat_id)
    )
    satellite = result.scalar_one_or_none()
    if satellite is None:
        raise HTTPException(status_code=404, detail="Satellite not found")

    # Derive orbital parameters using vis-viva equation
    mu = 398600.4418  # Earth gravitational parameter (km^3/s^2)
    re = 6371.0       # Earth mean radius (km)
    n_rad_s = satellite.mean_motion * 2 * pi / 86400  # rev/day → rad/s
    a = (mu / n_rad_s ** 2) ** (1 / 3)               # semi-major axis (km)
    altitude_km = round(a - re, 1)
    velocity_km_s = round(sqrt(mu / a), 3)

    return {
        "norad_cat_id": satellite.norad_cat_id,
        "object_name": satellite.object_name,
        "constellation": satellite.constellation,
        "epoch": satellite.epoch,
        "altitude_km": altitude_km,
        "velocity_km_s": velocity_km_s,
        "inclination": satellite.inclination,
        "eccentricity": satellite.eccentricity,
        "tle_updated_at": (
            satellite.updated_at.isoformat() if satellite.updated_at else None
        ),
    }
