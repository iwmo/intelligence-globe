"""
Aircraft ingest worker helpers.

upsert_aircraft: Parse one OpenSky state vector, skip if position is null,
                 upsert into the aircraft table with updated trail.

build_new_trail: Append a new position point to the existing trail list,
                 capping the result at 20 entries (oldest dropped first).

These functions are the unit-testable core of the ingest task.
The full RQ worker wrapper (Plan 02) will call upsert_aircraft in a loop.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.dialects.postgresql import insert as pg_insert

from app.models.aircraft import Aircraft

# Maximum number of trail entries to keep per aircraft
TRAIL_MAX = 20


def build_new_trail(existing: list[dict], new_point: dict) -> list[dict]:
    """Return a new trail list with new_point appended, capped at TRAIL_MAX.

    Args:
        existing: Current trail list (oldest first, newest last).
        new_point: Dict with keys lon, lat, alt, ts.

    Returns:
        New trail list with at most TRAIL_MAX entries, newest last.
    """
    combined = list(existing) + [new_point]
    if len(combined) > TRAIL_MAX:
        combined = combined[len(combined) - TRAIL_MAX:]
    return combined


async def upsert_aircraft(
    db: AsyncSession,
    sv: list[Any],
    fetched_at: datetime,
    last_seen_at: datetime,
) -> None:
    """Parse an OpenSky state vector and upsert into the aircraft table.

    Skips the row and returns None immediately if longitude (sv[5]) or
    latitude (sv[6]) is None — aircraft without a position are not useful
    for the globe visualization.

    The caller (ingest_aircraft task) owns the session commit.
    This function does NOT call db.commit().

    Args:
        db: Async SQLAlchemy session.
        sv: OpenSky state vector list (17 elements, but shorter vectors are
            handled gracefully — missing fields default to None).
        fetched_at: Datetime representing the OpenSky response `time` field.
        last_seen_at: Datetime representing the ingest timestamp (now UTC).

    Returns:
        None always (fire-and-forget upsert).
    """
    longitude = sv[5] if len(sv) > 5 else None
    latitude = sv[6] if len(sv) > 6 else None

    # Skip aircraft with no known position
    if longitude is None or latitude is None:
        return None

    icao24: str = sv[0]
    callsign: str | None = sv[1].strip() if sv[1] else None
    origin_country: str | None = sv[2] if len(sv) > 2 else None
    last_contact: int | None = sv[4] if len(sv) > 4 else None
    baro_altitude: float | None = sv[7] if len(sv) > 7 else None
    on_ground: bool = bool(sv[8]) if len(sv) > 8 and sv[8] is not None else False
    velocity: float | None = sv[9] if len(sv) > 9 else None
    true_track: float | None = sv[10] if len(sv) > 10 else None

    # New fields — length-guarded to handle short state vectors
    time_position: int | None = sv[3] if len(sv) > 3 else None
    vertical_rate: float | None = sv[11] if len(sv) > 11 else None
    geo_altitude: float | None = sv[13] if len(sv) > 13 else None
    position_source: int | None = sv[16] if len(sv) > 16 else None

    new_point = {
        "lon": longitude,
        "lat": latitude,
        "alt": baro_altitude,
        "ts": last_contact,
    }

    # Fetch existing trail to append to it
    from sqlalchemy import select
    result = await db.execute(
        select(Aircraft.trail).where(Aircraft.icao24 == icao24)
    )
    existing_row = result.one_or_none()
    existing_trail: list[dict] = existing_row[0] if existing_row else []
    if existing_trail is None:
        existing_trail = []

    new_trail = build_new_trail(existing_trail, new_point)

    stmt = (
        pg_insert(Aircraft)
        .values(
            icao24=icao24,
            callsign=callsign,
            origin_country=origin_country,
            longitude=longitude,
            latitude=latitude,
            baro_altitude=baro_altitude,
            on_ground=on_ground,
            velocity=velocity,
            true_track=true_track,
            last_contact=last_contact,
            trail=new_trail,
            time_position=time_position,
            vertical_rate=vertical_rate,
            geo_altitude=geo_altitude,
            position_source=position_source,
            fetched_at=fetched_at,
            last_seen_at=last_seen_at,
            is_active=True,
        )
        .on_conflict_do_update(
            index_elements=["icao24"],
            set_=dict(
                callsign=callsign,
                origin_country=origin_country,
                longitude=longitude,
                latitude=latitude,
                baro_altitude=baro_altitude,
                on_ground=on_ground,
                velocity=velocity,
                true_track=true_track,
                last_contact=last_contact,
                trail=new_trail,
                time_position=time_position,
                vertical_rate=vertical_rate,
                geo_altitude=geo_altitude,
                position_source=position_source,
                fetched_at=fetched_at,
                last_seen_at=last_seen_at,
                is_active=True,
            ),
        )
    )
    await db.execute(stmt)
    # NOTE: No commit here — the caller (ingest_aircraft task) owns the commit.
    return None
