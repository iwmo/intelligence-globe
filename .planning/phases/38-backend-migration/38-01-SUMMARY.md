---
phase: 38-backend-migration
plan: 01
subsystem: testing
tags: [adsb, pytest, tdd, aircraft-ingest, red-phase]

# Dependency graph
requires: []
provides:
  - "13 named RED tests covering INGEST-01..05 and SCHEMA-01..06 for the ADSB.lol ingest worker"
  - "test_ingest_aircraft.py retired (OpenSky stale refs removed)"
affects: [38-02, 38-03]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "RED-phase TDD: tests fail at import time (ModuleNotFoundError) until implementation exists"
    - "pytest.skip(allow_module_level=True) to retire test files without collection errors"
    - "AsyncMock + MagicMock session pattern: mock_cm/__aenter__/__aexit__ for async context managers"
    - "Capturing async get URLs via side-effect function replacement for URL assertion tests"

key-files:
  created:
    - backend/tests/test_ingest_adsbiol.py
  modified:
    - backend/tests/test_ingest_aircraft.py

key-decisions:
  - "Module-level import of ingest_adsbiol used (not importorskip) so all 13 tests fail together at collection time — cleaner RED signal than per-test import failures"
  - "test_no_opensky_references uses xfail+FileNotFoundError guard since the file does not exist yet; test becomes meaningful in Plan 03"
  - "test_ingest_aircraft.py replaced with module-level pytest.skip rather than per-function skips — ensures zero collection errors regardless of what stale code existed"

patterns-established:
  - "Redis bbox mock: patch app.tasks.ingest_adsbiol.redis_client with a MagicMock whose .get() returns bytes or None"
  - "HTTP URL capture: replace mock_client.get with an async def that appends url to list then returns a fabricated response"

requirements-completed: [INGEST-01, INGEST-02, INGEST-03, INGEST-04, INGEST-05, SCHEMA-01, SCHEMA-02, SCHEMA-03, SCHEMA-04, SCHEMA-05, SCHEMA-06]

# Metrics
duration: 2min
completed: 2026-03-15
---

# Phase 38 Plan 01: ADSB.lol Ingest Test Scaffold Summary

**13 RED tests for parse_adsbiol_aircraft and ingest_commercial/military_aircraft — fail at import time (ModuleNotFoundError) until Plan 03 creates app.tasks.ingest_adsbiol**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-15T08:57:29Z
- **Completed:** 2026-03-15T08:59:03Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Created test_ingest_adsbiol.py with all 13 named test functions spanning every INGEST-* and SCHEMA-* requirement
- Verified RED phase: pytest reports ModuleNotFoundError for app.tasks.ingest_adsbiol (implementation does not exist yet)
- Retired test_ingest_aircraft.py with module-level pytest.skip, eliminating all stale import errors (app.workers.ingest_aircraft, fetch_opensky_token, OPENSKY_CLIENT_ID)

## Task Commits

Each task was committed atomically:

1. **Tasks 1+2: ADSB.lol ingest test scaffold + OpenSky retirement** - `b657bee` (test)

**Plan metadata:** (docs commit follows)

## Files Created/Modified
- `backend/tests/test_ingest_adsbiol.py` - 13 RED unit tests covering all INGEST-* and SCHEMA-* requirements; imports from app.tasks.ingest_adsbiol (not yet created)
- `backend/tests/test_ingest_aircraft.py` - Replaced with module-level skip comment retiring OpenSky-era tests

## Decisions Made
- Used a module-level import block (not `pytest.importorskip`) so all 13 tests fail atomically at collection time, giving a clear single RED signal rather than 13 individual xfails.
- `test_no_opensky_references` uses `pytest.xfail` with `FileNotFoundError` guard because the source file doesn't exist yet; this test transitions from xfail to a real assertion in Plan 03.
- Replaced entire `test_ingest_aircraft.py` body rather than removing individual functions — simpler, no risk of missing a stale reference.

## Deviations from Plan

None — plan executed exactly as written. The `test_military_url_has_filter_mil` test uses a slightly more direct URL-capture pattern than the plan sketch (plan suggested a side_effect approach; implementation uses async function replacement which achieves the same assertion more cleanly), but the observable behavior is identical.

## Issues Encountered
None.

## User Setup Required
None — no external service configuration required.

## Next Phase Readiness
- All 13 RED tests are in place and fail correctly at import time
- Plan 02 (schema migration) and Plan 03 (ingest_adsbiol.py implementation) can now proceed
- Plan 03 implementation will be driven by these tests; when all 13 pass, the GREEN phase is complete

---
*Phase: 38-backend-migration*
*Completed: 2026-03-15*
