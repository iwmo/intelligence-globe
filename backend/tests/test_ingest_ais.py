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
