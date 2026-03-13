# Phase 22: Tests - Research

**Researched:** 2026-03-13
**Domain:** Python / pytest — freshness filtering, ingest, and API contract tests
**Confidence:** HIGH

## Summary

Phase 22 is a pure test-authoring phase. All production code (routes, models, ingest workers, `freshness.py`) was completed in Phases 17–21. The goal is to ensure every freshness and stale-filtering behavior introduced in the v4.0 milestone is covered by an automated test that can be verified by running `pytest` in a Docker container.

The test infrastructure already exists and is mature: pytest 8, pytest-asyncio 0.24 with `asyncio_mode = auto`, `httpx.AsyncClient` + `ASGITransport` for ASGI integration tests, SQLAlchemy async sessions with `NullPool` in conftest, and `unittest.mock` for unit-level mocking. Many tests are already written (including RED tests from Phase 21 TDD). Phase 22 must write the remaining tests and verify all previously-written tests are green.

**Primary recommendation:** Write missing tests directly in the existing test files (`test_aircraft.py`, `test_military.py`, `test_ships.py`, `test_gps_jamming.py`, `test_freshness.py`) using the established pattern. No new test infrastructure is needed. Confirm all tests pass by running `docker compose exec backend pytest tests/ -q` (requires running Docker stack).

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| TEST-01 | Aircraft rows with stale `time_position` excluded from `/api/aircraft`; fallback from `time_position` to `last_contact` when `time_position` is null | Routes implemented in Phase 19/21. Test helpers `_make_sv`, `AsyncSessionLocal`, `AsyncClient` pattern already in place. `test_list_aircraft_excludes_stale` and `test_list_aircraft_position_age_fallback` already written in `test_aircraft.py`. |
| TEST-02 | Aircraft `geo_altitude`, `vertical_rate`, `position_source` stored by ingest and returned in response | `upsert_aircraft` writes all three fields (verified in `test_upsert_aircraft_new_fields_in_set`). Route returns them via the response dict. Need integration test that inserts a row with non-null values and asserts they appear in `/api/aircraft/` response. |
| TEST-03 | Military stale rows excluded from `/api/military` | Route filters `fetched_at >= cutoff` AND `is_active=True`. Need DB-level integration test similar to `test_list_aircraft_excludes_stale`. |
| TEST-04 | Ships stale rows excluded from `/api/ships` | Route filters `last_seen_at >= cutoff` AND `is_active=True`. Need DB-level integration test using `Ship` model. |
| TEST-05 | GPS jamming response includes freshness metadata; `source_is_stale=true` when military data is stale | `test_gps_jamming_envelope_includes_metadata_keys` and `test_gps_jamming_source_is_stale_present_in_envelope` already written. Need a test that inserts a `GpsJammingCell` row with `source_is_stale=True` and asserts it propagates in the API response. |
| TEST-06 | `freshness.py` unit tests — stale cutoff boundary, `is_stale` true/false, clock mock behavior | All six tests already written and passing in `test_freshness.py` (verified by reading file). |
| TEST-07 | Existing happy-path contracts for all four endpoints still pass after all changes | Existing tests in `test_aircraft.py`, `test_military.py`, `test_ships.py`, `test_gps_jamming.py` serve as regression guards. Must confirm all pass green. |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| pytest | >=8.0 | Test runner | Already installed in `requirements-dev.txt` |
| pytest-asyncio | >=0.24 | Async test support | Already installed; `asyncio_mode = auto` in `pytest.ini` |
| httpx | >=0.27 | ASGI test client | `AsyncClient(transport=ASGITransport(app=app))` pattern throughout codebase |
| unittest.mock | stdlib | Mocking session, AsyncMock | Used extensively in `test_gps_jamming.py` and `test_ingest_aircraft.py` |
| sqlalchemy async | >=2.0 | DB-level integration tests | `AsyncSessionLocal` from `app.db` for inserting test fixtures |

### No New Dependencies Required
All test infrastructure is already installed. Phase 22 adds only new test functions to existing files.

## Architecture Patterns

