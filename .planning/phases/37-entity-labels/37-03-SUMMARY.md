---
phase: 37-entity-labels
plan: "03"
subsystem: frontend-layers
tags: [labels, cesium, military-aircraft, ships, entity-labels]
dependency_graph:
  requires:
    - "37-01"  # showEntityLabels toggle infrastructure in useSettingsStore
  provides:
    - LBL-07
    - LBL-08
    - LBL-09
    - LBL-10
  affects:
    - frontend/src/components/MilitaryAircraftLayer.tsx
    - frontend/src/components/ShipLayer.tsx
tech_stack:
  added: []
  patterns:
    - "Parallel LabelCollection alongside BillboardCollection (module-scope map per layer)"
    - "showEntityLabels selector from useSettingsStore driving label visibility"
    - "scaleByDistance NearFarScalar(1e4, 1.4, 5e6, 0.0) for zoom-responsive labels"
key_files:
  created: []
  modified:
    - frontend/src/components/MilitaryAircraftLayer.tsx
    - frontend/src/components/ShipLayer.tsx
decisions:
  - "Label position kept in sync with billboard during data refresh (both update on existing entity)"
  - "Labels start with show: false — visibility set reactively by Effect 4, not at creation time"
  - "Label text uppercased to match military/maritime display conventions"
metrics:
  duration: "~2 minutes"
  completed: "2026-03-15"
  tasks_completed: 2
  files_modified: 2
---

# Phase 37 Plan 03: Military Aircraft and Ship Labels Summary

**One-liner:** Red (#EF4444) callsign labels for military aircraft and green (#22C55E) vessel-name labels for ships, each driven by a parallel Cesium LabelCollection tied to the `showEntityLabels` toggle.

## What Was Built

Two layer components received parallel `LabelCollection` primitives, completing all four entity label implementations for the v9.0 milestone.

### MilitaryAircraftLayer

- Added `LabelCollection` (`labelCollectionRef`) created in Effect 1 alongside the existing `BillboardCollection`
- Module-scope `militaryLabelsByHex: Map<string, any>` mirrors `militaryBillboardsByHex`
- Labels render `(ac.flight?.trim() || ac.hex).toUpperCase()` in red `#EF4444`, 11px monospace with black outline
- Effect 4 sets `lbl.show = showEntityLabels && (bb?.show ?? false)` — labels respect both the entity-labels toggle and layer visibility
- Cleanup removes `LabelCollection` from scene and clears `militaryLabelsByHex`

### ShipLayer

- Added `LabelCollection` (`labelCollectionRef`) created in Effect 1 alongside the existing `BillboardCollection`
- Module-scope `shipLabelsByMmsi: Map<string, any>` mirrors `shipBillboardsByMmsi`
- Labels render `(ship.vessel_name?.trim() || ship.mmsi).toUpperCase()` in green `#22C55E`, 11px monospace with black outline
- Effect 4 sets `lbl.show = showEntityLabels && (bb?.show ?? false)`
- Cleanup removes `LabelCollection` from scene and clears `shipLabelsByMmsi`

Both labels use `scaleByDistance: new NearFarScalar(1e4, 1.4, 5e6, 0.0)` — fully visible at 10 km, invisible beyond 5,000 km, matching the approach from Plan 02.

## Deviations from Plan

None - plan executed exactly as written.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add military aircraft label LabelCollection | 07822f6 | MilitaryAircraftLayer.tsx |
| 2 | Add ship label LabelCollection to ShipLayer | 27b09a4 | ShipLayer.tsx |

## Requirements Satisfied

- LBL-07: Military aircraft labels visible when showEntityLabels=true
- LBL-08: Military aircraft labels hidden when showEntityLabels=false
- LBL-09: Ship labels visible when showEntityLabels=true
- LBL-10: Ship labels hidden when showEntityLabels=false

All 10 LBL requirements (LBL-01 through LBL-10) are now satisfied across Plans 01-03.
