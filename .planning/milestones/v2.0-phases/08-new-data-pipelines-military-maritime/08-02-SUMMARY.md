---
phase: 08-new-data-pipelines-military-maritime
plan: "02"
subsystem: backend
tags: [military-aircraft, pipeline, sqlalchemy, rq, alembic, fastapi]
dependency_graph:
  requires: [08-01]
  provides: [military-aircraft-api, military-ingest-worker]
  affects: [frontend-military-layer]
tech_stack:
  added: []
  patterns:
    - airplanes.live /v2/mil polling via httpx (300s interval)
    - RQ self-re-enqueue pattern (mirrors aircraft ingest)
    - pg_insert ON CONFLICT DO UPDATE upsert on hex
    - parse_military_aircraft() pure function for testable parsing
key_files:
  created:
    - backend/app/models/military_aircraft.py
    - backend/app/tasks/ingest_military.py
    - backend/alembic/versions/a1b2c3d4e5f6_add_military_aircraft_table.py
    - backend/app/api/routes_military.py
  modified:
    - backend/app/main.py
    - backend/alembic/env.py
decisions:
  - "lat/lon response keys used in routes_military.py to match test contract (test_military.py asserts 'lat' and 'lon', not 'latitude'/'longitude')"
  - "Alembic migration written manually (autogenerate requires live DB sync connection); revision a1b2c3d4e5f6 chains from c5795b11a549"
  - "MilitaryAircraft model stores altitude in FEET as received from airplanes.live (not normalised to metres)"
metrics:
  duration: "~15 minutes"
  completed_date: "2026-03-12"
  tasks_completed: 2
  files_created: 4
  files_modified: 2
---

# Phase 08 Plan 02: Military Aircraft Backend Pipeline Summary

Military aircraft backend pipeline delivering LAY-01: SQLAlchemy model, RQ self-re-enqueue ingest worker polling airplanes.live /v2/mil every 300 seconds with ground-altitude normalisation, Alembic migration, and REST API routes.

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | MilitaryAircraft model, Alembic migration, and ingest task | 3c97846 | military_aircraft.py, ingest_military.py, a1b2c3d4e5f6_*.py |
| 2 | Military API routes and main.py registration | 6048f81 | routes_military.py, main.py, env.py |

## Verification Results

All 4 military tests pass:
- `test_ground_altitude` — parse_military_aircraft returns alt_baro=None when input is "ground"
- `test_null_position_skipped` — parse_military_aircraft returns None when lat is None
- `test_list_military` — GET /api/military/ returns 200 with a list
- `test_military_detail` — GET /api/military/ae1234 returns 404 for unknown hex

Full suite: 23 passed (no regressions).

## Decisions Made

1. **lat/lon response keys:** The test contract in `test_military.py` checks for `"lat"` and `"lon"` keys (matching airplanes.live field names directly). The route returns these short names rather than the `"latitude"/"longitude"` names used in the aircraft routes.

2. **Manual Alembic migration:** autogenerate requires a live DB connection with the sync engine. Migration written manually following the aircraft and ships migration patterns. Revision `a1b2c3d4e5f6` inserts between `c5795b11a549` (aircraft latlon index) and `d4e8f2a1b3c0` (ships).

3. **Altitude in FEET:** airplanes.live reports altitude in feet; OpenSky reports in metres. The MilitaryAircraft model stores feet as-is with no normalisation. Frontend must be aware of unit difference.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Test key mismatch between plan action spec and actual test assertions**
- **Found during:** Task 2 GREEN implementation
- **Issue:** Plan action spec said routes should return `"latitude"` and `"longitude"` but `test_military.py` asserts `"lat"` and `"lon"` keys. If the plan spec had been followed, tests would fail.
- **Fix:** Used `"lat"` and `"lon"` as response keys to match the test contract (tests are the source of truth in TDD).
- **Files modified:** `backend/app/api/routes_military.py`
- **Commit:** 6048f81

**2. [Rule 2 - Missing] alembic/env.py not importing MilitaryAircraft model**
- **Found during:** Task 1 completion
- **Issue:** `alembic/env.py` imports all models for autogenerate but did not include `military_aircraft`. Future autogenerate runs would incorrectly detect the table as "extra" and try to drop it.
- **Fix:** Added `import app.models.military_aircraft` to env.py alongside other model imports.
- **Files modified:** `backend/alembic/env.py`
- **Commit:** 6048f81

## Self-Check: PASSED

Files verified:
- FOUND: backend/app/models/military_aircraft.py
- FOUND: backend/app/tasks/ingest_military.py
- FOUND: backend/alembic/versions/a1b2c3d4e5f6_add_military_aircraft_table.py
- FOUND: backend/app/api/routes_military.py

Commits verified:
- FOUND: 3c97846 (feat(08-02): MilitaryAircraft model, ingest task, and Alembic migration)
- FOUND: 6048f81 (feat(08-02): military API routes and main.py registration)
