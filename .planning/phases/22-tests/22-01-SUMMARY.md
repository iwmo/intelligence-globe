---
phase: 22-tests
plan: "01"
subsystem: testing
tags: [pytest, asyncio, sqlalchemy, httpx, military, ships, stale-filtering]

# Dependency graph
requires:
  - phase: 21-api-route-filtering
    provides: routes_military.py and routes_ships.py stale/inactive WHERE clauses that these tests verify
provides:
  - DB-level integration tests proving military stale fetched_at rows are excluded from /api/military/
  - DB-level integration tests proving military inactive rows are excluded from /api/military/
  - DB-level integration tests proving ships stale last_seen_at rows are excluded from /api/ships/
  - DB-level integration tests proving ships inactive rows are excluded from /api/ships/
affects: [22-02-PLAN, 22-03-PLAN, any future route modifications to military or ships endpoints]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Insert-then-assert-then-finally-delete pattern for DB-level integration tests (matching test_aircraft.py convention)"
    - "Deferred in-function imports for test infrastructure (AsyncSessionLocal, models) matching existing file style"
    - "Separate DELETE before insert in async session to guarantee clean fixture state"

key-files:
  created: []
  modified:
    - backend/tests/test_military.py
    - backend/tests/test_ships.py

key-decisions:
  - "Ships tests use last_seen_at not fetched_at — Ship model has no fetched_at column (AIS streamed, not polled)"
  - "Military test fixtures include latitude=48.0 longitude=2.0 (non-null) to satisfy route latitude.is_not(None) filter — without these the row is excluded regardless of staleness"
  - "pre-existing test_military_detail failure (200 vs 404) is out-of-scope — pre-dates this plan, logged as deferred"

patterns-established:
  - "TEST-03/TEST-04 pattern: always provide non-null lat/lon in military test fixtures (route WHERE includes latitude.is_not(None))"
  - "TEST-04 pattern: ship stale tests assert on last_seen_at, not fetched_at — document this asymmetry in every future ships test"

requirements-completed: [TEST-03, TEST-04]

# Metrics
duration: 2min
completed: 2026-03-13
---

# Phase 22 Plan 01: Tests — Stale Row Exclusion Summary

**DB-level integration tests using AsyncSessionLocal fixture inserts proving that stale (fetched_at/last_seen_at beyond cutoff) and inactive (is_active=False) rows are excluded from /api/military/ and /api/ships/ list endpoints**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-03-13T13:55:11Z
- **Completed:** 2026-03-13T13:56:22Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Added `test_military_list_excludes_stale_rows` — inserts MilitaryAircraft with fetched_at 15 minutes ago, asserts excluded from /api/military/
- Added `test_military_list_excludes_inactive_rows` — inserts MilitaryAircraft with is_active=False and fresh fetched_at, asserts excluded from /api/military/
- Added `test_ships_list_excludes_stale_rows` — inserts Ship with last_seen_at 1 hour ago, asserts excluded from /api/ships/
- Added `test_ships_list_excludes_inactive_rows` — inserts Ship with is_active=False and fresh last_seen_at, asserts excluded from /api/ships/
- All 4 new tests pass green immediately; no existing tests modified

## Task Commits

Each task was committed atomically:

1. **Task 1: Military stale and inactive exclusion tests (TEST-03)** - `c4b1484` (test)
2. **Task 2: Ships stale and inactive exclusion tests (TEST-04)** - `6aaa6c2` (test)

**Plan metadata:** TBD (docs: complete plan)

## Files Created/Modified

- `backend/tests/test_military.py` - Appended TEST-03 section with 2 new stale/inactive exclusion tests
- `backend/tests/test_ships.py` - Appended TEST-04 section with 2 new stale/inactive exclusion tests

## Decisions Made

- Ships tests use `last_seen_at` (not `fetched_at`) — this asymmetry exists because AIS data is streamed (Ship model has no `fetched_at` column), while military aircraft are polled. This is the critical pitfall called out in the research and must be respected in all future ship tests.
- Military test fixtures always include `latitude=48.0, longitude=2.0` — the route WHERE clause includes `MilitaryAircraft.latitude.is_not(None)` so a row without lat/lon would be excluded regardless of staleness, making the test ambiguous.

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

Pre-existing `test_military_detail` test failure (asserts 404 but gets 200) was observed during final verification. This is out-of-scope: it predates this plan and is unrelated to TEST-03/TEST-04. Logged to deferred items.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- TEST-03 and TEST-04 requirements are complete
- Route stale filtering for /api/military/ and /api/ships/ is now verified by automated tests
- Ready for 22-02 (next plan in phase 22-tests)

---
*Phase: 22-tests*
*Completed: 2026-03-13*
