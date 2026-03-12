"""
GPS Jamming API routes.

Exposes aggregated GPS jamming cell data from the gps_jamming_cells table.
Cells are produced by the ingest_gps_jamming RQ task (runs daily).

GET /api/gps-jamming → { "cells": GpsJammingCell[] }
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
    """Return all gps_jamming_cells as { cells: [...] }."""
    result = await db.execute(select(GpsJammingCell))
    cells = result.scalars().all()
    return {
        "cells": [
            {
                "h3index": c.h3index,
                "bad_ratio": c.bad_ratio,
                "severity": c.severity,
                "aircraft_count": c.aircraft_count,
                "updated_at": c.updated_at.isoformat() if c.updated_at else None,
            }
            for c in cells
        ]
    }
