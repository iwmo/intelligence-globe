"""
Pytest configuration for backend tests.

Uses NullPool so each async test gets a fresh connection not tied to a
shared event-loop pool.  This prevents the
  "Future attached to a different loop"
RuntimeError that occurs when SQLAlchemy's default connection pool
carries asyncpg futures across pytest-asyncio test boundaries.

Both the module-level engine AND AsyncSessionLocal are patched so that
get_db() yields sessions from the NullPool test engine rather than the
pooled production engine created at import time.
"""
import pytest
from sqlalchemy.pool import NullPool
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker

import app.db as db_module
from app.config import settings


@pytest.fixture(autouse=True)
def patch_db_engine(monkeypatch):
    """Replace the module-level engine and session factory with NullPool equivalents."""
    test_engine = create_async_engine(
        settings.database_url,
        echo=False,
        poolclass=NullPool,
    )
    test_session_factory = async_sessionmaker(test_engine, expire_on_commit=False)
    monkeypatch.setattr(db_module, "engine", test_engine)
    monkeypatch.setattr(db_module, "AsyncSessionLocal", test_session_factory)
    yield
    # NullPool means no persistent connections — nothing to dispose
