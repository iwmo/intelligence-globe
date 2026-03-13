---
phase: 20-military-ships-jamming-ingest
plan: 01
subsystem: database
tags: [sqlalchemy, postgresql, military-aircraft, freshness, tombstone, tdd]

# Dependency graph
requires:
  - phase: 17-schema-migration
    provides: fetched_at/last_seen_at/is_active columns on military_aircraft table (MIG-01)
provides:
  - Military aircraft ingest writes fetched_at, last_seen_at, is_active=True on every upsert
  - Tombstone sweep marks absent aircraft is_active=False in the same session commit
  - Guard: tombstone skipped when valid_records is empty (feed-down protection)
affects:
  - 20-02 (ships freshness): same tombstone pattern for AIS ships
  - 20-03 (GPS jamming): relies on is_active=True filter for current military aircraft
  - 21-api-freshness-endpoints: is_active column now maintained for military aircraft

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Tombstone sweep uses sa_update(Model).where(Model.col.not_in(seen_ids)).values(is_active=False)"
    - "Tombstone guarded by `if seen_hexes:` to prevent mass false-tombstone on feed-down"
    - "fetched_at = datetime.now(timezone.utc) captured at function start (wall-clock, no source timestamp)"
    - "Single session.commit() covers all upserts and tombstone — no second commit"
    - "SQLAlchemy _post_values_clause.update_values_to_set for test introspection of upsert set_{} dict"

key-files:
  created: []
  modified:
    - backend/app/tasks/ingest_military.py
    - backend/tests/test_ingest_military.py

key-decisions:
  - "Wall-clock time used for fetched_at (airplanes.live /v2/mil has no response-level timestamp)"
  - "SQLAlchemy _post_values_clause.update_values_to_set used in tests instead of str() — str() on stmt objects shows repr not SQL"
  - "Tombstone uses not_in() rather than a separate query — single session block, single commit"

patterns-established:
  - "MIL-tombstone: if seen_hexes: sa_update not_in sweep before commit"
  - "TDD test introspection: insert_stmt._post_values_clause for upsert set_{} assertions"

requirements-completed: [MIL-01]

# Metrics
duration: 12min
completed: 2026-03-13
---

# Phase 20 Plan 01: Military Aircraft Freshness Lifecycle Summary

**Military aircraft ingest now writes fetched_at/last_seen_at/is_active=True per upsert and sweeps absent aircraft to is_active=False in one atomic PostgreSQL commit**

## Performance

- **Duration:** 12 min
- **Started:** 2026-03-13T12:22:12Z
- **Completed:** 2026-03-13T12:34:00Z
- **Tasks:** 2 (TDD: RED + GREEN)
- **Files modified:** 2

## Accomplishments
- Added `fetched_at`, `last_seen_at`, `is_active=True` to the `set_={}` dict of every military aircraft upsert
- Implemented tombstone sweep: `sa_update(MilitaryAircraft).where(hex.not_in(seen_hexes)).values(is_active=False)` fires before the single `session.commit()`
- Guard `if seen_hexes:` prevents mass deactivation when feed returns no valid-position aircraft
- Four new TDD tests covering freshness fields, is_active assertion, tombstone execution, and tombstone skip on empty response — all GREEN alongside the original 2 tests (6 total)

## Task Commits

Each task was committed atomically:

1. **Task 1: Add MIL-01 test cases (RED)** - `04a164a` (test)
2. **Task 2: Implement MIL-01 freshness fields + tombstone (GREEN)** - `30c754a` (feat)

## Files Created/Modified
- `backend/app/tasks/ingest_military.py` - Added `from datetime import datetime, timezone`, `from sqlalchemy import update as sa_update`, `fetched_at` capture, freshness keys in `set_={}`, tombstone sweep
- `backend/tests/test_ingest_military.py` - Added four `@pytest.mark.asyncio` test functions for MIL-01 contract; uses `_post_values_clause.update_values_to_set` for introspection

## Decisions Made
- Wall-clock `datetime.now(timezone.utc)` is correct for `fetched_at` — airplanes.live `/v2/mil` provides no response-level timestamp field
- Test assertions use SQLAlchemy `_post_values_clause.update_values_to_set` (dict introspection) rather than `str()` on statement objects, which only shows object repr not SQL column names; tombstone SQL verified via `compile(dialect=postgresql.dialect(), literal_binds=True)`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Test assertion approach corrected from str() to SQLAlchemy introspection**
- **Found during:** Task 1 (RED phase execution in Docker)
- **Issue:** Plan specified asserting `"fetched_at" in str(call_args)` — but `str()` on SQLAlchemy statement objects renders the object repr (`<sqlalchemy.dialects.postgresql.dml.Insert object at 0x...>`), not the SQL with column names. All three freshness-field tests failed with the str() approach even after implementation was correct.
- **Fix:** Switched to `insert_stmt._post_values_clause.update_values_to_set` (same pattern used in `test_ingest_aircraft.py`), and `stmt.compile(dialect=postgresql.dialect(), literal_binds=True)` for the tombstone NOT IN check. Updated tests as part of the same TDD cycle before GREEN commit.
- **Files modified:** backend/tests/test_ingest_military.py
- **Verification:** All 6 tests pass in Docker container
- **Committed in:** 30c754a (combined with GREEN implementation commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 — test assertion bug)
**Impact on plan:** Required fix to make tests actually verify the implementation. No scope creep.

## Issues Encountered
- Local Python environment has SQLAlchemy 1.4 but project requires 2.0+; tests run in Docker backend container (Python 3.12 + SQLAlchemy 2.x) to match production environment

## Next Phase Readiness
- Military aircraft `is_active` column is now maintained by ingest — Phase 21 API endpoint can filter on `is_active=True`
- Same tombstone pattern ready to apply to AIS ship ingest (Phase 20 Plan 02)
- GPS jamming aggregation (Phase 20 Plan 03) can now use only active military aircraft for NIC/NACp analysis

---
*Phase: 20-military-ships-jamming-ingest*
*Completed: 2026-03-13*
