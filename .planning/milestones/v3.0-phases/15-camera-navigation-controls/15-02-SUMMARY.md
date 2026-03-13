---
phase: 15-camera-navigation-controls
plan: "02"
subsystem: frontend-globe-interaction
tags:
  - camera
  - navigation
  - double-click-zoom
  - debounce
  - cesium
dependency_graph:
  requires:
    - 15-01 (CameraControlWidget component, viewerRegistry, zoomStep/setPitchPreset)
  provides:
    - LEFT_DOUBLE_CLICK zoom gesture wired into GlobeView
    - 200ms debounced LEFT_CLICK entity selection in AircraftLayer
    - CameraControlWidget mounted unconditionally in App
  affects:
    - frontend/src/components/GlobeView.tsx
    - frontend/src/components/AircraftLayer.tsx
    - frontend/src/App.tsx
tech_stack:
  added:
    - ScreenSpaceEventHandler/ScreenSpaceEventType (GlobeView — new usage)
    - Cartesian2, Cartesian3, Cartographic, defined (GlobeView — new imports)
  patterns:
    - removeInputAction before setInputAction (prevents dual-flight conflict)
    - module-scope clickTimer for debounced event handler
    - pickPosition -> pickEllipsoid fallback -> sky guard pattern
key_files:
  created:
    - frontend/src/components/__tests__/AircraftLayer.debounce.test.tsx
  modified:
    - frontend/src/components/GlobeView.tsx
    - frontend/src/components/AircraftLayer.tsx
    - frontend/src/App.tsx
decisions:
  - removeInputAction(LEFT_DOUBLE_CLICK) called before registering custom handler — prevents two simultaneous flyTo animations (STATE.md locked decision)
  - clickTimer at module scope (not ref) — persists across re-renders, cleared on cleanup
  - 200ms debounce matches CesiumJS double-click window — issue #1171 (STATE.md locked decision)
  - pickPosition -> pickEllipsoid fallback covers entity surfaces where pickPosition returns undefined
  - targetAlt = max(500, currentAlt * 0.4) — 2.5x zoom per double-click, 500m floor
metrics:
  duration: "~3 minutes"
  completed: "2026-03-13"
  tasks: 2
  files_created: 1
  files_modified: 3
---

# Phase 15 Plan 02: Double-Click Zoom + LEFT_CLICK Debounce + Widget Mount Summary

Double-click zoom wired into GlobeView.tsx with removeInputAction guard and pickPosition/pickEllipsoid fallback; 200ms debounced LEFT_CLICK applied to AircraftLayer.tsx; CameraControlWidget mounted unconditionally in App.tsx.

## What Was Built

**Task 1 (TDD RED):** Created `AircraftLayer.debounce.test.tsx` with 5 tests validating the 200ms debounce contract via a standalone `makeDebounced` helper. Tests confirm: single click fires once after 200ms, double click fires once (not twice), zero dispatches within first 200ms of double-click gesture, timer reset on each click, and two separated clicks produce two dispatches.

**Task 2 (GREEN — Implementation):**

- **GlobeView.tsx**: Added 6 new Cesium imports (ScreenSpaceEventHandler, ScreenSpaceEventType, Cartesian2, Cartesian3, Cartographic, defined). Registered `removeInputAction(LEFT_DOUBLE_CLICK)` on `viewer.cesiumWidget.screenSpaceEventHandler` before creating custom handler. Custom `dblHandler` implements: `pickPosition` → `pickEllipsoid` fallback → sky guard → `flyTo` with `currentAlt * 0.4` target altitude (500m floor), 0.6s duration, heading/pitch preserved. Handler stored as `_dblHandler` and destroyed in `_cleanup`.

- **AircraftLayer.tsx**: Added module-scope `clickTimer` alongside existing module-scope maps. Wrapped entire LEFT_CLICK handler body in `setTimeout(..., 200)` with `clearTimeout` on each new click. Timer cleared on cleanup (`if (clickTimer !== null) { clearTimeout(clickTimer); clickTimer = null; }`).

- **App.tsx**: Added `import { CameraControlWidget } from './components/CameraControlWidget'` and mounted `<CameraControlWidget />` unconditionally after OsintEventPanel, following the same unconditional pattern as CinematicHUD, LandmarkNav, and PlaybackBar.

## Decisions Made

| Decision | Rationale |
|----------|-----------|
| removeInputAction before registering custom LEFT_DOUBLE_CLICK | STATE.md locked: two conflicting flyTo animations fire simultaneously without it |
| clickTimer at module scope (not useRef) | Must persist across re-renders; module scope matches prevPositions/currPositions pattern |
| 200ms debounce interval | STATE.md locked: CesiumJS issue #1171 — LEFT_CLICK fires before LEFT_DOUBLE_CLICK |
| pickPosition → pickEllipsoid fallback | Research pitfall 3: pickPosition returns undefined on billboard/entity surfaces |
| targetAlt = max(500, currentAlt * 0.4) | 2.5x zoom per double-click; 500m floor prevents terrain collision |

## Deviations from Plan

None — plan executed exactly as written.

## Verification

```
grep -n "removeInputAction\|LEFT_DOUBLE_CLICK" frontend/src/components/GlobeView.tsx
# 88: removeInputAction(LEFT_DOUBLE_CLICK)
# 89: ScreenSpaceEventType.LEFT_DOUBLE_CLICK
# 123: }, ScreenSpaceEventType.LEFT_DOUBLE_CLICK)

grep -n "clickTimer" frontend/src/components/AircraftLayer.tsx
# 84: let clickTimer ...
# 134: if (clickTimer !== null) clearTimeout(clickTimer)
# 135: clickTimer = setTimeout(() => {
# 136: clickTimer = null;
# 179: if (clickTimer !== null) { clearTimeout(clickTimer); clickTimer = null; }

grep -n "CameraControlWidget" frontend/src/App.tsx
# 21: import { CameraControlWidget }
# 69: <CameraControlWidget />
```

TypeScript: `cd frontend && npx tsc --noEmit` — no errors.
Vitest: 127 tests passing (2 pre-existing canvas-2d failures in MilitaryAircraftLayer/ShipLayer test env — unrelated to this plan).

## Self-Check: PASSED

- FOUND: frontend/src/components/__tests__/AircraftLayer.debounce.test.tsx
- FOUND: frontend/src/components/GlobeView.tsx (modified)
- FOUND: frontend/src/components/AircraftLayer.tsx (modified)
- FOUND: frontend/src/App.tsx (modified)
- FOUND: commit e0d0e05 (test RED)
- FOUND: commit 7a6362f (feat GREEN)
