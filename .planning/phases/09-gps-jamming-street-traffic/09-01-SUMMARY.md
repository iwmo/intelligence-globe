---
phase: 09-gps-jamming-street-traffic
plan: "01"
subsystem: testing
tags: [pytest, vitest, tdd, gps-jamming, h3, cesium, ground-primitive, street-traffic]

# Dependency graph
requires:
  - phase: 08-new-data-pipelines-military-maritime
    provides: military_aircraft table with nic/nac_p fields, AsyncClient test pattern

provides:
  - backend/tests/test_gps_jamming.py — 7 RED tests for aggregate_jamming_cells() and /api/gps-jamming route
  - frontend/src/components/__tests__/GpsJammingLayer.test.tsx — RED smoke test for GpsJammingLayer
  - frontend/src/components/__tests__/StreetTrafficLayer.test.tsx — RED smoke test for StreetTrafficLayer

affects:
  - 09-02 (implements aggregate_jamming_cells + /api/gps-jamming to turn backend RED → GREEN)
  - 09-03 (implements GpsJammingLayer to turn frontend RED → GREEN)
  - 09-04 (implements StreetTrafficLayer to turn frontend RED → GREEN)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Deferred imports inside test bodies (from app.tasks.X import Y) so ImportError is the RED failure, not collection error
    - Static import after vi.mock() for frontend component smoke tests
    - AsyncClient(ASGITransport(app=app)) pattern for backend API integration tests

key-files:
  created:
    - backend/tests/test_gps_jamming.py
    - frontend/src/components/__tests__/GpsJammingLayer.test.tsx
    - frontend/src/components/__tests__/StreetTrafficLayer.test.tsx
  modified: []

key-decisions:
  - "Backend GPS jamming tests use deferred import pattern so ModuleNotFoundError is the RED signal (not a collection error that would break other tests)"
  - "Frontend smoke tests use static import after vi.mock() — consistent with Phase 08 ShipLayer/MilitaryAircraftLayer pattern"
  - "test_missing_nic_excluded: aircraft with nic=None treated as GOOD (not bad, not skipped) per gpsjam.org formula; None fields mean no degradation data"
  - "test_null_position_excluded: aircraft with lat=None or lon=None excluded from H3 cell aggregation entirely (cannot be placed in a cell)"

patterns-established:
  - "Pattern: GPS jamming test data uses lat=25.0, lon=45.0 for all aircraft to land in same H3 cell — vary nic/nac_p only"
  - "Pattern: Frontend layer smoke test mocks useAppStore with layers selector, hook with empty/null data, and cesium CJS types"

requirements-completed:
  - LAY-02
  - LAY-04

# Metrics
duration: 4min
completed: 2026-03-12
---

# Phase 9 Plan 01: GPS Jamming + Street Traffic — TDD RED Scaffolds Summary

**TDD RED phase: 7 backend tests for NIC/NACp H3 aggregation and 2 frontend smoke tests for CesiumJS layer components, all failing with module-not-found errors before implementation**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-03-12T09:40:26Z
- **Completed:** 2026-03-12T09:44:19Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Created 7 backend pytest tests covering aggregate_jamming_cells() severity logic (red/yellow/green), null position exclusion, missing NIC/NACp handling, and GET /api/gps-jamming route contract
- Created GpsJammingLayer frontend smoke test (renders null when viewer=null) with cesium GroundPrimitive mock
- Created StreetTrafficLayer frontend smoke test (renders null when viewer=null) with cesium PointPrimitiveCollection mock
- All 3 test files fail RED (ModuleNotFoundError / "Failed to resolve import") — implementation does not exist yet
- Full existing test suite still passes (10 test files, 55 tests — unaffected)

## Task Commits

Each task was committed atomically:

1. **Task 1: Backend GPS Jamming test scaffold (RED)** - `dc51a8d` (test)
2. **Task 2: Frontend GPS Jamming + Street Traffic smoke test scaffolds (RED)** - `4f9534b` (test)

## Files Created/Modified

- `backend/tests/test_gps_jamming.py` — 7 pytest tests: 6 unit tests for aggregate_jamming_cells() severity/aggregation logic + 1 API integration test for GET /api/gps-jamming
- `frontend/src/components/__tests__/GpsJammingLayer.test.tsx` — Vitest smoke test: renders null when viewer=null; mocks cesium GroundPrimitive stack and useGpsJamming hook
- `frontend/src/components/__tests__/StreetTrafficLayer.test.tsx` — Vitest smoke test: renders null when viewer=null; mocks cesium PointPrimitiveCollection and useStreetTraffic hook

## Decisions Made

- Backend tests use deferred import pattern (`from app.tasks.ingest_gps_jamming import ...` inside test body) so `ModuleNotFoundError` is the RED failure at test-run time, not a collection-time error that would break all other tests
- `test_missing_nic_excluded` asserts aircraft with `nic=None, nac_p=None` are treated as good (not bad, not excluded): per gpsjam.org formula, missing NIC/NACp means no degradation signal, not a confirmed bad aircraft
- Frontend smoke tests follow the static-import-after-vi.mock() pattern established in Phase 08 (ShipLayer, MilitaryAircraftLayer) — no vi.hoisted() needed for simple cesium/store/hook mocks

## Deviations from Plan

None — plan executed exactly as written. The system SQLAlchemy version (1.4) was noted as a pre-existing environment issue; tests are run inside the Docker container where SQLAlchemy 2.0 is installed per requirements.txt.

## Issues Encountered

- Host system has SQLAlchemy 1.4 (lacks `async_sessionmaker` added in 2.0), causing conftest.py import failure when running pytest outside Docker. Verified tests in Docker container where correct version is installed. Pre-existing issue, not introduced by this plan.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Wave 0 test contracts established for LAY-02 (GPS Jamming) and LAY-04 (Street Traffic)
- Plan 09-02 implements `backend/app/tasks/ingest_gps_jamming.py` + `aggregate_jamming_cells()` + `/api/gps-jamming` route → turns backend RED → GREEN
- Plan 09-03 implements `GpsJammingLayer.tsx` + `useGpsJamming.ts` → turns frontend GPS jamming RED → GREEN
- Plan 09-04 implements `StreetTrafficLayer.tsx` + `useStreetTraffic.ts` → turns frontend street traffic RED → GREEN

---
*Phase: 09-gps-jamming-street-traffic*
*Completed: 2026-03-12*
