from datetime import datetime, timezone

from fastapi.testclient import TestClient

from app.main import app
from app.tasks.ingest_earthquakes import parse_usgs_feature
from app.tasks import ingest_fires
from app.tasks.ingest_fires import parse_firms_row
from app.tasks.ingest_launches import parse_ll2_launch

client = TestClient(app)


def test_parse_usgs_feature():
    feature = {
        "id": "us7000abc",
        "properties": {
            "mag": 5.2,
            "place": "10 km S of Test",
            "time": 1_700_000_000_000,
            "url": "https://earthquake.usgs.gov/test",
        },
        "geometry": {"coordinates": [-122.1, 37.7, 10.5]},
    }
    parsed = parse_usgs_feature(feature)
    assert parsed is not None
    assert parsed["usgs_id"] == "us7000abc"
    assert parsed["latitude"] == 37.7
    assert parsed["longitude"] == -122.1
    assert parsed["magnitude"] == 5.2


def test_parse_usgs_skips_missing_coords():
    assert parse_usgs_feature({"id": "x", "properties": {}, "geometry": {}}) is None


def test_parse_firms_row():
    fetched = datetime(2026, 8, 25, tzinfo=timezone.utc)
    row = {
        "latitude": "10.5",
        "longitude": "20.25",
        "bright_ti4": "330.1",
        "frp": "12.4",
        "confidence": "n",
        "acq_date": "2026-08-25",
        "acq_time": "134",
    }
    parsed = parse_firms_row(row, fetched)
    assert parsed is not None
    assert parsed["latitude"] == 10.5
    assert parsed["frp"] == 12.4
    assert parsed["acq_at"].hour == 1


def test_parse_ll2_launch():
    fetched = datetime(2026, 8, 25, tzinfo=timezone.utc)
    parsed = parse_ll2_launch(
        {
            "id": "abc123",
            "name": "Falcon 9 | Starlink",
            "net": "2026-09-01T12:00:00Z",
            "status": {"abbrev": "Go"},
            "pad": {"name": "SLC-40", "latitude": "28.56", "longitude": "-80.57"},
        },
        fetched,
    )
    assert parsed is not None
    assert parsed["ll2_id"] == "abc123"
    assert parsed["latitude"] == 28.56
    assert parsed["status"] == "Go"


def test_parse_ll2_skips_nameless():
    assert parse_ll2_launch({"id": "x"}, datetime.now(timezone.utc)) is None


def test_parse_ll2_list_mode_string_pad():
    parsed = parse_ll2_launch(
        {
            "id": "list1",
            "name": "Test | List mode",
            "net": "2026-09-01T12:00:00Z",
            "status": "Go",
            "pad": "SLC-40",
        },
        datetime(2026, 8, 25, tzinfo=timezone.utc),
    )
    assert parsed is not None
    assert parsed["pad_name"] == "SLC-40"
    assert parsed["latitude"] is None
    assert parsed["status"] == "Go"


def test_firms_bbox_rejects_globe_span(monkeypatch):
    monkeypatch.setattr(ingest_fires, "get_viewport_bbox", lambda: "box=-80,80,-170,170")
    assert ingest_fires._bbox_from_redis() is None


def test_firms_bbox_keeps_clipped_viewport(monkeypatch):
    monkeypatch.setattr(ingest_fires, "get_viewport_bbox", lambda: "box=24,26,50,52")
    assert ingest_fires._bbox_from_redis() == (24.0, 26.0, 50.0, 52.0)


def test_fire_status_unavailable_without_key(monkeypatch):
    monkeypatch.setattr("app.api.routes_fires.settings.firms_map_key", "")
    res = client.get("/api/fires/status")
    assert res.status_code == 200
    assert res.json()["available"] is False


def test_list_fires_empty_without_key(monkeypatch):
    monkeypatch.setattr("app.api.routes_fires.settings.firms_map_key", "")
    res = client.get("/api/fires/")
    assert res.status_code == 200
    body = res.json()
    assert body["available"] is False
    assert body["cells"] == []


def test_weather_proxies_open_meteo(monkeypatch):
    class FakeResp:
        def raise_for_status(self):
            return None

        def json(self):
            return {
                "current": {
                    "temperature_2m": 18.4,
                    "weather_code": 1,
                    "wind_speed_10m": 12.0,
                    "wind_direction_10m": 220,
                    "time": "2026-08-25T12:00",
                }
            }

    class FakeClient:
        def __init__(self, **_kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *_args):
            return False

        async def get(self, url, params=None):
            assert "open-meteo.com" in url
            assert params["latitude"] == 38.7
            assert params["wind_speed_unit"] == "kn"
            return FakeResp()

    monkeypatch.setattr("app.api.routes_weather.httpx.AsyncClient", FakeClient)
    res = client.get("/api/weather/?lat=38.7&lon=-9.1")
    assert res.status_code == 200
    body = res.json()
    assert body["temperature_c"] == 18.4
    assert body["wind_kn"] == 12.0
    assert body["source"] == "Open-Meteo"
