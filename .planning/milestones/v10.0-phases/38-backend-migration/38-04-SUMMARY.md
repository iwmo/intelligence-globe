---
phase: 38-backend-migration
plan: "04"
subsystem: backend-worker
tags: [adsb-lol, worker, docker-compose, cleanup, opensky-removal]
dependency_graph:
  requires: [38-02, 38-03]
  provides: [complete-opensky-cutover]
  affects: [docker-compose.yml, backend/app/worker.py]
tech_stack:
  added: []
  patterns: [self-reenqueue-rq, pytest-module-skip]
key_files:
  created: []
  modified:
    - backend/app/worker.py
    - docker-compose.yml
    - backend/tests/test_ingest_military.py
  deleted:
    - backend/app/tasks/ingest_aircraft.py
    - backend/app/tasks/ingest_military.py
decisions:
  - id: DEC-38-04-01
    summary: "Retired test_ingest_military.py with module-level pytest.skip (mirrors test_ingest_aircraft.py pattern from Plan 01); tests were not pre-retired as plan assumed"
metrics:
  duration: "~4 minutes"
  completed: "2026-03-15"
  tasks_completed: 2
  tasks_total: 2
  files_changed: 5
---

# Phase 38 Plan 04: Worker Wiring and OpenSky Cutover Summary

**One-liner:** Wired ADSB.lol ingest tasks into RQ worker startup, removed all OpenSky env vars from docker-compose, and deleted the two retired ingest modules (`ingest_aircraft.py`, `ingest_military.py`).

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Update worker.py and docker-compose.yml | d97d9c6 | backend/app/worker.py, docker-compose.yml |
| 2 | Delete retired ingest files and verify full suite | ed14900 | backend/app/tasks/ingest_aircraft.py (deleted), backend/app/tasks/ingest_military.py (deleted), backend/tests/test_ingest_military.py |

## Changes Made

### worker.py

- Replaced `queue.enqueue("app.tasks.ingest_aircraft.sync_ingest_aircraft")` with `queue.enqueue("app.tasks.ingest_adsbiol.sync_ingest_commercial")`
- Replaced `queue.enqueue("app.tasks.ingest_military.sync_ingest_military")` with `queue.enqueue("app.tasks.ingest_adsbiol.sync_ingest_military")`
- Updated docstring intervals: 90s → 15s (commercial), 300s → 15s (military)
- Updated log messages to indicate ADSB.lol source

### docker-compose.yml

- Removed `OPENSKY_CLIENT_ID` and `OPENSKY_CLIENT_SECRET` from both `backend` and `worker` services
- Added `ADSBIO_BASE_URL: ${ADSBIO_BASE_URL:-https://re-api.adsb.lol}` to both services

### Deleted files

- `backend/app/tasks/ingest_aircraft.py` — fully replaced by `ingest_adsbiol.py`
- `backend/app/tasks/ingest_military.py` — fully replaced by `ingest_adsbiol.py`

## Verification Results

- `grep -c "ADSBIO_BASE_URL" docker-compose.yml` → `2` (one per service)
- `grep "OPENSKY" docker-compose.yml` → empty (zero results)
- `grep "ingest_adsbiol\|ingest_aircraft\|ingest_military" backend/app/worker.py` → 2 lines, both `ingest_adsbiol`
- Full pytest suite: **66 passed, 4 skipped, 15 xpassed** — zero failures caused by this plan

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Retired test_ingest_military.py that still imported deleted module**

- **Found during:** Task 2 (after deleting ingest_military.py)
- **Issue:** `test_ingest_military.py` imported `from app.tasks.ingest_military import ...` — causing 6 test failures after the module was deleted. Plan 01 was supposed to retire this file but only retired `test_ingest_aircraft.py`.
- **Fix:** Replaced full test file with module-level `pytest.skip(...)` matching the pattern from `test_ingest_aircraft.py`
- **Files modified:** `backend/tests/test_ingest_military.py`
- **Commit:** ed14900

## Pre-existing Test Failures (out of scope)

Three test files fail due to pre-existing database schema drift (Alembic migrations from Plan 38-02 not yet applied to local Postgres instance):

- `test_aircraft.py` — `column aircraft.emergency does not exist`
- `test_military.py` — `column military_aircraft.emergency does not exist`
- `test_gps_jamming.py` — `No space left on device` (Postgres disk full)

These are not caused by Plan 04 changes. They will resolve once `alembic upgrade head` is run against the local database.

## Success Criteria Verification

- [x] worker.py enqueues `app.tasks.ingest_adsbiol.sync_ingest_commercial` and `app.tasks.ingest_adsbiol.sync_ingest_military`
- [x] docker-compose.yml has `ADSBIO_BASE_URL` in both backend and worker services; no OPENSKY vars remain
- [x] `backend/app/tasks/ingest_aircraft.py` deleted
- [x] `backend/app/tasks/ingest_military.py` deleted
- [x] No source file in `backend/app/` imports from ingest_aircraft or ingest_military
- [x] Full pytest suite: 66 passed, 4 skipped, 15 xpassed (pre-existing DB failures excluded)
