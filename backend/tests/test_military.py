"""
Military aircraft endpoint tests — LAY-01 API contract.

Tests are written before routes are wired (TDD RED phase).
Once backend/app/api/routes_military.py is added, the Alembic migration runs,
and main.py mounts the router, all tests should turn GREEN.
"""
import pytest
from httpx import AsyncClient, ASGITransport

from app.main import app


@pytest.mark.asyncio
async def test_list_military():
    """GET /api/military/ must return 200 with a list; each item has required keys."""
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        response = await client.get("/api/military/")
    assert response.status_code == 200
    body = response.json()
    assert isinstance(body, list)
    # If rows are present, validate their shape
    for item in body:
        assert "hex" in item
        assert "flight" in item
        assert "alt_baro" in item
        assert "gs" in item
        assert "track" in item
        assert "lat" in item
        assert "lon" in item


@pytest.mark.asyncio
async def test_military_detail():
    """GET /api/military/{hex} returns 404 for unknown hex; route must exist (not 422)."""
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        response = await client.get("/api/military/ae1234")
    # Route must exist and return 404 for unknown hex (not 422 or 404 from no route)
    assert response.status_code == 404


# ---------------------------------------------------------------------------
# MIL-02: freshness metadata in list response
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_military_response_includes_freshness_keys():
    """MIL-02: GET /api/military/ must include fetched_at and is_stale in each item.

    Fails RED until routes_military.py adds fetched_at and is_stale to the response dict.
    """
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        response = await client.get("/api/military/")
    assert response.status_code == 200
    body = response.json()
    assert isinstance(body, list)
    for item in body:
        assert "fetched_at" in item, f"fetched_at missing from item: {item}"
        assert "is_stale" in item, f"is_stale missing from item: {item}"


@pytest.mark.asyncio
async def test_military_list_shape_preserved():
    """MIL-02 regression guard: all existing keys must still be present after freshness additions.

    Passes RED — existing route already returns these keys. Guards against regression
    when routes_military.py is updated to add freshness fields.
    """
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        response = await client.get("/api/military/")
    assert response.status_code == 200
    body = response.json()
    assert isinstance(body, list)
    for item in body:
        assert "hex" in item, f"hex missing from item: {item}"
        assert "flight" in item, f"flight missing from item: {item}"
        assert "aircraft_type" in item, f"aircraft_type missing from item: {item}"
        assert "alt_baro" in item, f"alt_baro missing from item: {item}"
        assert "gs" in item, f"gs missing from item: {item}"
        assert "track" in item, f"track missing from item: {item}"
        assert "lat" in item, f"lat missing from item: {item}"
        assert "lon" in item, f"lon missing from item: {item}"
        assert "squawk" in item, f"squawk missing from item: {item}"
        assert "updated_at" in item, f"updated_at missing from item: {item}"


# ---------------------------------------------------------------------------
# TEST-03: Military stale row exclusion
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_military_list_excludes_stale_rows():
    """TEST-03: GET /api/military/ must exclude rows where fetched_at is older than MILITARY_STALE_SECONDS.

    Inserts a MilitaryAircraft row with fetched_at 15 minutes ago (well past the 600s default)
    and asserts that it does NOT appear in the list response.
    """
    from datetime import datetime, timezone, timedelta
    from sqlalchemy import text
    from app.db import AsyncSessionLocal
    from app.models.military_aircraft import MilitaryAircraft

    hex_id = "stl001"
    stale_ts = datetime.now(timezone.utc) - timedelta(minutes=15)

    async with AsyncSessionLocal() as session:
        await session.execute(
            text("DELETE FROM military_aircraft WHERE hex = :hex"), {"hex": hex_id}
        )
        await session.commit()
        row = MilitaryAircraft(
            hex=hex_id,
            latitude=48.0,
            longitude=2.0,
            is_active=True,
            fetched_at=stale_ts,
        )
        session.add(row)
        await session.commit()

    try:
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            response = await client.get("/api/military/")
        assert response.status_code == 200
        body = response.json()
        assert hex_id not in [item["hex"] for item in body], (
            f"Stale military row {hex_id!r} should be excluded from /api/military/ response"
        )
    finally:
        async with AsyncSessionLocal() as session:
            await session.execute(
                text("DELETE FROM military_aircraft WHERE hex = :hex"), {"hex": hex_id}
            )
            await session.commit()


@pytest.mark.asyncio
async def test_military_list_excludes_inactive_rows():
    """TEST-03: GET /api/military/ must exclude rows where is_active=False, even when fetched_at is fresh.

    Inserts a MilitaryAircraft row with is_active=False and a fresh fetched_at timestamp
    and asserts that it does NOT appear in the list response.
    """
    from datetime import datetime, timezone, timedelta
    from sqlalchemy import text
    from app.db import AsyncSessionLocal
    from app.models.military_aircraft import MilitaryAircraft

    hex_id = "inact1"
    fresh_ts = datetime.now(timezone.utc)

    async with AsyncSessionLocal() as session:
        await session.execute(
            text("DELETE FROM military_aircraft WHERE hex = :hex"), {"hex": hex_id}
        )
        await session.commit()
        row = MilitaryAircraft(
            hex=hex_id,
            latitude=48.0,
            longitude=2.0,
            is_active=False,
            fetched_at=fresh_ts,
        )
        session.add(row)
        await session.commit()

    try:
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            response = await client.get("/api/military/")
        assert response.status_code == 200
        body = response.json()
        assert hex_id not in [item["hex"] for item in body], (
            f"Inactive military row {hex_id!r} should be excluded from /api/military/ response"
        )
    finally:
        async with AsyncSessionLocal() as session:
            await session.execute(
                text("DELETE FROM military_aircraft WHERE hex = :hex"), {"hex": hex_id}
            )
            await session.commit()
