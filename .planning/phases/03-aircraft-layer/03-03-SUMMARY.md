---
phase: 03-aircraft-layer
plan: 03
subsystem: ui
tags: [cesium, react, zustand, tanstack-query, opensky, typescript]

# Dependency graph
requires:
  - phase: 03-aircraft-layer
    provides: aircraft DB model, /api/aircraft routes, OpenSky ingest RQ task
  - phase: 02-satellite-layer
    provides: SatelliteLayer CesiumJS pattern, RightDrawer component, useAppStore

provides:
  - AircraftLayer: orange PointPrimitiveCollection with lerp-based smooth movement
  - Trail polyline on selected aircraft (orange, 50% alpha, ArcType.NONE)
  - Unified LEFT_CLICK dispatcher in AircraftLayer (owns satellite + aircraft dispatch)
  - AircraftDetailPanel with flight number, route (FROM -> TO), altitude, speed, heading, country
  - GET /api/aircraft/{icao24}/route endpoint calling OpenSky flights API (graceful null fallback)
  - RightDrawer dual-entity routing: satellite vs aircraft panels never overlap

affects:
  - 04-ui-polish (RightDrawer panel structure to maintain)
  - 05-anomaly-detection (aircraft selection pattern established)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Unified click handler: single ScreenSpaceEventHandler in AircraftLayer dispatches both satellite and aircraft clicks, eliminating dual-handler race condition
    - Per-selection secondary fetch: route data fetched on click (not polling), 5min staleTime, no retry, graceful null fallback
    - Lerp rAF loop: module-scope maps (prevPositions, currPositions, pointsByIcao24) outside React for zero-rerender position interpolation

key-files:
  created:
    - frontend/src/hooks/useAircraft.ts
    - frontend/src/components/AircraftLayer.tsx
    - frontend/src/components/AircraftDetailPanel.tsx
  modified:
    - frontend/src/store/useAppStore.ts
    - frontend/src/components/RightDrawer.tsx
    - frontend/src/components/SatelliteLayer.tsx
    - frontend/src/App.tsx
    - backend/app/api/routes_aircraft.py

key-decisions:
  - "Unified click handler: moved all LEFT_CLICK dispatch to AircraftLayer to eliminate dual-handler race condition where both SatelliteLayer and AircraftLayer called scene.pick() independently on the same event"
  - "Route fetch is per-click (not polling): OpenSky flights API has credit cost; fetching only on selection with 5min cache avoids unnecessary calls"
  - "Backend /route endpoint proxies OpenSky credentials: never exposes OPENSKY_CLIENT_ID/SECRET to the frontend"
  - "Globe-click clearing: clicking non-primitive background clears both selectedSatelliteId and selectedAircraftId"

patterns-established:
  - "Unified CesiumJS dispatcher: one component owns scene.pick() + store dispatch for all entity types"
  - "Graceful route degradation: backend returns {origin: null, destination: null} on any failure — frontend shows Unavailable"

requirements-completed: [AIR-01, AIR-02, INT-02]

# Metrics
duration: ~30min (continuation execution after human verification)
completed: 2026-03-11
---

# Phase 3 Plan 3: Aircraft Frontend Pipeline Summary

**CesiumJS aircraft layer with lerp interpolation, unified click dispatch fixing satellite/aircraft panel switching, and per-selection route lookup (FROM -> TO) via OpenSky flights API**

## Performance

- **Duration:** ~30 min (continuation from human verification checkpoint)
- **Started:** 2026-03-11T14:54:01Z (initial), resumed for Task 3 fixes
- **Completed:** 2026-03-11T15:10:41Z
- **Tasks:** 3 (2 original + 1 fix/feature continuation)
- **Files modified:** 8

## Accomplishments

- Aircraft orange dots rendering on globe from live OpenSky data (10,000+ aircraft)
- Lerp-based smooth movement between 90-second poll intervals using rAF loop
- Trail polyline on selected aircraft; clears when deselected
- Fixed satellite/aircraft panel switching bug via unified click dispatch
- AircraftDetailPanel shows flight number (callsign), origin -> destination route, altitude, speed, heading, country
- New backend `/api/aircraft/{icao24}/route` endpoint with graceful null fallback

