from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.db import init_db
from app.api.routes_health import router as health_router
from app.api.routes_satellites import router as satellites_router
from app.api.routes_aircraft import router as aircraft_router
from app.api.routes_ships import router as ships_router
from app.api.routes_military import router as military_router
from app.api.routes_gps_jamming import router as gps_jamming_router
from app.api.routes_replay import router as replay_router
from app.api.routes_osint import router as osint_router
from app.api.routes_gdelt import router as gdelt_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield


app = FastAPI(title="Intelligence Globe API", version=settings.version, lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_origin],
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

app.include_router(health_router, prefix="/api")
app.include_router(satellites_router, prefix="/api/satellites")
app.include_router(aircraft_router, prefix="/api/aircraft")
app.include_router(ships_router, prefix="/api/ships")
app.include_router(military_router, prefix="/api/military")
app.include_router(gps_jamming_router, prefix="/api/gps-jamming")
app.include_router(replay_router, prefix="/api/replay")
app.include_router(osint_router, prefix="/api/osint-events")
app.include_router(gdelt_router, prefix="/api/gdelt-events")
