"""Tests for GDELT-01 through GDELT-04 (Phase 34: Backend Foundation).

Wave 0 scaffold — all 15 stubs are in RED state (xfail or known-failing assertion).
Plans 34-02 through 34-05 will make them green incrementally.

Groups:
  - Unit tests for parse helpers (top)
  - Integration DB tests (middle)
  - Integration API tests (bottom)
"""
import pytest
import pytest_asyncio
from unittest.mock import AsyncMock, MagicMock, patch
from datetime import datetime, timezone, timedelta

from httpx import AsyncClient, ASGITransport


# ---------------------------------------------------------------------------
# Unit tests — parse helpers
# ---------------------------------------------------------------------------


@pytest.mark.xfail(strict=False, reason="ingest_gdelt not yet implemented")
def test_parse_export_url():
    """parse_export_url returns the .export.CSV.zip URL from a 3-line lastupdate.txt."""
    from app.tasks.ingest_gdelt import parse_export_url  # noqa: PLC0415

    lastupdate_text = (
        "20260314123000 4200 http://data.gdeltproject.org/gdeltv2/20260314123000.gkg.csv.zip\n"
        "20260314123000 6300 http://data.gdeltproject.org/gdeltv2/20260314123000.mentions.csv.zip\n"
        "20260314123000 8900 http://data.gdeltproject.org/gdeltv2/20260314123000.export.CSV.zip\n"
    )
    result = parse_export_url(lastupdate_text)
    assert result == "http://data.gdeltproject.org/gdeltv2/20260314123000.export.CSV.zip"


@pytest.mark.xfail(strict=False, reason="ingest_gdelt not yet implemented")
def test_null_coordinates_skipped():
    """parse_gdelt_row returns None when lat or lon field is empty string."""
    from app.tasks.ingest_gdelt import parse_gdelt_row  # noqa: PLC0415

    row = {
        "ActionGeo_Lat": "",
        "ActionGeo_Long": "10.5",
        "QuadClass": "3",
        "SQLDATE": "20260314",
        "DATEADDED": "20260314000000",
        "GLOBALEVENTID": "123456789",
        "EventCode": "040",
        "Actor1Name": "",
        "Actor2Name": "",
        "SOURCEURL": "http://example.com",
        "AvgTone": "-1.5",
        "NumMentions": "5",
        "GoldsteinScale": "2.0",
    }
    assert parse_gdelt_row(row) is None


@pytest.mark.xfail(strict=False, reason="ingest_gdelt not yet implemented")
def test_quad_class_filter():
    """parse_gdelt_row returns None when quad_class == 1 (Verbal Cooperation)."""
    from app.tasks.ingest_gdelt import parse_gdelt_row  # noqa: PLC0415

    row = {
        "ActionGeo_Lat": "48.8566",
        "ActionGeo_Long": "2.3522",
        "QuadClass": "1",
        "SQLDATE": "20260314",
        "DATEADDED": "20260314000000",
        "GLOBALEVENTID": "123456790",
        "EventCode": "012",
        "Actor1Name": "FRANCE",
        "Actor2Name": "GERMANY",
        "SOURCEURL": "http://example.com",
        "AvgTone": "3.0",
        "NumMentions": "2",
        "GoldsteinScale": "1.0",
    }
    assert parse_gdelt_row(row) is None


@pytest.mark.xfail(strict=False, reason="ingest_gdelt not yet implemented")
def test_sqldate_parsing():
    """parse_gdelt_row converts SQLDATE '20260314' to datetime(2026, 3, 14, tzinfo=UTC) as occurred_at."""
    from app.tasks.ingest_gdelt import parse_gdelt_row  # noqa: PLC0415

    row = {
        "ActionGeo_Lat": "48.8566",
        "ActionGeo_Long": "2.3522",
        "QuadClass": "3",
        "SQLDATE": "20260314",
        "DATEADDED": "20260314123045",
        "GLOBALEVENTID": "123456791",
        "EventCode": "040",
        "Actor1Name": "FRANCE",
        "Actor2Name": "",
        "SOURCEURL": "http://example.com",
        "AvgTone": "-1.5",
        "NumMentions": "5",
        "GoldsteinScale": "2.0",
    }
    result = parse_gdelt_row(row)
    assert result is not None
    assert result["occurred_at"] == datetime(2026, 3, 14, 0, 0, 0, tzinfo=timezone.utc)


