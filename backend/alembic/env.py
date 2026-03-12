"""
Alembic environment for async SQLAlchemy (asyncpg).

Uses run_sync inside an async context so autogenerate works with
the asyncpg driver without needing a separate sync connection string.
"""
import asyncio
from logging.config import fileConfig

from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import pool

from alembic import context

# Import app modules to register metadata
from app.config import settings
from app.db import Base  # noqa: F401 — registers DeclarativeBase metadata

# Import all models so Alembic picks up their tables in autogenerate
import app.models.satellite  # noqa: F401
import app.models.aircraft  # noqa: F401
import app.models.ship  # noqa: F401
import app.models.military_aircraft  # noqa: F401

# Alembic Config object
config = context.config

# Configure logging
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Target metadata for autogenerate
target_metadata = Base.metadata


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode using the sync-compatible URL."""
    # Convert asyncpg URL to psycopg2 for offline (SQL dump) mode
    sync_url = settings.database_url.replace(
        "postgresql+asyncpg://", "postgresql://"
    )
    context.configure(
        url=sync_url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def include_object(object, name, type_, reflected, compare_to):
    """Exclude PostGIS/tiger tables and other pre-existing schemas from autogenerate."""
    if type_ == "table" and reflected and compare_to is None:
        # Ignore tables already in DB but not in our metadata (e.g. PostGIS)
        return False
    return True


def do_run_migrations(connection):
    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        compare_type=True,
        include_object=include_object,
    )
    with context.begin_transaction():
        context.run_migrations()


async def run_migrations_online() -> None:
    """Run migrations in 'online' mode using the async engine."""
    connectable = create_async_engine(
        settings.database_url,
        poolclass=pool.NullPool,
    )

    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)

    await connectable.dispose()


if context.is_offline_mode():
    run_migrations_offline()
else:
    asyncio.run(run_migrations_online())
