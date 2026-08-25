from fastapi import APIRouter
from fastapi.responses import JSONResponse
from redis.asyncio import Redis
from sqlalchemy import text
import app.db as db
from app.config import settings

router = APIRouter()


@router.get("/health")
async def health():
    return {"status": "ok", "version": settings.version}


@router.get("/ready")
async def ready():
    dependencies = {"database": False, "redis": False}
    try:
        async with db.engine.connect() as connection:
            await connection.execute(text("SELECT 1"))
        dependencies["database"] = True
    except Exception:
        pass

    redis = Redis.from_url(settings.redis_url, socket_connect_timeout=2, socket_timeout=2)
    try:
        dependencies["redis"] = bool(await redis.ping())
    except Exception:
        pass
    finally:
        await redis.aclose()

    ready_state = all(dependencies.values())
    payload = {
        "status": "ready" if ready_state else "unavailable",
        "version": settings.version,
        "dependencies": dependencies,
    }
    if ready_state:
        return payload
    return JSONResponse(status_code=503, content=payload)
