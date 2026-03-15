---
phase: 40-v10-tech-debt-cleanup
plan: "02"
subsystem: ui
tags: [react-query, polling, adsb.lol, aircraft]

# Dependency graph
requires: []
provides:
  - useAircraft hook polls at 15s cadence matching ADSB.lol backend freshness
  - No stale OpenSky 90s reference in frontend query hook
affects: [aircraft-layer, frontend-polling]

# Tech tracking
tech-stack:
  added: []
  patterns: [ADSB.lol 15s poll cadence for react-query staleTime and refetchInterval]

key-files:
  created: []
  modified:
    - frontend/src/hooks/useAircraft.ts

key-decisions:
  - "staleTime and refetchInterval both set to 15_000 — matches ADSB.lol backend refresh (~15s), eliminates up-to-90s data lag"
  - "OpenSky poll interval comment removed — comment was misleading after backend migration"

patterns-established:
  - "Poll cadence pattern: staleTime === refetchInterval === 15_000 for live ADSB.lol hooks"

requirements-completed: [CLEANUP-02]

# Metrics
duration: 1min
completed: 2026-03-15
---

# Phase 40 Plan 02: useAircraft Poll Cadence Cleanup Summary

**useAircraft hook poll interval reduced from 90s to 15s to match ADSB.lol backend cadence, eliminating stale data lag and removing the obsolete OpenSky comment**

## Performance

- **Duration:** ~1 min
- **Started:** 2026-03-15T10:02:13Z
- **Completed:** 2026-03-15T10:02:37Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments

- Changed `staleTime` from `90_000` to `15_000` in `useAircraft.ts`
- Changed `refetchInterval` from `90_000` to `15_000` when `replayMode === 'live'`
- Removed the stale `// 90 seconds — matches OpenSky poll interval` comment
- TypeScript compiles cleanly with no errors

## Task Commits

Each task was committed atomically:

1. **Task 1: Update poll interval and remove OpenSky comment** - `642f498` (feat)

**Plan metadata:** (docs commit — see below)

## Files Created/Modified

- `frontend/src/hooks/useAircraft.ts` - staleTime and refetchInterval updated to 15_000; OpenSky comment removed

## Decisions Made

- staleTime and refetchInterval both set to `15_000` — ADSB.lol delivers fresh data every ~15 seconds, so the old 90s value meant showing data up to 90 seconds old when fresher data was available
- OpenSky comment removed as it referenced a now-retired data source and was misleading

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Poll cadence aligned with ADSB.lol backend; globe will now refresh aircraft positions at 15s intervals matching backend ingest
- Ready for Phase 40 Plan 03 (next tech debt cleanup task)

---
*Phase: 40-v10-tech-debt-cleanup*
*Completed: 2026-03-15*
