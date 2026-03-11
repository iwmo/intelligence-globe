"""
Pytest configuration for backend tests.

Uses NullPool so each async test gets a fresh connection not tied to a
shared event-loop pool.  This prevents the
  "Future attached to a different loop"
RuntimeError that occurs when SQLAlchemy's default connection pool
carries asyncpg futures across pytest-asyncio test boundaries.
"""
import pytest
from sqlalchemy.pool import NullPool
from sqlalchemy.ext.asyncio import create_async_engine

import app.db as db_module
from app.config import settings


@pytest.fixture(autouse=True)
def patch_db_engine(monkeypatch):
    """Replace the module-level engine with a NullPool engine for tests."""
    test_engine = create_async_engine(
        settings.database_url,
        echo=False,
        poolclass=NullPool,
    )
    monkeypatch.setattr(db_module, "engine", test_engine)
    yield
    # NullPool means no persistent connections — nothing to dispose
