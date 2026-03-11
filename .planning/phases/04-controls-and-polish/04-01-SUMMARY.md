---
phase: 04-controls-and-polish
plan: 01
subsystem: ui
tags: [zustand, cesium, web-worker, typescript, vitest]

# Dependency graph
requires:
  - phase: 03-aircraft-layer
    provides: useAppStore with selected satellite/aircraft IDs, SatelliteLayer with worker reference, App.tsx with onViewerReady
provides:
  - Zustand store extended with satelliteFilter, aircraftFilter, searchQuery, aircraftLastUpdated slices
  - viewerRegistry singleton exposing registerViewer, flyToPosition, flyToCartesian
  - propagation.worker.ts GET_POSITION handler that posts POSITION_RESULT with on-demand ECEF coordinates
  - SatelliteLayer PositionResultMessage type in WorkerOutMessage union (stub handler, wired in Plan 02)
affects:
  - 04-02 (SearchBar needs store searchQuery, worker GET_POSITION/POSITION_RESULT)
  - 04-03 (FilterPanel needs satelliteFilter and aircraftFilter slices)

# Tech tracking
tech-stack:
  added: [vitest, jsdom, @testing-library/react]
  patterns: [TDD red-green for Zustand slices, viewerRegistry singleton for imperative camera access]

key-files:
  created:
    - frontend/src/lib/viewerRegistry.ts
    - frontend/src/store/__tests__/useAppStore.test.ts
  modified:
    - frontend/src/store/useAppStore.ts
    - frontend/src/workers/propagation.worker.ts
    - frontend/src/App.tsx
    - frontend/src/components/SatelliteLayer.tsx
    - frontend/vite.config.ts

key-decisions:
  - "vitest installed as test framework (first tests in frontend codebase) with jsdom environment"
  - "viewerRegistry uses module-level singleton (_viewer variable) — simple and sufficient for single-viewer app"
  - "GET_POSITION re-propagates on demand rather than caching — acceptable for single-object lookup"
  - "POSITION_RESULT stub handler in SatelliteLayer with comment directing to Plan 02 for fly-to wiring"

patterns-established:
  - "Store slice pattern: interface addition + create() addition — extend existing slices, do not replace"
  - "Partial setter merge: set((s) => ({ slice: { ...s.slice, ...partial } })) for nested filter objects"

requirements-completed: [SAT-03, AIR-03, SAT-04, AIR-04, INT-03, GLOB-03]

# Metrics
duration: 4min
completed: 2026-03-11
---

# Phase 4 Plan 01: Infrastructure Foundation Summary

**Zustand store extended with filter/search slices, viewerRegistry singleton created, and propagation worker gains on-demand ECEF position lookup via GET_POSITION/POSITION_RESULT**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-03-11T19:26:59Z
- **Completed:** 2026-03-11T19:29:43Z
- **Tasks:** 2 (Task 1 TDD: 3 commits; Task 2: 1 commit)
- **Files modified:** 6

## Accomplishments
- Extended useAppStore with four new slices (satelliteFilter, aircraftFilter, searchQuery, aircraftLastUpdated) using partial merge setters
- Created viewerRegistry.ts singleton with registerViewer, flyToPosition, flyToCartesian — wired into App.tsx onViewerReady
- Added GET_POSITION message handler to propagation.worker.ts that re-propagates a single satellite on demand and posts POSITION_RESULT
- Added PositionResultMessage to SatelliteLayer WorkerOutMessage union with stub handler comment directing to Plan 02
- Installed vitest + jsdom as first test infrastructure in the frontend codebase

## Task Commits

Each task was committed atomically:

1. **Task 1 RED: failing store tests** - `29ad0f6` (test)
2. **Task 1 GREEN: extend Zustand store** - `aaa75f3` (feat)
3. **Task 2: viewerRegistry + GET_POSITION** - `f392b99` (feat)

_Note: TDD task has 2 commits (test RED + feat GREEN); no refactor needed._

## Files Created/Modified
- `frontend/src/store/useAppStore.ts` - Extended AppState interface and create() with four new slices
- `frontend/src/lib/viewerRegistry.ts` - New singleton module with three exports for imperative camera control
- `frontend/src/workers/propagation.worker.ts` - Added GetPositionMessage type and GET_POSITION handler block
- `frontend/src/components/SatelliteLayer.tsx` - Added PositionResultMessage interface to WorkerOutMessage union
- `frontend/src/App.tsx` - onViewerReady now calls registerViewer before setCesiumViewer
- `frontend/src/store/__tests__/useAppStore.test.ts` - 13 unit tests covering all new slice behaviors
- `frontend/vite.config.ts` - Added vitest test config block with jsdom environment

## Decisions Made
- Installed vitest as test framework — first TDD infrastructure in the frontend; jsdom environment required for Zustand store tests
- viewerRegistry uses a module-level `_viewer` variable (singleton) — simple and sufficient; a context/provider approach would add unnecessary complexity for a single-viewer app
- GET_POSITION re-propagates the requested satellite on demand rather than caching the last ECEF — acceptable overhead for single-object fly-to use case
- POSITION_RESULT stub handler in SatelliteLayer.tsx with an explanatory comment — the actual fly-to wiring belongs to Plan 02 (SearchBar), keeping Plan 01 concerns clean

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Plans 02 and 03 can now proceed in parallel
- Plan 02 (SearchBar): use `searchQuery`/`setSearchQuery` from store, send `GET_POSITION` to worker via workerRef, handle `POSITION_RESULT` by calling `flyToCartesian`
- Plan 03 (FilterPanel): use `satelliteFilter`/`setSatelliteFilter` and `aircraftFilter`/`setAircraftFilter` from store
- No blockers.

---
*Phase: 04-controls-and-polish*
*Completed: 2026-03-11*
