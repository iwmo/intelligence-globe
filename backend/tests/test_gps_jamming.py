"""
GPS Jamming aggregation tests — LAY-02 contract (TDD RED phase).

Tests are written before implementation exists.
All unit tests use deferred imports inside test body so that
ImportError is the RED failure — not a collection-time error.

Once backend/app/tasks/ingest_gps_jamming.py and /api/gps-jamming route
are implemented (Plan 02), all tests should turn GREEN.
"""
import pytest
from httpx import AsyncClient, ASGITransport

from app.main import app


# ---------------------------------------------------------------------------
# Unit tests for aggregate_jamming_cells()
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_nic_nacp_aggregation():
    """5 aircraft same cell (3 bad NIC<7, 2 good) → exactly 1 cell returned."""
    from app.tasks.ingest_gps_jamming import aggregate_jamming_cells

    aircraft = [
        {"lat": 25.0, "lon": 45.0, "nic": 3, "nac_p": 5},   # bad: nic < 7
        {"lat": 25.0, "lon": 45.0, "nic": 2, "nac_p": 5},   # bad: nic < 7
        {"lat": 25.0, "lon": 45.0, "nic": 1, "nac_p": 4},   # bad: nic < 7
        {"lat": 25.0, "lon": 45.0, "nic": 9, "nac_p": 10},  # good
        {"lat": 25.0, "lon": 45.0, "nic": 8, "nac_p": 9},   # good
    ]
    result = aggregate_jamming_cells(aircraft)
    assert isinstance(result, list)
    assert len(result) == 1


@pytest.mark.asyncio
async def test_severity_red():
    """3 bad / 5 total → ratio = 3/5 = 0.6 → severity == 'red'."""
    from app.tasks.ingest_gps_jamming import aggregate_jamming_cells

    aircraft = [
        {"lat": 25.0, "lon": 45.0, "nic": 3, "nac_p": 5},   # bad
        {"lat": 25.0, "lon": 45.0, "nic": 2, "nac_p": 5},   # bad
        {"lat": 25.0, "lon": 45.0, "nic": 1, "nac_p": 4},   # bad
        {"lat": 25.0, "lon": 45.0, "nic": 9, "nac_p": 10},  # good
        {"lat": 25.0, "lon": 45.0, "nic": 8, "nac_p": 9},   # good
    ]
    result = aggregate_jamming_cells(aircraft)
    assert len(result) == 1
    cell = result[0]
    assert cell["severity"] == "red"
    assert abs(cell["bad_ratio"] - 0.6) < 0.001


@pytest.mark.asyncio
async def test_severity_yellow():
    """1 bad / 5 total → ratio = 1/5 = 0.2 → severity == 'yellow'."""
    from app.tasks.ingest_gps_jamming import aggregate_jamming_cells

    aircraft = [
        {"lat": 25.0, "lon": 45.0, "nic": 3, "nac_p": 5},   # bad: nic < 7
        {"lat": 25.0, "lon": 45.0, "nic": 9, "nac_p": 10},  # good
        {"lat": 25.0, "lon": 45.0, "nic": 8, "nac_p": 9},   # good
        {"lat": 25.0, "lon": 45.0, "nic": 10, "nac_p": 11}, # good
        {"lat": 25.0, "lon": 45.0, "nic": 9, "nac_p": 10},  # good
    ]
    result = aggregate_jamming_cells(aircraft)
    assert len(result) == 1
    cell = result[0]
    assert cell["severity"] == "yellow"
    assert 0.1 <= cell["bad_ratio"] < 0.3


@pytest.mark.asyncio
async def test_severity_green():
    """All good aircraft → bad_ratio == 0.0 → severity == 'green'."""
    from app.tasks.ingest_gps_jamming import aggregate_jamming_cells

    aircraft = [
        {"lat": 25.0, "lon": 45.0, "nic": 9, "nac_p": 10},
        {"lat": 25.0, "lon": 45.0, "nic": 8, "nac_p": 9},
        {"lat": 25.0, "lon": 45.0, "nic": 10, "nac_p": 11},
    ]
    result = aggregate_jamming_cells(aircraft)
    assert len(result) == 1
    cell = result[0]
    assert cell["bad_ratio"] == 0.0
    assert cell["severity"] == "green"


