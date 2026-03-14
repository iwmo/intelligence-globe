"""
OSINT events API tests — Phase 12 RED stubs + Phase 28 auth tests.

Tests assert the contract for GET /api/osint-events and POST /api/osint-events.
Phase 28 adds API key auth to POST — three new auth tests cover no-key, wrong-key,
correct-key scenarios.
"""
import pytest
from httpx import AsyncClient, ASGITransport

from app.main import app

TEST_PAYLOAD = {
    "ts": 1_700_000_000_000,
    "category": "KINETIC",
    "label": "Strike near capital",
    "source_url": "https://example.com/source",
}


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
async def test_create_event(monkeypatch):
    """POST /api/osint-events with correct X-API-Key must return 201 with an 'id' key."""
    monkeypatch.setattr("app.config.settings.api_key", "correct-key")
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        response = await client.post(
            "/api/osint-events", json=TEST_PAYLOAD, headers={"X-API-Key": "correct-key"}
        )
    assert response.status_code == 201
    body = response.json()
    assert "id" in body


@pytest.mark.asyncio
async def test_invalid_category(monkeypatch):
    """POST /api/osint-events with invalid category must return 422 (validation error).

    Auth must pass first (correct key supplied) so that Pydantic validation runs
    and returns 422 for the bad category value.
    """
    monkeypatch.setattr("app.config.settings.api_key", "correct-key")
    payload = {
        "ts": 1_700_000_000_000,
        "category": "INVALID",
        "label": "Bad category",
        "source_url": None,
    }
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        response = await client.post(
            "/api/osint-events", json=payload, headers={"X-API-Key": "correct-key"}
        )
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_create_event_no_key():
    """POST with no X-API-Key header must return 401."""
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        response = await client.post("/api/osint-events", json=TEST_PAYLOAD)
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_create_event_wrong_key(monkeypatch):
    """POST with wrong X-API-Key value must return 401."""
    monkeypatch.setattr("app.config.settings.api_key", "correct-key")
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        response = await client.post(
            "/api/osint-events", json=TEST_PAYLOAD, headers={"X-API-Key": "wrong-key"}
        )
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_create_event_correct_key(monkeypatch):
    """POST with correct X-API-Key value must return 201."""
    monkeypatch.setattr("app.config.settings.api_key", "correct-key")
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        response = await client.post(
            "/api/osint-events", json=TEST_PAYLOAD, headers={"X-API-Key": "correct-key"}
        )
    assert response.status_code == 201
    assert "id" in response.json()
