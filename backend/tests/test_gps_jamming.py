"""
GPS Jamming aggregation tests — LAY-02 contract (TDD RED phase).

Tests are written before implementation exists.
All unit tests use deferred imports inside test body so that
ImportError is the RED failure — not a collection-time error.

Once backend/app/tasks/ingest_gps_jamming.py and /api/gps-jamming route
are implemented (Plan 02), all tests should turn GREEN.
"""
import pytest
from httpx import AsyncClient, ASGITransport

from app.main import app


# ---------------------------------------------------------------------------
# Unit tests for aggregate_jamming_cells()
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_nic_nacp_aggregation():
    """5 aircraft same cell (3 bad NIC<7, 2 good) → exactly 1 cell returned."""
    from app.tasks.ingest_gps_jamming import aggregate_jamming_cells

    aircraft = [
        {"lat": 25.0, "lon": 45.0, "nic": 3, "nac_p": 5},   # bad: nic < 7
        {"lat": 25.0, "lon": 45.0, "nic": 2, "nac_p": 5},   # bad: nic < 7
        {"lat": 25.0, "lon": 45.0, "nic": 1, "nac_p": 4},   # bad: nic < 7
        {"lat": 25.0, "lon": 45.0, "nic": 9, "nac_p": 10},  # good
        {"lat": 25.0, "lon": 45.0, "nic": 8, "nac_p": 9},   # good
    ]
    result = aggregate_jamming_cells(aircraft)
    assert isinstance(result, list)
    assert len(result) == 1


@pytest.mark.asyncio
async def test_severity_red():
    """3 bad / 5 total → ratio = (3-1)/5 = 0.4 → severity == 'red'."""
    from app.tasks.ingest_gps_jamming import aggregate_jamming_cells

    aircraft = [
        {"lat": 25.0, "lon": 45.0, "nic": 3, "nac_p": 5},   # bad
        {"lat": 25.0, "lon": 45.0, "nic": 2, "nac_p": 5},   # bad
        {"lat": 25.0, "lon": 45.0, "nic": 1, "nac_p": 4},   # bad
        {"lat": 25.0, "lon": 45.0, "nic": 9, "nac_p": 10},  # good
        {"lat": 25.0, "lon": 45.0, "nic": 8, "nac_p": 9},   # good
    ]
    result = aggregate_jamming_cells(aircraft)
    assert len(result) == 1
    cell = result[0]
    assert cell["severity"] == "red"
    assert abs(cell["bad_ratio"] - 0.4) < 0.001


@pytest.mark.asyncio
async def test_severity_yellow():
    """2 bad / 5 total → ratio = (2-1)/5 = 0.2 → severity == 'yellow'."""
    from app.tasks.ingest_gps_jamming import aggregate_jamming_cells

    aircraft = [
        {"lat": 25.0, "lon": 45.0, "nic": 3, "nac_p": 5},   # bad: nic < 7
        {"lat": 25.0, "lon": 45.0, "nic": 2, "nac_p": 3},   # bad: nic < 7
        {"lat": 25.0, "lon": 45.0, "nic": 9, "nac_p": 10},  # good
        {"lat": 25.0, "lon": 45.0, "nic": 8, "nac_p": 9},   # good
        {"lat": 25.0, "lon": 45.0, "nic": 10, "nac_p": 11}, # good
    ]
    result = aggregate_jamming_cells(aircraft)
    assert len(result) == 1
    cell = result[0]
    assert cell["severity"] == "yellow"
    assert 0.1 <= cell["bad_ratio"] < 0.3


@pytest.mark.asyncio
async def test_severity_green():
    """All good aircraft → bad_ratio == 0.0 → severity == 'green'."""
    from app.tasks.ingest_gps_jamming import aggregate_jamming_cells

    aircraft = [
        {"lat": 25.0, "lon": 45.0, "nic": 9, "nac_p": 10},
        {"lat": 25.0, "lon": 45.0, "nic": 8, "nac_p": 9},
        {"lat": 25.0, "lon": 45.0, "nic": 10, "nac_p": 11},
    ]
    result = aggregate_jamming_cells(aircraft)
    assert len(result) == 1
    cell = result[0]
    assert cell["bad_ratio"] == 0.0
    assert cell["severity"] == "green"


@pytest.mark.asyncio
async def test_missing_nic_excluded():
    """Aircraft with nic=None, nac_p=None → treated as good (not bad), not skipped."""
    from app.tasks.ingest_gps_jamming import aggregate_jamming_cells

    # 1 aircraft with None NIC/NACp (treated as good) + 1 truly bad
    # With total=2, bad=1: ratio = max(0, (1-1)/2) = 0.0 → green
    aircraft = [
        {"lat": 25.0, "lon": 45.0, "nic": None, "nac_p": None},  # good (missing = no data)
        {"lat": 25.0, "lon": 45.0, "nic": None, "nac_p": None},  # good
    ]
    result = aggregate_jamming_cells(aircraft)
    # Aircraft with None are not skipped — they should still be aggregated
    assert len(result) == 1
    cell = result[0]
    assert cell["aircraft_count"] == 2
    assert cell["severity"] == "green"


@pytest.mark.asyncio
async def test_null_position_excluded():
    """Aircraft with lat=None → excluded from aggregation entirely."""
    from app.tasks.ingest_gps_jamming import aggregate_jamming_cells

    aircraft = [
        {"lat": None, "lon": 45.0, "nic": 3, "nac_p": 5},   # excluded: no position
        {"lat": 25.0, "lon": None, "nic": 3, "nac_p": 5},   # excluded: no position
        {"lat": 25.0, "lon": 45.0, "nic": 9, "nac_p": 10},  # included: good
    ]
    result = aggregate_jamming_cells(aircraft)
    # Only 1 valid aircraft in cell → cell exists with count 1
    assert len(result) == 1
    assert result[0]["aircraft_count"] == 1


# ---------------------------------------------------------------------------
# API integration test
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_gps_jamming_route():
    """GET /api/gps-jamming returns 200 with JSON body { cells: [...] }."""
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        response = await client.get("/api/gps-jamming")
    assert response.status_code == 200
    body = response.json()
    assert "cells" in body
    assert isinstance(body["cells"], list)
