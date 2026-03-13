"""
Unit tests for AIS message parsing — LAY-03 ingest logic.

These are pure unit tests: no database, no HTTP client, no real WebSocket.
The helper is in backend/app/workers/ingest_ais.py (Plan 03).
Since Plan 01 only defines the contract, we import the function by name
and assert its behaviour so Plan 03 can implement it against these tests.

aisstream.io PositionReport schema reference:
  MessageType: "PositionReport"
  MetaData: { MMSI: int, ShipName: str, ... }
  Message: {
    PositionReport: {
      UserID: int,
      Latitude: float,
      Longitude: float,
      Sog: float,         # Speed over ground in knots
      Cog: float,         # Course over ground
      TrueHeading: int,   # 0-359 degrees, 511 = not available
    }
  }
"""
import pytest
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch, call


def _make_position_report(
    mmsi: int = 123456789,
    ship_name: str = "TEST VESSEL",
    latitude: float = 51.5,
    longitude: float = -0.1,
    sog: float = 12.5,
    cog: float = 90.0,
    true_heading: int = 90,
) -> dict:
    """Build a minimal aisstream.io PositionReport message dict."""
    return {
        "MessageType": "PositionReport",
        "MetaData": {
            "MMSI": mmsi,
            "ShipName": ship_name,
            "latitude": latitude,
            "longitude": longitude,
        },
        "Message": {
            "PositionReport": {
                "UserID": mmsi,
                "Latitude": latitude,
                "Longitude": longitude,
                "Sog": sog,
                "Cog": cog,
                "TrueHeading": true_heading,
            }
        },
    }


def test_parse_position_report():
    """parse_ais_message with valid PositionReport returns dict with expected keys."""
    from app.workers.ingest_ais import parse_ais_message

    msg = _make_position_report()
    result = parse_ais_message(msg)
    assert result is not None
    assert "mmsi" in result
    assert "latitude" in result
    assert "longitude" in result
    assert "sog" in result
    assert "cog" in result
    assert "true_heading" in result
    assert "ship_name" in result
    assert result["mmsi"] == 123456789
    assert result["latitude"] == 51.5
    assert result["longitude"] == -0.1


def test_non_position_report_ignored():
    """parse_ais_message with MessageType != 'PositionReport' must return None."""
    from app.workers.ingest_ais import parse_ais_message

    msg = {
        "MessageType": "ShipStaticData",
        "MetaData": {
            "MMSI": 123456789,
            "ShipName": "TEST VESSEL",
        },
        "Message": {
            "ShipStaticData": {
                "UserID": 123456789,
                "Name": "TEST VESSEL",
                "ImoNumber": 1234567,
            }
        },
    }
    result = parse_ais_message(msg)
    assert result is None


# ---------------------------------------------------------------------------
# SHIP-01 freshness field tests — Task 1 (TDD RED phase)
# ---------------------------------------------------------------------------


def _make_redis_client_with_one_ship(
    mmsi: str = "111111",
    time_utc: str = "2026-03-13T10:00:00",
):
    """Build a mock redis_client with scan_iter yielding one ship key."""
    redis_client = MagicMock()

    key = f"ship:{mmsi}".encode()
    ship_data = {
        b"mmsi": mmsi.encode(),
        b"ship_name": b"TEST VESSEL",
        b"latitude": b"51.5",
        b"longitude": b"-0.1",
        b"sog": b"12.5",
        b"cog": b"90.0",
        b"true_heading": b"90",
        b"nav_status": b"0",
        b"time_utc": time_utc.encode(),
    }

    async def _scan_iter(pattern):
        yield key

    redis_client.scan_iter = _scan_iter
    redis_client.hgetall = AsyncMock(return_value=ship_data)
    return redis_client


def _make_session_factory():
    """Build a mock async session_factory context manager."""
    mock_session = AsyncMock()
    mock_session.execute = AsyncMock()
    mock_session.commit = AsyncMock()

    session_ctx = AsyncMock()
    session_ctx.__aenter__ = AsyncMock(return_value=mock_session)
    session_ctx.__aexit__ = AsyncMock(return_value=False)

    session_factory = MagicMock(return_value=session_ctx)
    return session_factory, mock_session


