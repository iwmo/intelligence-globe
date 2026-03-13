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
    """GET /api/ships/{mmsi} returns 404 for unknown MMSI; route must exist (not 422)."""
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        response = await client.get("/api/ships/123456789")
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
