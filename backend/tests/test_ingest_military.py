"""
Unit tests for military aircraft ingest helpers — LAY-01 ingest logic.

These are pure unit tests: no database, no HTTP client needed.
The helper is in backend/app/tasks/ingest_military.py (Plan 02).
Since Plan 01 only defines the contract, we import the function by name
and assert its behaviour so Plan 02 can implement it against these tests.
"""
import pytest


@pytest.mark.asyncio
async def test_ground_altitude():
    """parse_military_aircraft with alt_baro='ground' must return dict with alt_baro=None."""
    from app.tasks.ingest_military import parse_military_aircraft

    ac = {
        "hex": "ae1234",
        "lat": 10.0,
        "lon": 20.0,
        "alt_baro": "ground",
        "gs": 0.0,
        "track": 0.0,
        "flight": "TEST01",
    }
    result = parse_military_aircraft(ac)
    assert result is not None
    assert result["alt_baro"] is None


@pytest.mark.asyncio
async def test_null_position_skipped():
    """parse_military_aircraft with lat=None must return None (skip the aircraft)."""
    from app.tasks.ingest_military import parse_military_aircraft

    ac = {
        "hex": "ae1234",
        "lat": None,
        "lon": 20.0,
        "alt_baro": 10000,
        "gs": 300.0,
        "track": 90.0,
        "flight": "TEST01",
    }
    result = parse_military_aircraft(ac)
    assert result is None