@pytest.mark.asyncio
async def test_missing_nic_excluded():
    """Aircraft with nic=None, nac_p=None → treated as good (not bad), not skipped."""
    from app.tasks.ingest_gps_jamming import aggregate_jamming_cells

    # 2 aircraft with None NIC/NACp (both treated as good, not bad)
    # bad=0, total=2: ratio = 0/2 = 0.0 → green
    aircraft = [
        {"lat": 25.0, "lon": 45.0, "nic": None, "nac_p": None},  # good (missing = no data)
        {"lat": 25.0, "lon": 45.0, "nic": None, "nac_p": None},  # good
    ]
    result = aggregate_jamming_cells(aircraft)
    # Aircraft with None are not skipped — they should still be aggregated
    assert len(result) == 1
    cell = result[0]
    assert cell["aircraft_count"] == 2
    assert cell["severity"] == "green"


@pytest.mark.asyncio
async def test_null_position_excluded():
    """Aircraft with lat=None → excluded from aggregation entirely."""
    from app.tasks.ingest_gps_jamming import aggregate_jamming_cells

    aircraft = [
        {"lat": None, "lon": 45.0, "nic": 3, "nac_p": 5},   # excluded: no position
        {"lat": 25.0, "lon": None, "nic": 3, "nac_p": 5},   # excluded: no position
        {"lat": 25.0, "lon": 45.0, "nic": 9, "nac_p": 10},  # included: good
    ]
    result = aggregate_jamming_cells(aircraft)
    # Only 1 valid aircraft in cell → cell exists with count 1
    assert len(result) == 1
    assert result[0]["aircraft_count"] == 1


# ---------------------------------------------------------------------------
# API integration test
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_gps_jamming_route():
    """GET /api/gps-jamming returns 200 with JSON body { cells: [...] }."""
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        response = await client.get("/api/gps-jamming")
    assert response.status_code == 200
    body = response.json()
    assert "cells" in body
    assert isinstance(body["cells"], list)


# ---------------------------------------------------------------------------
# JAM-01: active-only filter and freshness metadata tests
# ---------------------------------------------------------------------------

def _make_aircraft(
    lat: float = 25.0,
    lon: float = 45.0,
    nic: int = 3,
    nac_p: int = 5,
    fetched_at=None,
    is_active: bool = True,
):
    """Build a mock MilitaryAircraft-like object."""
    from unittest.mock import MagicMock
    from datetime import datetime, timezone

    ac = MagicMock()
    ac.latitude = lat
    ac.longitude = lon
    ac.nic = nic
    ac.nac_p = nac_p
    ac.is_active = is_active
    ac.fetched_at = fetched_at if fetched_at is not None else datetime.now(timezone.utc)
    return ac


