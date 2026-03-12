---
phase: 14-entity-icons-altitude-scaling
plan: 04
subsystem: ui
tags: [cesium, satellites, PointPrimitive, NearFarScalar, altitude-scaling]

# Dependency graph
requires:
  - phase: 14-02
    provides: Ship and military billboard layers with scaleByDistance
  - phase: 14-03
    provides: Aircraft billboard layer with scaleByDistance

provides:
  - Satellite PointPrimitive scaleByDistance NearFarScalar(5e5, 1.5, 5e7, 0.3) post-add in LOADED handler
  - All five entity types (aircraft, military, ships, satellites) have altitude-proportional icon sizing

affects:
  - future satellite layer changes
  - zoom legibility tuning passes

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "PointPrimitive.scaleByDistance set post-add (not in collection.add options) — confirmed API pattern"
    - "Satellite layer stays PointPrimitiveCollection — NearFarScalar on primitives avoids BillboardCollection GPU cost"

key-files:
  created: []
  modified:
    - frontend/src/components/SatelliteLayer.tsx

key-decisions:
  - "scaleByDistance must be set post-add on PointPrimitive instance — collection.add() returns the instance"
  - "Starting NearFarScalar values (near=5e5, far=5e7) require in-browser zoom tuning — mandated as Task 2 human-verify checkpoint"

patterns-established:
  - "Pattern: capture collection.add() return value to set scaleByDistance post-add on PointPrimitive"

requirements-completed:
  - ICONS-04
  - ICONS-05

# Metrics
duration: 1min
completed: 2026-03-12
---

# Phase 14 Plan 04: Satellite scaleByDistance and Zoom Legibility Summary

**NearFarScalar(5e5, 1.5, 5e7, 0.3) added post-add to each satellite PointPrimitive in LOADED handler — all five entity types now have altitude-proportional sizing**

## Performance

- **Duration:** 1 min
- **Started:** 2026-03-12T17:48:38Z
- **Completed:** 2026-03-12T17:49:18Z
- **Tasks:** 1 of 2 (Task 2 is a human-verify checkpoint — awaiting visual approval)
- **Files modified:** 1

## Accomplishments
- Added `NearFarScalar` import to SatelliteLayer.tsx cesium imports
- Captured `collection.add()` return value as `pt` in the `LOADED` message handler
- Set `pt.scaleByDistance = new NearFarScalar(5e5, 1.5, 5e7, 0.3)` post-add on each satellite primitive
- Satellite layer architecture unchanged — still PointPrimitiveCollection, no BillboardCollection migration

## Task Commits

Each task was committed atomically:

1. **Task 1: Add scaleByDistance to SatelliteLayer.tsx PointPrimitive entries** - `805eaaf` (feat)
2. **Task 2: Verify all entity icons and zoom legibility** - PENDING human-verify checkpoint

**Plan metadata:** (docs commit pending after Task 2 approval)

## Files Created/Modified
- `frontend/src/components/SatelliteLayer.tsx` - Added NearFarScalar import + pt.scaleByDistance post-add in LOADED handler

## Decisions Made
- `scaleByDistance` is set post-add on the PointPrimitive instance (not as a collection.add() option) — API pattern confirmed from research
- Starting values NearFarScalar(5e5, 1.5, 5e7, 0.3): near=500km → scale 1.5x, far=50,000km → scale 0.3x
- NearFarScalar values are explicitly labeled as starting values requiring in-browser tuning during zoom test

## Deviations from Plan

None — plan executed exactly as written. The two additive changes (import + post-add scaleByDistance) were applied without any structural changes to SatelliteLayer.tsx.

## Issues Encountered

Pre-existing lint and TypeScript build errors exist in test files and unrelated source files (SatelliteLayer.cleanup.test.tsx, propagation.test.ts, vite.config.ts). None are in SatelliteLayer.tsx itself. These were already present before this plan and are out of scope.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness
- Task 2 (human-verify checkpoint) requires starting the dev server and performing zoom legibility test across 20,000 km to 500 m range
- If NearFarScalar values need tuning, user reports the adjusted values and executor applies them
- After human approval, Phase 14 is complete (all five entity types have shaped icons with altitude scaling)

---
*Phase: 14-entity-icons-altitude-scaling*
*Completed: 2026-03-12 (partial — Task 2 checkpoint pending)*