### Pattern 1: DB-Level Integration Test (Insert + HTTP assert)

This is the dominant pattern for TEST-01 through TEST-05. Used in `test_aircraft.py` (`test_list_aircraft_excludes_stale`, `test_list_aircraft_freshness_fields`).

**What:** Insert a controlled row directly via `AsyncSessionLocal`, hit the endpoint with `AsyncClient`, assert on response body, clean up in `finally` block.

**When to use:** When the behavior under test is an end-to-end filter (`fetched_at >= cutoff`, `is_active=True`, `source_is_stale` propagation).

```python
# Source: existing tests/test_aircraft.py
@pytest.mark.asyncio
async def test_list_aircraft_excludes_stale():
    from sqlalchemy import text
    from app.db import AsyncSessionLocal
    from app.models.aircraft import Aircraft

    icao24 = "stale01"
    stale_ts = datetime.now(timezone.utc) - timedelta(minutes=10)

    async with AsyncSessionLocal() as session:
        await session.execute(
            text("DELETE FROM aircraft WHERE icao24 = :icao24"),
            {"icao24": icao24},
        )
        await session.commit()
        aircraft = Aircraft(
            icao24=icao24, ..., is_active=True, fetched_at=stale_ts
        )
        session.add(aircraft)
        await session.commit()

    try:
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            response = await client.get("/api/aircraft/")
        assert response.status_code == 200
        assert icao24 not in [item["icao24"] for item in response.json()]
    finally:
        async with AsyncSessionLocal() as session:
            await session.execute(
                text("DELETE FROM aircraft WHERE icao24 = :icao24"),
                {"icao24": icao24},
            )
            await session.commit()
```

### Pattern 2: Unit Test with Clock Mock

Used for `freshness.py` functions. Key detail from STATE.md decision: `from datetime import datetime` (not `import datetime`) is required for `patch("app.freshness.datetime")` to work.

```python
# Source: existing tests/test_freshness.py
FROZEN_NOW = datetime(2026, 3, 13, 12, 0, 0, tzinfo=timezone.utc)

def test_is_stale_boundary_exactly_at_cutoff():
    with patch("app.freshness.datetime") as mock_dt:
        mock_dt.now.return_value = FROZEN_NOW
        at_cutoff = datetime(2026, 3, 13, 11, 58, 0, tzinfo=timezone.utc)
        result = is_stale(at_cutoff, 120)
    assert result is False
```

### Pattern 3: AsyncMock Session for Ingest Unit Tests

Used in `test_gps_jamming.py` and `test_ingest_aircraft.py` when testing ingest functions without a real DB. The double-session factory pattern (first call = SELECT session, second = upsert session) is the established convention.

### Recommended Test Structure per Requirement

| Req | Test File | Test Name(s) to Write | Notes |
|-----|-----------|-----------------------|-------|
| TEST-01 | `test_aircraft.py` | Already written: `test_list_aircraft_excludes_stale`, `test_list_aircraft_position_age_fallback` | Verify these pass GREEN |
| TEST-02 | `test_aircraft.py` | `test_aircraft_geo_altitude_vertical_rate_position_source_stored_and_returned` | New test needed |
| TEST-03 | `test_military.py` | `test_military_list_excludes_stale_rows`, `test_military_list_excludes_inactive_rows` | New tests needed |
| TEST-04 | `test_ships.py` | `test_ships_list_excludes_stale_rows`, `test_ships_list_excludes_inactive_rows` | New tests needed |
| TEST-05 | `test_gps_jamming.py` | `test_gps_jamming_source_is_stale_true_propagates_from_db` | New test needed — insert row with source_is_stale=True, check envelope |
| TEST-06 | `test_freshness.py` | Already written: 6 tests (stale_cutoff + is_stale boundary + clock mock) | Verify pass GREEN |
| TEST-07 | All test files | Existing happy-path tests | Verify all pass GREEN |

### Anti-Patterns to Avoid

