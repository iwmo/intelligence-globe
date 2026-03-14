---
phase: 37-entity-labels
plan: "02"
subsystem: ui
tags: [cesium, LabelCollection, satellite, aircraft, entity-labels, NearFarScalar]

# Dependency graph
requires:
  - phase: 37-entity-labels/37-01
    provides: showEntityLabels toggle in useSettingsStore
  - phase: 14
    provides: BillboardCollection and PointPrimitiveCollection patterns in AircraftLayer/SatelliteLayer
provides:
  - Floating cyan OBJECT_NAME labels above satellite PointPrimitives (LBL-03, LBL-04)
  - Floating orange callsign/ICAO24 labels above aircraft billboards (LBL-05, LBL-06)
  - Labels hidden by default, shown only when showEntityLabels=true
  - Labels fade at global zoom via scaleByDistance NearFarScalar
affects:
  - 37-03 (ships and military label implementations — same pattern)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Parallel LabelCollection alongside existing primitive collection per layer"
    - "Module-scope labelsByIcao24 Map mirrors billboardsByIcao24 — same lifecycle"
    - "lbl.show = showEntityLabels && pt/bb.show — cross-reference with entity visibility"
    - "Label positions synced inside POSITIONS worker handler (satellite) and rAF lerp loop (aircraft)"

key-files:
  created: []
  modified:
    - frontend/src/components/SatelliteLayer.tsx
    - frontend/src/components/AircraftLayer.tsx

key-decisions:
  - "Labels are a separate LabelCollection primitive, not embedded in PointPrimitiveCollection/BillboardCollection — required by Cesium GPU architecture"
  - "labelsByIcao24 at module scope mirrors billboardsByIcao24 pattern — same lifecycle, cleared on unmount"
  - "Label show state cross-references entity show state: hidden satellites/aircraft don't get visible labels even if toggle is on"
  - "scaleByDistance satellites: NearFarScalar(5e5, 1.2, 5e7, 0.0) — vanish at global altitude matching point scale range"
  - "scaleByDistance aircraft: NearFarScalar(1e4, 1.4, 5e6, 0.0) — vanish at global altitude matching billboard scale range"
  - "pixelOffset: Cartesian2(0, -18) satellites / Cartesian2(0, -22) aircraft — positioned above icon center"

patterns-established:
  - "Parallel LabelCollection pattern: create alongside existing collection, same cleanup, labelsByX map at module scope"
  - "Label visibility: lbl.show = showEntityLabels && entityRef?.show ?? false — always cross-reference entity visibility"

requirements-completed: [LBL-03, LBL-04, LBL-05, LBL-06]

# Metrics
duration: 2min
completed: 2026-03-14
---

# Phase 37 Plan 02: Entity Labels (Satellites + Aircraft) Summary

**Cyan OBJECT_NAME labels above satellite PointPrimitives and orange callsign/ICAO24 labels above aircraft billboards, driven by showEntityLabels toggle with NearFarScalar distance fading**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-14T21:16:00Z
- **Completed:** 2026-03-14T21:18:13Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- SatelliteLayer gains a parallel LabelCollection (cyan monospace OBJECT_NAME, scaleByDistance 5e5-5e7, positions synced in POSITIONS worker handler)
- AircraftLayer gains a parallel LabelCollection with module-scope labelsByIcao24 map (orange monospace callsign/ICAO24, scaleByDistance 1e4-5e6, positions synced in rAF lerp loop)
- Both label collections properly cleaned up on component unmount and reference-guarded with isDestroyed()
- Label visibility cross-references entity visibility: lbl.show = showEntityLabels && entity.show

## Task Commits

Each task was committed atomically:

1. **Task 1: Add satellite label LabelCollection to SatelliteLayer** - `3238207` (feat)
2. **Task 2: Add aircraft label LabelCollection to AircraftLayer** - `2ce339a` (feat)

## Files Created/Modified

- `frontend/src/components/SatelliteLayer.tsx` - Added LabelCollection alongside PointPrimitiveCollection; labels at OBJECT_NAME, cyan, monospace, synced in POSITIONS handler and controlled by showEntityLabels visibility effect
- `frontend/src/components/AircraftLayer.tsx` - Added LabelCollection alongside BillboardCollection; module-scope labelsByIcao24 map mirrors billboardsByIcao24; labels at callsign/ICAO24, orange, monospace, synced in rAF lerp loop

## Decisions Made

- Labels are a separate Cesium primitive (LabelCollection), not embedded in the existing primitive collection — Cesium requires this and it keeps GPU budget separate
- labelsByIcao24 follows the exact same module-scope Map pattern as billboardsByIcao24 for consistent lifecycle management
- Label show state cross-references entity show state so filtered-out entities don't get phantom labels

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Satellite and aircraft labels are wired and ready
- Plan 37-03 can implement ship and military aircraft labels using the exact same parallel LabelCollection pattern established here

---
*Phase: 37-entity-labels*
*Completed: 2026-03-14*