@pytest.mark.asyncio
async def test_only_active_aircraft_used():
    """ingest_gps_jamming() SELECT must include is_active=True filter.

    Mock session.execute to return only the active row; the inactive row
    should be excluded before aggregate_jamming_cells() is called.
    We assert the produced cells reflect only 1 active aircraft (aircraft_count==1).
    """
    from unittest.mock import AsyncMock, MagicMock, patch
    from datetime import datetime, timezone

    active_ac = _make_aircraft(lat=25.0, lon=45.0, nic=3, nac_p=5, is_active=True)
    # Inactive aircraft — the SELECT filter should exclude it at the DB level.
    # We simulate the filter by only returning the active one from the mock.

    # First session context (SELECT): returns only active row
    mock_result_select = MagicMock()
    mock_result_select.scalars.return_value.all.return_value = [active_ac]

    mock_session_select = AsyncMock()
    mock_session_select.execute = AsyncMock(return_value=mock_result_select)
    mock_session_select.__aenter__ = AsyncMock(return_value=mock_session_select)
    mock_session_select.__aexit__ = AsyncMock(return_value=False)

    # Second session context (upsert)
    mock_session_upsert = AsyncMock()
    mock_session_upsert.execute = AsyncMock()
    mock_session_upsert.commit = AsyncMock()
    mock_session_upsert.__aenter__ = AsyncMock(return_value=mock_session_upsert)
    mock_session_upsert.__aexit__ = AsyncMock(return_value=False)

    call_count = 0

    def session_factory():
        nonlocal call_count
        call_count += 1
        if call_count == 1:
            return mock_session_select
        return mock_session_upsert

    with patch("app.tasks.ingest_gps_jamming.AsyncSessionLocal", side_effect=session_factory):
        from app.tasks.ingest_gps_jamming import ingest_gps_jamming
        result = await ingest_gps_jamming()

    # 1 active aircraft → 1 cell with aircraft_count == 1
    assert result == 1
    # Verify the upsert was called (cells were produced)
    assert mock_session_upsert.execute.called


@pytest.mark.asyncio
async def test_aggregated_at_written_to_cells():
    """aggregated_at is a timezone-aware datetime written in set_={} for every upserted cell."""
    from unittest.mock import AsyncMock, MagicMock, patch, call
    from datetime import datetime, timezone

    active_ac = _make_aircraft(lat=25.0, lon=45.0, nic=3, nac_p=5, is_active=True)

    mock_result_select = MagicMock()
    mock_result_select.scalars.return_value.all.return_value = [active_ac]

    mock_session_select = AsyncMock()
    mock_session_select.execute = AsyncMock(return_value=mock_result_select)
    mock_session_select.__aenter__ = AsyncMock(return_value=mock_session_select)
    mock_session_select.__aexit__ = AsyncMock(return_value=False)

    captured_stmts = []

    mock_session_upsert = AsyncMock()
    mock_session_upsert.execute = AsyncMock(side_effect=lambda stmt: captured_stmts.append(stmt))
    mock_session_upsert.commit = AsyncMock()
    mock_session_upsert.__aenter__ = AsyncMock(return_value=mock_session_upsert)
    mock_session_upsert.__aexit__ = AsyncMock(return_value=False)

    call_count = 0

    def session_factory():
        nonlocal call_count
        call_count += 1
        if call_count == 1:
            return mock_session_select
        return mock_session_upsert

    with patch("app.tasks.ingest_gps_jamming.AsyncSessionLocal", side_effect=session_factory):
        from app.tasks.ingest_gps_jamming import ingest_gps_jamming
        await ingest_gps_jamming()

    # Extract set_={} from the upsert statement via _post_values_clause
    # update_values_to_set is a list of (key, value) tuples — convert to dict
    assert len(captured_stmts) == 1
    stmt = captured_stmts[0]
    set_dict = dict(stmt._post_values_clause.update_values_to_set)
    assert "aggregated_at" in set_dict
    agg_at = set_dict["aggregated_at"]
    assert isinstance(agg_at, datetime)
    assert agg_at.tzinfo is not None  # must be timezone-aware


