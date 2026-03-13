"""
Migration freshness column tests (MIG-01).

Verifies that all freshness tracking columns added by migration
a4f7c2e9b1d3_add_freshness_columns are present in the database and
that is_active server_default applied correctly to existing rows.

These tests are the RED state before Task 2 runs the migration.
After the migration runs they become GREEN.
"""
import pytest
from sqlalchemy import text
from app.db import engine


@pytest.mark.asyncio
async def test_aircraft_columns():
    """aircraft table must have all 7 new freshness columns."""
    async with engine.connect() as conn:
        result = await conn.execute(
            text("SELECT column_name FROM information_schema.columns WHERE table_name = :t"),
            {"t": "aircraft"},
        )
        cols = {row[0] for row in result}
        for col in (
            "time_position",
            "geo_altitude",
            "vertical_rate",
            "position_source",
            "fetched_at",
            "last_seen_at",
            "is_active",
        ):
            assert col in cols, f"aircraft missing column {col}"


@pytest.mark.asyncio
async def test_military_columns():
    """military_aircraft table must have 3 new freshness columns."""
    async with engine.connect() as conn:
        result = await conn.execute(
            text("SELECT column_name FROM information_schema.columns WHERE table_name = :t"),
            {"t": "military_aircraft"},
        )
        cols = {row[0] for row in result}
        for col in ("fetched_at", "last_seen_at", "is_active"):
            assert col in cols, f"military_aircraft missing column {col}"


@pytest.mark.asyncio
async def test_ships_columns():
    """ships table must have 2 new freshness columns."""
    async with engine.connect() as conn:
        result = await conn.execute(
            text("SELECT column_name FROM information_schema.columns WHERE table_name = :t"),
            {"t": "ships"},
        )
        cols = {row[0] for row in result}
        for col in ("last_seen_at", "is_active"):
            assert col in cols, f"ships missing column {col}"


@pytest.mark.asyncio
async def test_gps_jamming_columns():
    """gps_jamming_cells table must have 3 new freshness columns."""
    async with engine.connect() as conn:
        result = await conn.execute(
            text("SELECT column_name FROM information_schema.columns WHERE table_name = :t"),
            {"t": "gps_jamming_cells"},
        )
        cols = {row[0] for row in result}
        for col in ("aggregated_at", "source_fetched_at", "source_is_stale"):
            assert col in cols, f"gps_jamming_cells missing column {col}"


@pytest.mark.asyncio
async def test_is_active_default():
    """
    For each table with is_active, no existing row should have is_active IS NULL.
    The server_default='true' must have applied to all pre-existing rows.
    Skips the assertion if the table is empty (avoids false-pass on blank DB).
    """
    tables = ("aircraft", "military_aircraft", "ships")
    async with engine.connect() as conn:
        for table in tables:
            # Check row count first — skip if empty
            count_result = await conn.execute(text(f"SELECT count(*) FROM {table}"))
            row_count = count_result.scalar()
            if row_count == 0:
                pytest.skip(f"{table} is empty — skipping is_active default check")

            null_result = await conn.execute(
                text(f"SELECT count(*) FROM {table} WHERE is_active IS NULL")
            )
            null_count = null_result.scalar()
            assert null_count == 0, (
                f"{table} has {null_count} rows with is_active IS NULL "
                f"— server_default did not apply"
            )
