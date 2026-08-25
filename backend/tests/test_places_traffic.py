from app.lib.geo_budget import clamp_bbox, congestion_bucket, congestion_ratio, sample_grid
from app.main import app
from fastapi.testclient import TestClient

client = TestClient(app)


def test_clamp_bbox_centers_and_caps_span():
    south, north, west, east = clamp_bbox(34.0, 35.0, -121.0, -120.0, max_span=0.08)
    assert north - south <= 0.081
    assert east - west <= 0.081
    assert abs((south + north) / 2 - 34.5) < 0.01


def test_congestion_buckets():
    assert congestion_bucket(congestion_ratio(90, 100)) == "free"
    assert congestion_bucket(congestion_ratio(20, 100)) == "standstill"
    assert congestion_bucket(None, closed=True) == "closed"


def test_sample_grid_is_3x3():
    pts = sample_grid(0, 2, 0, 2, n=3)
    assert len(pts) == 9
    assert pts[0] == (0, 0)
    assert pts[-1] == (2, 2)


def test_places_status_defaults_to_nominatim(monkeypatch):
    monkeypatch.setattr("app.api.routes_places.settings.google_maps_api_key", "")
    res = client.get("/api/places/status")
    assert res.status_code == 200
    body = res.json()
    assert body["available"] is True
    assert body["provider"] == "nominatim"
    assert body["nearby"] is False


def test_traffic_status_defaults_to_sim(monkeypatch):
    monkeypatch.setattr("app.api.routes_traffic.settings.tomtom_api_key", "")
    res = client.get("/api/traffic/status")
    assert res.status_code == 200
    assert res.json()["mode"] == "sim"


def test_traffic_flow_keyless_is_sim(monkeypatch):
    monkeypatch.setattr("app.api.routes_traffic.settings.tomtom_api_key", "")
    res = client.get("/api/traffic/flow?min_lat=34.6&max_lat=34.7&min_lon=-120.7&max_lon=-120.6")
    assert res.status_code == 200
    assert res.json()["mode"] == "sim"
    assert res.json()["samples"] == []


def test_places_geocode_uses_nominatim(monkeypatch):
    monkeypatch.setattr("app.api.routes_places.settings.google_maps_api_key", "")

    class FakeResp:
        def raise_for_status(self):
            return None

        def json(self):
            return [{"display_name": "Lisbon, Portugal", "lat": "38.72", "lon": "-9.14"}]

    class FakeClient:
        def __init__(self, **_kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *_args):
            return False

        async def get(self, url, params=None, headers=None):
            assert "nominatim" in url
            return FakeResp()

    monkeypatch.setattr("app.api.routes_places.httpx.AsyncClient", FakeClient)
    res = client.get("/api/places/geocode?q=LIS")
    assert res.status_code == 200
    body = res.json()
    assert body["provider"] == "nominatim"
    assert body["results"][0]["lat"] == 38.72


def test_nearby_without_google_key(monkeypatch):
    monkeypatch.setattr("app.api.routes_places.settings.google_maps_api_key", "")
    res = client.get("/api/places/nearby?lat=38.72&lon=-9.14")
    assert res.status_code == 200
    assert res.json()["available"] is False
