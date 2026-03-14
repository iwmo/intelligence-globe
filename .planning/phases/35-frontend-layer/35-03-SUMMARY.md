---
phase: 35-frontend-layer
plan: "03"
subsystem: frontend-rendering
tags: [gdelt, cesium, custom-datasource, entity-cluster, click-handler, layer-toggle]
dependency_graph:
  requires: [35-01, 35-02]
  provides: [GDELT-05, GDELT-06, GDELT-07]
  affects: [AircraftLayer, LeftSidebar, GdeltLayer]
tech_stack:
  added: [CustomDataSource, EntityCluster, PointGraphics]
  patterns: [tdd-red-green, cesium-datasource-lifecycle, unified-click-handler-extension]
key_files:
  created:
    - frontend/src/components/GdeltLayer.tsx
    - frontend/src/components/__tests__/GdeltLayer.test.tsx (replaced stub)
  modified:
    - frontend/src/components/AircraftLayer.tsx
    - frontend/src/components/LeftSidebar.tsx
decisions:
  - "Entity.point.show (not entity.show) used for QuadClass visibility — PointGraphics show field is the correct control point inside a CustomDataSource entity"
  - "vi.mock factory must be self-contained — no references to module-scope class variables (hoisting constraint); all Cesium mock classes defined inline inside factory"
  - "dataSource.show set in Effect 2 (sync entities) not Effect 1 (init) — layerVisible changes must survive viewer remounts independently"
metrics:
  duration: "~3 minutes"
  completed: "2026-03-14"
  tasks: 2
  files: 4
---

# Phase 35 Plan 03: GdeltLayer Cesium Rendering Summary

GdeltLayer rendering component with CustomDataSource + EntityCluster + PointGraphics, unified click handler extension for gdelt: entity prefix, and GEO layer toggle in LeftSidebar.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create GdeltLayer.tsx with CustomDataSource + EntityCluster (TDD) | d587548 | GdeltLayer.tsx, GdeltLayer.test.tsx |
| 2 | Extend AircraftLayer click handler + LeftSidebar GEO toggle | ae4fc31 | AircraftLayer.tsx, LeftSidebar.tsx |

## What Was Built

**GdeltLayer.tsx** — CesiumJS rendering layer:
- Renders null to the DOM; all rendering via CustomDataSource
- Effect 1 (deps: [viewer]): creates `CustomDataSource('gdelt')` with `EntityCluster` (pixelRange: 40, minimumClusterSize: 3, clusterPoints: true, clusterBillboards: false, clusterLabels: false); adds to `viewer.dataSources`; cleanup removes on unmount
- Effect 2 (deps: [events, gdeltQuadClassFilter, layerVisible, viewer]): full entity rebuild — `removeAll()` then re-add; sets `dataSource.show = layerVisible`; creates `Entity({ id: 'gdelt:{global_event_id}', point: PointGraphics({ show: gdeltQuadClassFilter.includes(event.quad_class) }) })`
- `QUAD_CLASS_COLORS` map at module scope: blue (1), green (2), yellow (3), red (4)

**AircraftLayer.tsx** — unified click handler extended:
- Added `gdelt:` prefix check as first branch (before existing `mmsi:` check)
- Parses `parseInt(picked.id.slice(6), 10)` → `setSelectedGdeltEventId(eventId)`, clears all other selection IDs
- Background-click else branch now also calls `setSelectedGdeltEventId(null)` to clear panel

**LeftSidebar.tsx** — GEO layer toggle:
- Added `Zap` to lucide-react import
- Added `<LayerToggleButton label="GEO" active={layers.gdelt} icon={<Zap size={12} />} onToggle={() => setLayerVisible('gdelt', !layers.gdelt)} />` after TFC button

## Test Results

- 8 GdeltLayer-specific tests green (smoke, entity creation, removeAll ordering, QuadClass filter)
- 240 total tests pass across 33 test files; full suite unaffected

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Vitest hoisting conflict with module-scope class references in vi.mock factory**
- **Found during:** Task 1 TDD RED → GREEN transition
- **Issue:** `vi.mock('cesium', ...)` factory referenced `MockCustomDataSource` by name, but `vi.mock` is hoisted above class declarations; caused `ReferenceError: Cannot access 'MockCustomDataSource' before initialization`
- **Fix:** Moved all mock class definitions inside the `vi.mock` factory block; kept module-scope `mockEntitiesAdd` and `mockEntitiesRemoveAll` spies for cross-test inspection (vi.fn() assignments are safe to reference from factory closures)
- **Files modified:** `frontend/src/components/__tests__/GdeltLayer.test.tsx`
- **Commit:** d587548

## Self-Check: PASSED

- frontend/src/components/GdeltLayer.tsx — FOUND
- frontend/src/components/__tests__/GdeltLayer.test.tsx — FOUND
- Commit d587548 — FOUND
- Commit ae4fc31 — FOUND
