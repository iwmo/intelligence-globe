"""
Aircraft API routes.

Mounted at /api/aircraft by main.py.
Endpoint order matters: /freshness must be defined before /{icao24}
so FastAPI matches the literal path "freshness" before treating it as a string.
/{icao24}/route uses a longer path so it is always distinguished from /{icao24}.
"""
import os
import time
import logging

import httpx
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.models.aircraft import Aircraft
from app.tasks.ingest_aircraft import fetch_opensky_token

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
async def get_aircraft_route(icao24: str):
    """Return estimated origin/destination airports for an aircraft.

    Calls the OpenSky flights/aircraft endpoint with a 2-hour lookback window.
    Credentials are read from OPENSKY_CLIENT_ID / OPENSKY_CLIENT_SECRET env vars.
    Returns {"origin": "EGLL", "destination": "KJFK"} or null for each field
    when the endpoint returns no data (common for cargo/GA/military flights).
    Returns {"origin": null, "destination": null} if credentials are absent or
    the API call fails — graceful degradation, never a 500.
    """
    client_id = os.environ.get("OPENSKY_CLIENT_ID")
    client_secret = os.environ.get("OPENSKY_CLIENT_SECRET")

    if not client_id or not client_secret:
        # Credentials not configured — return graceful null response
        return {"origin": None, "destination": None}

    now = int(time.time())
    begin = now - 7200  # 2-hour lookback

    try:
        token = await fetch_opensky_token(client_id, client_secret)
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(
                "https://opensky-network.org/api/flights/aircraft",
                params={"icao24": icao24, "begin": begin, "end": now},
                headers={"Authorization": f"Bearer {token}"},
            )

        if resp.status_code == 429:
            logger.warning("OpenSky rate-limited (429) on flights/aircraft for %s", icao24)
            return {"origin": None, "destination": None}

        resp.raise_for_status()
        flights = resp.json()

        if not flights:
            return {"origin": None, "destination": None}

        # Use the most recent flight record (last element)
        latest = flights[-1]
        return {
            "origin": latest.get("estDepartureAirport"),
            "destination": latest.get("estArrivalAirport"),
        }

    except Exception as exc:
        # Network error, auth failure, malformed response — degrade gracefully
        logger.warning("Failed to fetch route for %s: %s", icao24, exc)
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
