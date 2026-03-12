"""
Replay API routes — GET /api/replay/snapshots.

Returns position snapshots from the position_snapshots partitioned table
for a given layer and time range.  Used by Phase 11 replay engine to load
historical position data for playback.

Prefix is set in main.py as /api/replay, so route decorators use empty
string "" (not "/") matching the established project pattern.
"""
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.models.position_snapshot import PositionSnapshot

router = APIRouter()

VALID_LAYERS = {"aircraft", "military", "ship", "all"}


@router.get("")
async def get_snapshots(
    layer: str = Query("all"),
    start: datetime = Query(...),
    end: datetime = Query(...),
    limit: int = Query(10000, ge=1, le=100000),
    db: AsyncSession = Depends(get_db),
):
    """Return position snapshots for the given layer and time window.

    Args:
        layer: One of "aircraft", "military", "ship", or "all".
        start: ISO 8601 start timestamp (inclusive).
        end: ISO 8601 end timestamp (inclusive).
        limit: Maximum number of rows to return (default 10000, max 100000).
        db: Async database session (injected).

    Returns:
        JSON body with "snapshots" list and "count" integer.

    Raises:
        HTTPException 404: If layer is not a recognised value.
    """
    if layer not in VALID_LAYERS:
        raise HTTPException(status_code=404, detail=f"Unknown layer: {layer}")

    stmt = select(PositionSnapshot).where(
        PositionSnapshot.ts >= start,
        PositionSnapshot.ts <= end,
    )
    if layer != "all":
        stmt = stmt.where(PositionSnapshot.layer_type == layer)
    stmt = stmt.order_by(PositionSnapshot.ts).limit(limit)

    result = await db.execute(stmt)
    rows = result.scalars().all()

    return {
        "snapshots": [
            {
                "ts": r.ts.isoformat(),
                "layer_type": r.layer_type,
                "entity_id": r.entity_id,
                "latitude": r.latitude,
                "longitude": r.longitude,
                "altitude": r.altitude,
                "heading": r.heading,
                "speed": r.speed,
            }
            for r in rows
        ],
        "count": len(rows),
    }
