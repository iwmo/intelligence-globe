"""
Aircraft endpoint tests — AIR-01, INT-02, and ACFT-03 contract.

Tests are written before routes are wired (TDD RED phase).
Once backend/app/api/routes_aircraft.py is added, the Alembic migration runs,
and main.py mounts the router, all tests should turn GREEN.
"""
import pytest
from datetime import datetime, timezone, timedelta
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


# ---------------------------------------------------------------------------
# ACFT-03: Freshness filter and new response fields
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_list_aircraft_excludes_stale():
    """Rows with fetched_at older than AIRCRAFT_STALE_SECONDS are excluded from GET /api/aircraft."""
    from sqlalchemy import text
    from app.db import AsyncSessionLocal
    from app.models.aircraft import Aircraft

    icao24 = "stale01"
    stale_ts = datetime.now(timezone.utc) - timedelta(minutes=10)

    async with AsyncSessionLocal() as session:
        await session.execute(
            text("DELETE FROM aircraft WHERE icao24 = :icao24"),
            {"icao24": icao24},
        )
        await session.commit()

        aircraft = Aircraft(
            icao24=icao24,
            callsign="STALE01",
            origin_country="Test",
            longitude=10.0,
            latitude=50.0,
            baro_altitude=5000.0,
            is_active=True,
            fetched_at=stale_ts,
        )
        session.add(aircraft)
        await session.commit()

    try:
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            response = await client.get("/api/aircraft/")

        assert response.status_code == 200
        body = response.json()
        icao24s = [item["icao24"] for item in body]
        assert icao24 not in icao24s, "Stale row must be excluded from list"

    finally:
        async with AsyncSessionLocal() as session:
            await session.execute(
                text("DELETE FROM aircraft WHERE icao24 = :icao24"),
                {"icao24": icao24},
            )
            await session.commit()


@pytest.mark.asyncio
async def test_list_aircraft_excludes_inactive():
    """Rows with is_active=False are excluded from GET /api/aircraft."""
    from sqlalchemy import text
    from app.db import AsyncSessionLocal
    from app.models.aircraft import Aircraft

    icao24 = "inact01"
    fresh_ts = datetime.now(timezone.utc)

    async with AsyncSessionLocal() as session:
        await session.execute(
            text("DELETE FROM aircraft WHERE icao24 = :icao24"),
            {"icao24": icao24},
        )
        await session.commit()

        aircraft = Aircraft(
            icao24=icao24,
            callsign="INACT01",
            origin_country="Test",
            longitude=10.0,
            latitude=50.0,
            baro_altitude=5000.0,
            is_active=False,
            fetched_at=fresh_ts,
        )
        session.add(aircraft)
        await session.commit()

    try:
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            response = await client.get("/api/aircraft/")

        assert response.status_code == 200
        body = response.json()
        icao24s = [item["icao24"] for item in body]
        assert icao24 not in icao24s, "Inactive row must be excluded from list"

    finally:
        async with AsyncSessionLocal() as session:
            await session.execute(
                text("DELETE FROM aircraft WHERE icao24 = :icao24"),
                {"icao24": icao24},
            )
            await session.commit()


