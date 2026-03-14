"""
OSINT Events API routes.

Mounted at /api/osint-events by main.py.
Provides GET (list) and POST (create) for open-source intelligence events
correlated with globe layers.

Category validation is done in the route handler (not Pydantic) so that
invalid categories return 422 rather than a 422 Pydantic validation error
with an ambiguous message.
"""
import datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, field_validator
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import verify_api_key
from app.db import get_db
from app.models.osint_event import OsintEvent

router = APIRouter()

VALID_CATEGORIES = {"KINETIC", "AIRSPACE", "MARITIME", "SEISMIC", "JAMMING"}


class OsintEventCreate(BaseModel):
    ts: Any  # accepts datetime ISO string OR milliseconds epoch int
    category: str
    label: str
    latitude: float | None = None
    longitude: float | None = None
    source_url: str | None = None

    @field_validator("ts", mode="before")
    @classmethod
    def coerce_ts(cls, v: Any) -> datetime.datetime:
        """Accept ISO datetime string or Unix milliseconds integer."""
        if isinstance(v, datetime.datetime):
            return v
        if isinstance(v, (int, float)):
            # Treat as Unix milliseconds
            return datetime.datetime.fromtimestamp(v / 1000.0, tz=datetime.timezone.utc)
        if isinstance(v, str):
            return datetime.datetime.fromisoformat(v)
        raise ValueError(f"Cannot coerce ts value: {v!r}")

    @field_validator("category", mode="before")
    @classmethod
    def validate_category(cls, v: str) -> str:
        if v not in VALID_CATEGORIES:
            raise ValueError(
                f"category must be one of {sorted(VALID_CATEGORIES)}, got {v!r}"
            )
        return v


def _event_dict(event: OsintEvent) -> dict:
    return {
        "id": event.id,
        "ts": event.ts.isoformat() if event.ts else None,
        "category": event.category,
        "label": event.label,
        "latitude": event.latitude,
        "longitude": event.longitude,
        "source_url": event.source_url,
    }


@router.get("")
async def list_events(db: AsyncSession = Depends(get_db)):
    """Return all OSINT events ordered by ts ascending."""
    result = await db.execute(select(OsintEvent).order_by(OsintEvent.ts))
    rows = result.scalars().all()
    return {"events": [_event_dict(r) for r in rows]}


@router.post("", dependencies=[Depends(verify_api_key)], status_code=201)
async def create_event(body: OsintEventCreate, db: AsyncSession = Depends(get_db)):
    """Create a new OSINT event. Returns the created event with its id."""
    event = OsintEvent(
        ts=body.ts,
        category=body.category,
        label=body.label,
        latitude=body.latitude,
        longitude=body.longitude,
        source_url=body.source_url,
    )
    db.add(event)
    await db.commit()
    await db.refresh(event)
    return _event_dict(event)
