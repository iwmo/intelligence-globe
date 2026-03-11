import pytest
from sqlalchemy import text
from app.db import engine


@pytest.mark.asyncio
async def test_postgres_reachable():
    async with engine.connect() as conn:
        result = await conn.execute(text("SELECT 1"))
        assert result.scalar() == 1


@pytest.mark.asyncio
async def test_postgis_extension_exists():
    async with engine.connect() as conn:
        result = await conn.execute(
            text("SELECT COUNT(*) FROM pg_extension WHERE extname = 'postgis'")
        )
        assert result.scalar() == 1