@pytest.mark.xfail(strict=False, reason="ingest_gdelt not yet implemented")
def test_dateadded_parsing():
    """parse_gdelt_row converts DATEADDED '20260314123045' to datetime(2026,3,14,12,30,45,UTC) as discovered_at."""
    from app.tasks.ingest_gdelt import parse_gdelt_row  # noqa: PLC0415

    row = {
        "ActionGeo_Lat": "48.8566",
        "ActionGeo_Long": "2.3522",
        "QuadClass": "3",
        "SQLDATE": "20260314",
        "DATEADDED": "20260314123045",
        "GLOBALEVENTID": "123456792",
        "EventCode": "040",
        "Actor1Name": "FRANCE",
        "Actor2Name": "",
        "SOURCEURL": "http://example.com",
        "AvgTone": "-1.5",
        "NumMentions": "5",
        "GoldsteinScale": "2.0",
    }
    result = parse_gdelt_row(row)
    assert result is not None
    assert result["discovered_at"] == datetime(2026, 3, 14, 12, 30, 45, tzinfo=timezone.utc)


@pytest.mark.xfail(strict=False, reason="redis_gdelt_dedup not yet implemented")
def test_redis_file_level_skip():
    """When Redis SADD returns 0 (URL already in set), ingest exits without calling DB insert."""
    from app.tasks.ingest_gdelt import ingest_gdelt_file  # noqa: PLC0415

    mock_redis = AsyncMock()
    mock_redis.sadd = AsyncMock(return_value=0)  # 0 = already member (not added)

    with patch("app.tasks.ingest_gdelt.get_redis_client", return_value=mock_redis):
        with patch("app.tasks.ingest_gdelt.insert_gdelt_events") as mock_insert:
            import asyncio
            asyncio.get_event_loop().run_until_complete(
                ingest_gdelt_file("http://data.gdeltproject.org/gdeltv2/test.export.CSV.zip")
            )
            mock_insert.assert_not_called()


# ---------------------------------------------------------------------------
# Integration DB tests
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
@pytest.mark.xfail(strict=False, reason="migration not yet applied")
async def test_gdelt_events_table_schema():
    """After Alembic upgrade, gdelt_events table has all required columns."""
    from app.db import AsyncSessionLocal  # noqa: PLC0415
    from sqlalchemy import text  # noqa: PLC0415

    async with AsyncSessionLocal() as session:
        result = await session.execute(
            text(
                "SELECT column_name, data_type, character_maximum_length "
                "FROM information_schema.columns "
                "WHERE table_name = 'gdelt_events' "
                "ORDER BY ordinal_position"
            )
        )
        rows = result.fetchall()
        column_names = {r[0] for r in rows}

    expected_columns = {
        "id", "global_event_id", "occurred_at", "discovered_at",
        "latitude", "longitude", "quad_class", "goldstein_scale",
        "event_code", "actor1_name", "actor2_name", "source_url",
        "avg_tone", "num_mentions", "source_is_stale",
    }
    assert expected_columns <= column_names, (
        f"Missing columns: {expected_columns - column_names}"
    )


