"""
Aircraft endpoint tests — AIR-01 and INT-02 contract.

Tests are written before routes are wired (TDD RED phase).
Once backend/app/api/routes_aircraft.py is added, the Alembic migration runs,
and main.py mounts the router, all tests should turn GREEN.
"""
import pytest
from httpx import AsyncClient, ASGITransport

from app.main import app


@pytest.mark.asyncio
async def test_list_aircraft():
    """GET /api/aircraft/ must return 200 with a list; each item has required keys."""
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        response = await client.get("/api/aircraft/")
    assert response.status_code == 200
    body = response.json()
    assert isinstance(body, list)
    # If rows are present, validate their shape
    for item in body:
        assert "icao24" in item
        assert "latitude" in item
        assert "longitude" in item
        assert "baro_altitude" in item
        assert "callsign" in item
        assert "origin_country" in item
        assert "velocity" in item
        assert "true_track" in item


@pytest.mark.asyncio
async def test_aircraft_freshness():
    """GET /api/aircraft/freshness must return 200 with a last_updated key."""
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        response = await client.get("/api/aircraft/freshness")
    assert response.status_code == 200
    body = response.json()
    assert "last_updated" in body
    # When empty, last_updated is null
    assert body["last_updated"] is None or isinstance(body["last_updated"], str)


@pytest.mark.asyncio
async def test_aircraft_detail():
    """GET /api/aircraft/{icao24} returns full metadata; 404 for unknown ICAO24."""
    from sqlalchemy import text
    from app.db import AsyncSessionLocal
    from app.models.aircraft import Aircraft

    icao24 = "a1b2c3"

    async with AsyncSessionLocal() as session:
        # Clean up any leftover row
        await session.execute(
            text("DELETE FROM aircraft WHERE icao24 = :icao24"),
            {"icao24": icao24},
        )
        await session.commit()

        aircraft = Aircraft(
            icao24=icao24,
            callsign="TEST001",
            origin_country="Test Country",
            longitude=-73.935242,
            latitude=40.730610,
            baro_altitude=10000.0,
            on_ground=False,
            velocity=250.0,
            true_track=90.0,
            last_contact=1741651200,
            trail=[{"lon": -73.935242, "lat": 40.730610, "alt": 10000.0, "ts": 1741651200}],
        )
        session.add(aircraft)
        await session.commit()

    try:
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            response = await client.get(f"/api/aircraft/{icao24}")

        assert response.status_code == 200
        body = response.json()
        assert body["icao24"] == icao24
        assert "callsign" in body
        assert "baro_altitude" in body
        assert "velocity" in body
        assert "true_track" in body
        assert "origin_country" in body

        # 404 for unknown
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            not_found = await client.get("/api/aircraft/xxxxxx")
        assert not_found.status_code == 404

    finally:
        async with AsyncSessionLocal() as session:
            await session.execute(
                text("DELETE FROM aircraft WHERE icao24 = :icao24"),
                {"icao24": icao24},
            )
            await session.commit()
