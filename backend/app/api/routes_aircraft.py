"""
Aircraft API routes.

Mounted at /api/aircraft by main.py.
Endpoint order matters: /freshness must be defined before /{icao24}
so FastAPI matches the literal path "freshness" before treating it as a string.
/{icao24}/route uses a longer path so it is always distinguished from /{icao24}.
"""
import logging
import time as time_module

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Optional
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.freshness import stale_cutoff, is_stale
from app.config import settings
from app.models.aircraft import Aircraft
from app.models.military_aircraft import MilitaryAircraft

logger = logging.getLogger(__name__)

router = APIRouter()


def _position_age_seconds(r: Aircraft) -> "float | None":
    """Use time_position for position age, fall back to last_contact when null."""
    ref_ts = r.time_position if r.time_position is not None else r.last_contact
    if ref_ts is None:
        return None
    return time_module.time() - ref_ts


@router.get("")
@router.get("/")
async def list_aircraft(
    db: AsyncSession = Depends(get_db),
    min_lat: Optional[float] = Query(default=None),
    max_lat: Optional[float] = Query(default=None),
    min_lon: Optional[float] = Query(default=None),
    max_lon: Optional[float] = Query(default=None),
):
    """Return fresh, active aircraft with valid positions and freshness metadata.

    Optional bbox params (all four required for filtering to activate):
      min_lat, max_lat, min_lon, max_lon (degrees, float).
    When absent or incomplete, the full global dataset is returned.
    IDL crossing (min_lon > max_lon) is detected by the frontend before calling;
    if somehow received here, the BETWEEN clause would be a no-op — handled client-side.
    """
    cutoff = stale_cutoff(settings.AIRCRAFT_STALE_SECONDS)
    mil_hexes = select(MilitaryAircraft.hex)
    stmt = select(Aircraft).where(
        Aircraft.is_active == True,
        Aircraft.latitude.is_not(None),
        Aircraft.longitude.is_not(None),
        Aircraft.fetched_at >= cutoff,
        Aircraft.icao24.not_in(mil_hexes),
    )
    if all(v is not None for v in (min_lat, max_lat, min_lon, max_lon)):
        stmt = stmt.where(
            Aircraft.latitude.between(min_lat, max_lat),
            Aircraft.longitude.between(min_lon, max_lon),
        )
    result = await db.execute(stmt)
    rows = result.scalars().all()
    return [
        {
            "icao24": r.icao24,
            "callsign": r.callsign,
            "origin_country": r.origin_country,
            "latitude": r.latitude,
            "longitude": r.longitude,
            "baro_altitude": r.baro_altitude,
            "velocity": r.velocity,
            "true_track": r.true_track,
            "trail": r.trail,
            "time_position": r.time_position,
            "fetched_at": r.fetched_at.isoformat() if r.fetched_at else None,
            "is_stale": is_stale(r.fetched_at, settings.AIRCRAFT_STALE_SECONDS),
            "position_age_seconds": _position_age_seconds(r),
            "geo_altitude": r.geo_altitude,
            "vertical_rate": r.vertical_rate,
            "position_source": r.position_source,
            "roll": r.roll,
        }
        for r in rows
    ]


@router.get("/freshness")
async def aircraft_freshness(db: AsyncSession = Depends(get_db)):
    """Return the most recent updated_at timestamp across all aircraft rows."""
    result = await db.execute(select(func.max(Aircraft.updated_at)))
    max_ts = result.scalar_one_or_none()
    return {"last_updated": max_ts.isoformat() if max_ts else None}


@router.get("/{icao24}/route")
async def get_aircraft_route(icao24: str, db: AsyncSession = Depends(get_db)):
    """Return origin/destination airports with full names for an aircraft.

    Uses adsbdb.com (free, no key) looked up by callsign.
    Returns structured airport objects with name, IATA code, city, and country,
    or null for each field when no route data exists (cargo/GA/military/private).
    Degrades gracefully — never a 500.
    """
    # Look up the callsign from the database
    result = await db.execute(select(Aircraft).where(Aircraft.icao24 == icao24))
    aircraft = result.scalar_one_or_none()

    callsign = aircraft.callsign.strip() if aircraft and aircraft.callsign else None
    if not callsign:
        return {"origin": None, "destination": None}

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                f"https://api.adsbdb.com/v0/callsign/{callsign}",
                headers={"Accept": "application/json"},
            )

        if resp.status_code == 404:
            return {"origin": None, "destination": None}

        resp.raise_for_status()
        data = resp.json()
        route = data.get("response", {}).get("flightroute")
        if not route:
            return {"origin": None, "destination": None}

        def format_airport(airport: dict | None) -> dict | None:
            if not airport:
                return None
            return {
                "icao": airport.get("icao_code"),
                "iata": airport.get("iata_code"),
                "name": airport.get("name"),
                "city": airport.get("municipality"),
                "country": airport.get("country_name"),
            }

        return {
            "origin": format_airport(route.get("origin")),
            "destination": format_airport(route.get("destination")),
        }

    except Exception as exc:
        logger.warning("Failed to fetch route for %s (callsign=%s): %s", icao24, callsign, exc)
        return {"origin": None, "destination": None}


@router.get("/{icao24}")
async def get_aircraft(icao24: str, db: AsyncSession = Depends(get_db)):
    """Return full aircraft record; raise 404 if ICAO24 not found."""
    result = await db.execute(
        select(Aircraft).where(Aircraft.icao24 == icao24)
    )
    aircraft = result.scalar_one_or_none()
    if aircraft is None:
        raise HTTPException(status_code=404, detail="Aircraft not found")

    return {
        "icao24": aircraft.icao24,
        "callsign": aircraft.callsign,
        "origin_country": aircraft.origin_country,
        "latitude": aircraft.latitude,
        "longitude": aircraft.longitude,
        "baro_altitude": aircraft.baro_altitude,
        "on_ground": aircraft.on_ground,
        "velocity": aircraft.velocity,
        "true_track": aircraft.true_track,
        "last_contact": aircraft.last_contact,
        "trail": aircraft.trail,
        "updated_at": aircraft.updated_at.isoformat() if aircraft.updated_at else None,
        "emergency": aircraft.emergency,
        "nav_modes": aircraft.nav_modes,
        "ias": aircraft.ias,
        "tas": aircraft.tas,
        "mach": aircraft.mach,
        "registration": aircraft.registration,
        "type_code": aircraft.type_code,
        "roll": aircraft.roll,
    }
