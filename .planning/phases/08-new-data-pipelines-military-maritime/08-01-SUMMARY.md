---
phase: 08-new-data-pipelines-military-maritime
plan: "01"
subsystem: testing
tags: [pytest, vitest, tdd, military, ais, ships, red-phase, wave-0]

# Dependency graph
requires: []
provides:
  - "8 pytest test functions covering /api/military/ and /api/ships/ API contracts"
  - "4 unit tests covering parse_military_aircraft and parse_ais_message logic"
  - "2 Vitest smoke tests for MilitaryAircraftLayer and ShipLayer components"
  - "Wave 0 test scaffold — unlocks automated verify commands in Plans 02, 03, 04"
affects: [08-02, 08-03, 08-04]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "AsyncClient + ASGITransport for async FastAPI endpoint tests (same pattern as aircraft tests)"
    - "Pure unit tests without DB/HTTP for ingest function contracts"
    - "vi.mock('cesium') + vi.mock store + vi.mock hook pattern for frontend layer smoke tests"

key-files:
  created:
    - backend/tests/test_military.py
    - backend/tests/test_ingest_military.py
    - backend/tests/test_ships.py
    - backend/tests/test_ingest_ais.py
    - frontend/src/components/__tests__/MilitaryAircraftLayer.test.tsx
    - frontend/src/components/__tests__/ShipLayer.test.tsx
  modified: []

key-decisions:
  - "test_military_detail and test_ship_detail assert 404 not 422 — forces route to exist before detail test can pass"
  - "test_ingest_ais.py uses synchronous test functions (not async) — parse_ais_message is a pure sync function with no I/O"
  - "Frontend smoke tests use static import after vi.mock() to match Vite import analysis requirements (no vi.hoisted needed for simple mocks)"
  - "aisstream.io PositionReport schema used for AIS test fixture: MessageType, MetaData.MMSI, Message.PositionReport.{Latitude,Longitude,Sog,Cog,TrueHeading}"

patterns-established:
  - "Wave 0 backend API test pattern: AsyncClient(ASGITransport(app=app)) + assert 200 + isinstance(body, list) + per-field key assertions"
  - "Wave 0 ingest unit test pattern: build minimal dict fixture, call parse_*() directly, assert return value or None"
  - "Wave 0 frontend smoke test pattern: vi.mock('cesium') + vi.mock store + vi.mock hook, then import component, render with viewer=null, expect container.firstChild to be null"

requirements-completed: [LAY-01, LAY-03]

# Metrics
duration: 6min
completed: 2026-03-12
---

# Phase 8 Plan 01: Wave 0 Test Scaffolds (Military + Maritime) Summary

**6 RED-phase test files defining the full API + ingest + render contracts for military aircraft and AIS ship pipelines — all collected by pytest/Vitest, all failing correctly before implementation**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-12T09:34:27Z
- **Completed:** 2026-03-12T09:39:42Z
- **Tasks:** 2
- **Files modified:** 6 created

## Accomplishments

- Created 4 backend test files (8 pytest functions) covering military and AIS API + ingest contracts — all collected by Docker pytest with no syntax errors
- Created 2 frontend Vitest smoke tests for MilitaryAircraftLayer and ShipLayer — both fail with module-not-found (correct RED state, no syntax errors)
- Established aisstream.io PositionReport fixture schema in test_ingest_ais.py for Plan 03 implementation

## Task Commits

1. **Task 1: Backend Wave 0 test scaffolds (military + AIS)** - `3292f16` (test)
2. **Task 2: Frontend Wave 0 smoke tests (MilitaryAircraftLayer + ShipLayer)** - `22aafba` (test)

## Files Created/Modified

- `backend/tests/test_military.py` - API contract: GET /api/military/ list + GET /api/military/{hex} detail
- `backend/tests/test_ingest_military.py` - Unit: parse_military_aircraft ground altitude + null position skip
- `backend/tests/test_ships.py` - API contract: GET /api/ships/ list + GET /api/ships/{mmsi} detail
- `backend/tests/test_ingest_ais.py` - Unit: parse_ais_message PositionReport parse + non-position ignore
- `frontend/src/components/__tests__/MilitaryAircraftLayer.test.tsx` - Smoke: renders null with viewer=null
- `frontend/src/components/__tests__/ShipLayer.test.tsx` - Smoke: renders null with viewer=null

## Decisions Made

- test_military_detail and test_ship_detail assert 404 (not 422): forces the route to exist before the detail test can pass — 422 would mean the route doesn't exist at all
- test_ingest_ais.py uses synchronous (non-async) test functions: parse_ais_message is a pure sync parser with no I/O, no async needed
- Frontend smoke tests use direct static import after vi.mock() instead of vi.hoisted: the mocks are simple enough that Vite's import hoisting handles them without the more complex vi.hoisted() pattern
- aisstream.io PositionReport schema documented in test fixture comments for Plan 03 implementor reference

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- The host machine's anaconda Python 3.11 has SQLAlchemy 1.x which lacks `async_sessionmaker` — resolved by using Docker (`docker compose run --rm backend python -m pytest`) as the correct test environment for this project.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All 6 Wave 0 test files exist and are in RED state — Plans 02, 03, 04 can now use their `<automated>` verify commands
- Plan 02 (military routes + ingest) unlocks: `pytest tests/test_military.py tests/test_ingest_military.py`
- Plan 03 (AIS worker + ships routes) unlocks: `pytest tests/test_ships.py tests/test_ingest_ais.py`
- Plan 04 (frontend layers) unlocks: `npx vitest run MilitaryAircraftLayer.test.tsx ShipLayer.test.tsx`

---
*Phase: 08-new-data-pipelines-military-maritime*
*Completed: 2026-03-12*
