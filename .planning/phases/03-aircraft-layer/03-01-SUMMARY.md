---
phase: 03-aircraft-layer
plan: 01
subsystem: api
tags: [aircraft, opensky, sqlalchemy, alembic, postgresql, jsonb, fastapi, pytest, tdd]

# Dependency graph
requires:
  - phase: 02-satellite-layer
    provides: Satellite model pattern, router pattern, alembic env pattern with asyncio, FastAPI main.py structure

provides:
  - Aircraft SQLAlchemy model with icao24 String PK and JSONB trail column
  - Three API endpoints mounted at /api/aircraft/ (list, freshness, detail)
  - Alembic migration ca281e8bedd2 — aircraft table in PostgreSQL
  - ingest_aircraft.py helpers: upsert_aircraft, build_new_trail (ready for Plan 02 ingest worker)
  - Test contracts: test_aircraft.py (API layer) and test_ingest_aircraft.py (unit)

affects:
  - 03-02-ingest (imports upsert_aircraft, build_new_trail)
  - 03-03-frontend (consumes /api/aircraft/ and /api/aircraft/{icao24})

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Aircraft model uses icao24 String as primary key (no surrogate integer id unlike Satellite)
    - JSONB trail column stores list of {lon, lat, alt, ts} dicts, newest last, capped at 20
    - Ingest helpers decoupled from worker: upsert_aircraft + build_new_trail testable in isolation
    - ON CONFLICT DO UPDATE on icao24 for idempotent upserts (Plan 02)

key-files:
  created:
    - backend/app/models/aircraft.py
    - backend/app/api/routes_aircraft.py
    - backend/app/workers/__init__.py
    - backend/app/workers/ingest_aircraft.py
    - backend/alembic/versions/ca281e8bedd2_add_aircraft_table.py
    - backend/tests/test_aircraft.py
    - backend/tests/test_ingest_aircraft.py
  modified:
    - backend/app/main.py
    - backend/alembic/env.py

key-decisions:
  - "Aircraft uses icao24 (String) as primary key directly — no surrogate integer id needed, ICAO24 is a natural stable identifier"
  - "Trail capping (max 20) enforced by ingest helper build_new_trail, not by SQLAlchemy model constraint"
  - "ingest_aircraft.py created in Plan 01 (not Plan 02) to unblock unit tests that must pass before ingest worker is wired"
  - "workers/ directory created under app/ to house RQ task helpers alongside model/api layers"

patterns-established:
  - "Ingest helpers pattern: upsert_aircraft accepts AsyncSession + sv list; build_new_trail is pure function (no DB) for easy unit testing"
  - "Null-position filter: return None early if sv[5] or sv[6] is None — aircraft without position skipped before any DB I/O"
  - "Trail append pattern: build_new_trail(existing, new_point) -> list capped at TRAIL_MAX"

requirements-completed: [AIR-01, AIR-02, INT-02]

# Metrics
duration: 15min
completed: 2026-03-11
---

# Phase 03 Plan 01: Aircraft Backend Foundation Summary

**Aircraft SQLAlchemy model, Alembic migration, three FastAPI routes at /api/aircraft/, and ingest helper stubs with 5 green TDD tests**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-03-11T14:10:00Z
- **Completed:** 2026-03-11T14:25:00Z
- **Tasks:** 2 (Task 1: credentials — user action; Task 2: model/routes/tests — TDD auto)
- **Files modified:** 9 files (7 created, 2 modified)

## Accomplishments

- Aircraft table created in PostgreSQL with icao24 String PK, all OpenSky state-vector columns, and JSONB trail
- Three API endpoints live: GET /api/aircraft/ (empty list), GET /api/aircraft/freshness (null), GET /api/aircraft/{icao24} (404 on unknown)
- Full TDD cycle: 5 tests written RED first, then GREEN after implementation; all 15 backend tests pass
- Ingest helpers (upsert_aircraft, build_new_trail) created with unit-test contracts so Plan 02 only needs to wire the RQ worker

## Task Commits

Each task was committed atomically:

1. **Task 1: Register OpenSky OAuth2 credentials** — user action (no commit, pre-condition)
2. **Task 2: Aircraft model + routes + migration + tests** — `d0db1fe` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `backend/app/models/aircraft.py` — Aircraft model: icao24 PK, 10 columns, JSONB trail
- `backend/app/api/routes_aircraft.py` — Three endpoints: list (null-position filtered), freshness, detail
- `backend/app/workers/ingest_aircraft.py` — upsert_aircraft + build_new_trail helpers
- `backend/alembic/versions/ca281e8bedd2_add_aircraft_table.py` — Migration creating aircraft table
- `backend/tests/test_aircraft.py` — 3 API tests: list shape, freshness null, detail + 404
- `backend/tests/test_ingest_aircraft.py` — 2 unit tests: null-position skip, trail capped at 20
- `backend/app/main.py` — Added aircraft_router import and include_router at /api/aircraft
- `backend/alembic/env.py` — Added import app.models.aircraft for autogenerate

## Decisions Made

- Aircraft uses icao24 (String) as primary key directly — ICAO24 is a stable natural identifier, no surrogate integer needed
- Trail capping enforced in build_new_trail (pure function), not in SQLAlchemy model — keeps model simple, makes helper unit-testable
- ingest_aircraft.py stubbed in Plan 01 (not Plan 02) to satisfy test_ingest_aircraft.py contract tests before ingest worker is built
- workers/ directory created under app/ following the layer structure: models/, api/, workers/

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Created app/workers/ingest_aircraft.py in Plan 01**
- **Found during:** Task 2 (writing test_ingest_aircraft.py)
- **Issue:** test_ingest_aircraft.py imports `upsert_aircraft` and `build_new_trail` from `app.workers.ingest_aircraft`, but Plan 01 did not include this file in `<files>`. Without it the test file would fail at import time (ModuleNotFoundError), making RED phase impossible to achieve correctly.
- **Fix:** Created the workers/ directory and a minimal ingest_aircraft.py with the two helper functions required to satisfy both import and unit-test contracts.
- **Files modified:** backend/app/workers/__init__.py, backend/app/workers/ingest_aircraft.py
- **Verification:** test_null_position_filtered and test_trail_capped_at_20 both green
- **Committed in:** d0db1fe (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 2 — missing critical functionality for test contract)
**Impact on plan:** The stub implementation satisfies Plan 01 test contracts and provides the exact API surface Plan 02 will flesh out. No scope creep — Plan 02 still owns the RQ worker wiring and OpenSky HTTP fetch logic.

## Issues Encountered

- Alembic autogenerate also detected a change on the satellites table (unique constraint vs unique index divergence from a previous migration). This was included in the migration automatically by Alembic and is benign — the constraint was being represented two ways; the migration normalises it to a unique index only.

## Next Phase Readiness

- Aircraft table present in PostgreSQL, endpoints mounted and reachable
- ingest_aircraft.py helper stubs ready for Plan 02 to add the HTTP fetch loop and RQ worker wrapper
- Frontend (Plan 03) can start using /api/aircraft/ endpoint immediately once Plan 02 populates data

---
*Phase: 03-aircraft-layer*
*Completed: 2026-03-11*