- **No `async_generator` confusion:** Always use `async with AsyncSessionLocal() as session:` — never call `AsyncSessionLocal()` without context manager.
- **No test interdependence:** Always DELETE in `finally` block. Tests share a live DB; leftover rows cause cross-test contamination.
- **No `asyncio_mode` override per test:** Global `asyncio_mode = auto` in `pytest.ini` handles all tests. Don't add `@pytest.mark.asyncio` metadata conflicts.
- **No `time.sleep` in tests:** Clock-sensitive tests use `unittest.mock.patch` to freeze time, not `sleep`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| ASGI test client | Custom HTTP client | `httpx.AsyncClient(transport=ASGITransport(app=app))` | Already used in all test files |
| Async mock session | Manual async context manager | `unittest.mock.AsyncMock` with `__aenter__`/`__aexit__` | Already used in `test_gps_jamming.py` |
| Clock freezing | `time.sleep` or real-time assertions | `unittest.mock.patch("app.freshness.datetime")` | Already established in `test_freshness.py` |
| Test DB | Separate test database | Live DB with `NullPool` + `DELETE` fixture cleanup | Already configured in `conftest.py` |

## Common Pitfalls

### Pitfall 1: Stale Row Not Excluded Because `is_active` Not Set
**What goes wrong:** Insert a row with `fetched_at` in the past but forget to set `is_active=True`. Route filters on BOTH conditions — the test passes vacuously because the row is excluded by `is_active` not `fetched_at`.
**Why it happens:** `server_default='true'` in the model, but explicit SQLAlchemy ORM construction requires setting `is_active=True` to be certain.
**How to avoid:** Always set both `is_active=True` AND `fetched_at=stale_ts` explicitly in stale-exclusion test fixtures.

### Pitfall 2: Ships Use `last_seen_at`, Not `fetched_at`
**What goes wrong:** Attempting to set `fetched_at` on a `Ship` model instance — `Ship` has no `fetched_at` column (AIS is streamed, not polled).
**Why it happens:** Model asymmetry documented in STATE.md: military filters by `fetched_at`, ships filter by `last_seen_at`.
**How to avoid:** Use `last_seen_at` for ship stale tests. See `routes_ships.py` line: `Ship.last_seen_at >= cutoff`.

### Pitfall 3: GPS Jamming `source_is_stale` Requires a Real DB Row
**What goes wrong:** Testing `source_is_stale=True` propagation only with mock sessions — this doesn't actually test the route.
**Why it happens:** The existing `test_gps_jamming.py` only tests `source_is_stale` at the ingest level (via mock). TEST-05 requires an integration test that inserts a real `GpsJammingCell` row with `source_is_stale=True` and hits the real route.
**How to avoid:** Write a DB-level integration test for `test_gps_jamming.py` that inserts a `GpsJammingCell` with `source_is_stale=True`, GETs `/api/gps-jamming`, and asserts `body["source_is_stale"] is True`.

### Pitfall 4: `patch("app.freshness.datetime")` Breakage
**What goes wrong:** `patch` fails to mock `datetime.now()` when the import is `import datetime` instead of `from datetime import datetime`.
**Why it happens:** `patch` replaces the name in the target module's namespace. If `freshness.py` uses `datetime.datetime.now(...)` the patch target is `datetime.datetime`, not `app.freshness.datetime`.
**How to avoid:** `freshness.py` already uses `from datetime import datetime` (confirmed). Keep it that way.

### Pitfall 5: `GpsJammingCell` Has No `h3index` Auto-generation
**What goes wrong:** Inserting a `GpsJammingCell` in a test without an `h3index` value causes a NOT NULL violation.
**Why it happens:** `h3index` is the primary key (String, not auto-increment).
**How to avoid:** Use a known h3 string like `"8542e97ffffffff"` as a placeholder. Clean up with DELETE in `finally`.

### Pitfall 6: `MilitaryAircraft` Has No `latitude`/`longitude` Filter Bypass
**What goes wrong:** Inserting a military aircraft row with `latitude=None` — the route also filters `latitude.is_not(None)`, so the stale-exclusion test can't distinguish between "excluded because stale" and "excluded because null position".
**Why it happens:** `routes_military.py` has `MilitaryAircraft.latitude.is_not(None)` in the WHERE clause alongside `fetched_at >= cutoff`.
**How to avoid:** Always provide valid `latitude`/`longitude` values in stale-exclusion test fixtures.

