"""
Ship endpoint tests — LAY-03 API contract.

Tests are written before routes are wired (TDD RED phase).
Once backend/app/api/routes_ships.py is added, the Alembic migration runs,
and main.py mounts the router, all tests should turn GREEN.
"""
import pytest
from httpx import AsyncClient, ASGITransport

from app.main import app


@pytest.mark.asyncio
async def test_list_ships():
    """GET /api/ships/ must return 200 with a list; each item has required keys."""
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        response = await client.get("/api/ships/")
    assert response.status_code == 200
    body = response.json()
    assert isinstance(body, list)
    # If rows are present, validate their shape
    for item in body:
        assert "mmsi" in item
        assert "vessel_name" in item
        assert "lat" in item
        assert "lon" in item
        assert "sog" in item
        assert "heading" in item


@pytest.mark.asyncio
async def test_ship_detail():
    """GET /api/ships/{mmsi} returns 404 for unknown MMSI; route must exist (not 422).

    Uses '000000000' — MMSI codes are 9-digit numbers starting with 1-9 (country code),
    so all-zeros is structurally invalid and can never appear in live AIS data.
    Pre-deletes the sentinel value to guard against prior test pollution.
    """
    from sqlalchemy import text
    from app.db import AsyncSessionLocal

    sentinel_mmsi = "000000000"
    async with AsyncSessionLocal() as session:
        await session.execute(
            text("DELETE FROM ships WHERE mmsi = :mmsi"), {"mmsi": sentinel_mmsi}
        )
        await session.commit()

    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        response = await client.get(f"/api/ships/{sentinel_mmsi}")
    # Route must exist and return 404 for unknown MMSI (not 422 or 404 from no route)
    assert response.status_code == 404


# ---------------------------------------------------------------------------
# SHIP-02: freshness metadata in list response
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_ships_response_includes_freshness_keys():
    """SHIP-02: GET /api/ships/ must include last_seen_at, fetched_at, and is_stale in each item.

    Fails RED until routes_ships.py adds last_seen_at, fetched_at, and is_stale to the response dict.
    """
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        response = await client.get("/api/ships/")
    assert response.status_code == 200
    body = response.json()
    assert isinstance(body, list)
    for item in body:
        assert "last_seen_at" in item, f"last_seen_at missing from item: {item}"
        assert "fetched_at" in item, f"fetched_at missing from item: {item}"
        assert "is_stale" in item, f"is_stale missing from item: {item}"


@pytest.mark.asyncio
async def test_ships_list_shape_preserved():
    """SHIP-02 regression guard: all existing keys must still be present after freshness additions.

    Passes RED — existing route already returns these keys. Guards against regression
    when routes_ships.py is updated to add freshness fields.
    """
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        response = await client.get("/api/ships/")
    assert response.status_code == 200
    body = response.json()
    assert isinstance(body, list)
    for item in body:
        assert "mmsi" in item, f"mmsi missing from item: {item}"
        assert "vessel_name" in item, f"vessel_name missing from item: {item}"
        assert "vessel_type" in item, f"vessel_type missing from item: {item}"
        assert "lat" in item, f"lat missing from item: {item}"
        assert "lon" in item, f"lon missing from item: {item}"
        assert "sog" in item, f"sog missing from item: {item}"
        assert "cog" in item, f"cog missing from item: {item}"
        assert "heading" in item, f"heading missing from item: {item}"
        assert "nav_status" in item, f"nav_status missing from item: {item}"
        assert "last_update" in item, f"last_update missing from item: {item}"
        assert "updated_at" in item, f"updated_at missing from item: {item}"


