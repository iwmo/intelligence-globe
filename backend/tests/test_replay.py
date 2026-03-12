"""
Replay API integration tests — REP-01 contract (TDD RED phase).

Tests are written before the /api/replay/snapshots route is implemented.
The RED signal is 404 (route not yet mounted) or AssertionError on response body shape.

Once backend/app/api/routes_replay.py is implemented and mounted in main.py (Plan 03),
all tests should turn GREEN.
"""
import pytest
from httpx import AsyncClient, ASGITransport

from app.main import app


@pytest.mark.asyncio
async def test_replay_route_exists():
    """GET /api/replay/snapshots?layer=all must return 200 with a 'snapshots' key in body."""
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        response = await client.get(
            "/api/replay/snapshots",
            params={
                "layer": "all",
                "start": "2026-03-12T00:00:00Z",
                "end": "2026-03-12T01:00:00Z",
            },
        )
    assert response.status_code == 200
    body = response.json()
    assert "snapshots" in body


@pytest.mark.asyncio
async def test_replay_layer_filter():
    """GET /api/replay/snapshots?layer=aircraft must return 200 with 'snapshots' and 'count' keys."""
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        response = await client.get(
            "/api/replay/snapshots",
            params={
                "layer": "aircraft",
                "start": "2026-03-12T00:00:00Z",
                "end": "2026-03-12T01:00:00Z",
            },
        )
    assert response.status_code == 200
    body = response.json()
    assert "snapshots" in body
    assert "count" in body


@pytest.mark.asyncio
async def test_replay_invalid_layer():
    """GET /api/replay/snapshots?layer=unknown_xyz must return 404 — route must exist and validate layer."""
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        response = await client.get(
            "/api/replay/snapshots",
            params={
                "layer": "unknown_xyz",
                "start": "2026-03-12T00:00:00Z",
                "end": "2026-03-12T01:00:00Z",
            },
        )
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_replay_window_route():
    """GET /api/replay/window must return 200 with oldest_ts and newest_ts keys.

    Returns 200 with null values when no snapshot data exists (empty DB in test).
    RED signal: route does not exist yet — expect 404 until Plan 02 implements it.
    """
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        response = await client.get("/api/replay/window")
    assert response.status_code == 200
    body = response.json()
    assert "oldest_ts" in body
    assert "newest_ts" in body