@pytest.mark.asyncio
async def test_last_seen_at_written():
    """batch_flush_ships_to_pg upserts last_seen_at from time_utc field."""
    from app.workers.ingest_ais import batch_flush_ships_to_pg

    redis_client = _make_redis_client_with_one_ship(
        mmsi="111111", time_utc="2026-03-13T10:00:00"
    )
    session_factory, mock_session = _make_session_factory()

    await batch_flush_ships_to_pg(redis_client, session_factory)

    # The execute call on the session contains the INSERT stmt — check values
    assert mock_session.execute.called
    # Extract the insert statement values from the call
    call_args = mock_session.execute.call_args_list
    # First call is the insert upsert statement
    insert_stmt = call_args[0][0][0]
    # Access the clause compile or check via string representation
    stmt_str = str(insert_stmt)
    assert "last_seen_at" in stmt_str


@pytest.mark.asyncio
async def test_is_active_true_for_seen():
    """batch_flush_ships_to_pg sets is_active=True for seen ships in on_conflict_do_update."""
    from app.workers.ingest_ais import batch_flush_ships_to_pg

    redis_client = _make_redis_client_with_one_ship()
    session_factory, mock_session = _make_session_factory()

    await batch_flush_ships_to_pg(redis_client, session_factory)

    assert mock_session.execute.called
    call_args = mock_session.execute.call_args_list
    insert_stmt = call_args[0][0][0]
    stmt_str = str(insert_stmt)
    assert "is_active" in stmt_str


@pytest.mark.asyncio
async def test_deactivation_sweep_marks_absent_inactive():
    """batch_flush_ships_to_pg calls sa_update to mark ships not in current scan as inactive."""
    from app.workers.ingest_ais import batch_flush_ships_to_pg
    from sqlalchemy.sql.dml import Update

    redis_client = _make_redis_client_with_one_ship(mmsi="111111")
    session_factory, mock_session = _make_session_factory()

    await batch_flush_ships_to_pg(redis_client, session_factory)

    # session.execute is called at least twice: once for INSERT, once for sweep UPDATE
    assert mock_session.execute.call_count >= 2
    # The second call should be the deactivation sweep
    sweep_call = mock_session.execute.call_args_list[1]
    sweep_stmt = sweep_call[0][0]
    sweep_str = str(sweep_stmt)
    # Verify the UPDATE targets the Ship table and sets is_active
    assert "is_active" in sweep_str
    assert "NOT IN" in sweep_str.upper()
    # Verify the sweep is an UPDATE statement (not an INSERT)
    assert isinstance(sweep_stmt, Update)


@pytest.mark.asyncio
async def test_deactivation_skipped_when_empty_redis():
    """batch_flush_ships_to_pg returns 0 and skips sa_update when Redis scan is empty."""
    from app.workers.ingest_ais import batch_flush_ships_to_pg

    # Redis with no keys
    redis_client = MagicMock()

    async def _empty_scan(pattern):
        return
        yield  # make it an async generator

    redis_client.scan_iter = _empty_scan
    redis_client.hgetall = AsyncMock(return_value={})

    session_factory, mock_session = _make_session_factory()

    result = await batch_flush_ships_to_pg(redis_client, session_factory)

    assert result == 0
    # session.execute should NOT have been called (no rows, early return)
    assert not mock_session.execute.called


# ---------------------------------------------------------------------------
# parse_time_utc helper tests — Task 1 (TDD RED — function not yet added)
# ---------------------------------------------------------------------------


def test_parse_time_utc_naive_gets_utc():
    """parse_time_utc with naive ISO string attaches UTC timezone."""
    from app.workers.ingest_ais import parse_time_utc

    result = parse_time_utc("2026-03-13T10:00:00")
    assert result is not None
    assert isinstance(result, datetime)
    assert result.tzinfo is not None
    assert result.tzinfo == timezone.utc
    assert result.year == 2026
    assert result.month == 3
    assert result.day == 13


def test_parse_time_utc_none_returns_none():
    """parse_time_utc(None) returns None without raising."""
    from app.workers.ingest_ais import parse_time_utc

    result = parse_time_utc(None)
    assert result is None


def test_parse_time_utc_malformed_returns_none():
    """parse_time_utc with unparseable string returns None without raising."""
    from app.workers.ingest_ais import parse_time_utc

    result = parse_time_utc("not-a-date")
    assert result is None
