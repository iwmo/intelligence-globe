---
phase: 33-viewport-culling
plan: 04
subsystem: ui
tags: [react-query, viewport-culling, bbox, hooks, typescript]

# Dependency graph
requires:
  - phase: 33-02
    provides: viewportBbox store field and setViewportBbox action
  - phase: 33-03
    provides: bbox query parameters on backend aircraft/ships/military endpoints
provides:
  - bbox-aware React Query hooks for aircraft, ships, and military aircraft layers
  - queryKey includes viewportBbox so React Query auto-refetches on camera pan
  - live-mode bbox params appended to fetch URL; playback mode suppresses bbox
affects:
  - any component using useAircraft, useShips, or useMilitaryAircraft

# Tech tracking
tech-stack:
  added: []
  patterns:
    - effectiveBbox pattern (replayMode === 'live' ? viewportBbox : null) for VPC-08 playback suppression
    - queryKey includes bbox object to trigger automatic React Query refetch on viewport change
    - URLSearchParams construction with min_lat/max_lat/min_lon/max_lon when bbox non-null

key-files:
  created: []
  modified:
    - frontend/src/hooks/useAircraft.ts
    - frontend/src/hooks/useShips.ts
    - frontend/src/hooks/useMilitaryAircraft.ts

key-decisions:
  - "effectiveBbox = replayMode === 'live' ? viewportBbox : null — bbox always suppressed in playback (VPC-08)"
  - "queryKey includes effectiveBbox object (not serialized string) — React Query deep-compares objects, triggers refetch on new camera bounds"

patterns-established:
  - "All live-data hooks follow the same effectiveBbox pattern for consistent bbox suppression"

requirements-completed: [VPC-04, VPC-05, VPC-06, VPC-08]

# Metrics
duration: 5min
completed: 2026-03-14
---

# Phase 33 Plan 04: Viewport Culling Hook Wiring Summary

**Three live-data hooks (aircraft, ships, military) wired to read viewportBbox from store, include it in React Query queryKey, and append bbox params to fetch URL in live mode — completing the viewport culling loop from camera move to filtered backend response**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-03-14T15:47:00Z
- **Completed:** 2026-03-14T16:10:00Z
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments

- All three data hooks (`useAircraft`, `useShips`, `useMilitaryAircraft`) now read `viewportBbox` from `useAppStore`
- `effectiveBbox` pattern ensures bbox is suppressed during playback mode (VPC-08 compliance)
- `queryKey` includes `effectiveBbox` so React Query automatically re-fetches each layer on camera pan
- URL params `min_lat/max_lat/min_lon/max_lon` appended when `effectiveBbox` non-null and live
- Full frontend suite: 31 test files, 217 tests passed; backend suite: 102 passed, 2 skipped

## Task Commits

Each task was committed atomically:

1. **Task 1: Wire bbox into useAircraft** - `d1d009d` (feat)
2. **Task 2: Wire bbox into useShips and useMilitaryAircraft** - `cbfd01b` (feat)
3. **Task 3: Full suite verification** - no file changes (verification only)

## Files Created/Modified

- `frontend/src/hooks/useAircraft.ts` - Added viewportBbox selector, effectiveBbox computation, bbox in queryKey, conditional URL params
- `frontend/src/hooks/useShips.ts` - Same bbox pattern applied to ships layer
- `frontend/src/hooks/useMilitaryAircraft.ts` - Same bbox pattern applied to military aircraft layer

## Decisions Made

- `effectiveBbox = replayMode === 'live' ? viewportBbox : null` — bbox always suppressed during playback (VPC-08). Replay engine must be able to load historical data across arbitrary space/time without viewport restrictions.
- `queryKey: ['aircraft', effectiveBbox]` — React Query deep-compares the bbox object, so a new camera bounds (even with same shape) triggers a fresh fetch. No manual invalidation needed.

## Deviations from Plan

None — plan executed exactly as written. Test file `useAircraft.bbox.test.ts` was already in GREEN state from prior plans (correctly testing VPC-08 suppression), which was expected since the test was written in plan 33-03. The GREEN implementation in this plan ensures the full live-mode bbox path also works correctly.

## Issues Encountered

Backend `python -m pytest` failed with `ModuleNotFoundError: No module named 'fastapi'` when called with the system anaconda Python. Tests pass correctly when run with the project's virtualenv (`backend/venv/bin/python -m pytest`). This is a pre-existing environment issue unrelated to this plan's changes.

## Next Phase Readiness

Phase 33 viewport culling is complete. The full loop is functional:
1. Camera move fires `useViewportBbox` hook (plan 33-02)
2. Hook updates `viewportBbox` in the store
3. React Query sees queryKey change, re-fetches data hooks (this plan)
4. Backend endpoints filter by bbox params (plan 33-03)
5. Frontend renders only the visible region's data

All VPC-01 through VPC-08 requirements satisfied.

---
*Phase: 33-viewport-culling*
*Completed: 2026-03-14*
