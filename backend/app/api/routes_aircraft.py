"""
Aircraft API routes.

Mounted at /api/aircraft by main.py.
Endpoint order matters: /freshness must be defined before /{icao24}
so FastAPI matches the literal path "freshness" before treating it as a string.
/{icao24}/route uses a longer path so it is always distinguished from /{icao24}.
"""
import logging

import httpx
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.models.aircraft import Aircraft

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("")
@router.get("/")
async def list_aircraft(db: AsyncSession = Depends(get_db)):
    """Return all aircraft with valid positions, including trail for frontend polylines."""
    result = await db.execute(
        select(Aircraft).where(
            Aircraft.latitude.is_not(None),
            Aircraft.longitude.is_not(None),
        )
    )
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
    }
