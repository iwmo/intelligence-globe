---
phase: 23-store-foundation-viewer-clock
plan: 02
subsystem: ui
tags: [zustand, react, playback, store, state-management]

# Dependency graph
requires:
  - phase: 23-01
    provides: useAppStore foundation and initial slices
provides:
  - isPlaying boolean in useAppStore with boolean + functional updater setIsPlaying
  - PlaybackBar reading isPlaying from store via selector (no local useState)
  - rAF tick and handleModeToggle using getState().setIsPlaying(false) pattern
affects:
  - 25-layer-audit
  - all components that need to gate behavior on isPlaying

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Zustand getState() inside rAF tick closure to avoid stale closures"
    - "Functional updater form setIsPlaying(p => !p) via store action accepting boolean | ((prev) => boolean)"

key-files:
  created: []
  modified:
    - frontend/src/store/useAppStore.ts
    - frontend/src/components/PlaybackBar.tsx
    - frontend/src/store/__tests__/useAppStore.test.ts

key-decisions:
  - "isPlaying in useAppStore not useSettingsStore — transient runtime state must not persist to localStorage"
  - "rAF tick window-end uses getState().setIsPlaying(false) not closure variable — same stale-closure avoidance pattern already established for replayTs"

patterns-established:
  - "TDD RED-GREEN: write failing tests first, commit, then implement, commit"
  - "Store actions accept boolean | functional updater for React-compatible toggle patterns"

requirements-completed:
  - PLAY-01

# Metrics
duration: 8min
completed: 2026-03-13
---

# Phase 23 Plan 02: isPlaying Store Migration Summary

**`isPlaying` promoted from PlaybackBar `useState` to Zustand slice in `useAppStore` with functional updater support and stale-closure-safe `getState()` calls in the rAF tick.**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-03-13T21:49:00Z
- **Completed:** 2026-03-13T21:52:00Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Added `isPlaying: boolean` and `setIsPlaying(v: boolean | ((prev: boolean) => boolean))` to the AppState interface and create() body in `useAppStore.ts`
- Removed `useState` import and local `const [isPlaying, setIsPlaying] = useState(false)` from `PlaybackBar.tsx`
- Replaced both `setIsPlaying(false)` calls in rAF tick and `handleModeToggle` with `useAppStore.getState().setIsPlaying(false)` to avoid stale closure
- All 47 tests across useAppStore, PlaybackBar smoke, and PlaybackBar category suites pass GREEN

## Task Commits

Each task was committed atomically:

1. **RED test** — `6d48d21` (test: add failing tests for isPlaying slice)
2. **Task 1: Add isPlaying slice to useAppStore.ts** — `5198889` (feat: implement isPlaying + setIsPlaying)
3. **Task 2: Migrate PlaybackBar from useState to store isPlaying** — `a7f8f0d` (feat: migrate PlaybackBar)

_Note: TDD tasks have test commit followed by implementation commit_

## Files Created/Modified

- `frontend/src/store/useAppStore.ts` — Added isPlaying: false and setIsPlaying action to interface + implementation
- `frontend/src/components/PlaybackBar.tsx` — Removed useState for isPlaying; read from store via selector; getState() calls in tick and toggle
- `frontend/src/store/__tests__/useAppStore.test.ts` — Added isPlaying slice describe block (4 tests)

## Decisions Made

- `isPlaying` goes in `useAppStore` not `useSettingsStore` — per locked STATE.md decision, transient runtime values must not persist to localStorage
- `setIsPlaying` accepts `boolean | ((prev: boolean) => boolean)` — matches the React `setState` functional updater pattern so `setIsPlaying(p => !p)` works in the play/pause click handler without change

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `isPlaying` is now the global source of truth — any component can read it from the store
- Phase 25 layer guards can now call `useAppStore(s => s.isPlaying)` to detect playback state
- PlaybackBar behavior is unchanged from the user's perspective; only the state residence changed

---
*Phase: 23-store-foundation-viewer-clock*
*Completed: 2026-03-13*