@pytest.mark.asyncio
async def test_list_aircraft_freshness_fields():
    """Fresh, active rows appear in the list with the four new freshness fields."""
    from sqlalchemy import text
    from app.db import AsyncSessionLocal
    from app.models.aircraft import Aircraft
    import time as time_module

    icao24 = "fresh01"
    now_ts = datetime.now(timezone.utc)
    known_time_position = int(time_module.time()) - 30  # 30 seconds ago

    async with AsyncSessionLocal() as session:
        await session.execute(
            text("DELETE FROM aircraft WHERE icao24 = :icao24"),
            {"icao24": icao24},
        )
        await session.commit()

        aircraft = Aircraft(
            icao24=icao24,
            callsign="FRESH01",
            origin_country="Test",
            longitude=10.0,
            latitude=50.0,
            baro_altitude=5000.0,
            is_active=True,
            fetched_at=now_ts,
            time_position=known_time_position,
        )
        session.add(aircraft)
        await session.commit()

    try:
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            response = await client.get("/api/aircraft/")

        assert response.status_code == 200
        body = response.json()
        item = next((i for i in body if i["icao24"] == icao24), None)
        assert item is not None, "Fresh active row must appear in list"

        # Four new freshness fields must be present
        assert "time_position" in item
        assert "fetched_at" in item
        assert "is_stale" in item
        assert "position_age_seconds" in item

        # Values must be correct
        assert item["time_position"] == known_time_position
        assert item["fetched_at"] is not None
        assert isinstance(item["fetched_at"], str)
        assert item["is_stale"] is False
        assert isinstance(item["position_age_seconds"], float)
        # 30 seconds ago ± some tolerance
        assert 0 <= item["position_age_seconds"] < 60

        # All pre-existing keys still present
        for key in ("icao24", "callsign", "latitude", "longitude", "baro_altitude", "velocity", "true_track", "trail"):
            assert key in item, f"Pre-existing key '{key}' must still be present"

    finally:
        async with AsyncSessionLocal() as session:
            await session.execute(
                text("DELETE FROM aircraft WHERE icao24 = :icao24"),
                {"icao24": icao24},
            )
            await session.commit()


@pytest.mark.asyncio
async def test_list_aircraft_position_age_fallback():
    """When time_position is null, position_age_seconds falls back to last_contact."""
    from sqlalchemy import text
    from app.db import AsyncSessionLocal
    from app.models.aircraft import Aircraft
    import time as time_module

    icao24 = "fallbk1"
    now_ts = datetime.now(timezone.utc)
    known_last_contact = int(time_module.time()) - 45  # 45 seconds ago

    async with AsyncSessionLocal() as session:
        await session.execute(
            text("DELETE FROM aircraft WHERE icao24 = :icao24"),
            {"icao24": icao24},
        )
        await session.commit()

        aircraft = Aircraft(
            icao24=icao24,
            callsign="FALLBK1",
            origin_country="Test",
            longitude=10.0,
            latitude=50.0,
            baro_altitude=5000.0,
            is_active=True,
            fetched_at=now_ts,
            time_position=None,
            last_contact=known_last_contact,
        )
        session.add(aircraft)
        await session.commit()

    try:
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            response = await client.get("/api/aircraft/")

        assert response.status_code == 200
        body = response.json()
        item = next((i for i in body if i["icao24"] == icao24), None)
        assert item is not None, "Row must appear in list"

        # time_position null → position_age_seconds uses last_contact
        assert item["time_position"] is None
        assert isinstance(item["position_age_seconds"], float), "position_age_seconds must fall back to last_contact"
        assert 0 <= item["position_age_seconds"] < 120

    finally:
        async with AsyncSessionLocal() as session:
            await session.execute(
                text("DELETE FROM aircraft WHERE icao24 = :icao24"),
                {"icao24": icao24},
            )
            await session.commit()


@pytest.mark.asyncio
async def test_list_aircraft_position_age_null_when_both_null():
    """When both time_position and last_contact are null, position_age_seconds is null."""
    from sqlalchemy import text
    from app.db import AsyncSessionLocal
    from app.models.aircraft import Aircraft

    icao24 = "nullag1"
    now_ts = datetime.now(timezone.utc)

    async with AsyncSessionLocal() as session:
        await session.execute(
            text("DELETE FROM aircraft WHERE icao24 = :icao24"),
            {"icao24": icao24},
        )
        await session.commit()

        aircraft = Aircraft(
            icao24=icao24,
            callsign="NULLAG1",
            origin_country="Test",
            longitude=10.0,
            latitude=50.0,
            baro_altitude=5000.0,
            is_active=True,
            fetched_at=now_ts,
            time_position=None,
            last_contact=None,
        )
        session.add(aircraft)
        await session.commit()

    try:
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            response = await client.get("/api/aircraft/")

        assert response.status_code == 200
        body = response.json()
        item = next((i for i in body if i["icao24"] == icao24), None)
        assert item is not None, "Row must appear in list"

        assert item["time_position"] is None
        assert item["position_age_seconds"] is None, "Both timestamps null → position_age_seconds must be null"

    finally:
        async with AsyncSessionLocal() as session:
            await session.execute(
                text("DELETE FROM aircraft WHERE icao24 = :icao24"),
                {"icao24": icao24},
            )
            await session.commit()


