from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_health_returns_200():
    response = client.get("/api/health")
    assert response.status_code == 200


def test_health_has_version():
    response = client.get("/api/health")
    data = response.json()
    assert "version" in data
    assert isinstance(data["version"], str)


def test_health_status_ok():
    response = client.get("/api/health")
    assert response.json()["status"] == "ok"
