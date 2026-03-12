---
phase: 08-new-data-pipelines-military-maritime
plan: "04"
subsystem: ui
tags: [cesium, react, zustand, tanstack-query, typescript]

# Dependency graph
requires:
  - phase: 08-new-data-pipelines-military-maritime/08-02
    provides: Military aircraft backend API (/api/military/) and MilitaryAircraft model
  - phase: 08-new-data-pipelines-military-maritime/08-03
    provides: AIS ships backend API (/api/ships/) and Ship model

provides:
  - MilitaryAircraftLayer component (amber points, lerp rAF, mil: prefix IDs)
  - ShipLayer component (cyan points, direct update, mmsi: prefix IDs)
  - useMilitaryAircraft hook (refetchInterval 300_000ms)
  - useShips hook (refetchInterval 30_000ms)
  - Extended Zustand store with selectedMilitaryId, selectedShipId, layers.militaryAircraft, layers.ships
  - MilitaryDetailPanel with callsign/ICAO24/type/altitude/speed/heading/squawk
  - ShipDetailPanel with MMSI/name/type/speed/heading/nav-status/last-update
  - Extended AircraftLayer click handler routing mmsi:/mil: prefixed IDs

affects: [09-gps-jamming, App.tsx wiring for layer toggle controls]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Module-scope Map naming: distinct prefix (militaryPointsByHex, shipPointsByMmsi) avoids collision with existing aircraft maps
    - mil: prefix for military point IDs, mmsi: prefix for ship IDs enables single click handler routing by prefix
    - LayerToggle pattern: layers.militaryAircraft and layers.ships default false (opt-in)
    - Ships use direct position update (no lerp) — slow-moving entities don't benefit from interpolation
    - Military aircraft use lerp rAF loop (same as commercial aircraft)
    - Single ScreenSpaceEventHandler in AircraftLayer routes all 4 entity types by ID prefix/type

key-files:
  created:
    - frontend/src/hooks/useMilitaryAircraft.ts
    - frontend/src/hooks/useShips.ts
    - frontend/src/components/MilitaryAircraftLayer.tsx
    - frontend/src/components/ShipLayer.tsx
    - frontend/src/components/MilitaryDetailPanel.tsx
    - frontend/src/components/ShipDetailPanel.tsx
  modified:
    - frontend/src/store/useAppStore.ts
    - frontend/src/components/AircraftLayer.tsx
    - frontend/src/components/RightDrawer.tsx
    - frontend/src/components/__tests__/MilitaryAircraftLayer.test.tsx
    - frontend/src/components/__tests__/ShipLayer.test.tsx

key-decisions:
  - "Ship heading 511 displayed as N/A (AIS standard: 511 = not available)"
  - "layers.militaryAircraft and layers.ships default false — user opt-in prevents globe clutter on first load"
  - "ShipLayer omits lerp rAF loop — direct position update sufficient for ship update cadence (30s)"
  - "MilitaryDetailPanel close button clears all 4 selections for safety (prevents stale panel state)"

patterns-established:
  - "Entity ID prefix routing: bare string=aircraft, mil:=military, mmsi:=ship, number>1000=satellite"
  - "Module-scope map naming convention: {entity}PointsBy{Key} avoids collision across layers"

requirements-completed: [LAY-01, LAY-03]

# Metrics
duration: ~4min
completed: 2026-03-12
---

# Phase 08 Plan 04: Frontend Layers — Military Aircraft + Maritime Ships Summary

**Amber military dots and cyan ship dots rendered on CesiumJS globe with click-through detail panels, extended Zustand store, and unified 4-entity click handler routing via ID prefix**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-03-12T06:48:45Z
- **Completed:** 2026-03-12T06:52:45Z
- **Tasks:** 2
- **Files modified:** 11

## Accomplishments

- Extended useAppStore with `selectedMilitaryId`, `selectedShipId`, `layers.militaryAircraft`, `layers.ships` (default false = opt-in)
- Created `useMilitaryAircraft` (5-min refetch) and `useShips` (30-sec refetch) React Query hooks
- Built `MilitaryAircraftLayer` with amber `#F59E0B` points, `mil:{hex}` IDs, lerp rAF loop, ft-to-meters altitude conversion
- Built `ShipLayer` with cyan `#06B6D4` points, `mmsi:{mmsi}` IDs, direct position update (no lerp needed for slow ships)
- Extended AircraftLayer click handler to route all 4 entity types: `mmsi:` → ship, `mil:` → military, bare string → commercial, number → satellite
- Created `MilitaryDetailPanel` (amber color scheme, callsign/ICAO24/type/alt-ft/speed-kts/heading/squawk)
- Created `ShipDetailPanel` (cyan color scheme, MMSI/name/type/speed/heading/nav-status/last-update, 511=N/A for heading)
- Extended `RightDrawer` to render all 4 detail panel types
- All 55 frontend tests pass

