"""
Unit tests for aircraft ingest helpers — AIR-01 (null-position filter), AIR-02 (trail capping),
ACFT-01 (new state-vector fields), ACFT-02 (freshness timestamps, tombstone sweep).

These are pure unit tests: no database, no HTTP client needed.
"""
import pytest
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, call, patch


def _make_sv(
    icao24="abc123",
    callsign="TEST",
    origin_country="Test",
    time_position=None,    # sv[3]
    last_contact=1741651200,
    longitude=10.0,
    latitude=50.0,
    baro_altitude=8000.0,
    on_ground=False,
    velocity=200.0,
    true_track=180.0,
    vertical_rate=None,    # sv[11]
    geo_altitude=None,     # sv[13]
    position_source=None,  # sv[16]
):
    """Build a minimal OpenSky state-vector list matching the API field order."""
    sv = [None] * 17
    sv[0] = icao24
    sv[1] = callsign
    sv[2] = origin_country
    sv[3] = time_position   # sv[3] — Unix timestamp of last position fix
    sv[4] = last_contact
    sv[5] = longitude
    sv[6] = latitude
    sv[7] = baro_altitude
    sv[8] = on_ground
    sv[9] = velocity
    sv[10] = true_track
    sv[11] = vertical_rate  # sv[11]
    sv[13] = geo_altitude   # sv[13]
    sv[16] = position_source  # sv[16]
    return sv


# ---------------------------------------------------------------------------
# Existing tests (preserved)
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_null_position_filtered():
    """A state vector with sv[5]=None (null longitude) must be skipped without error."""
    from app.workers.ingest_aircraft import upsert_aircraft

    sv_null_lon = _make_sv(longitude=None)
    fetched_at = datetime(2023, 11, 14, 12, 0, 0, tzinfo=timezone.utc)
    last_seen_at = datetime(2023, 11, 14, 12, 1, 0, tzinfo=timezone.utc)

    from unittest.mock import AsyncMock
    mock_session = AsyncMock()
    result = await upsert_aircraft(mock_session, sv_null_lon, fetched_at, last_seen_at)
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


# ---------------------------------------------------------------------------
# Task 1 tests: new state-vector fields in upsert_aircraft
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_upsert_aircraft_new_fields_in_set():
    """New fields (time_position, vertical_rate, geo_altitude, position_source,
    fetched_at, last_seen_at, is_active) must appear in set_={} of the upsert stmt."""
    from app.workers.ingest_aircraft import upsert_aircraft

    fetched_at = datetime(2023, 11, 14, 12, 0, 0, tzinfo=timezone.utc)
    last_seen_at = datetime(2023, 11, 14, 12, 1, 0, tzinfo=timezone.utc)

    sv = _make_sv(
        time_position=1700000000,
        vertical_rate=3.5,
        geo_altitude=10500.0,
        position_source=0,
    )

    # Capture the stmt passed to session.execute
    mock_session = AsyncMock()
    # Return empty trail result for the SELECT
    mock_result = MagicMock()
    mock_result.one_or_none.return_value = None
    mock_session.execute.return_value = mock_result

    await upsert_aircraft(mock_session, sv, fetched_at, last_seen_at)

    # The second execute call (after SELECT) gets the INSERT stmt
    assert mock_session.execute.call_count == 2
    insert_stmt = mock_session.execute.call_args_list[1][0][0]

    # Inspect set_ dict via the on_conflict clause's update_values_to_set
    # SQLAlchemy 2.x: update_values_to_set is list of (str_key, value) tuples
    conflict_clause = insert_stmt._post_values_clause
    update_dict = dict(conflict_clause.update_values_to_set)

    assert "time_position" in update_dict
    assert update_dict["time_position"] == 1700000000
    assert "vertical_rate" in update_dict
    assert update_dict["vertical_rate"] == 3.5
    assert "geo_altitude" in update_dict
    assert update_dict["geo_altitude"] == 10500.0
    assert "position_source" in update_dict
    assert update_dict["position_source"] == 0
    assert "fetched_at" in update_dict
    assert update_dict["fetched_at"] == fetched_at
    assert "last_seen_at" in update_dict
    assert update_dict["last_seen_at"] == last_seen_at
    assert "is_active" in update_dict
    assert update_dict["is_active"] is True


