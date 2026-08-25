from fastapi import APIRouter
from sqlalchemy import func, select

from app.config import settings
from app.db import AsyncSessionLocal
from app.freshness import is_stale
from app.models.launch import Launch

router = APIRouter()


@router.get("")
@router.get("/")
async def list_launches():
    async with AsyncSessionLocal() as session:
        newest = await session.scalar(select(func.max(Launch.fetched_at)))
        rows = (await session.execute(select(Launch).order_by(Launch.net.asc().nulls_last()).limit(40))).scalars().all()

    return {
        "fetched_at": newest.isoformat() if newest else None,
        "source_is_stale": is_stale(newest, settings.LAUNCH_STALE_SECONDS),
        "launches": [
            {
                "id": r.ll2_id,
                "name": r.name,
                "net": r.net.isoformat() if r.net else None,
                "status": r.status,
                "pad": r.pad_name,
                "lat": r.latitude,
                "lon": r.longitude,
            }
            for r in rows
        ],
    }
