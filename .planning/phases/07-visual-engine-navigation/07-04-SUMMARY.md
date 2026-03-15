---
phase: 07-visual-engine-navigation
plan: "04"
subsystem: ui
tags: [cesiumjs, react, navigation, landmarks, keyboard-shortcuts, nominatim, vitest]

# Dependency graph
requires:
  - phase: 07-01
    provides: viewerRegistry with registerViewer and flyToPosition baseline

provides:
  - landmarks.json with 5 Doha Q/W/E/R/T shortcut landmarks at city-scale altitudes
  - flyToLandmark() in viewerRegistry with cancelFlight + distance-proportional duration
  - getViewer() export from viewerRegistry
  - useKeyboardShortcuts hook (Q/W/E/R/T, case-insensitive, input-aware)
  - LandmarkNav component with Nominatim city search (400ms debounce) + 5 preset buttons

affects:
  - 07-05  # App.tsx wiring uses LandmarkNav and useKeyboardShortcuts

# Tech tracking
tech-stack:
  added: []
  patterns:
    - viewerRegistry as centralized navigation singleton (no prop drilling)
    - cancelFlight-before-flyTo pattern prevents CesiumJS conflict errors on rapid keypresses
    - distance-proportional flight duration via Math.hypot of angular degrees mapped to 0.5s-3.5s
    - bbox-derived altitude from Nominatim: max(100k, min(3M, span * 111000))
    - 400ms debounce with useRef cleanup on unmount for Nominatim search

key-files:
  created:
    - frontend/src/data/landmarks.json
    - frontend/src/hooks/useKeyboardShortcuts.ts
    - frontend/src/components/LandmarkNav.tsx
    - frontend/src/data/__tests__/landmarks.test.ts
    - frontend/src/hooks/__tests__/useKeyboardShortcuts.test.ts
  modified:
    - frontend/src/lib/viewerRegistry.ts

key-decisions:
  - "LandmarkNav navigation goes through viewerRegistry singleton, not viewer prop — avoids prop drilling and keeps nav surface area minimal"
  - "cancelFlight() called before every flyToLandmark to prevent CesiumJS 'Cannot read properties of undefined' error on rapid Q→W keypresses"
  - "Distance-proportional duration: Math.hypot(deltaLon, deltaLat) / 30, clamped 0.5s–3.5s — feels responsive close-up, smooth long-distance"
  - "Nominatim bbox altitude formula: max(100k, min(3M, max(latSpan,lonSpan) * 111000)) gives city-appropriate zoom for diverse result types"
  - "LandmarkTarget interface defined inline in viewerRegistry (not imported from JSON) to keep type boundaries clean"

patterns-established:
  - "Pattern: cancelFlight-before-flyTo — always call _viewer.camera.cancelFlight() before any flyTo to prevent concurrent flight errors"
  - "Pattern: distance-proportional duration — compute Math.hypot(deltaLon, deltaLat), map to duration range via division and clamp"

requirements-completed: [NAV-01, NAV-02, NAV-03]

# Metrics
duration: 3min
completed: 2026-03-11
---

# Phase 07 Plan 04: Navigation System Summary

**Keyboard shortcuts (Q/W/E/R/T), Nominatim city quick-jump, and flyToLandmark with cancelFlight + distance-proportional duration replacing the broken +2M altitude flyToPosition**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-03-11T20:05:10Z
- **Completed:** 2026-03-11T20:08:00Z
- **Tasks:** 2 (Task 1 TDD: RED + GREEN, Task 2)
- **Files modified:** 6

## Accomplishments

- landmarks.json with 5 Doha landmarks (Doha City Center, Hamad Airport, The Pearl, Lusail City, West Bay) at city-scale altitudes 8k-80k meters
- viewerRegistry extended with flyToLandmark (cancelFlight + distance-proportional duration) and getViewer
- useKeyboardShortcuts hook with case-insensitive Q/W/E/R/T, input-field exclusion, and cleanup on unmount
- LandmarkNav component with 400ms-debounced Nominatim search, dropdown with outside-click close, bbox altitude derivation, and five preset buttons
- 8 new tests passing (4 landmarks schema + 4 keyboard shortcut dispatch); full suite 53/53 green

## Task Commits

Each task was committed atomically:

1. **TDD RED — failing tests for landmarks schema and keyboard shortcuts** - `de29020` (test)
2. **Task 1: landmarks.json + viewerRegistry flyToLandmark + useKeyboardShortcuts** - `6affc0a` (feat)
3. **Task 2: LandmarkNav component** - `d72e913` (feat)

_Note: TDD task has two commits (test RED then feat GREEN)_

## Files Created/Modified

- `frontend/src/data/landmarks.json` - 5 Doha Q/W/E/R/T landmark presets with city-scale altitudes
- `frontend/src/lib/viewerRegistry.ts` - Added flyToLandmark (cancelFlight + duration), getViewer, LandmarkTarget interface
- `frontend/src/hooks/useKeyboardShortcuts.ts` - Global keydown handler for Q/W/E/R/T landmarks
- `frontend/src/components/LandmarkNav.tsx` - City search bar (Nominatim) + 5 landmark preset buttons
- `frontend/src/data/__tests__/landmarks.test.ts` - 4 schema validation tests
- `frontend/src/hooks/__tests__/useKeyboardShortcuts.test.ts` - 4 dispatch tests

## Decisions Made

- Navigation goes through viewerRegistry singleton, not component prop — avoids prop drilling
- cancelFlight() called before every flyToLandmark to prevent CesiumJS concurrent flight errors on rapid keypresses
- Distance-proportional duration: Math.hypot(deltaLon, deltaLat) / 30, clamped 0.5s-3.5s
- Nominatim bbox altitude: max(100k, min(3M, max(latSpan, lonSpan) * 111000)) — city-appropriate for diverse result types

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Complete navigation system ready for App.tsx wiring in Plan 07-05
- LandmarkNav exports LandmarkNav component, useKeyboardShortcuts exports useKeyboardShortcuts hook
- Plan 05 needs to add `<LandmarkNav viewer={cesiumViewer} />` to App.tsx and call `useKeyboardShortcuts()` in App component

---
*Phase: 07-visual-engine-navigation*
*Completed: 2026-03-11*
