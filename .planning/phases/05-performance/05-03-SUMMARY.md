---
phase: 05-performance
plan: "03"
subsystem: testing
tags: [vitest, satellite.js, cesium, unit-test, eci-ecef, cleanup]

requires:
  - phase: 05-performance/05-01
    provides: BlendOption.OPAQUE applied to SatelliteLayer and AircraftLayer
  - phase: 05-performance/05-02
    provides: Aircraft latlon partial index, backend latency tests

provides:
  - ISS ground track ECI/ECEF validation unit test (propagation.test.ts)
  - SatelliteLayer cleanup unit test confirming worker.terminate + primitives.remove
  - Nine pitfall static audit — all 9 checks pass
  - Human FPS checkpoint approved at ~60fps sustained (Chrome DevTools, 10.86s recording)

affects:
  - Phase 5 INFRA-03 requirement closure
  - Any future satellite propagation work

tech-stack:
  added: []
  patterns:
    - vi.hoisted() for mocks that reference top-level variables inside vi.mock() factory
    - execSync grep assertions for static code analysis in vitest test blocks
    - ISS_OMM_FIXTURE hardcoded for offline-capable propagation math tests

key-files:
  created:
    - frontend/src/workers/__tests__/propagation.test.ts
    - frontend/src/components/__tests__/SatelliteLayer.cleanup.test.tsx
  modified: []

key-decisions:
  - "vi.hoisted() used to create mock variables before vi.mock() hoisting — avoids 'cannot access before initialization' error"
  - "Worker global mocked as class (not vi.fn()) so 'new Worker()' constructor call in SatelliteLayer works"
  - "SRC_DIR resolved via path.resolve(__dirname, '../..') = frontend/src — matches component/worker relative paths"
  - "Pitfall 7 ArcType check excludes import destructuring bare-name lines via regex pattern"

requirements-completed:
  - INFRA-03

duration: 8min
completed: 2026-03-11
---

# Phase 05 Plan 03: Validation Tests and Pitfall Audit Summary

**ISS ground track ECI/ECEF validation (5 tests), SatelliteLayer cleanup test with Worker mock (2 tests), nine-pitfall static audit (9 checks), and human FPS checkpoint approved at ~60fps — all Phase 5 INFRA-03 verification gates closed**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-03-11T17:34:00Z
- **Completed:** 2026-03-11T17:39:00Z
- **Tasks:** 3 of 3 (Task 3: human FPS checkpoint approved at ~60fps)
- **Files created:** 2

## Accomplishments

- ISS ground track test: 5 assertions — json2satrec parse, latitude bounds (±53°), ECEF magnitude in LEO range, valid point count (≥90/96), longitude range ([-180,180])
- SatelliteLayer cleanup test: confirms `worker.terminate()` and `viewer.scene.primitives.remove()` called on unmount using vi.hoisted() CesiumJS class mocks
- Nine pitfall static audit: 4 grep-based (EntityCollection absence, km→m conversion, pt.position= assignment, isDestroyed guard, ArcType.NONE) plus 5 code-review assertions
- Full vitest suite 29/29 green (3 test files)

## Task Commits

Each task was committed atomically:

1. **Task 1: ISS ground track ECI/ECEF validation unit test** - `e7fd508` (test)
2. **Task 2: SatelliteLayer cleanup unit test + nine pitfall static audit** - `d28041e` (test)
3. **Task 3: Human FPS visual verification** - approved by user (no code commit — human verification artifact: ~60fps sustained, GPU continuously active, no red frame drops in 10.86s Chrome DevTools Performance trace)

**Plan metadata:** TBD (docs commit below)

## Files Created/Modified

- `frontend/src/workers/__tests__/propagation.test.ts` — ISS orbit propagation math tests (5 tests, offline, satellite.js direct import)
- `frontend/src/components/__tests__/SatelliteLayer.cleanup.test.tsx` — cleanup unit test + nine pitfall audit (11 tests)

## Decisions Made

- **vi.hoisted() pattern:** `vi.mock()` factories are hoisted before imports, making top-level class declarations inaccessible inside factories. Used `vi.hoisted()` to create shared mock state that survives hoisting.
- **Worker as class:** `vi.stubGlobal('Worker', class MockWorker {...})` required because SatelliteLayer uses `new Worker(...)` constructor syntax.
- **Path resolution:** `__dirname` in test = `frontend/src/components/__tests__`. Used `path.resolve(__dirname, '../..')` to get `frontend/src` for grep commands.
- **Pitfall 7 filter:** Import destructure line (`  ArcType,`) matched false positive in ArcType check. Added regex `^\s*\d*[:\s]*\s*ArcType,` to exclude bare-name destructure lines.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed three vi.mock() hoisting issues during Task 2 iteration**

- **Found during:** Task 2 (SatelliteLayer.cleanup.test.tsx creation)
- **Issue 1:** `PointPrimitiveCollection: vi.fn(() => mockCollection)` — vi.fn() factory returns an object, not a constructor; `new PointPrimitiveCollection()` throws "not a constructor"
- **Issue 2:** `SRC_DIR` was calculated as `frontend` (wrong level); grep paths like `frontend/workers/` didn't exist
- **Issue 3:** Pitfall 7 false positive — import destructure `ArcType,` matched the "other ArcType usage" check
- **Fix:** Used vi.hoisted() for shared mocks, proper class definitions inside vi.mock() factory, corrected path to `../../..` = `frontend/src`, added regex exclusion for bare import names
- **Verification:** All 11 tests pass after each fix; full suite 29/29 green
- **Committed in:** `d28041e` (Task 2 commit — final passing version)

---

**Total deviations:** 1 auto-fixed (Rule 1 - implementation bug in test mock setup)
**Impact on plan:** Fix was necessary for test correctness. No scope creep.

## Issues Encountered

- vitest mock hoisting required `vi.hoisted()` pattern — standard Vitest pattern for class-based CesiumJS mocks
- grep path resolution needed careful calculation from `__dirname` — resolved by using `path.resolve(__dirname, '../..')`

## Next Phase Readiness

- Phase 5 automated verification gates complete: ECI/ECEF math validated, cleanup paths tested, nine pitfalls audited
- Phase 5 is fully complete — all three plans executed, INFRA-03 satisfied
- Human FPS checkpoint approved at ~60fps: sustained green Frames bar throughout 10.86s recording, GPU continuously active, no red drops
- INFRA-03 fully satisfied: 60 FPS target confirmed, sub-100ms latency tested (Plan 02), ECI/ECEF validated (Plan 03)

---
*Phase: 05-performance*
*Completed: 2026-03-11*
