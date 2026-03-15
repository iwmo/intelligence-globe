---
phase: 39-frontend-telemetry-ui
plan: 02
subsystem: ui
tags: [cesium, aircraft, billboard, rotation, adsb, roll, vitest, typescript]

# Dependency graph
requires:
  - phase: 38-adsb-migration
    provides: roll field in Aircraft model and ingest_adsbiol populates it from ADSB.lol
  - phase: 39-frontend-telemetry-ui
    plan: 01
    provides: AircraftRecord extended with telemetry fields; AircraftDetailPanel wired
provides:
  - GET /api/aircraft/ list endpoint includes roll per record (null when not reported)
  - AircraftRecord TypeScript interface has roll: number | null
  - computeIconRotation exported from AircraftLayer.tsx; combines heading and roll into billboard rotation
  - Billboard rotation uses computeIconRotation; aircraft with roll data visually bank
  - 6 vitest unit tests for computeIconRotation covering all edge cases
affects:
  - Any future plan modifying AircraftLayer.tsx rotation logic
  - Any plan adding more telemetry fields to AircraftRecord

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pure rotation helper extracted and exported for unit testing without Cesium mocks"
    - "TDD RED-GREEN pattern for billboard rotation logic"
    - "computeIconRotation(trueTrack, roll): number — CesiumMath.toRadians(-(trueTrack ?? 0) + (roll ?? 0))"

key-files:
  created:
    - frontend/src/components/__tests__/AircraftLayer.roll.test.tsx
  modified:
    - backend/app/api/routes_aircraft.py
    - frontend/src/hooks/useAircraft.ts
    - frontend/src/components/AircraftLayer.tsx

key-decisions:
  - "Roll angle applied as additive offset to heading: toRadians(-(trueTrack ?? 0) + (roll ?? 0)) — standard screen-space 2D rotation with alignedAxis: Cartesian3.ZERO"
  - "computeIconRotation extracted as named export — enables unit testing without Cesium mocks"
  - "ac.roll passed directly (typed number | null from AircraftRecord) — no ?? null needed since type already nullable"

patterns-established:
  - "Extract pure billboard rotation logic into named exported helper above the component for testability"

requirements-completed: [UI-04]

# Metrics
duration: 1min
completed: 2026-03-15
---

# Phase 39 Plan 02: Roll Banking Rotation Summary

**Aircraft billboard icons visually bank during turns using ADSB.lol roll angle — computeIconRotation helper combines heading and roll into a single Cesium screen-space rotation**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-03-15T09:32:09Z
- **Completed:** 2026-03-15T09:33:53Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Added `"roll": r.roll` to the `list_aircraft` list endpoint response per record
- Extended `AircraftRecord` TypeScript interface with `roll: number | null`
- Exported `computeIconRotation(trueTrack, roll)` pure helper from AircraftLayer.tsx
- Updated both billboard rotation assignment sites (creation and existing-aircraft update) to use the helper
- Added 6 unit tests validating null handling, heading-only, roll-only, combined, and negative roll cases

## Task Commits

Each task was committed atomically:

1. **Task 1: Add roll to list endpoint and AircraftRecord type** - `71d3886` (feat)
2. **Task 2 RED: Add failing tests for computeIconRotation** - `b78c735` (test)
3. **Task 2 GREEN: Implement computeIconRotation and apply roll banking** - `c0f2e0e` (feat)

_TDD task has RED + GREEN commits as expected._

## Files Created/Modified
- `backend/app/api/routes_aircraft.py` - Added `"roll": r.roll` to list endpoint dict
- `frontend/src/hooks/useAircraft.ts` - Added `roll: number | null` to AircraftRecord interface
- `frontend/src/components/AircraftLayer.tsx` - Added `computeIconRotation` exported helper; updated billboard creation and update rotation assignments
- `frontend/src/components/__tests__/AircraftLayer.roll.test.tsx` - 6 vitest unit tests for computeIconRotation

## Decisions Made
- Roll applied as additive offset to heading rotation in Cesium screen-space (`alignedAxis: Cartesian3.ZERO`), which is the correct plane for top-down 2D icon visual banking. Positive roll = right bank in standard aviation convention maps correctly to Cesium's screen-space rotation axis.
- `computeIconRotation` extracted as a named export above the component so tests can import it without instantiating React or mocking Cesium — the helper has no Cesium type dependencies at call time, only `CesiumMath.toRadians` which is mocked at the vitest level.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- 2 pre-existing `SatelliteLayer.cleanup.test.tsx` failures remain in the full suite — confirmed pre-existing from STATE.md (deferred in 39-01), out of scope for this plan.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 39 complete: all 2 plans executed
- Roll banking is live when aircraft have ADSB.lol roll angle sensor data
- No blockers or concerns

## Self-Check: PASSED

All created/modified files exist on disk. All 3 task commits verified in git log (71d3886, b78c735, c0f2e0e).

---
*Phase: 39-frontend-telemetry-ui*
*Completed: 2026-03-15*