## Code Examples

### TEST-02 Pattern: Ingest stores fields → Route returns them

```python
# Pattern for test_aircraft.py
@pytest.mark.asyncio
async def test_aircraft_new_fields_stored_and_returned():
    """geo_altitude, vertical_rate, position_source written by ingest appear in /api/aircraft/."""
    from sqlalchemy import text
    from app.db import AsyncSessionLocal
    from app.models.aircraft import Aircraft

    icao24 = "newf01"
    now_ts = datetime.now(timezone.utc)

    async with AsyncSessionLocal() as session:
        await session.execute(
            text("DELETE FROM aircraft WHERE icao24 = :icao24"), {"icao24": icao24}
        )
        await session.commit()
        session.add(Aircraft(
            icao24=icao24, callsign="NEWF01", origin_country="Test",
            longitude=10.0, latitude=50.0, baro_altitude=5000.0,
            is_active=True, fetched_at=now_ts,
            geo_altitude=5100.0, vertical_rate=2.5, position_source=0,
        ))
        await session.commit()

    try:
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            response = await client.get("/api/aircraft/")
        body = response.json()
        item = next((i for i in body if i["icao24"] == icao24), None)
        assert item is not None
        # Note: routes_aircraft.py list endpoint currently returns time_position,
        # fetched_at, is_stale, position_age_seconds but NOT geo_altitude/vertical_rate/position_source.
        # TEST-02 may require verifying these via /api/aircraft/{icao24} detail endpoint
        # which returns the full Aircraft record.
    finally:
        async with AsyncSessionLocal() as session:
            await session.execute(
                text("DELETE FROM aircraft WHERE icao24 = :icao24"), {"icao24": icao24}
            )
            await session.commit()
```

**Critical note on TEST-02:** The list endpoint (`routes_aircraft.py`) does NOT currently return `geo_altitude`, `vertical_rate`, or `position_source` in its response dict. They are stored in the DB but not projected in the list response. TEST-02 can be satisfied by: (a) testing the detail endpoint `GET /api/aircraft/{icao24}` which also doesn't include them currently, or (b) adding them to the list response. The planner must choose the interpretation and may need to add fields to the route response dict.

### TEST-05 Pattern: GPS jamming `source_is_stale=True` DB integration test