@pytest.mark.asyncio
@pytest.mark.xfail(strict=False, reason="migration not yet applied")
async def test_event_code_varchar4():
    """event_code column is VARCHAR(4) — code '040' round-trips without coercion to int 40."""
    from app.db import AsyncSessionLocal  # noqa: PLC0415
    from app.models.gdelt_event import GdeltEvent  # noqa: PLC0415
    from sqlalchemy import select, delete  # noqa: PLC0415

    async with AsyncSessionLocal() as session:
        async with session.begin():
            # Clean up any leftover test row
            await session.execute(
                delete(GdeltEvent).where(GdeltEvent.global_event_id == "VARCHAR4_TEST")
            )

        async with session.begin():
            event = GdeltEvent(
                global_event_id="VARCHAR4_TEST",
                occurred_at=datetime(2026, 3, 14, tzinfo=timezone.utc),
                event_code="040",
            )
            session.add(event)

        async with session.begin():
            result = await session.execute(
                select(GdeltEvent).where(GdeltEvent.global_event_id == "VARCHAR4_TEST")
            )
            fetched = result.scalar_one()
            assert fetched.event_code == "040", f"Expected '040', got {fetched.event_code!r}"
            # Clean up
            await session.execute(
                delete(GdeltEvent).where(GdeltEvent.global_event_id == "VARCHAR4_TEST")
            )


@pytest.mark.asyncio
@pytest.mark.xfail(strict=False, reason="migration not yet applied")
async def test_unique_constraint():
    """Inserting two rows with same global_event_id raises IntegrityError."""
    from app.db import AsyncSessionLocal  # noqa: PLC0415
    from app.models.gdelt_event import GdeltEvent  # noqa: PLC0415
    from sqlalchemy import delete  # noqa: PLC0415
    from sqlalchemy.exc import IntegrityError  # noqa: PLC0415

    async with AsyncSessionLocal() as session:
        async with session.begin():
            await session.execute(
                delete(GdeltEvent).where(GdeltEvent.global_event_id == "UNIQUE_TEST_001")
            )

    with pytest.raises(IntegrityError):
        async with AsyncSessionLocal() as session:
            async with session.begin():
                session.add(GdeltEvent(
                    global_event_id="UNIQUE_TEST_001",
                    occurred_at=datetime(2026, 3, 14, tzinfo=timezone.utc),
                ))
                session.add(GdeltEvent(
                    global_event_id="UNIQUE_TEST_001",
                    occurred_at=datetime(2026, 3, 14, tzinfo=timezone.utc),
                ))

    # Clean up after expected failure — use a separate session
    async with AsyncSessionLocal() as session:
        async with session.begin():
            await session.execute(
                delete(GdeltEvent).where(GdeltEvent.global_event_id == "UNIQUE_TEST_001")
            )


@pytest.mark.asyncio
@pytest.mark.xfail(strict=False, reason="migration not yet applied")
async def test_no_duplicate_rows():
    """Inserting the same global_event_id twice with ON CONFLICT DO NOTHING leaves exactly 1 row."""
    from app.db import AsyncSessionLocal  # noqa: PLC0415
    from sqlalchemy import text  # noqa: PLC0415

    async with AsyncSessionLocal() as session:
        async with session.begin():
            await session.execute(
                text("DELETE FROM gdelt_events WHERE global_event_id = 'DEDUP_TEST_001'")
            )
        async with session.begin():
            await session.execute(
                text(
                    "INSERT INTO gdelt_events (global_event_id, occurred_at) "
                    "VALUES ('DEDUP_TEST_001', '2026-03-14 00:00:00+00') "
                    "ON CONFLICT (global_event_id) DO NOTHING"
                )
            )
            await session.execute(
                text(
                    "INSERT INTO gdelt_events (global_event_id, occurred_at) "
                    "VALUES ('DEDUP_TEST_001', '2026-03-14 00:00:00+00') "
                    "ON CONFLICT (global_event_id) DO NOTHING"
                )
            )
        async with session.begin():
            result = await session.execute(
                text("SELECT COUNT(*) FROM gdelt_events WHERE global_event_id = 'DEDUP_TEST_001'")
            )
            count = result.scalar()
            assert count == 1
        async with session.begin():
            await session.execute(
                text("DELETE FROM gdelt_events WHERE global_event_id = 'DEDUP_TEST_001'")
            )