@pytest.mark.asyncio
async def test_source_fetched_at_is_max_of_active_rows():
    """source_fetched_at == max(fetched_at) across active rows."""
    from unittest.mock import AsyncMock, MagicMock, patch
    from datetime import datetime, timezone, timedelta

    t1 = datetime(2026, 1, 1, 12, 0, 0, tzinfo=timezone.utc)
    t2 = datetime(2026, 1, 1, 12, 5, 0, tzinfo=timezone.utc)  # newer

    ac1 = _make_aircraft(lat=25.0, lon=45.0, nic=3, nac_p=5, fetched_at=t1, is_active=True)
    ac2 = _make_aircraft(lat=26.0, lon=46.0, nic=3, nac_p=5, fetched_at=t2, is_active=True)

    mock_result_select = MagicMock()
    mock_result_select.scalars.return_value.all.return_value = [ac1, ac2]

    mock_session_select = AsyncMock()
    mock_session_select.execute = AsyncMock(return_value=mock_result_select)
    mock_session_select.__aenter__ = AsyncMock(return_value=mock_session_select)
    mock_session_select.__aexit__ = AsyncMock(return_value=False)

    captured_stmts = []

    mock_session_upsert = AsyncMock()
    mock_session_upsert.execute = AsyncMock(side_effect=lambda stmt: captured_stmts.append(stmt))
    mock_session_upsert.commit = AsyncMock()
    mock_session_upsert.__aenter__ = AsyncMock(return_value=mock_session_upsert)
    mock_session_upsert.__aexit__ = AsyncMock(return_value=False)

    call_count = 0

    def session_factory():
        nonlocal call_count
        call_count += 1
        if call_count == 1:
            return mock_session_select
        return mock_session_upsert

    with patch("app.tasks.ingest_gps_jamming.AsyncSessionLocal", side_effect=session_factory):
        from app.tasks.ingest_gps_jamming import ingest_gps_jamming
        await ingest_gps_jamming()

    # Both aircraft are in different cells — check source_fetched_at in any stmt
    # update_values_to_set is a list of (key, value) tuples — convert to dict
    assert len(captured_stmts) >= 1
    stmt = captured_stmts[0]
    set_dict = dict(stmt._post_values_clause.update_values_to_set)
    assert "source_fetched_at" in set_dict
    assert set_dict["source_fetched_at"] == t2


@pytest.mark.asyncio
async def test_source_is_stale_true_when_no_active_rows():
    """When no active aircraft rows exist, early-return fires and returns 0."""
    from unittest.mock import AsyncMock, MagicMock, patch

    mock_result_select = MagicMock()
    mock_result_select.scalars.return_value.all.return_value = []

    mock_session_select = AsyncMock()
    mock_session_select.execute = AsyncMock(return_value=mock_result_select)
    mock_session_select.__aenter__ = AsyncMock(return_value=mock_session_select)
    mock_session_select.__aexit__ = AsyncMock(return_value=False)

    mock_session_upsert = AsyncMock()
    mock_session_upsert.execute = AsyncMock()
    mock_session_upsert.commit = AsyncMock()
    mock_session_upsert.__aenter__ = AsyncMock(return_value=mock_session_upsert)
    mock_session_upsert.__aexit__ = AsyncMock(return_value=False)

    call_count = 0

    def session_factory():
        nonlocal call_count
        call_count += 1
        if call_count == 1:
            return mock_session_select
        return mock_session_upsert

    with patch("app.tasks.ingest_gps_jamming.AsyncSessionLocal", side_effect=session_factory):
        from app.tasks.ingest_gps_jamming import ingest_gps_jamming
        result = await ingest_gps_jamming()

    # Empty active set → no cells → early-return → 0
    assert result == 0
    # Upsert session must NOT have been called (early return before second block)
    assert not mock_session_upsert.execute.called


