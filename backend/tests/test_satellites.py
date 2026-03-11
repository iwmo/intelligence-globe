"""
Satellite endpoint tests — Wave 0 contract for SAT-01 and INT-01.

Tests are written before routes are wired (TDD RED phase).
Once backend/app/api/routes_satellites.py is added and the Alembic migration
runs, all five tests should turn GREEN.
"""
import pytest
from httpx import AsyncClient, ASGITransport
from sqlalchemy import text

from app.main import app
from app.db import AsyncSessionLocal


@pytest.mark.asyncio
async def test_satellite_list_returns_200():
    """GET /api/satellites/ must return HTTP 200 with a JSON list."""
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        response = await client.get("/api/satellites/")
    assert response.status_code == 200
    assert isinstance(response.json(), list)


@pytest.mark.asyncio
async def test_satellite_table_exists():
    """The satellites table must exist in the database (Alembic migration ran)."""
    async with AsyncSessionLocal() as session:
        try:
            await session.execute(text("SELECT 1 FROM satellites LIMIT 1"))
        except Exception as exc:
            pytest.fail(f"satellites table does not exist: {exc}")


@pytest.mark.asyncio
async def test_satellite_detail_404_for_unknown():
    """GET /api/satellites/{norad_id} must return 404 for an unknown NORAD ID."""
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        response = await client.get("/api/satellites/99999999")
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_satellite_detail_returns_metadata():
    """Seed one Satellite row; GET /api/satellites/{norad_cat_id} must return 200
    with all expected metadata fields."""
    from app.models.satellite import Satellite

    norad_id = 25544  # ISS — well-known, non-colliding
    raw_omm = {
        "NORAD_CAT_ID": norad_id,
        "OBJECT_NAME": "ISS (ZARYA)",
        "EPOCH": "2026-03-11T00:00:00",
        "MEAN_MOTION": 15.5,
        "ECCENTRICITY": 0.0002,
        "INCLINATION": 51.6,
        "RA_OF_ASC_NODE": 120.0,
        "ARG_OF_PERICENTER": 90.0,
        "MEAN_ANOMALY": 0.0,
        "BSTAR": 0.00001,
        "MEAN_MOTION_DOT": 0.0001,
        "MEAN_MOTION_DDOT": 0.0,
    }

    async with AsyncSessionLocal() as session:
        # Clean up any leftover row from a previous run
        await session.execute(
            text("DELETE FROM satellites WHERE norad_cat_id = :nid"),
            {"nid": norad_id},
        )
        await session.commit()

        satellite = Satellite(
            norad_cat_id=norad_id,
            object_name="ISS (ZARYA)",
            constellation="ISS",
            epoch="2026-03-11T00:00:00",
            mean_motion=15.5,
            eccentricity=0.0002,
            inclination=51.6,
            ra_of_asc_node=120.0,
            arg_of_pericenter=90.0,
            mean_anomaly=0.0,
            bstar=0.00001,
            mean_motion_dot=0.0001,
            mean_motion_ddot=0.0,
            raw_omm=raw_omm,
        )
        session.add(satellite)
        await session.commit()

    try:
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            response = await client.get(f"/api/satellites/{norad_id}")

        assert response.status_code == 200
        body = response.json()
        assert body["norad_cat_id"] == norad_id
        assert "object_name" in body
        assert "altitude_km" in body
        assert "velocity_km_s" in body
        assert "constellation" in body
        assert "epoch" in body
    finally:
        async with AsyncSessionLocal() as session:
            await session.execute(
                text("DELETE FROM satellites WHERE norad_cat_id = :nid"),
                {"nid": norad_id},
            )
            await session.commit()


@pytest.mark.asyncio
async def test_tle_freshness_returns_timestamp():
    """GET /api/satellites/freshness must return HTTP 200 with a last_updated key."""
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        response = await client.get("/api/satellites/freshness")
    assert response.status_code == 200
    body = response.json()
    assert "last_updated" in body
