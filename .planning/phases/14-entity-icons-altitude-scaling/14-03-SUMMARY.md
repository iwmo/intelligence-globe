---
phase: 14-entity-icons-altitude-scaling
plan: "03"
subsystem: frontend-visualization
tags: [cesium, billboard, aircraft, lerp, raf, texture-atlas, altitude-scaling]

requires:
  - phase: 14-01
    provides: "AIRCRAFT_ICON exported HTMLCanvasElement constant at module scope"
provides:
  - "AircraftLayer.tsx using BillboardCollection with AIRCRAFT_ICON airplane silhouette icons"
  - "Aircraft icons rotate with heading via CesiumMath.toRadians on true_track"
  - "Aircraft icons scale with altitude via NearFarScalar(1e4, 1.5, 5e6, 0.4)"
  - "rAF lerp loop iterates billboardsByIcao24 and updates bb.position"
  - "Playback snapshot interpolation operates on billboard bb.position"
affects: []

tech-stack:
  added: []
  patterns:
    - "BillboardCollection replacing PointPrimitiveCollection for movable entity layers"
    - "module-scope map renamed: pointsByIcao24 -> billboardsByIcao24"
    - "billboard.position API identical to point.position — rAF lerp unchanged structurally"
    - "heading rotation: CesiumMath.toRadians(-(true_track ?? 0)) updated each poll cycle"

key-files:
  created: []
  modified:
    - frontend/src/components/AircraftLayer.tsx

key-decisions:
  - "id: ac.icao24 (bare icao24, no prefix) preserved on billboards — unified LEFT_CLICK handler requires no changes"
  - "alignedAxis: Cartesian3.ZERO for screen-space billboard rotation — icons face camera, not globe surface"
  - "existing-aircraft branch gets heading update (existingBb.rotation) on each data refresh — icons always point in direction of travel"
  - "rAF lerp loop closure still captures module-scope billboardsByIcao24 — no structural change to lerp architecture"

patterns-established:
  - "BillboardCollection migration pattern: rename map, rename collection type, replace collection.add() properties, keep id and lerp position API unchanged"

requirements-completed: [ICONS-01, ICONS-05]

duration: 4min
completed: 2026-03-12
---

# Phase 14 Plan 03: AircraftLayer BillboardCollection Migration Summary

**AircraftLayer.tsx migrated from PointPrimitiveCollection (orange dots) to BillboardCollection with AIRCRAFT_ICON airplane silhouettes, heading rotation via true_track, and NearFarScalar altitude scaling — rAF lerp loop and playback interpolation preserved structurally.**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-12T17:44:34Z
- **Completed:** 2026-03-12T17:48:00Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments

- Commercial aircraft now render as swept-wing orange airplane silhouettes instead of orange dots
- Aircraft icons rotate to match true_track heading — icons point in direction of travel
- Icons scale with altitude via NearFarScalar(1e4, 1.5, 5e6, 0.4) — larger close up, smaller at orbital view
- rAF lerp loop preserved exactly — bb.position API identical to point.position, only variable names changed
- Unified LEFT_CLICK handler unchanged — bare icao24 id scheme maintained on all billboards
- Playback snapshot interpolation preserved — bb.position assignment identical to point.position
- Trail-on-selection effect (Effect 3) unchanged — uses aircraft.data directly, not billboard map

## Task Commits

Each task was committed atomically:

1. **Task 1: Migrate AircraftLayer.tsx to BillboardCollection with rAF lerp** - `44634fb` (feat)

**Plan metadata:** (docs commit to follow)

## Files Created/Modified

- `frontend/src/components/AircraftLayer.tsx` — Full migration from PointPrimitiveCollection to BillboardCollection: renamed map (pointsByIcao24 -> billboardsByIcao24), changed collectionRef type, added BillboardCollection/NearFarScalar/CesiumMath imports, removed PointPrimitiveCollection import, updated all five effects to use billboard API

## Decisions Made

- id set to bare `ac.icao24` (no prefix) on billboards — unified LEFT_CLICK handler in Effect 1 routes commercial aircraft via the else branch (bare string) — no handler changes required
- `alignedAxis: Cartesian3.ZERO` — screen-space billboard rotation so icons face camera rather than aligning to globe surface normal
- Existing aircraft branch updates `existingBb.rotation` on every data refresh cycle to keep heading current during flight
- rAF lerp function closes over module-scope `billboardsByIcao24` (same closure pattern as the prior `pointsByIcao24` — no structural change)

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None. Pre-existing TypeScript errors in `propagation.worker.ts`, `propagation.test.ts`, and `vite.config.ts` are unrelated to this plan and were present before execution. `AircraftLayer.tsx` produces zero TypeScript errors under `tsc --noEmit --skipLibCheck`.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- All three movable entity layers (aircraft, ships, military aircraft) now display shaped icons instead of dots
- Phase 14 Plan 04 (satellite icon/scaling plan if any) or overall Phase 14 verification can proceed
- NearFarScalar values (1e4, 1.5, 5e6, 0.4) require in-browser tuning with continuous zoom test before Phase 14 is marked complete

---
*Phase: 14-entity-icons-altitude-scaling*
*Completed: 2026-03-12*
