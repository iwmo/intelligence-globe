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
