from fastapi.testclient import TestClient

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
