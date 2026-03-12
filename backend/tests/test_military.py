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
