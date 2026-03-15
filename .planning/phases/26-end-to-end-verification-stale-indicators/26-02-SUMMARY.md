---
phase: 26-end-to-end-verification-stale-indicators
plan: "02"
subsystem: ui
tags: [cesium, react, typescript, stale-indicators, billboard, vis-01]

# Dependency graph
requires:
  - phase: 26-01
    provides: Contract tests (VIS-01 stale-tint helpers, VRFY-01 tick boundary) already passing RED

provides:
  - AircraftRecord, ShipRecord, MilitaryAircraftRecord each expose is_stale: boolean
  - AircraftLayer stale-tint useEffect (VIS-01) — GRAY.withAlpha(0.4) in live, no-op in playback
  - ShipLayer stale-tint useEffect (VIS-01) — GRAY.withAlpha(0.4) in live, no-op in playback
  - MilitaryAircraftLayer stale-tint useEffect (VIS-01) — GRAY.withAlpha(0.4) in live, no-op in playback

affects:
  - 26-03 (VRFY-01 replay boundary verification)
  - 26-04 (VRFY-02 FPS gate)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Stale-tint pattern: useEffect after playback interpolation effect, deps [data, replayMode], early-return on 'playback'"
    - "Color singleton safety: always Color.GRAY.withAlpha(0.4) and Color.WHITE.clone() — never assign singletons directly"

key-files:
  created: []
  modified:
    - frontend/src/hooks/useAircraft.ts
    - frontend/src/hooks/useShips.ts
    - frontend/src/hooks/useMilitaryAircraft.ts
    - frontend/src/components/AircraftLayer.tsx
    - frontend/src/components/ShipLayer.tsx
    - frontend/src/components/MilitaryAircraftLayer.tsx

key-decisions:
  - "Stale-tint effect placed after playback interpolation effect in each component — ordering ensures color writes don't conflict with position writes"
  - "Color import added to ShipLayer.tsx and MilitaryAircraftLayer.tsx (were missing); AircraftLayer.tsx already had it"
  - "Effect deps [data, replayMode] — re-runs whenever live data refreshes or mode switches, ensuring tint is cleared on LIVE return"

patterns-established:
  - "VIS-01 stale-tint pattern: single useEffect per layer, early-return guard on playback, iterate billboard map against fresh data lookup"

requirements-completed: [VIS-01]

# Metrics
duration: 3min
completed: 2026-03-13
---

# Phase 26 Plan 02: Stale Indicators — VIS-01 Implementation Summary

**`is_stale: boolean` wired from hook interfaces to Cesium billboard color across all three live entity layers with playback guard**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-13T20:43:59Z
- **Completed:** 2026-03-13T20:47:00Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Extended AircraftRecord, ShipRecord, MilitaryAircraftRecord interfaces with `is_stale: boolean`
- Added stale-tint useEffect to AircraftLayer, ShipLayer, MilitaryAircraftLayer — GRAY.withAlpha(0.4) for stale, WHITE.clone() for fresh
- Added Color to ShipLayer and MilitaryAircraftLayer cesium imports (were missing)
- Full 213-test suite green; TypeScript compiles with no errors

## Task Commits

1. **Task 1: Extend three hook interfaces with is_stale** - `ab121d7` (feat)
2. **Task 2: Add stale-tint effects to AircraftLayer, ShipLayer, MilitaryAircraftLayer** - `0613ddc` (feat)

**Plan metadata:** (docs commit below)

## Files Created/Modified
- `frontend/src/hooks/useAircraft.ts` - AircraftRecord gains `is_stale: boolean`
- `frontend/src/hooks/useShips.ts` - ShipRecord gains `is_stale: boolean`
- `frontend/src/hooks/useMilitaryAircraft.ts` - MilitaryAircraftRecord gains `is_stale: boolean`
- `frontend/src/components/AircraftLayer.tsx` - Stale-tint useEffect added after playback interpolation effect
- `frontend/src/components/ShipLayer.tsx` - Color import added; stale-tint useEffect added
- `frontend/src/components/MilitaryAircraftLayer.tsx` - Color import added; stale-tint useEffect added

## Decisions Made
- Stale-tint effect placed as the last useEffect in each component (after playback interpolation) to avoid conflicting with position-write effects
- `Color.GRAY.withAlpha(0.4)` and `Color.WHITE.clone()` — each returns a new Color instance, preventing Cesium singleton mutation
- `deps: [data, replayMode]` — re-runs on every data poll refresh and on LIVE/playback mode switch

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- VIS-01 fully implemented — stale entities grey-tinted in live, no tint in playback
- Ready for Phase 26-03: VRFY-01 replay boundary end-to-end verification
- Contract tests from 26-01 now turn GREEN with this implementation

---
*Phase: 26-end-to-end-verification-stale-indicators*
*Completed: 2026-03-13*
