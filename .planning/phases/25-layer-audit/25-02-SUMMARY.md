---
phase: 25-layer-audit
plan: 02
subsystem: ui
tags: [cesium, replay, playback, billboard, animation, zustand]

# Dependency graph
requires:
  - phase: 25-01
    provides: queryClient extracted and 7 RED test cases written for LAYR-01/LAYR-02 guards
provides:
  - AircraftLayer lerp() guard reading replayMode via getState() — skips bb.position writes in playback
  - ShipLayer Effect 2 replayMode guard with replayMode in deps array
  - MilitaryAircraftLayer Effect 2 replayMode guard with replayMode in deps array
  - LAYR-01 and LAYR-02 test cases GREEN
affects:
  - 25-03
  - 25-04
  - 26-end-to-end-verification

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Playback mode guard pattern: early return before position writes, replayMode via getState() in rAF, replayMode in deps for React effects"

key-files:
  created: []
  modified:
    - frontend/src/components/AircraftLayer.tsx
    - frontend/src/components/ShipLayer.tsx
    - frontend/src/components/MilitaryAircraftLayer.tsx
    - frontend/src/components/__tests__/AircraftLayer.debounce.test.tsx
    - frontend/src/components/__tests__/ShipLayer.test.tsx
    - frontend/src/components/__tests__/MilitaryAircraftLayer.test.tsx

key-decisions:
  - "AircraftLayer lerp reads replayMode via useAppStore.getState() inside rAF body — not captured closure — prevents stale value after effect re-creation"
  - "rAF loop stays alive in playback (returns after scheduling next frame) — enables instant resume without loop restart overhead"
  - "ShipLayer and MilitaryAircraftLayer guards placed before null-check guards — replayMode takes precedence over data availability"
  - "replayMode added to Effect 2 deps in both layers — live-resume triggers immediate re-run when mode switches back"

patterns-established:
  - "Effect 2 guard pattern: if (replayMode === 'playback') return; as first line before null checks"
  - "rAF guard pattern: check replayMode via getState() then schedule next frame before returning — loop never stops"
  - "Contract test helper mirrors guarded production logic — helper accepts replayMode param, skips writes in playback"

requirements-completed: [LAYR-01, LAYR-02]

# Metrics
duration: 8min
completed: 2026-03-13
---

# Phase 25 Plan 02: Layer Audit — Playback Guards Summary

**Playback mode guards wired into AircraftLayer lerp loop and ShipLayer/MilitaryAircraftLayer Effect 2, giving snapshot interpolation exclusive bb.position ownership during replay**

## Performance

- **Duration:** 8 min
- **Started:** 2026-03-13T23:00:00Z
- **Completed:** 2026-03-13T23:08:00Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- AircraftLayer lerp() reads `useAppStore.getState().replayMode` each frame — returns early in playback without cancelling rAF
- ShipLayer Effect 2 returns early when `replayMode === 'playback'`, with `replayMode` added to deps for live-resume reactivity
- MilitaryAircraftLayer Effect 2 identical guard and deps update
- All 13 tests GREEN across three test files (7 LAYR-01/LAYR-02 cases + 6 pre-existing)

## Task Commits

Each task was committed atomically:

1. **Task 1: Guard AircraftLayer lerp loop (LAYR-01)** - `b26c8d9` (feat)
2. **Task 2: Guard ShipLayer and MilitaryAircraftLayer Effect 2 (LAYR-02)** - `87246c9` (feat)

## Files Created/Modified

- `frontend/src/components/AircraftLayer.tsx` - Added LAYR-01 guard in lerp() after rafRunningRef check
- `frontend/src/components/ShipLayer.tsx` - Added LAYR-02 guard as first line of Effect 2, replayMode in deps
- `frontend/src/components/MilitaryAircraftLayer.tsx` - Added LAYR-02 guard as first line of Effect 2, replayMode in deps
- `frontend/src/components/__tests__/AircraftLayer.debounce.test.tsx` - Updated helper to simulate guarded lerp, LAYR-01 tests GREEN
- `frontend/src/components/__tests__/ShipLayer.test.tsx` - Updated helper to check replayMode, LAYR-02 tests GREEN
- `frontend/src/components/__tests__/MilitaryAircraftLayer.test.tsx` - Updated helper to check replayMode, LAYR-02 tests GREEN

## Decisions Made

- AircraftLayer uses `useAppStore.getState().replayMode` (not a component-scope selector) inside the rAF closure — this is the only safe approach since the rAF closure is created once when aircraft.data changes and would freeze a captured closure value
- rAF loop stays alive during playback (schedules next frame before returning) — consistent with the decision from Plan 25-01 context: "Aircraft lerp loop must stay alive in playback (return early, not cancel rAF)"
- Guard placed as first line before null checks in ShipLayer/MilitaryAircraftLayer — this matches the plan spec and ensures no unnecessary work is done when replayMode is playback

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None — all three guards applied cleanly. All 13 tests passed on first run after changes.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- LAYR-01 and LAYR-02 GREEN — snapshot interpolation now has exclusive bb.position ownership in playback
- Plan 25-03 can proceed to audit remaining layers (GPS jamming, street traffic, satellites) for similar guards
- On return to LIVE, the next data change re-runs Effect 2 and writes fresh positions (replayMode in deps handles this)

---
*Phase: 25-layer-audit*
*Completed: 2026-03-13*