## Task Commits

1. **Task 1: Extend store + hooks, build layer components, extend click handler** - `77c66f7` (feat)
2. **Task 2: MilitaryDetailPanel, ShipDetailPanel, RightDrawer extension** - `1b42630` (feat)

**Plan metadata:** (docs commit — see below)

## Files Created/Modified

- `frontend/src/store/useAppStore.ts` - Added selectedMilitaryId, selectedShipId, layers.militaryAircraft/ships
- `frontend/src/hooks/useMilitaryAircraft.ts` - React Query hook, refetchInterval 300_000ms
- `frontend/src/hooks/useShips.ts` - React Query hook, refetchInterval 30_000ms
- `frontend/src/components/MilitaryAircraftLayer.tsx` - Amber PointPrimitiveCollection, lerp rAF, mil: IDs
- `frontend/src/components/ShipLayer.tsx` - Cyan PointPrimitiveCollection, direct update, mmsi: IDs
- `frontend/src/components/MilitaryDetailPanel.tsx` - Detail panel with amber color, altitude in ft
- `frontend/src/components/ShipDetailPanel.tsx` - Detail panel with cyan color, heading 511=N/A
- `frontend/src/components/AircraftLayer.tsx` - Click handler extended for 4-entity routing
- `frontend/src/components/RightDrawer.tsx` - Renders MilitaryDetailPanel + ShipDetailPanel
- `frontend/src/components/__tests__/MilitaryAircraftLayer.test.tsx` - Fixed mock paths (bug fix)
- `frontend/src/components/__tests__/ShipLayer.test.tsx` - Fixed mock paths + layers key (bug fix)

## Decisions Made

- Ship heading 511 displayed as "N/A" (AIS standard: value 511 means heading not available)
- `layers.militaryAircraft` and `layers.ships` default to `false` — prevents globe clutter on first load; user must enable explicitly
- `ShipLayer` omits lerp rAF loop — ships move too slowly (knots) to benefit from 30-second interpolation
- `MilitaryDetailPanel` close button clears all 4 selections, not just militaryId — prevents stale panel state edge cases

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed incorrect mock paths in pre-written test files**
- **Found during:** Task 1 (running smoke tests after implementing components)
- **Issue:** Both `MilitaryAircraftLayer.test.tsx` and `ShipLayer.test.tsx` used `'../../../store/useAppStore'` and `'../../../hooks/...'` paths (3 levels up from `__tests__/`), which resolved to `frontend/` root rather than `frontend/src/`. Vitest mock wasn't intercepting the actual module, causing "No QueryClient set" errors.
- **Fix:** Changed mock paths from `../../../` to `../../` prefix (correct path to `src/store/` and `src/hooks/`)
- **Additional fix:** `ShipLayer.test.tsx` used `layers: { maritimeTraffic: true }` — changed to `layers: { ships: true }` to match actual store key
- **Files modified:** `frontend/src/components/__tests__/MilitaryAircraftLayer.test.tsx`, `frontend/src/components/__tests__/ShipLayer.test.tsx`
- **Verification:** Both smoke tests pass GREEN; all 55 tests pass
- **Committed in:** `77c66f7` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - Bug in pre-written test files)
**Impact on plan:** Required fix for test correctness. No scope creep. Both tests now pass exactly as the plan required.

## Issues Encountered

- Pre-written test files (from Plan 08-01 TDD red phase) had incorrect relative mock paths. Fixed as Rule 1 auto-fix. No other issues.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `MilitaryAircraftLayer` and `ShipLayer` are built but not yet wired into `App.tsx` — Plan 08-05 should mount these components and add layer toggle controls to the sidebar
- Both layers default to `false` (hidden) — toggle controls needed for user activation
- `RightDrawer` is fully wired and ready for all 4 entity types

---
*Phase: 08-new-data-pipelines-military-maritime*
*Completed: 2026-03-12*
