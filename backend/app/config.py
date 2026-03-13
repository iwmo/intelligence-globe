from pydantic_settings import BaseSettings
from pydantic import ConfigDict


class Settings(BaseSettings):
    model_config = ConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/opensignal"
    redis_url: str = "redis://localhost:6379/0"
    frontend_origin: str = "http://localhost:3000"
    version: str = "0.1.0"

    # Freshness thresholds (FRESH-02) — overridable via environment variables
    AIRCRAFT_STALE_SECONDS: int = 120
    MILITARY_STALE_SECONDS: int = 600
    SHIP_STALE_SECONDS: int = 900
    GPS_JAMMING_STALE_SECONDS: int = 600


settings = Settings()
