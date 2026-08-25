from fastapi.testclient import TestClient
from app.main import app
from app.config import Settings
import app.api.routes_health as routes_health

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


def test_ready_checks_database_and_redis(monkeypatch):
    class FakeRedis:
        async def ping(self):
            return True

        async def aclose(self):
            return None

    monkeypatch.setattr(
        routes_health.Redis,
        "from_url",
        lambda *_args, **_kwargs: FakeRedis(),
    )
    response = client.get("/api/ready")
    assert response.status_code == 200
    assert response.json()["status"] == "ready"
    assert response.json()["dependencies"] == {"database": True, "redis": True}


def test_railway_postgres_url_is_normalized_for_asyncpg():
    settings = Settings(
        database_url="postgresql://user:password@postgres.railway.internal:5432/app"
    )
    assert settings.database_url.startswith("postgresql+asyncpg://")
