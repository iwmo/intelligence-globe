---
phase: 14-entity-icons-altitude-scaling
plan: "02"
subsystem: frontend-visualization
tags: [cesium, billboard, canvas, icons, scaleByDistance, NearFarScalar, ships, military]

# Dependency graph
requires:
  - phase: 14-entity-icons-altitude-scaling
    plan: "01"
    provides: [SHIP_ICON, MILITARY_ICON canvas constants]
provides:
  - ShipLayer using BillboardCollection with SHIP_ICON hull silhouette and heading rotation
  - MilitaryAircraftLayer using BillboardCollection with MILITARY_ICON delta-wing and track rotation
  - NearFarScalar altitude scaling (1e4 near, 5e6 far) on both layers
affects: [AircraftLayer, phase-15, phase-16]

# Tech tracking
tech-stack:
  added: []
  patterns: [billboard-collection-migration, nearfarscalar-altitude-scaling, atomic-collection-swap]

key-files:
  created: []
  modified:
    - frontend/src/components/ShipLayer.tsx
    - frontend/src/components/MilitaryAircraftLayer.tsx

key-decisions:
  - "Ship heading uses 511-sentinel fallback to cog: (heading !== null && heading !== 511) ? heading : (cog ?? 0)"
  - "Military heading uses track field directly (no sentinel needed — null ?? 0 is sufficient)"
  - "Billboard width/height: ships 20x20, military 24x24 — slightly larger for delta-wing readability at altitude"
  - "Atomic migration: old PointPrimitiveCollection removed in same cleanup as BillboardCollection creation — no parallel draw calls"

patterns-established:
  - "BillboardCollection migration pattern: replace collection init, rename module-scope map, update add() call to include image/width/height/rotation/alignedAxis/scaleByDistance, update position-only updates to also update rotation"
  - "Heading-to-CesiumJS rotation: CesiumMath.toRadians(-headingDegrees) converts clockwise-from-north heading to CCW radians for screen-space billboard rotation"

requirements-completed: [ICONS-02, ICONS-03, ICONS-05]

# Metrics
duration: 3min
completed: 2026-03-12
tasks_completed: 2
files_modified: 2
---

# Phase 14 Plan 02: ShipLayer and MilitaryAircraftLayer Billboard Migration Summary

**ShipLayer and MilitaryAircraftLayer atomically migrated from PointPrimitiveCollection to BillboardCollection with SHIP_ICON hull silhouettes, MILITARY_ICON delta-wings, heading rotation (511-sentinel fallback for ships, track for military), and NearFarScalar altitude scaling.**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-03-12T17:40:25Z
- **Completed:** 2026-03-12T17:43:25Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- ShipLayer fully migrated to BillboardCollection — ships render as green hull silhouettes (SHIP_ICON) at sea level + 100m with heading rotation and altitude-proportional scaling
- MilitaryAircraftLayer fully migrated to BillboardCollection — military aircraft render as red delta-wing shapes (MILITARY_ICON) at barometric altitude with track rotation and altitude-proportional scaling
- Both layers use `NearFarScalar(1e4, 1.5, 5e6, 0.4)` — icons enlarge at street level (1.5x) and shrink at orbital altitude (0.4x)
- No PointPrimitiveCollection remains in either file — migration is atomic (single collection per layer)
- Vite build passes with zero new errors

## Task Commits

Each task was committed atomically:

1. **Task 1: Migrate ShipLayer.tsx to BillboardCollection** - `a6c2b68` (feat)
2. **Task 2: Migrate MilitaryAircraftLayer.tsx to BillboardCollection** - `3824a9b` (feat)

## Files Created/Modified

- `frontend/src/components/ShipLayer.tsx` — PointPrimitiveCollection replaced with BillboardCollection; shipPointsByMmsi map renamed to shipBillboardsByMmsi; heading rotation with 511-sentinel fallback; NearFarScalar scaleByDistance; Color import removed
- `frontend/src/components/MilitaryAircraftLayer.tsx` — PointPrimitiveCollection replaced with BillboardCollection; militaryPointsByHex map renamed to militaryBillboardsByHex; track-based heading rotation; NearFarScalar scaleByDistance; Color import removed

## Decisions Made

- Ship heading: `(ship.heading !== null && ship.heading !== 511) ? ship.heading : (ship.cog ?? 0)` — AIS heading value 511 is the standard sentinel for "not available"; COG is the authoritative fallback
- Military heading: `ac.track ?? 0` — track field is already degrees clockwise from north, same convention as billboard rotation input; no sentinel needed
- Billboard sizes: 20x20 for ships (matching existing pixelSize visual weight), 24x24 for military (slightly larger for delta-wing readability)
- Both layers: `alignedAxis: Cartesian3.ZERO` — screen-space rotation mode so icons rotate with heading but always face the camera (not globe-surface normal)

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

Pre-existing TypeScript errors in `propagation.worker.ts`, `propagation.test.ts`, and `vite.config.ts` produced tsc output during `npm run build`. These errors are unchanged from before this plan (documented as out-of-scope in 14-01-SUMMARY.md). Vite build (esbuild transpilation) succeeds with exit 0 — the tsc type check is a CI concern, not a build blocker.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- ShipLayer and MilitaryAircraftLayer are complete. Plan 03 (AircraftLayer) is the next migration — more complex due to the rAF lerp loop and the AIRCRAFT_ICON billboard needing to integrate with the existing animation frame.
- NearFarScalar values (1e4–5e6) require in-browser zoom testing before Phase 14 is marked complete — this is a known blocker tracked in STATE.md.

---
*Phase: 14-entity-icons-altitude-scaling*
*Completed: 2026-03-12*
