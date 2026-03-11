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
) -> None:
    """Parse an OpenSky state vector and upsert into the aircraft table.

    Skips the row and returns None immediately if longitude (sv[5]) or
    latitude (sv[6]) is None — aircraft without a position are not useful
    for the globe visualization.

    Args:
        db: Async SQLAlchemy session.
        sv: OpenSky state vector list (17 elements).

    Returns:
        None always (fire-and-forget upsert).
    """
    longitude = sv[5]
    latitude = sv[6]

    # Skip aircraft with no known position
    if longitude is None or latitude is None:
        return None

    icao24: str = sv[0]
    callsign: str | None = sv[1].strip() if sv[1] else None
    origin_country: str | None = sv[2]
    last_contact: int | None = sv[4]
    baro_altitude: float | None = sv[7]
    on_ground: bool = bool(sv[8]) if sv[8] is not None else False
    velocity: float | None = sv[9]
    true_track: float | None = sv[10]

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
            ),
        )
    )
    await db.execute(stmt)
    await db.commit()
    return None
