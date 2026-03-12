"""
OSINT events API tests — Phase 12 RED stubs.

Tests assert the contract for GET /api/osint-events and POST /api/osint-events.
All tests currently fail with 404 (route not yet registered in main.py).
Once routes_osint.py is added and mounted, these should turn GREEN.

Deferred import pattern: if app.api.routes_osint does not exist, the collection
of this file still succeeds (the import is inside the test function body).
"""
import pytest
from httpx import AsyncClient, ASGITransport

from app.main import app


@pytest.mark.asyncio
async def test_list_events():
    """GET /api/osint-events must return 200 with {"events": [...]}."""
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        response = await client.get("/api/osint-events")
    assert response.status_code == 200
    body = response.json()
    assert "events" in body
    assert isinstance(body["events"], list)


@pytest.mark.asyncio
async def test_create_event():
    """POST /api/osint-events with valid body must return 200/201 with an 'id' key."""
    payload = {
        "ts": 1_700_000_000_000,
        "category": "KINETIC",
        "label": "Strike near capital",
        "source_url": "https://example.com/source",
    }
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        response = await client.post("/api/osint-events", json=payload)
    assert response.status_code in (200, 201)
    body = response.json()
    assert "id" in body


@pytest.mark.asyncio
async def test_invalid_category():
    """POST /api/osint-events with invalid category must return 422 (validation error)."""
    payload = {
        "ts": 1_700_000_000_000,
        "category": "INVALID",
        "label": "Bad category",
        "source_url": None,
    }
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        response = await client.post("/api/osint-events", json=payload)
    assert response.status_code == 422
