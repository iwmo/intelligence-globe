from pydantic_settings import BaseSettings
from pydantic import ConfigDict


class Settings(BaseSettings):
    model_config = ConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/opensignal"
    redis_url: str = "redis://localhost:6379/0"
    adsbio_base_url: str = "https://re-api.adsb.lol"
    frontend_origin: str = "http://localhost:3000"
    version: str = "0.1.0"
    api_key: str = ""  # loaded from API_KEY env var; empty = fail-secure (all POSTs rejected)
    openai_api_key: str = ""  # OPENAI_API_KEY — server-side only, never VITE_
    voice_model: str = "gpt-realtime-2.1-mini"
    voice_session_cap_usd: float = 3.0
    firms_map_key: str = ""  # FIRMS_MAP_KEY — server-side only
    ll2_api_token: str = ""  # LL2_API_TOKEN — optional, anonymous works
    google_maps_api_key: str = ""  # GOOGLE_MAPS_API_KEY — Places/Geocoding only, never VITE_
    tomtom_api_key: str = ""  # TOMTOM_API_KEY — traffic flow, never VITE_
    tomtom_daily_sample_budget: int = 2_000

    # Freshness thresholds (FRESH-02) — overridable via environment variables
    AIRCRAFT_STALE_SECONDS: int = 120
    MILITARY_STALE_SECONDS: int = 600
    SHIP_STALE_SECONDS: int = 900
    GPS_JAMMING_STALE_SECONDS: int = 600
    GDELT_STALE_SECONDS: int = 1800  # 2× the 15-min poll interval
    EARTHQUAKE_STALE_SECONDS: int = 1800
    FIRE_STALE_SECONDS: int = 1800
    LAUNCH_STALE_SECONDS: int = 3600


settings = Settings()
