---
phase: 24-satellite-propagation-fix
plan: 01
subsystem: testing
tags: [vitest, tdd, satellite.js, typescript, replay-engine]

# Dependency graph
requires:
  - phase: 23-store-foundation-viewer-clock
    provides: useAppStore with isPlaying, replayMode, replayTs fields
provides:
  - resolveTimestamp pure function (frontend/src/lib/resolveTimestamp.ts)
  - Full branch coverage for PLAY-02 timestamp resolution logic
  - PLAY-02 propagation test block proving replay moves satellites by >1000 km
affects:
  - 24-02 (SatelliteLayer and SearchBar integration uses resolveTimestamp)
  - Any future code touching satellite propagation timing

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "TDD RED/GREEN: tests written and committed while failing, then implementation makes them green"
    - "Pure function pattern: timestamp resolution extracted from component into standalone testable unit"
    - "vi.spyOn(Date, 'now') for deterministic wall-clock tests"

key-files:
  created:
    - frontend/src/lib/resolveTimestamp.ts
    - frontend/src/lib/__tests__/resolveTimestamp.test.ts
  modified:
    - frontend/src/workers/__tests__/propagation.test.ts

key-decisions:
  - "resolveTimestamp returns null (not 0) for pause guard — null is a deliberate skip-dispatch signal, not a timestamp"
  - "PLAY-02 test uses deterministic 2026-01-01T12:00:00Z reference time to avoid wall-clock flakiness"
  - "ISS 6-hour position delta threshold set at 1000 km — generous enough to be stable but physically meaningful"

patterns-established:
  - "resolveTimestamp(replayMode, isPlaying, replayTs) -> number | null — three-branch pure function contract"

requirements-completed: [PLAY-02]

# Metrics
duration: 7min
completed: 2026-03-13
---

# Phase 24 Plan 01: resolveTimestamp Pure Function + PLAY-02 Tests Summary

**TDD-first timestamp-resolution pure function: resolveTimestamp.ts with three-branch contract, full unit coverage, and PLAY-02 propagation proof that a 6-hour timestamp rewind moves ISS >1000 km**

## Performance

- **Duration:** ~7 min
- **Started:** 2026-03-13T22:22:00Z
- **Completed:** 2026-03-13T22:23:30Z
- **Tasks:** 2 (RED + GREEN)
- **Files modified:** 3

## Accomplishments

- Created `resolveTimestamp.ts` pure function covering all four input branches: playback/paused returns null, playback/playing returns replayTs, live (either isPlaying) returns Date.now()
- Created `resolveTimestamp.test.ts` with 6 tests covering all branches with mocked Date.now()
- Extended `propagation.test.ts` with a `PLAY-02` describe block (4 tests) proving that ISS propagated at historical timestamp vs wall-clock produces positions differing by over 1000 km
- Full vitest suite green: 178 tests passing across 28 test files

## Task Commits

Each task was committed atomically:

1. **Task RED: Failing tests** - `558d39b` (test)
2. **Task GREEN: resolveTimestamp implementation** - `ce015f0` (feat)

## Files Created/Modified

- `frontend/src/lib/resolveTimestamp.ts` - Pure function: three-branch timestamp resolution logic
- `frontend/src/lib/__tests__/resolveTimestamp.test.ts` - 6 unit tests covering all branches
- `frontend/src/workers/__tests__/propagation.test.ts` - Extended with PLAY-02 describe block (4 tests)

## Decisions Made

- `resolveTimestamp` returns `null` (not `0` or `Date.now()`) for the pause guard — null is an explicit skip-dispatch signal that callers check for before sending to the propagation worker
- PLAY-02 propagation tests use a deterministic reference timestamp (`2026-01-01T12:00:00Z`) rather than `Date.now()` to avoid any future flakiness from epoch drift relative to the TLE fixture
- 1000 km distance threshold is conservative enough to survive any reasonable ISS TLE variation while being physically significant (ISS travels ~28,000 km/h, so 6h gap → ~168,000 km path, plenty of margin)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `resolveTimestamp` is exported and ready for Plan 02 to import into `SatelliteLayer.tsx` (Effect 1 rAF loop and Effect 2 orbit computation) and `SearchBar.tsx` (GET_POSITION payload)
- All 178 tests green — baseline is clean for Plan 02 surgery
- No blockers

---

## Self-Check: PASSED

- FOUND: frontend/src/lib/resolveTimestamp.ts
- FOUND: frontend/src/lib/__tests__/resolveTimestamp.test.ts
- FOUND: commits 558d39b and ce015f0

---
*Phase: 24-satellite-propagation-fix*
*Completed: 2026-03-13*
