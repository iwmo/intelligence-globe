---
phase: 14-entity-icons-altitude-scaling
plan: "01"
subsystem: frontend-visualization
tags: [cesium, canvas, billboard, icons, texture-atlas]
dependency_graph:
  requires: []
  provides: [AIRCRAFT_ICON, MILITARY_ICON, SHIP_ICON]
  affects: [AircraftLayer, MilitaryAircraftLayer, ShipLayer]
tech_stack:
  added: []
  patterns: [module-scope-canvas-prerender, cesium-texture-atlas-dedup]
key_files:
  created: []
  modified:
    - frontend/src/components/AircraftLayer.tsx
    - frontend/src/components/MilitaryAircraftLayer.tsx
    - frontend/src/components/ShipLayer.tsx
decisions:
  - "Export canvas constants (not unexported) so downstream plans can import the same reference for TextureAtlas dedup"
  - "All three icons use 32x32 canvas — same size prevents atlas fragmentation"
  - "Pre-existing TypeScript errors in propagation.worker.ts and vite.config.ts are out-of-scope; layer files pass tsc --noEmit --skipLibCheck with zero errors"
metrics:
  duration: "2 minutes"
  completed: "2026-03-12"
  tasks_completed: 2
  files_modified: 3
---

# Phase 14 Plan 01: Module-Scope Canvas Icon Constants Summary

**One-liner:** Pre-rendered 32x32 HTMLCanvasElement icons for aircraft (swept-wing orange), military aircraft (delta-wing red), and ship (hull-silhouette green) at module scope in their respective CesiumJS layer files.

## What Was Built

Three module-scope canvas drawing functions and exported constants, one per layer file:

- `AircraftLayer.tsx` — `drawAircraftIcon()` + `export const AIRCRAFT_ICON`: swept-wing airplane silhouette in #FF8C00 (orange), nose-up orientation with twin tail fins
- `MilitaryAircraftLayer.tsx` — `drawMilitaryIcon()` + `export const MILITARY_ICON`: delta-wing silhouette in #EF4444 (red), visually distinct broad-wing shape
- `ShipLayer.tsx` — `drawShipIcon()` + `export const SHIP_ICON`: vessel hull viewed from above in #22C55E (green), pointed bow with rectangular midship

All constants are placed after the import block and before any module-scope maps (prevPositions, militaryPointsByHex, shipPointsByMmsi). This is the only correct position — module-scope execution runs before React component initialization.

## Why This Pattern Matters

CesiumJS `BillboardCollection.add({ image: canvas })` uses the canvas object reference as the TextureAtlas key. If the same HTMLCanvasElement reference is passed for every entity of the same type, the texture is deduplicated to a single GPU upload. If a new canvas is created per entity (the naive pattern), the TextureAtlas exceeds its entry limit and throws a `DeveloperError` at 500+ entities. Module-scope pre-rendering is the only safe pattern at scale.

## Decisions Made

- Constants are exported (`export const`) rather than unexported module-private, enabling downstream plans (plan 02: BillboardCollection migration) to import and pass the same reference without re-creating canvases.
- All three icons use 32x32 pixels — uniform size prevents atlas fragmentation and aligns with CesiumJS billboard default scale expectations.
- Icon colors match existing `Color.fromCssColorString` values already used in `collection.add({ color: ... })` calls within the same files, ensuring visual continuity during the transition from PointPrimitive to BillboardCollection.

## Verification

```
grep -n "const AIRCRAFT_ICON\|const MILITARY_ICON\|const SHIP_ICON" \
  frontend/src/components/AircraftLayer.tsx \
  frontend/src/components/MilitaryAircraftLayer.tsx \
  frontend/src/components/ShipLayer.tsx

frontend/src/components/AircraftLayer.tsx:48:export const AIRCRAFT_ICON = drawAircraftIcon();
frontend/src/components/MilitaryAircraftLayer.tsx:37:export const MILITARY_ICON = drawMilitaryIcon();
frontend/src/components/ShipLayer.tsx:38:export const SHIP_ICON = drawShipIcon();
```

TypeScript: `npx tsc --noEmit --skipLibCheck` produces zero errors in all three modified files.

## Deviations from Plan

None — plan executed exactly as written.

Note: Pre-existing TypeScript errors exist in `src/workers/propagation.worker.ts`, `src/workers/__tests__/propagation.test.ts`, and `vite.config.ts`. These are unrelated to this plan's changes, were present before this plan executed, and are out of scope per deviation Rule scope boundary. They have been logged to deferred-items.md.

## Self-Check: PASSED

- `frontend/src/components/AircraftLayer.tsx` — FOUND, contains `export const AIRCRAFT_ICON`
- `frontend/src/components/MilitaryAircraftLayer.tsx` — FOUND, contains `export const MILITARY_ICON`
- `frontend/src/components/ShipLayer.tsx` — FOUND, contains `export const SHIP_ICON`
- Commit 16e7964: feat(14-01): add AIRCRAFT_ICON and MILITARY_ICON canvas constants — FOUND
- Commit b5108e1: feat(14-01): add SHIP_ICON canvas constant to ShipLayer — FOUND
