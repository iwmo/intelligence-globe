---
phase: 14-entity-icons-altitude-scaling
plan: "04"
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
  - Human zoom test approved — icons legible from 20,000 km orbital to 500 m street level

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
  - "NearFarScalar(5e5, 1.5, 5e7, 0.3) starting values passed human zoom test without tuning — approved as-is"
  - "Satellite layer remains PointPrimitiveCollection — BillboardCollection migration blocked by 5,000+ entity GPU TextureAtlas constraint"

patterns-established:
  - "Pattern: capture collection.add() return value to set scaleByDistance post-add on PointPrimitive"

requirements-completed:
  - ICONS-04
  - ICONS-05

# Metrics
duration: 10min
completed: 2026-03-12
---

# Phase 14 Plan 04: Satellite scaleByDistance and Zoom Legibility Summary

**NearFarScalar(5e5, 1.5, 5e7, 0.3) added post-add to each satellite PointPrimitive; human zoom test approved all five entity icon shapes and altitude legibility from 20,000 km orbital to 500 m street level**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-03-12T17:48:38Z
- **Completed:** 2026-03-12T18:00:00Z
- **Tasks:** 2 of 2
- **Files modified:** 1

## Accomplishments

- Added `NearFarScalar` import to SatelliteLayer.tsx cesium imports
- Captured `collection.add()` return value as `pt` in the `LOADED` message handler and set `pt.scaleByDistance = new NearFarScalar(5e5, 1.5, 5e7, 0.3)` post-add on each satellite primitive
- Satellite layer architecture unchanged — still PointPrimitiveCollection, no BillboardCollection migration
- Human approved all five entity icon shapes: aircraft (orange swept-wing), military (red delta-wing), ships (green hull), satellites (cyan dots by design)
- Continuous zoom test from 20,000 km to 500 m passed — NearFarScalar starting values required no tuning

## Task Commits

Each task was committed atomically:

1. **Task 1: Add scaleByDistance to SatelliteLayer.tsx PointPrimitive entries** - `805eaaf` (feat)
2. **Task 2: Verify all entity icons and zoom legibility** - human-approved (no code changes required)

**Plan metadata:** (docs commit follows this summary)

## Files Created/Modified

- `frontend/src/components/SatelliteLayer.tsx` - Added NearFarScalar import + pt.scaleByDistance post-add in LOADED handler

## Decisions Made

- `scaleByDistance` is set post-add on the PointPrimitive instance (not as a collection.add() option) — API pattern confirmed from research
- Starting NearFarScalar values (near=5e5, nearValue=1.5, far=5e7, farValue=0.3) passed human visual zoom test without adjustment — approved as-is
- Satellite layer stays PointPrimitiveCollection per hard GPU constraint (5,000+ billboards degrade integrated GPU frame rate)

## Deviations from Plan

None — plan executed exactly as written. NearFarScalar starting values required no tuning per human zoom test approval.

## Issues Encountered

Pre-existing lint and TypeScript build errors exist in test files and unrelated source files (SatelliteLayer.cleanup.test.tsx, propagation.test.ts, vite.config.ts). None are in SatelliteLayer.tsx itself. These were already present before this plan and are out of scope.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Phase 14 (entity icons and altitude scaling) is complete — all four plans (01-04) executed
- All five entity types render with correct shaped icons and altitude-proportional scaling
- No GPU TextureAtlas crash risk — three pre-rendered canvas textures shared across all billboard entities; satellites remain PointPrimitiveCollection
- Ready for subsequent phase development

---
*Phase: 14-entity-icons-altitude-scaling*
*Completed: 2026-03-12*