# ---------------------------------------------------------------------------
# TEST-04: Ships stale row exclusion
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_ships_list_excludes_stale_rows():
    """TEST-04: GET /api/ships/ must exclude rows where last_seen_at is older than SHIP_STALE_SECONDS.

    Inserts a Ship row with last_seen_at 1 hour ago (well past the 900s default)
    and asserts that it does NOT appear in the list response.

    NOTE: Ship model has NO fetched_at column — use last_seen_at (AIS is streamed, not polled).
    """
    from datetime import datetime, timezone, timedelta
    from sqlalchemy import text
    from app.db import AsyncSessionLocal
    from app.models.ship import Ship

    mmsi = "999000001"
    stale_ts = datetime.now(timezone.utc) - timedelta(hours=1)

    async with AsyncSessionLocal() as session:
        await session.execute(
            text("DELETE FROM ships WHERE mmsi = :mmsi"), {"mmsi": mmsi}
        )
        await session.commit()
        row = Ship(
            mmsi=mmsi,
            latitude=51.5,
            longitude=-0.1,
            is_active=True,
            last_seen_at=stale_ts,
        )
        session.add(row)
        await session.commit()

    try:
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            response = await client.get("/api/ships/")
        assert response.status_code == 200
        body = response.json()
        assert mmsi not in [item["mmsi"] for item in body], (
            f"Stale ship {mmsi!r} should be excluded from /api/ships/ response"
        )
    finally:
        async with AsyncSessionLocal() as session:
            await session.execute(
                text("DELETE FROM ships WHERE mmsi = :mmsi"), {"mmsi": mmsi}
            )
            await session.commit()


@pytest.mark.asyncio
async def test_ships_list_excludes_inactive_rows():
    """TEST-04: GET /api/ships/ must exclude rows where is_active=False, even when last_seen_at is fresh.

    Inserts a Ship row with is_active=False and a fresh last_seen_at timestamp
    and asserts that it does NOT appear in the list response.
    """
    from datetime import datetime, timezone, timedelta
    from sqlalchemy import text
    from app.db import AsyncSessionLocal
    from app.models.ship import Ship

    mmsi = "999000002"
    fresh_ts = datetime.now(timezone.utc)

    async with AsyncSessionLocal() as session:
        await session.execute(
            text("DELETE FROM ships WHERE mmsi = :mmsi"), {"mmsi": mmsi}
        )
        await session.commit()
        row = Ship(
            mmsi=mmsi,
            latitude=51.5,
            longitude=-0.1,
            is_active=False,
            last_seen_at=fresh_ts,
        )
        session.add(row)
        await session.commit()

    try:
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            response = await client.get("/api/ships/")
        assert response.status_code == 200
        body = response.json()
        assert mmsi not in [item["mmsi"] for item in body], (
            f"Inactive ship {mmsi!r} should be excluded from /api/ships/ response"
        )
    finally:
        async with AsyncSessionLocal() as session:
            await session.execute(
                text("DELETE FROM ships WHERE mmsi = :mmsi"), {"mmsi": mmsi}
            )
            await session.commit()


# ---------------------------------------------------------------------------
# VPC-05: bbox query-param filtering for ships
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_list_ships_bbox():
    """VPC-05: GET /api/ships/ with bbox returns only in-range ships."""
    from datetime import datetime, timezone
    from app.db import AsyncSessionLocal
    from app.models.ship import Ship

    now = datetime.now(timezone.utc)
    ship_in = Ship(
        mmsi="123456789", latitude=40.0, longitude=10.0,
        is_active=True, last_seen_at=now,
    )
    ship_out = Ship(
        mmsi="987654321", latitude=60.0, longitude=10.0,
        is_active=True, last_seen_at=now,
    )
    async with AsyncSessionLocal() as session:
        session.add_all([ship_in, ship_out])
        await session.commit()

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get(
            "/api/ships/",
            params={"min_lat": 10, "max_lat": 50, "min_lon": -10, "max_lon": 30},
        )
    assert response.status_code == 200
    mmsis = [r["mmsi"] for r in response.json()]
    assert "123456789" in mmsis
    assert "987654321" not in mmsis

    async with AsyncSessionLocal() as session:
        for mmsi in ("123456789", "987654321"):
            row = await session.get(Ship, mmsi)
            if row:
                await session.delete(row)
        await session.commit()