# ---------------------------------------------------------------------------
# TEST-02: geo_altitude, vertical_rate, position_source stored and returned
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_aircraft_geo_altitude_vertical_rate_position_source_stored_and_returned():
    """geo_altitude, vertical_rate, and position_source written to DB are returned by GET /api/aircraft/."""
    from sqlalchemy import text
    from app.db import AsyncSessionLocal
    from app.models.aircraft import Aircraft

    icao24 = "geoalt1"
    now_ts = datetime.now(timezone.utc)

    async with AsyncSessionLocal() as session:
        await session.execute(
            text("DELETE FROM aircraft WHERE icao24 = :icao24"),
            {"icao24": icao24},
        )
        await session.commit()

        aircraft = Aircraft(
            icao24=icao24,
            callsign="GEOALT1",
            origin_country="Test",
            longitude=10.0,
            latitude=50.0,
            baro_altitude=5000.0,
            is_active=True,
            fetched_at=now_ts,
            geo_altitude=5100.0,
            vertical_rate=2.5,
            position_source=0,
        )
        session.add(aircraft)
        await session.commit()

    try:
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            response = await client.get("/api/aircraft/")

        assert response.status_code == 200
        body = response.json()
        item = next((i for i in body if i["icao24"] == icao24), None)
        assert item is not None, "Inserted row must appear in list"

        assert item["geo_altitude"] == 5100.0
        assert item["vertical_rate"] == 2.5
        assert item["position_source"] == 0

        # All pre-existing keys still present
        for key in (
            "icao24", "callsign", "latitude", "longitude", "baro_altitude",
            "velocity", "true_track", "trail", "time_position", "fetched_at",
            "is_stale", "position_age_seconds",
        ):
            assert key in item, f"Pre-existing key '{key}' must still be present"

    finally:
        async with AsyncSessionLocal() as session:
            await session.execute(
                text("DELETE FROM aircraft WHERE icao24 = :icao24"),
                {"icao24": icao24},
            )
            await session.commit()


# ---------------------------------------------------------------------------
# VPC-03, VPC-04: bbox query-param filtering
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_list_aircraft_no_bbox():
    """VPC-03: GET /api/aircraft/ without bbox returns 200 with a list."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/api/aircraft/")
    assert response.status_code == 200
    assert isinstance(response.json(), list)


@pytest.mark.asyncio
async def test_list_aircraft_bbox():
    """VPC-04: GET /api/aircraft/ with bbox returns only in-range aircraft.

    Seeds two aircraft rows: one inside bbox, one outside.
    After bbox filtering, only the inside row is returned.
    """
    from app.db import AsyncSessionLocal
    from app.models.aircraft import Aircraft

    now = datetime.now(timezone.utc)
    # Inside bbox (lat=40, lon=10)
    ac_in = Aircraft(
        icao24="aaa111", latitude=40.0, longitude=10.0,
        is_active=True, fetched_at=now,
    )
    # Outside bbox (lat=60, lon=10) -- above max_lat=50
    ac_out = Aircraft(
        icao24="bbb222", latitude=60.0, longitude=10.0,
        is_active=True, fetched_at=now,
    )
    async with AsyncSessionLocal() as session:
        session.add_all([ac_in, ac_out])
        await session.commit()

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get(
            "/api/aircraft/",
            params={"min_lat": 10, "max_lat": 50, "min_lon": -10, "max_lon": 30},
        )
    assert response.status_code == 200
    icaos = [r["icao24"] for r in response.json()]
    assert "aaa111" in icaos
    assert "bbb222" not in icaos

    # Cleanup
    async with AsyncSessionLocal() as session:
        for icao in ("aaa111", "bbb222"):
            row = await session.get(Aircraft, icao)
            if row:
                await session.delete(row)
        await session.commit()
