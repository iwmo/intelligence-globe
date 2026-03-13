"""
GPS Jamming API routes.

Exposes aggregated GPS jamming cell data from the gps_jamming_cells table.
Cells are produced by the ingest_gps_jamming RQ task (runs daily).

GET /api/gps-jamming → {
    "aggregated_at": str | null,
    "source_fetched_at": str | null,
    "source_is_stale": bool | null,
    "cells": GpsJammingCell[]
}
"""
from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.models.gps_jamming import GpsJammingCell

router = APIRouter()


@router.get("")
@router.get("/")
async def list_gps_jamming_cells(db: AsyncSession = Depends(get_db)):
    """Return gps_jamming_cells with freshness metadata envelope.

    JAM-03: When military source data is stale, cells are returned with
    source_is_stale=True rather than an empty set. This is intentional —
    an empty response silently converts a staleness event into a blank
    globe layer. The ingest layer (JAM-01) writes source_is_stale=True
    to every stored cell when the military feed is stale; the route simply
    surfaces what the DB holds. Do NOT add a staleness WHERE filter here.
    """
    result = await db.execute(select(GpsJammingCell))
    cells = result.scalars().all()

    # All cells in a batch share the same metadata — lift from first row.
    # Guard with None when table is empty (test env or before first ingest run).
    first = cells[0] if cells else None
    return {
        "aggregated_at": first.aggregated_at.isoformat() if first and first.aggregated_at else None,
        "source_fetched_at": first.source_fetched_at.isoformat() if first and first.source_fetched_at else None,
        "source_is_stale": first.source_is_stale if first is not None else None,
        "cells": [
            {
                "h3index": c.h3index,
                "bad_ratio": c.bad_ratio,
                "severity": c.severity,
                "aircraft_count": c.aircraft_count,
                "updated_at": c.updated_at.isoformat() if c.updated_at else None,
            }
            for c in cells
        ],
    }
