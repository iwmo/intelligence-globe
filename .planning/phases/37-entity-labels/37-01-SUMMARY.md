---
phase: 37-entity-labels
plan: 01
subsystem: ui
tags: [zustand, react, settings, localStorage, persist]

# Dependency graph
requires:
  - phase: 16-persistent-settings
    provides: useSettingsStore with zustand persist pattern and SettingsPanel structure
provides:
  - showEntityLabels boolean field in useSettingsStore (persisted to localStorage globe-settings key)
  - setShowEntityLabels action in useSettingsStore
  - Entity Labels checkbox in SettingsPanel Display section
affects:
  - 37-entity-labels plans 02 and 03 (all four label layer implementations consume showEntityLabels)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Persisted boolean toggle in useSettingsStore for UI display preferences
    - DISPLAY section above Default Layers in SettingsPanel for non-layer rendering toggles

key-files:
  created: []
  modified:
    - frontend/src/store/useSettingsStore.ts
    - frontend/src/components/SettingsPanel.tsx

key-decisions:
  - "showEntityLabels defaults to false — labels are off on first load, user opts in"
  - "Field placed inside persist() call so it is serialised to globe-settings localStorage key alongside other settings"
  - "DISPLAY section added above Default Layers — visual rendering controls separate from layer visibility controls"

patterns-established:
  - "Boolean display toggle pattern: add field+action to useSettingsStore, add checkbox in SettingsPanel DISPLAY section"

requirements-completed: [LBL-01, LBL-02]

# Metrics
duration: 3min
completed: 2026-03-14
---

# Phase 37 Plan 01: Entity Labels Toggle Infrastructure Summary

**Persisted showEntityLabels boolean added to useSettingsStore and wired to an Entity Labels checkbox in the SettingsPanel Display section**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-14T21:13:34Z
- **Completed:** 2026-03-14T21:16:59Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Added `showEntityLabels: boolean` (default false) and `setShowEntityLabels` action to `SettingsState` interface and store factory, inside the `persist()` call so the value survives browser refresh via the `globe-settings` localStorage key
- Added a "DISPLAY" section above the existing "Default Layers" section in SettingsPanel containing an "Entity Labels" checkbox that reads and writes the new store field
- TypeScript compiles cleanly with no errors after both changes

## Task Commits

Each task was committed atomically:

1. **Task 1: Add showEntityLabels to useSettingsStore** - `5fe4750` (feat)
2. **Task 2: Add Entity Labels toggle to SettingsPanel** - `2de1dd6` (feat)

## Files Created/Modified
- `frontend/src/store/useSettingsStore.ts` - Added showEntityLabels field (default false) and setShowEntityLabels action to persisted store
- `frontend/src/components/SettingsPanel.tsx` - Added DISPLAY section with Entity Labels checkbox above Default Layers section

## Decisions Made
- showEntityLabels defaults to false so labels are opt-in, not forced on every user on first load
- DISPLAY section placed at the top (section 0) of the panel since it is a global rendering preference, distinct from per-layer toggles

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- showEntityLabels and setShowEntityLabels are now exported from useSettingsStore and ready for all four label layer implementations in plans 02 and 03
- No blockers; toggle infrastructure is complete

---
*Phase: 37-entity-labels*
*Completed: 2026-03-14*