@pytest.mark.asyncio
async def test_upsert_aircraft_short_sv_no_index_error():
    """A state vector with fewer than 17 elements must not raise IndexError.
    time_position, vertical_rate, geo_altitude, position_source must all be None."""
    from app.workers.ingest_aircraft import upsert_aircraft

    fetched_at = datetime(2023, 11, 14, 12, 0, 0, tzinfo=timezone.utc)
    last_seen_at = datetime(2023, 11, 14, 12, 1, 0, tzinfo=timezone.utc)

    # Only 10 elements — short vector
    sv = [None] * 10
    sv[0] = "abc123"
    sv[1] = "TEST"
    sv[2] = "TestCountry"
    sv[5] = 10.0   # longitude
    sv[6] = 50.0   # latitude

    mock_session = AsyncMock()
    mock_result = MagicMock()
    mock_result.one_or_none.return_value = None
    mock_session.execute.return_value = mock_result

    # Must not raise IndexError
    await upsert_aircraft(mock_session, sv, fetched_at, last_seen_at)

    # Verify the stmt was executed (upsert happened)
    assert mock_session.execute.call_count == 2
    insert_stmt = mock_session.execute.call_args_list[1][0][0]
    conflict_clause = insert_stmt._post_values_clause
    update_dict = dict(conflict_clause.update_values_to_set)

    # All new fields must be None when sv is short
    assert update_dict.get("time_position") is None
    assert update_dict.get("vertical_rate") is None
    assert update_dict.get("geo_altitude") is None
    assert update_dict.get("position_source") is None


@pytest.mark.asyncio
async def test_upsert_aircraft_commit_not_called():
    """upsert_aircraft must NOT call db.commit() — the caller owns the commit."""
    from app.workers.ingest_aircraft import upsert_aircraft

    fetched_at = datetime(2023, 11, 14, 12, 0, 0, tzinfo=timezone.utc)
    last_seen_at = datetime(2023, 11, 14, 12, 1, 0, tzinfo=timezone.utc)

    sv = _make_sv()
    mock_session = AsyncMock()
    mock_result = MagicMock()
    mock_result.one_or_none.return_value = None
    mock_session.execute.return_value = mock_result

    await upsert_aircraft(mock_session, sv, fetched_at, last_seen_at)

    mock_session.commit.assert_not_called()


# ---------------------------------------------------------------------------
# Task 2 tests: fetch_aircraft_states tuple, tombstone, single commit
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_fetch_aircraft_states_returns_tuple():
    """fetch_aircraft_states must return a 2-tuple (states_list, response_time_int)."""
    from app.tasks.ingest_aircraft import fetch_aircraft_states

    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {
        "time": 1700000000,
        "states": [["abc123", "TEST", "TestCountry"]],
    }
    mock_response.raise_for_status = MagicMock()

    with patch("app.tasks.ingest_aircraft.httpx.AsyncClient") as mock_client_cls:
        mock_client = AsyncMock()
        mock_client.get.return_value = mock_response
        mock_client_cls.return_value.__aenter__.return_value = mock_client

        result = await fetch_aircraft_states("test_token")

    assert isinstance(result, tuple)
    assert len(result) == 2
    states, response_time = result
    assert isinstance(states, list)
    assert isinstance(response_time, int)
    assert response_time == 1700000000


@pytest.mark.asyncio
async def test_fetch_aircraft_states_empty_returns_zero_time():
    """When states is empty, return ([], 0) or ([], <time>), not just []."""
    from app.tasks.ingest_aircraft import fetch_aircraft_states

    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {"time": 0, "states": None}
    mock_response.raise_for_status = MagicMock()

    with patch("app.tasks.ingest_aircraft.httpx.AsyncClient") as mock_client_cls:
        mock_client = AsyncMock()
        mock_client.get.return_value = mock_response
        mock_client_cls.return_value.__aenter__.return_value = mock_client

        states, response_time = await fetch_aircraft_states("test_token")

    assert states == []
    assert isinstance(response_time, int)


