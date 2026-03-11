"""
Unit tests for aircraft ingest helpers — AIR-01 (null-position filter) and AIR-02 (trail capping).

These are pure unit tests: no database, no HTTP client needed.
The helpers are in backend/app/workers/ingest_aircraft.py (Plan 02).
Since Plan 01 only defines the contract, we import the functions by name
and assert their behaviour so Plan 02 can implement them against these tests.
"""
import pytest


def _make_sv(
    icao24="abc123",
    callsign="TEST",
    origin_country="Test",
    last_contact=1741651200,
    longitude=10.0,
    latitude=50.0,
    baro_altitude=8000.0,
    on_ground=False,
    velocity=200.0,
    true_track=180.0,
):
    """Build a minimal OpenSky state-vector list matching the API field order."""
    # Indices match sv[0]..sv[10] from OpenSky /states/all response
    sv = [None] * 17
    sv[0] = icao24
    sv[1] = callsign
    sv[2] = origin_country
    sv[4] = last_contact
    sv[5] = longitude
    sv[6] = latitude
    sv[7] = baro_altitude
    sv[8] = on_ground
    sv[9] = velocity
    sv[10] = true_track
    return sv


@pytest.mark.asyncio
async def test_null_position_filtered():
    """A state vector with sv[5]=None (null longitude) must be skipped without error."""
    from app.workers.ingest_aircraft import upsert_aircraft

    sv_null_lon = _make_sv(longitude=None)

    # Should return None (skipped), not raise
    from unittest.mock import AsyncMock
    mock_session = AsyncMock()
    result = await upsert_aircraft(mock_session, sv_null_lon)
    assert result is None
    # execute should NOT have been called (row skipped entirely)
    mock_session.execute.assert_not_called()


@pytest.mark.asyncio
async def test_trail_capped_at_20():
    """Trail list must be capped at 20 entries (oldest dropped when at capacity)."""
    from app.workers.ingest_aircraft import build_new_trail

    # 19 existing entries + 1 new = 20 total
    existing_19 = [{"lon": float(i), "lat": float(i), "alt": 1000.0, "ts": i} for i in range(19)]
    new_point = {"lon": 99.0, "lat": 99.0, "alt": 1000.0, "ts": 9999}
    result_19 = build_new_trail(existing_19, new_point)
    assert len(result_19) == 20
    assert result_19[-1] == new_point  # newest is last

    # 20 existing entries + 1 new = still 20 (oldest dropped)
    existing_20 = [{"lon": float(i), "lat": float(i), "alt": 1000.0, "ts": i} for i in range(20)]
    result_20 = build_new_trail(existing_20, new_point)
    assert len(result_20) == 20
    # Oldest entry (ts=0) must be gone
    assert existing_20[0] not in result_20
    assert result_20[-1] == new_point  # newest is last