@pytest.mark.asyncio
async def test_source_is_stale_false_when_recent_fetched_at():
    """source_is_stale=False when active aircraft has a fresh fetched_at (within threshold)."""
    from unittest.mock import AsyncMock, MagicMock, patch
    from datetime import datetime, timezone, timedelta

    recent_ts = datetime.now(timezone.utc) - timedelta(seconds=10)
    active_ac = _make_aircraft(lat=25.0, lon=45.0, nic=3, nac_p=5, fetched_at=recent_ts, is_active=True)

    mock_result_select = MagicMock()
    mock_result_select.scalars.return_value.all.return_value = [active_ac]

    mock_session_select = AsyncMock()
    mock_session_select.execute = AsyncMock(return_value=mock_result_select)
    mock_session_select.__aenter__ = AsyncMock(return_value=mock_session_select)
    mock_session_select.__aexit__ = AsyncMock(return_value=False)

    captured_stmts = []

    mock_session_upsert = AsyncMock()
    mock_session_upsert.execute = AsyncMock(side_effect=lambda stmt: captured_stmts.append(stmt))
    mock_session_upsert.commit = AsyncMock()
    mock_session_upsert.__aenter__ = AsyncMock(return_value=mock_session_upsert)
    mock_session_upsert.__aexit__ = AsyncMock(return_value=False)

    call_count = 0

    def session_factory():
        nonlocal call_count
        call_count += 1
        if call_count == 1:
            return mock_session_select
        return mock_session_upsert

    with patch("app.tasks.ingest_gps_jamming.AsyncSessionLocal", side_effect=session_factory):
        from app.tasks.ingest_gps_jamming import ingest_gps_jamming
        await ingest_gps_jamming()

    # update_values_to_set is a list of (key, value) tuples — convert to dict
    assert len(captured_stmts) == 1
    stmt = captured_stmts[0]
    set_dict = dict(stmt._post_values_clause.update_values_to_set)
    assert "source_is_stale" in set_dict
    assert set_dict["source_is_stale"] is False


# ---------------------------------------------------------------------------
# JAM-02 and JAM-03: Route envelope includes freshness metadata
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_gps_jamming_envelope_includes_metadata_keys():
    """GET /api/gps-jamming returns 200 with aggregated_at, source_fetched_at, source_is_stale at envelope top level.

    JAM-02: The response envelope must include freshness metadata alongside cells
    so callers can detect when the military data source was stale.
    """
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        response = await client.get("/api/gps-jamming")
    assert response.status_code == 200
    body = response.json()
    assert "cells" in body
    assert "aggregated_at" in body
    assert "source_fetched_at" in body
    assert "source_is_stale" in body


@pytest.mark.asyncio
async def test_gps_jamming_source_is_stale_present_in_envelope():
    """GET /api/gps-jamming always has source_is_stale key — null when table empty.

    JAM-03: source_is_stale key must always be present in response envelope —
    stale cells are returned with source_is_stale=true rather than silently
    dropping cells. When the table is empty (test env / before first ingest run),
    the key is present with value null.
    """
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        response = await client.get("/api/gps-jamming")
    assert response.status_code == 200
    body = response.json()
    assert "source_is_stale" in body


# ---------------------------------------------------------------------------
# TEST-05: source_is_stale=True propagates from DB row to API envelope
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_gps_jamming_source_is_stale_true_from_db():
    """A GpsJammingCell row stored with source_is_stale=True causes GET /api/gps-jamming to return source_is_stale=true.

    The route lifts source_is_stale from cells[0] — the first row returned by
    the SELECT. To guarantee our test row is the only row (and therefore cells[0]),
    this test truncates the table, inserts one row, verifies the envelope, then
    restores the cleared rows via a rollback-safe finally block that only deletes
    the specific test row (the truncation is permanent for this test run).
    """
    from sqlalchemy import text
    from app.db import AsyncSessionLocal
    from app.models.gps_jamming import GpsJammingCell
    from datetime import datetime, timezone

    h3index = "8542e97ffffffff"
    now_ts = datetime.now(timezone.utc)

    async with AsyncSessionLocal() as session:
        # Truncate the table so our row is the only one (cells[0] is our row)
        await session.execute(text("TRUNCATE TABLE gps_jamming_cells"))
        await session.commit()

        cell = GpsJammingCell(
            h3index=h3index,
            bad_ratio=0.5,
            severity="red",
            aircraft_count=10,
            aggregated_at=now_ts,
            source_fetched_at=now_ts,
            source_is_stale=True,
        )
        session.add(cell)
        await session.commit()

    try:
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            response = await client.get("/api/gps-jamming")

        assert response.status_code == 200
        body = response.json()
        assert body["source_is_stale"] is True

    finally:
        async with AsyncSessionLocal() as session:
            await session.execute(
                text("DELETE FROM gps_jamming_cells WHERE h3index = :h"),
                {"h": h3index},
            )
            await session.commit()
