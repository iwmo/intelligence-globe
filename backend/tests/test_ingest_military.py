"""
Unit tests for military aircraft ingest helpers — LAY-01 ingest logic.

These are pure unit tests: no database, no HTTP client needed.
The helper is in backend/app/tasks/ingest_military.py (Plan 02).
Since Plan 01 only defines the contract, we import the function by name
and assert its behaviour so Plan 02 can implement it against these tests.
"""
import pytest
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch


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


# ---------------------------------------------------------------------------
# MIL-01: freshness fields and tombstone sweep tests
# ---------------------------------------------------------------------------

def _make_ac(hex_code="ae0001", lat=10.0, lon=20.0):
    """Build a minimal military aircraft dict with valid position."""
    return {
        "hex": hex_code,
        "lat": lat,
        "lon": lon,
        "alt_baro": 15000,
        "gs": 400.0,
        "track": 90.0,
        "flight": "TEST01",
        "t": "F16",
        "r": "N12345",
        "squawk": "7500",
        "nic": 8,
        "nac_p": 9,
    }


def _make_mock_session():
    """Create an async context manager mock for AsyncSessionLocal."""
    mock_session = AsyncMock()
    mock_session.execute = AsyncMock()
    mock_session.commit = AsyncMock()
    mock_cm = MagicMock()
    mock_cm.__aenter__ = AsyncMock(return_value=mock_session)
    mock_cm.__aexit__ = AsyncMock(return_value=False)
    return mock_cm, mock_session


def _make_mock_response(ac_list):
    """Create a mock httpx response with given aircraft list."""
    mock_resp = MagicMock()
    mock_resp.raise_for_status = MagicMock()
    mock_resp.json = MagicMock(return_value={"ac": ac_list})
    return mock_resp


@pytest.mark.asyncio
async def test_fetched_at_written():
    """ingest_military_aircraft() must write fetched_at and last_seen_at in set_={} for each upserted row."""
    from app.tasks.ingest_military import ingest_military_aircraft

    mock_cm, mock_session = _make_mock_session()
    mock_resp = _make_mock_response([_make_ac("ae0001")])
    mock_http_client = AsyncMock()
    mock_http_client.get = AsyncMock(return_value=mock_resp)
    mock_http_cm = MagicMock()
    mock_http_cm.__aenter__ = AsyncMock(return_value=mock_http_client)
    mock_http_cm.__aexit__ = AsyncMock(return_value=False)

    with patch("app.tasks.ingest_military.AsyncSessionLocal", return_value=mock_cm), \
         patch("httpx.AsyncClient", return_value=mock_http_cm):
        await ingest_military_aircraft()

    # The first execute call is the upsert for "ae0001"
    first_call_args = str(mock_session.execute.call_args_list[0])
    assert "fetched_at" in first_call_args
    assert "last_seen_at" in first_call_args


@pytest.mark.asyncio
async def test_is_active_true_for_seen():
    """ingest_military_aircraft() must write is_active=True in set_={} for each upserted row."""
    from app.tasks.ingest_military import ingest_military_aircraft

    mock_cm, mock_session = _make_mock_session()
    mock_resp = _make_mock_response([_make_ac("ae0001")])
    mock_http_client = AsyncMock()
    mock_http_client.get = AsyncMock(return_value=mock_resp)
    mock_http_cm = MagicMock()
    mock_http_cm.__aenter__ = AsyncMock(return_value=mock_http_client)
    mock_http_cm.__aexit__ = AsyncMock(return_value=False)

    with patch("app.tasks.ingest_military.AsyncSessionLocal", return_value=mock_cm), \
         patch("httpx.AsyncClient", return_value=mock_http_cm):
        await ingest_military_aircraft()

    first_call_args = str(mock_session.execute.call_args_list[0])
    assert "is_active" in first_call_args


@pytest.mark.asyncio
async def test_tombstone_marks_absent_inactive():
    """Aircraft absent from response must be marked is_active=False via tombstone sweep.

    Response contains only "ae0001" — so "ae9999" (previously active) should be
    swept inactive. We verify by asserting a second execute() call occurs (the tombstone)
    and that it references 'not_in' in its string representation.
    """
    from app.tasks.ingest_military import ingest_military_aircraft

    mock_cm, mock_session = _make_mock_session()
    mock_resp = _make_mock_response([_make_ac("ae0001")])
    mock_http_client = AsyncMock()
    mock_http_client.get = AsyncMock(return_value=mock_resp)
    mock_http_cm = MagicMock()
    mock_http_cm.__aenter__ = AsyncMock(return_value=mock_http_client)
    mock_http_cm.__aexit__ = AsyncMock(return_value=False)

    with patch("app.tasks.ingest_military.AsyncSessionLocal", return_value=mock_cm), \
         patch("httpx.AsyncClient", return_value=mock_http_cm):
        await ingest_military_aircraft()

    # 1 upsert for "ae0001" + 1 tombstone sweep = 2 execute calls
    assert mock_session.execute.call_count == 2, (
        f"Expected 2 execute calls (1 upsert + 1 tombstone), got {mock_session.execute.call_count}"
    )
    tombstone_call_args = str(mock_session.execute.call_args_list[-1])
    assert "not_in" in tombstone_call_args.lower() or "notin" in tombstone_call_args.lower(), (
        f"Tombstone call does not appear to use not_in: {tombstone_call_args}"
    )


@pytest.mark.asyncio
async def test_tombstone_skipped_when_empty_valid_records():
    """When the API returns no aircraft with valid positions, no tombstone sweep must occur."""
    from app.tasks.ingest_military import ingest_military_aircraft

    # One aircraft with lat=None so it gets filtered out, leaving valid_records empty
    mock_cm, mock_session = _make_mock_session()
    mock_resp = _make_mock_response([_make_ac("ae0001", lat=None)])
    mock_http_client = AsyncMock()
    mock_http_client.get = AsyncMock(return_value=mock_resp)
    mock_http_cm = MagicMock()
    mock_http_cm.__aenter__ = AsyncMock(return_value=mock_http_client)
    mock_http_cm.__aexit__ = AsyncMock(return_value=False)

    with patch("app.tasks.ingest_military.AsyncSessionLocal", return_value=mock_cm), \
         patch("httpx.AsyncClient", return_value=mock_http_cm):
        result = await ingest_military_aircraft()

    # Function returns 0 early when valid_records is empty — no DB session used at all
    assert result == 0
    mock_session.execute.assert_not_called()
