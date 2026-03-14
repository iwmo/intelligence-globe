---
phase: 37-entity-labels
plan: "04"
subsystem: frontend/cesium-layers
tags: [labels, satellite, aircraft, gap-closure, cesium]
dependency_graph:
  requires: [37-02]
  provides: [LBL-03, LBL-04 gap closure]
  affects: [SatelliteLayer, AircraftLayer]
tech_stack:
  added: []
  patterns:
    - "Zustand escape hatch useSettingsStore.getState() for reading state in async worker callbacks"
    - "NearFarScalar minimum-scale floor to prevent Cesium label culling at globe altitude"
key_files:
  created: []
  modified:
    - frontend/src/components/SatelliteLayer.tsx
    - frontend/src/components/AircraftLayer.tsx
decisions:
  - "Apply showEntityLabels immediately in LOADED handler after label creation — effect alone cannot re-run because deps don't change after async worker response"
  - "Remove early-return length guard from label visibility effect — empty loop is harmless; guard blocked effect from running before LOADED populated the collection"
  - "Aircraft label scaleByDistance far bound changed from 5000km to 2000km with minimum scale floor 0.3 — prevents Cesium culling at ~2893km globe-view altitude"
metrics:
  duration: "~1 minute"
  completed_date: "2026-03-14"
  tasks_completed: 2
  files_modified: 2
---

# Phase 37 Plan 04: Entity Label Gap Closure (Satellite Initial Load + Aircraft Globe Visibility) Summary

**One-liner:** Fixed satellite labels silently absent on first load (persisted localStorage toggle) and aircraft labels culled to zero pixels at globe-view altitude via NearFarScalar floor raise.

## Objective

Both label gaps caused the feature to appear broken even when the user had enabled it: satellite labels never showed on initial page load when `showEntityLabels=true` was persisted in localStorage, and aircraft labels scaled below Cesium's culling threshold at ~2893km global altitude.

## Tasks Completed

### Task 1: Fix SatelliteLayer — apply showEntityLabels in LOADED handler and remove early-return guard

**Commit:** `ffab86b`
**Files:** `frontend/src/components/SatelliteLayer.tsx`

Two targeted changes:

**Change A — LOADED handler:** After the loop that creates labels with `show: false`, immediately reads `useSettingsStore.getState().showEntityLabels` and corrects each label's show state. This covers the case where the toggle was `true` before the worker responded; without this the effect had already run on an empty collection and never re-ran.

**Change B — Label visibility effect:** Removed `if (labelColl.length === 0) return;` early-return guard. The effect must run even when the collection is empty (it iterates zero items — a no-op). The guard was preventing the effect from running before the LOADED response, and since the effect deps do not change after LOADED fires (they were already set), the effect would never re-run. Removing the guard is safe because an empty loop has no cost.

### Task 2: Fix AircraftLayer — raise scaleByDistance minimum to keep labels visible at globe altitude

**Commit:** `a27dd7c`
**Files:** `frontend/src/components/AircraftLayer.tsx`

Changed aircraft label `scaleByDistance` from `NearFarScalar(1e4, 1.4, 5e6, 0.0)` to `NearFarScalar(1e4, 1.4, 2e6, 0.3)`.

At the typical globe-view camera altitude of ~2893km, the old scalar interpolated to approximately 0.59 × label size — at or below Cesium's culling threshold, making labels invisible. The new scalar keeps a minimum floor of 0.3 beyond 2000km, ensuring labels remain visible at global zoom while still fading gracefully with distance.

No other NearFarScalar values in the file were changed (billboard scaleByDistance unaffected).

## Verification

1. `npx tsc --noEmit` — EXIT:0, zero TypeScript errors across the project
2. `grep "labelColl.length === 0" SatelliteLayer.tsx` — returns nothing (guard removed)
3. `grep "useSettingsStore.getState" SatelliteLayer.tsx` — line 185 match in LOADED handler
4. `grep "NearFarScalar(1e4, 1.4, 2e6, 0.3)" AircraftLayer.tsx` — line 286 match

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check

### Files exist
- `frontend/src/components/SatelliteLayer.tsx` — modified
- `frontend/src/components/AircraftLayer.tsx` — modified

### Commits exist
- `ffab86b` — fix(37-04): fix satellite labels not visible on initial load when toggle pre-enabled
- `a27dd7c` — fix(37-04): raise aircraft label scaleByDistance minimum to stay visible at globe altitude

## Self-Check: PASSED
