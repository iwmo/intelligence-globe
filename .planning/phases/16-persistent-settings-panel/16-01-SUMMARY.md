---
phase: 16-persistent-settings-panel
plan: 01
subsystem: ui
tags: [zustand, persist, localStorage, settings, typescript]

# Dependency graph
requires:
  - phase: 07-visual-engine-navigation
    provides: VisualPreset type used as defaultPreset type
  - phase: 13-collapsible-sidebar-layout
    provides: useAppStore layer defaults that must be matched exactly
provides:
  - useSettingsStore Zustand persist store with all four startup configuration defaults
  - SettingsState exported interface for downstream plan imports
  - localStorage key 'globe-settings' as authoritative settings persistence layer
affects:
  - 16-02 (settings panel UI reads/writes this store)
  - 16-03 (app boot reads defaultLayers, defaultPreset, defaultCamera, defaultMode from this store)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Zustand v5 double-call syntax for persist middleware: create<T>()(persist(fn, opts))
    - Settings store separated from runtime store (useAppStore) to avoid persisting transient state

key-files:
  created:
    - frontend/src/store/useSettingsStore.ts
    - frontend/src/store/__tests__/useSettingsStore.test.ts
  modified: []

key-decisions:
  - "useSettingsStore is separate from useAppStore — prevents transient runtime values (selectedId, replayTs, replayWindowStart) from being persisted to localStorage"
  - "persist name 'globe-settings' — no partialize needed, entire state is configuration"
  - "defaultCamera: null is the sentinel for 'no flyTo on boot' — null is explicitly typed and preserved in localStorage"
  - "Initial defaultLayers exactly match useAppStore initial defaults so first-ever load is identical to existing behavior"

patterns-established:
  - "SettingsState: explicit exported interface (not inferred) — required for downstream plan imports"
  - "TDD RED→GREEN: test file committed before implementation file"

requirements-completed: [CONFIG-02, CONFIG-03, CONFIG-04, CONFIG-05, CONFIG-06]

# Metrics
duration: 5min
completed: 2026-03-13
---

# Phase 16 Plan 01: useSettingsStore — Persistent Startup Configuration Store Summary

**Zustand v5 persist store with four startup defaults (layers, visual preset, camera position, app mode) serialized to localStorage key 'globe-settings', with full TDD test coverage (16 tests, CONFIG-02 through CONFIG-06)**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-13T09:28:06Z
- **Completed:** 2026-03-13T09:33:00Z
- **Tasks:** 2 (RED + GREEN; REFACTOR no-op — SettingsState already explicitly declared)
- **Files modified:** 2

## Accomplishments
- Created `useSettingsStore.ts` with Zustand v5 persist middleware, `localStorage` key `globe-settings`, all four configuration defaults and setters
- Exported `SettingsState` interface explicitly for downstream plan imports (not inferred)
- Full TDD cycle: 16 tests written RED-first, all pass GREEN; full suite 145/145 green with no regressions

## Task Commits

Each task was committed atomically:

1. **RED: Failing tests for useSettingsStore** - `7f09982` (test)
2. **GREEN: useSettingsStore implementation** - `ee0d4c1` (feat)

_Note: REFACTOR phase was no-op — SettingsState was explicitly declared from the start._

## Files Created/Modified
- `frontend/src/store/useSettingsStore.ts` — Zustand persist store: defaultLayers, defaultPreset, defaultCamera, defaultMode + four setters
- `frontend/src/store/__tests__/useSettingsStore.test.ts` — 16 tests covering CONFIG-02 through CONFIG-06 (initial values, mutations, localStorage persistence)

## Decisions Made
- Separated settings store from `useAppStore` to prevent transient runtime values from being persisted (selected entity IDs, replay timestamps, replay window bounds are not startup configuration)
- No `partialize` — entire `SettingsState` is configuration, nothing to filter out
- `defaultCamera: null` sentinel is explicitly typed as `{...} | null` and preserved correctly through persist middleware
- Initial `defaultLayers` exactly mirrors `useAppStore` initial defaults so first-ever load produces identical behavior to pre-settings era

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness
- `useSettingsStore` and `SettingsState` are ready for Phase 16-02 (Settings Panel UI) to read and mutate
- `defaultCamera` null sentinel behavior is defined: downstream boot logic must check for null before calling flyTo
- Full suite stays green — safe to proceed to 16-02

---
*Phase: 16-persistent-settings-panel*
*Completed: 2026-03-13*
