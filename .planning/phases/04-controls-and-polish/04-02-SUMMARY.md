---
phase: 04-controls-and-polish
plan: "02"
subsystem: ui
tags: [react, cesium, zustand, lucide-react, search, layer-toggle]

# Dependency graph
requires:
  - phase: 04-controls-and-polish/04-01
    provides: store slices (layers, search, aircraft freshness), viewerRegistry (flyToPosition, flyToCartesian), GET_POSITION worker message
  - phase: 03-aircraft-layer
    provides: AircraftLayer component, useAircraft hook, aircraft API
provides:
  - SearchBar component for satellite + aircraft fly-to from unified input
  - Persistent SAT/AIR layer toggle buttons (always visible, bottom-left corner)
  - Layer visibility wiring in SatelliteLayer and AircraftLayer via point.show
  - BottomStatusBar with conditional TLE and aircraft freshness per active layer
affects:
  - 04-03 (filter panel — inserts content into FILTERS placeholder in LeftSidebar)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - onWorkerReady callback prop to expose SatelliteLayer worker to parent (App.tsx)
    - satWorkerRef threaded App.tsx → LeftSidebar → SearchBar for worker access
    - Debounced search (300ms) with immediate result status display
    - Per-point show toggle (not collection.show) to avoid filter-effect conflicts

key-files:
  created:
    - frontend/src/components/SearchBar.tsx
  modified:
    - frontend/src/components/LeftSidebar.tsx
    - frontend/src/components/BottomStatusBar.tsx
    - frontend/src/components/SatelliteLayer.tsx
    - frontend/src/components/AircraftLayer.tsx
    - frontend/src/App.tsx

key-decisions:
  - "onWorkerReady callback prop pattern in SatelliteLayer: worker is exposed to parent via callback rather than forwardRef — avoids ref forwarding complexity for non-DOM component"
  - "satWorker state + satWorkerRef pattern in App.tsx: useState triggers re-render to pass worker down, useRef provides stable ref for SearchBar without re-triggering search effects"
  - "Per-point show (not collection.show) for layer visibility: consistent with upcoming Plan 03 filter effects that also set per-point show — avoids conflicts between layer toggle and filter toggle"
  - "Aircraft search tries callsign contains-match: partial callsign input ('UAL' matches 'UAL123') improves discoverability"

patterns-established:
  - "SearchBar debounced input: 300ms debounce prevents excessive matching on keystrokes"
  - "Freshness conditional render: layer must be active before freshness indicator appears in BottomStatusBar"

requirements-completed: [SAT-03, AIR-03, INT-03, GLOB-03]

# Metrics
duration: 3min
completed: 2026-03-11
---

# Phase 4 Plan 02: Controls and Polish Summary

**Unified search bar (satellite + aircraft fly-to via NORAD/callsign/ICAO24), persistent SAT/AIR layer toggle buttons, and conditional per-layer freshness indicators in BottomStatusBar**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-03-11T16:20:00Z
- **Completed:** 2026-03-11T16:36:00Z
- **Tasks:** 3 of 3 (Task 3 visual verification — approved)
- **Files modified:** 6

## Accomplishments
- SearchBar.tsx: unified input searching satellites by NORAD ID or name fragment, aircraft by ICAO24 or callsign; debounced 300ms; dispatches GET_POSITION to worker for satellite fly-to; calls flyToPosition directly for aircraft
- Persistent SAT and AIR layer toggle buttons always rendered in bottom-left corner (above BottomStatusBar) regardless of sidebar state
- SatelliteLayer Effect 4 watches layers.satellites and sets per-point show on PointPrimitiveCollection
- AircraftLayer layer visibility effect watches layers.aircraft and sets per-point show on all pointsByIcao24 entries
- BottomStatusBar polls /api/aircraft/freshness every 90s; shows TLE freshness only when SAT active, ACF freshness only when AIR active

## Task Commits

Each task was committed atomically:

1. **Task 1: SearchBar component with satellite + aircraft fly-to** - `8a6a2ed` (feat)
2. **Task 2: Layer toggles in LeftSidebar + aircraft freshness in BottomStatusBar** - `1bdee8c` (feat)
3. **Task 3: Visual verification checkpoint** - approved by user

Additional fix commit (applied after Tasks 1-2):
- **fix(04-02): correct initial layer state and add hamburger button** - `14d7003`

**Plan docs commit:** `d8a3318` (docs: plan record)

## Files Created/Modified
- `frontend/src/components/SearchBar.tsx` - Unified search input with debounced satellite + aircraft fly-to
- `frontend/src/components/LeftSidebar.tsx` - Rewritten with persistent SAT/AIR toggles and SearchBar inside sidebar
- `frontend/src/components/BottomStatusBar.tsx` - Added aircraft freshness, conditional per-layer display
- `frontend/src/components/SatelliteLayer.tsx` - Added onWorkerReady prop, POSITION_RESULT flyToCartesian, Effect 4 for layer visibility
- `frontend/src/components/AircraftLayer.tsx` - Added layer visibility effect for layers.aircraft
- `frontend/src/App.tsx` - Added satWorker state + satWorkerRef, threads workerRef to LeftSidebar

## Decisions Made
- onWorkerReady callback prop pattern: worker is exposed to parent via callback rather than forwardRef — avoids ref forwarding complexity for non-DOM component
- satWorker state + satWorkerRef pattern: useState triggers re-render to pass worker down; useRef provides stable ref for SearchBar
- Per-point show (not collection.show) for layer visibility: consistent with Plan 03 filter effects
- Aircraft search uses contains-match on callsign for better discoverability

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Corrected layers initial state defaulting to false**
- **Found during:** Post-checkpoint visual verification
- **Issue:** useAppStore initialized layers.satellites and layers.aircraft to false, causing satellite and aircraft points to be hidden on first load
- **Fix:** Changed default values to true in useAppStore so both layers render on startup
- **Files modified:** frontend/src/store/useAppStore.ts
- **Verification:** Layers visible on initial page load after fix
- **Committed in:** 14d7003

**2. [Rule 2 - Missing Critical] Added hamburger button to LeftSidebar**
- **Found during:** Post-checkpoint visual verification
- **Issue:** No UI affordance existed to open/close the sidebar panel — users had no way to access search
- **Fix:** Added hamburger button (fixed top-left position) that calls setSidebarOpen toggle from Zustand store
- **Files modified:** frontend/src/components/LeftSidebar.tsx
- **Verification:** Sidebar opens and closes via button click; SAT/AIR toggles remain visible regardless of sidebar state
- **Committed in:** 14d7003

---

**Total deviations:** 2 auto-fixed (1 bug, 1 missing critical)
**Impact on plan:** Both fixes necessary for correct initial state and usability. No scope creep.

## Issues Encountered

None beyond the two auto-fixed items above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- All tasks complete and visually verified — plan fully done
- Plan 03 (filter panel) can insert content into the FILTERS placeholder already present in LeftSidebar
- All TypeScript compiles clean (0 errors)
- SAT-03, AIR-03, INT-03, GLOB-03 requirements delivered

---
*Phase: 04-controls-and-polish*
*Completed: 2026-03-11*