## Task Commits

1. **Task 1: useAircraft hook + store + AircraftLayer + AircraftDetailPanel** - `795d517` (feat)
2. **Task 2: RightDrawer dual-entity routing + App.tsx wiring** - `fd603b7` (feat)
3. **Task 3 fix: Unified click dispatch** - `4cd288c` (fix)
4. **Task 3 feat: Flight number + origin/destination route** - `927b757` (feat)

## Files Created/Modified

- `frontend/src/hooks/useAircraft.ts` - TanStack Query hook, 90s polling, AircraftRecord interface
- `frontend/src/components/AircraftLayer.tsx` - CesiumJS primitives, lerp rAF, trail-on-selection, unified click dispatch
- `frontend/src/components/AircraftDetailPanel.tsx` - Flight, Route (FROM->TO), ICAO24, altitude, speed, heading, country
- `frontend/src/store/useAppStore.ts` - Added selectedAircraftId + setSelectedAircraftId
- `frontend/src/components/RightDrawer.tsx` - Dual-entity: satellite or aircraft panel, never both
- `frontend/src/components/SatelliteLayer.tsx` - Removed duplicate click handler; AircraftLayer owns dispatch
- `frontend/src/App.tsx` - Mounts AircraftLayer next to SatelliteLayer
- `backend/app/api/routes_aircraft.py` - Added GET /{icao24}/route with OpenSky flights API proxy

## Decisions Made

- Unified click dispatch: moved all `scene.pick()` + store dispatch to `AircraftLayer` to fix the dual-handler race condition. Two separate `ScreenSpaceEventHandler` instances on the same canvas both receive the same LEFT_CLICK. When both call `scene.pick()` independently, the order of execution and primitive z-order can cause the wrong entity type to be selected. Single handler eliminates this.
- Route fetch is per-click with 5-minute stale time and no retry — OpenSky flights API consumes credits; fetching only on aircraft selection minimises credit consumption. Graceful null on any failure means the panel never breaks.
- Backend proxies the OpenSky route call so credentials stay server-side.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed satellite/aircraft panel switching via unified click dispatcher**
- **Found during:** Task 3 (human verification feedback — clicking satellite did not switch drawer)
- **Issue:** Both `SatelliteLayer` and `AircraftLayer` registered independent `ScreenSpaceEventHandler` LEFT_CLICK listeners. Each called `viewer.scene.pick()` separately. Under certain conditions (overlapping primitives, render frame timing), both could fire and produce conflicting store updates on the same click.
- **Fix:** Removed click handler from `SatelliteLayer.tsx`. `AircraftLayer.tsx` now owns a single unified handler: string id → aircraft, number id > 1000 → satellite, else clear both.
- **Files modified:** `frontend/src/components/AircraftLayer.tsx`, `frontend/src/components/SatelliteLayer.tsx`
- **Verification:** TypeScript compiles clean; logic flow verified by code inspection
- **Committed in:** `4cd288c`

---

**Total deviations:** 1 auto-fixed (Rule 1 - Bug)
**Impact on plan:** Essential correctness fix. The feature request (route lookup) was in-scope per the checkpoint resume instructions.

## Issues Encountered

- Satellite handler used `picked.id > 1000` guard to exclude low-NORAD-ID edge cases; this guard was preserved in the unified handler.
- OpenSky `/flights/aircraft` endpoint sometimes returns empty array for cargo/GA/military — handled with graceful `{origin: null, destination: null}` at both backend and frontend layers.

## Next Phase Readiness

- Aircraft + satellite layer coexist stably with unified click dispatch
- RightDrawer panel switching fully functional
- Origin/destination route data available per selection
- Ready for Phase 4: UI polish (panel styling, sidebar layer controls, performance tuning)

---
*Phase: 03-aircraft-layer*
*Completed: 2026-03-11*
