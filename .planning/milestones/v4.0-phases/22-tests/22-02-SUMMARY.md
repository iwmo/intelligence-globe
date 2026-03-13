---
phase: 22-tests
plan: "02"
subsystem: backend-api-tests
tags: [aircraft, gps-jamming, integration-tests, api, test]
dependency_graph:
  requires: []
  provides: [TEST-02, TEST-05]
  affects: [backend/app/api/routes_aircraft.py, backend/tests/test_aircraft.py, backend/tests/test_gps_jamming.py]
tech_stack:
  added: []
  patterns: [DB-level integration test with AsyncSessionLocal, TRUNCATE for test isolation]
key_files:
  created: []
  modified:
    - backend/app/api/routes_aircraft.py
    - backend/tests/test_aircraft.py
    - backend/tests/test_gps_jamming.py
decisions:
  - "GPS jamming source_is_stale test truncates entire gps_jamming_cells table to ensure cells[0] is the test row — pre-existing rows with source_is_stale=None would otherwise shadow the envelope value"
metrics:
  duration: 158s
  completed: "2026-03-13"
  tasks_completed: 2
  files_modified: 3
---

# Phase 22 Plan 02: Aircraft Fields + GPS Jamming DB Integration Tests Summary

**One-liner:** Aircraft list endpoint extended with geo_altitude/vertical_rate/position_source; DB-level integration tests added for new fields and source_is_stale propagation.

## What Was Built

### Task 1: Add geo_altitude, vertical_rate, position_source to aircraft list response

Added three additive fields to the `list_aircraft()` response dict in `routes_aircraft.py`:

```python
"geo_altitude": r.geo_altitude,
"vertical_rate": r.vertical_rate,
"position_source": r.position_source,
```

No existing keys were removed or renamed. The Aircraft model already had these columns (Float nullable and Integer nullable respectively). No import changes were needed.

### Task 2: Write integration tests (TEST-02 and TEST-05)

**test_aircraft.py** — `test_aircraft_geo_altitude_vertical_rate_position_source_stored_and_returned`:
- Inserts an Aircraft row with geo_altitude=5100.0, vertical_rate=2.5, position_source=0
- GETs /api/aircraft/ and finds the inserted row
- Asserts all three new fields are present with correct values
- Asserts all pre-existing keys still present

**test_gps_jamming.py** — `test_gps_jamming_source_is_stale_true_from_db`:
- Truncates the gps_jamming_cells table (to ensure test row is cells[0])
- Inserts a GpsJammingCell with source_is_stale=True
- GETs /api/gps-jamming and asserts body["source_is_stale"] is True (not just truthy)
- Cleans up in finally block

## Verification

All 24 tests in both files pass:
```
docker compose exec backend pytest tests/test_aircraft.py tests/test_gps_jamming.py -q
24 passed in 2.77s
```

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] GPS jamming test needed table truncation for isolation**
- **Found during:** Task 2 (test_gps_jamming_source_is_stale_true_from_db)
- **Issue:** The route lifts `source_is_stale` from `cells[0]` — the first row from an unordered SELECT. The test DB contained 1739 pre-existing rows with `source_is_stale=None`. When the test inserted a new row with `source_is_stale=True`, the route returned `None` because cells[0] was one of the existing rows, not the test row.
- **Fix:** Added `TRUNCATE TABLE gps_jamming_cells` before inserting the test row, ensuring our row is the only one and therefore cells[0].
- **Files modified:** `backend/tests/test_gps_jamming.py`
- **Commit:** a804502

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| Task 1 | a92a65a | feat(22-02): add geo_altitude, vertical_rate, position_source to aircraft list response |
| Task 2 | a804502 | test(22-02): add geo_altitude/vertical_rate/position_source and source_is_stale DB integration tests |

## Self-Check: PASSED

- backend/app/api/routes_aircraft.py: FOUND
- backend/tests/test_aircraft.py: FOUND
- backend/tests/test_gps_jamming.py: FOUND
- Commit a92a65a: FOUND
- Commit a804502: FOUND
