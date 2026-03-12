"""
Snapshot helper unit tests — REP-01 contract (TDD RED phase).

Tests are written before implementation exists.
All unit tests use deferred imports inside test body so that
ModuleNotFoundError is the RED failure — not a collection-time error.

Once backend/app/tasks/snapshot_positions.py is implemented (Plan 02),
all tests should turn GREEN.
"""
from datetime import date, datetime, timezone


# ---------------------------------------------------------------------------
# Unit tests for snapshot_from_* pure helpers
# ---------------------------------------------------------------------------

def test_snapshot_from_aircraft():
    """snapshot_from_aircraft maps an aircraft row dict to a canonical snapshot dict."""
    from app.tasks.snapshot_positions import snapshot_from_aircraft

    ts = datetime(2026, 3, 12, 10, 0, 0, tzinfo=timezone.utc)
    row = {
        "icao24": "abc123",
        "latitude": 51.5074,
        "longitude": -0.1278,
        "baro_altitude": 10000.0,
        "velocity": 250.0,
        "true_track": 90.0,
    }
    result = snapshot_from_aircraft(row, ts)
    assert "ts" in result
    assert result["layer_type"] == "aircraft"
    assert "entity_id" in result
    assert "latitude" in result
    assert "longitude" in result
    assert "altitude" in result
    assert "heading" in result
    assert "speed" in result


def test_snapshot_from_military():
    """snapshot_from_military maps a military aircraft row dict to a canonical snapshot dict."""
    from app.tasks.snapshot_positions import snapshot_from_military

    ts = datetime(2026, 3, 12, 10, 0, 0, tzinfo=timezone.utc)
    row = {
        "hex": "ae1234",
        "latitude": 48.8566,
        "longitude": 2.3522,
        "alt_baro": 35000,
        "gs": 450.0,
        "track": 270.0,
    }
    result = snapshot_from_military(row, ts)
    assert "ts" in result
    assert result["layer_type"] == "military"
    assert "entity_id" in result
    assert "latitude" in result
    assert "longitude" in result
    assert "altitude" in result
    assert "heading" in result
    assert "speed" in result


def test_snapshot_from_ship():
    """snapshot_from_ship maps a ship row dict to a canonical snapshot dict; altitude is None."""
    from app.tasks.snapshot_positions import snapshot_from_ship

    ts = datetime(2026, 3, 12, 10, 0, 0, tzinfo=timezone.utc)
    row = {
        "mmsi": 123456789,
        "latitude": 40.7128,
        "longitude": -74.0060,
        "sog": 12.5,
        "true_heading": 180,
    }
    result = snapshot_from_ship(row, ts)
    assert "ts" in result
    assert result["layer_type"] == "ship"
    assert "entity_id" in result
    assert "latitude" in result
    assert "longitude" in result
    assert result["altitude"] is None
    assert "heading" in result
    assert "speed" in result


def test_ensure_partition_name():
    """ensure_partition_name returns the expected table name string for a given date."""
    from app.tasks.snapshot_positions import ensure_partition_name

    result = ensure_partition_name(date(2026, 3, 12))
    assert result == "position_snapshots_2026_03_12"
