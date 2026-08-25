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
from app.api.routes_viewport import router as viewport_router
from app.api.routes_voice import router as voice_router
from app.api.routes_earthquakes import router as earthquakes_router
from app.api.routes_fires import router as fires_router
from app.api.routes_launches import router as launches_router
from app.api.routes_weather import router as weather_router
from app.api.routes_places import router as places_router
from app.api.routes_traffic import router as traffic_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield


app = FastAPI(title="Intelligence Globe API", version=settings.version, lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_origin],
    allow_methods=["GET", "POST", "PUT"],
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
app.include_router(viewport_router, prefix="/api")
app.include_router(voice_router, prefix="/api/voice")
app.include_router(earthquakes_router, prefix="/api/earthquakes")
app.include_router(fires_router, prefix="/api/fires")
app.include_router(launches_router, prefix="/api/launches")
app.include_router(weather_router, prefix="/api/weather")
app.include_router(places_router, prefix="/api/places")
app.include_router(traffic_router, prefix="/api/traffic")
