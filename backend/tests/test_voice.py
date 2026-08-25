from fastapi.testclient import TestClient

from app.api.routes_voice import extract_client_secret
from app.main import app

client = TestClient(app)


def test_voice_status_unavailable_without_key(monkeypatch):
    monkeypatch.setattr("app.api.routes_voice.settings.openai_api_key", "")
    res = client.get("/api/voice/status")
    assert res.status_code == 200
    assert res.json()["available"] is False


def test_voice_session_requires_api_key(monkeypatch):
    monkeypatch.setattr("app.config.settings.api_key", "correct-key")
    monkeypatch.setattr("app.api.routes_voice.settings.openai_api_key", "sk-test")
    res = client.post("/api/voice/session")
    assert res.status_code == 401


def test_voice_session_unavailable_without_openai(monkeypatch):
    monkeypatch.setattr("app.config.settings.api_key", "correct-key")
    monkeypatch.setattr("app.api.routes_voice.settings.openai_api_key", "")
    res = client.post("/api/voice/session", headers={"X-API-Key": "correct-key"})
    assert res.status_code == 503


def test_extract_client_secret_ga_and_beta():
    assert extract_client_secret({"value": "ek_ga"}) == "ek_ga"
    assert extract_client_secret({"client_secret": {"value": "ek_beta"}}) == "ek_beta"
    assert extract_client_secret({"client_secret": "ek_str"}) == "ek_str"
    assert extract_client_secret({}) is None


def test_voice_session_mints_ga_client_secret(monkeypatch):
    monkeypatch.setattr("app.config.settings.api_key", "correct-key")
    monkeypatch.setattr("app.api.routes_voice.settings.openai_api_key", "sk-test")
    monkeypatch.setattr("app.api.routes_voice.settings.voice_model", "gpt-realtime-2.1-mini")

    class FakeResp:
        status_code = 200
        content = b"{}"

        def json(self):
            return {"value": "ek_test", "session": {"type": "realtime"}}

    class FakeClient:
        def __init__(self, **_kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *_args):
            return False

        async def post(self, url, headers=None, json=None):
            assert url == "https://api.openai.com/v1/realtime/client_secrets"
            assert json["session"]["type"] == "realtime"
            assert json["session"]["model"] == "gpt-realtime-2.1-mini"
            return FakeResp()

    monkeypatch.setattr("app.api.routes_voice.httpx.AsyncClient", FakeClient)
    res = client.post("/api/voice/session", headers={"X-API-Key": "correct-key"})
    assert res.status_code == 200
    body = res.json()
    assert body["client_secret"] == "ek_test"
    assert "fly_to" in body["tools"]
    assert "enter_cockpit" in body["tools"]
    assert "count_flights_in_bbox" in body["tools"]
    assert "geocode_place" in body["tools"]
    assert "nearby_places" in body["tools"]