```python
@pytest.mark.asyncio
async def test_gps_jamming_source_is_stale_true_from_db():
    """When gps_jamming_cells has source_is_stale=True, the API envelope reflects it."""
    from sqlalchemy import text
    from app.db import AsyncSessionLocal
    from app.models.gps_jamming import GpsJammingCell
    from datetime import datetime, timezone

    h3index = "8542e97ffffffff"
    now_ts = datetime.now(timezone.utc)

    async with AsyncSessionLocal() as session:
        await session.execute(
            text("DELETE FROM gps_jamming_cells WHERE h3index = :h"), {"h": h3index}
        )
        await session.commit()
        session.add(GpsJammingCell(
            h3index=h3index, bad_ratio=0.5, severity="red", aircraft_count=10,
            aggregated_at=now_ts, source_fetched_at=now_ts, source_is_stale=True,
        ))
        await session.commit()

    try:
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            response = await client.get("/api/gps-jamming")
        body = response.json()
        assert body["source_is_stale"] is True
    finally:
        async with AsyncSessionLocal() as session:
            await session.execute(
                text("DELETE FROM gps_jamming_cells WHERE h3index = :h"), {"h": h3index}
            )
            await session.commit()
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Empty response on stale military feed | Return cells with `source_is_stale=True` | Phase 21 (JAM-03) | Test must assert key present even on stale feed, not just on empty table |
| No freshness fields in responses | `fetched_at`, `is_stale`, `last_seen_at` in all list endpoints | Phase 21 | Regression guards needed — shape tests already written |

## Open Questions

1. **TEST-02: Does "returned in response" mean the list endpoint or detail endpoint?**
   - What we know: `geo_altitude`, `vertical_rate`, `position_source` are stored by ingest (confirmed in `upsert_aircraft`) and the model has them. The list endpoint response dict does NOT include them. The detail endpoint `GET /api/aircraft/{icao24}` also does not include them in its current response dict.
   - What's unclear: Whether TEST-02 requires adding these fields to a route response, or just asserting they're in the DB.
   - Recommendation: The planner should add `geo_altitude`, `vertical_rate`, `position_source` to the list endpoint response dict (additive change) so TEST-02 can be a straightforward integration test. This is a small route change (2-3 lines) bundled with the test.

2. **Test run command — Docker required**
   - What we know: Tests require a running PostgreSQL (AsyncSessionLocal hits real DB). Local environment lacks `fastapi` package.
   - What's unclear: Whether a `docker compose exec backend pytest tests/ -q` or `docker compose run --rm backend pytest` is the canonical command.
   - Recommendation: Use `docker compose exec backend pytest tests/ -q` (backend already running). For CI/plan verification, this is the gate command.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | pytest 8.x + pytest-asyncio 0.24 |
| Config file | `backend/pytest.ini` |
| Quick run command | `docker compose exec backend pytest tests/test_freshness.py tests/test_ingest_aircraft.py -q` |
| Full suite command | `docker compose exec backend pytest tests/ -q` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TEST-01 | Stale aircraft excluded; fallback to `last_contact` | integration | `pytest tests/test_aircraft.py::test_list_aircraft_excludes_stale tests/test_aircraft.py::test_list_aircraft_position_age_fallback -x` | Tests already written — verify GREEN |
| TEST-02 | `geo_altitude`, `vertical_rate`, `position_source` stored + returned | integration | `pytest tests/test_aircraft.py -k "new_fields" -x` | New test needed |
| TEST-03 | Military stale rows excluded | integration | `pytest tests/test_military.py -k "stale" -x` | New test needed |
| TEST-04 | Ships stale rows excluded | integration | `pytest tests/test_ships.py -k "stale" -x` | New test needed |
| TEST-05 | GPS jamming `source_is_stale=True` propagates to API | integration | `pytest tests/test_gps_jamming.py -k "source_is_stale_true" -x` | New test needed |
| TEST-06 | `freshness.py` unit tests — boundary + mock | unit | `pytest tests/test_freshness.py -x` | Tests already written — verify GREEN |
| TEST-07 | All existing happy-path contracts pass | regression | `pytest tests/ -q` | Existing tests — verify all GREEN |

### Sampling Rate
- **Per task commit:** `pytest tests/test_freshness.py tests/test_ingest_aircraft.py -q` (pure unit tests, no DB required locally)
- **Per wave merge:** `docker compose exec backend pytest tests/ -q`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
None — existing test infrastructure covers all phase requirements. No new pytest config, conftest changes, or fixture files needed.

## Sources

### Primary (HIGH confidence)
- Direct code inspection of `backend/tests/` — all test files read and analyzed
- Direct code inspection of `backend/app/api/routes_*.py` — all route implementations verified
- Direct code inspection of `backend/app/workers/ingest_aircraft.py` — upsert field list verified
- Direct code inspection of `backend/app/freshness.py` — import style confirmed for mock patching
- `backend/pytest.ini` — `asyncio_mode = auto` confirmed
- `backend/tests/conftest.py` — `NullPool` pattern confirmed
- `.planning/STATE.md` — v4.0 architectural decisions and Phase 18/19/20/21 constraints

### Secondary (MEDIUM confidence)
- `requirements.txt` and `requirements-dev.txt` — confirmed package versions in use

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages confirmed in requirements files and actively used
- Architecture: HIGH — test patterns read directly from existing test files
- Pitfalls: HIGH — derived from STATE.md architectural decisions and direct route code inspection
- Open questions: MEDIUM — TEST-02 scope interpretation requires planner decision

**Research date:** 2026-03-13
**Valid until:** 2026-04-13 (stable codebase — no fast-moving dependencies)