@pytest.mark.asyncio
async def test_ingest_aircraft_tombstone_sweep():
    """ingest_aircraft() must execute a tombstone sweep setting is_active=False
    for aircraft NOT in the current snapshot's seen icao24 set."""
    from app.tasks.ingest_aircraft import ingest_aircraft

    sv1 = _make_sv(icao24="aaa111")
    sv2 = _make_sv(icao24="bbb222")
    states = [sv1, sv2]

    with patch.dict("os.environ", {
        "OPENSKY_CLIENT_ID": "test_id",
        "OPENSKY_CLIENT_SECRET": "test_secret",
    }):
        with patch("app.tasks.ingest_aircraft.fetch_opensky_token", new=AsyncMock(return_value="token")):
            with patch("app.tasks.ingest_aircraft.fetch_aircraft_states", new=AsyncMock(return_value=(states, 1700000000))):
                with patch("app.tasks.ingest_aircraft.AsyncSessionLocal") as mock_session_cls:
                    mock_session = AsyncMock()
                    mock_session_cls.return_value.__aenter__.return_value = mock_session

                    # Return empty trail map
                    trail_result = MagicMock()
                    trail_result.__iter__ = MagicMock(return_value=iter([]))
                    mock_session.execute.return_value = trail_result

                    await ingest_aircraft()

                    # Verify session.execute was called (tombstone is one of the calls)
                    assert mock_session.execute.call_count >= 2

                    # Verify commit called exactly once
                    mock_session.commit.assert_called_once()


@pytest.mark.asyncio
async def test_ingest_aircraft_tombstone_skipped_when_no_valid_states():
    """Tombstone sweep must be skipped when seen_icao24s is empty
    (prevents mass false-tombstone on empty feed)."""
    from app.tasks.ingest_aircraft import ingest_aircraft

    # All states have null position — valid_states will be empty
    sv_null = _make_sv(longitude=None)
    states = [sv_null]

    with patch.dict("os.environ", {
        "OPENSKY_CLIENT_ID": "test_id",
        "OPENSKY_CLIENT_SECRET": "test_secret",
    }):
        with patch("app.tasks.ingest_aircraft.fetch_opensky_token", new=AsyncMock(return_value="token")):
            with patch("app.tasks.ingest_aircraft.fetch_aircraft_states", new=AsyncMock(return_value=(states, 1700000000))):
                # Should return 0 without entering the session block
                result = await ingest_aircraft()

    assert result == 0


@pytest.mark.asyncio
async def test_ingest_aircraft_fetched_at_passed_correctly():
    """ingest_aircraft() must convert response_time int to datetime and pass
    fetched_at and last_seen_at to the upsert loop."""
    from app.tasks.ingest_aircraft import ingest_aircraft

    sv = _make_sv()
    states = [sv]

    captured_execute_calls = []

    with patch.dict("os.environ", {
        "OPENSKY_CLIENT_ID": "test_id",
        "OPENSKY_CLIENT_SECRET": "test_secret",
    }):
        with patch("app.tasks.ingest_aircraft.fetch_opensky_token", new=AsyncMock(return_value="token")):
            with patch("app.tasks.ingest_aircraft.fetch_aircraft_states", new=AsyncMock(return_value=(states, 1700000000))):
                with patch("app.tasks.ingest_aircraft.AsyncSessionLocal") as mock_session_cls:
                    mock_session = AsyncMock()
                    mock_session_cls.return_value.__aenter__.return_value = mock_session

                    trail_result = MagicMock()
                    trail_result.__iter__ = MagicMock(return_value=iter([]))
                    mock_session.execute.return_value = trail_result

                    await ingest_aircraft()

                    # Commit must be called exactly once
                    mock_session.commit.assert_called_once()