@pytest.mark.asyncio
@pytest.mark.xfail(strict=False, reason="cleanup_old_events not yet implemented")
async def test_7day_cleanup():
    """cleanup_old_events deletes rows where occurred_at < now - 7 days; recent rows kept."""
    from app.tasks.ingest_gdelt import cleanup_old_events  # noqa: PLC0415
    from app.db import AsyncSessionLocal  # noqa: PLC0415
    from sqlalchemy import text  # noqa: PLC0415

    now = datetime.now(tz=timezone.utc)
    old_ts = (now - timedelta(days=8)).isoformat()
    recent_ts = (now - timedelta(days=1)).isoformat()

    async with AsyncSessionLocal() as session:
        async with session.begin():
            await session.execute(text(
                "DELETE FROM gdelt_events WHERE global_event_id IN ('CLEANUP_OLD', 'CLEANUP_RECENT')"
            ))
            await session.execute(text(
                f"INSERT INTO gdelt_events (global_event_id, occurred_at) "
                f"VALUES ('CLEANUP_OLD', '{old_ts}'), ('CLEANUP_RECENT', '{recent_ts}')"
            ))

    await cleanup_old_events()

    async with AsyncSessionLocal() as session:
        async with session.begin():
            result = await session.execute(text(
                "SELECT global_event_id FROM gdelt_events "
                "WHERE global_event_id IN ('CLEANUP_OLD', 'CLEANUP_RECENT')"
            ))
            remaining = {r[0] for r in result.fetchall()}

    assert "CLEANUP_OLD" not in remaining, "Old event should have been deleted"
    assert "CLEANUP_RECENT" in remaining, "Recent event should have been kept"

    # Final cleanup
    async with AsyncSessionLocal() as session:
        async with session.begin():
            await session.execute(text(
                "DELETE FROM gdelt_events WHERE global_event_id = 'CLEANUP_RECENT'"
            ))


# ---------------------------------------------------------------------------
# Integration API tests
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
@pytest.mark.xfail(strict=False, reason="route not yet registered")
async def test_gdelt_events_route():
    """GET /api/gdelt-events returns 200 with JSON list."""
    from app.main import app  # noqa: PLC0415

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/api/gdelt-events")

    assert response.status_code == 200
    body = response.json()
    assert isinstance(body, list)


@pytest.mark.asyncio
@pytest.mark.xfail(strict=False, reason="route not yet registered")
async def test_gdelt_events_bbox_filter():
    """GET /api/gdelt-events with bbox params returns only rows within bbox."""
    from app.main import app  # noqa: PLC0415

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get(
            "/api/gdelt-events",
            params={"min_lat": "40.0", "min_lon": "-10.0", "max_lat": "60.0", "max_lon": "30.0"},
        )

    assert response.status_code == 200
    body = response.json()
    assert isinstance(body, list)
    for item in body:
        assert 40.0 <= item["latitude"] <= 60.0
        assert -10.0 <= item["longitude"] <= 30.0


@pytest.mark.asyncio
@pytest.mark.xfail(strict=False, reason="route not yet registered")
async def test_gdelt_events_time_range():
    """GET /api/gdelt-events with since/until filters by occurred_at."""
    from app.main import app  # noqa: PLC0415

    since = "2026-03-14T00:00:00Z"
    until = "2026-03-14T23:59:59Z"

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get(
            "/api/gdelt-events",
            params={"since": since, "until": until},
        )

    assert response.status_code == 200
    body = response.json()
    assert isinstance(body, list)


@pytest.mark.asyncio
@pytest.mark.xfail(strict=False, reason="route not yet registered")
async def test_gdelt_events_source_is_stale_present():
    """Every item in GET /api/gdelt-events response has source_is_stale key."""
    from app.main import app  # noqa: PLC0415

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/api/gdelt-events")

    assert response.status_code == 200
    body = response.json()
    for item in body:
        assert "source_is_stale" in item, f"Missing source_is_stale in: {item}"
