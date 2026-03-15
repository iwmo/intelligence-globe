---
phase: 23-store-foundation-viewer-clock
plan: 03
subsystem: ui
tags: [cesium, react, zustand, hooks, clock-sync]

# Dependency graph
requires:
  - phase: 23-02
    provides: useAppStore with replayMode/replayTs, useReplaySnapshots hook, PlaybackBar wired
provides:
  - useViewerClock hook syncing viewer.clock.currentTime via postUpdate
  - App.tsx wired to call useViewerClock(cesiumViewer)
affects:
  - 24-satellite-propagation-fix
  - 25-layer-audit

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "postUpdate.addEventListener pattern for zero-frame-lag CesiumJS clock sync"
    - "getState() inside handler to avoid stale React closure over store state"
    - "isDestroyed() guard before removeEventListener to prevent DeveloperError on unmount"

key-files:
  created:
    - frontend/src/hooks/useViewerClock.ts
  modified:
    - frontend/src/App.tsx
    - frontend/src/hooks/__tests__/useViewerClock.test.ts

key-decisions:
  - "postUpdate pattern confirmed: syncs clock inside CesiumJS render frame, not in React useEffect"
  - "getState() reads store inline in handler — prevents stale closure over replayMode/replayTs"

patterns-established:
  - "postUpdate handler: read store via getState(), guard mode, set clock, guard cleanup with isDestroyed()"

requirements-completed:
  - PLAY-03

# Metrics
duration: 6min
completed: 2026-03-13
---

# Phase 23 Plan 03: useViewerClock Hook Summary

**useViewerClock hook syncing viewer.clock.currentTime with replayTs via CesiumJS postUpdate.addEventListener, wired in App.tsx alongside cesiumViewer**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-13T18:54:29Z
- **Completed:** 2026-03-13T18:56:48Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Created `useViewerClock` hook that syncs `viewer.clock.currentTime` with `replayTs` inside every CesiumJS render frame via `postUpdate`
- In LIVE mode the hook is a no-op — live globe lighting is unaffected
- Cleanup guards `viewer.isDestroyed()` before removing listener, preventing `DeveloperError` during CesiumJS tear-down
- Wired hook in `App.tsx` with a single `useViewerClock(cesiumViewer)` call after existing hooks
- All 6 useViewerClock tests GREEN; full suite 27 files / 168 tests GREEN

## Task Commits

Each task was committed atomically:

1. **Task 1: Create useViewerClock hook** - `a4939c2` (feat)
2. **Task 2: Wire useViewerClock in App.tsx** - `86d9af8` (feat)

**Plan metadata:** (docs commit below)

## Files Created/Modified
- `frontend/src/hooks/useViewerClock.ts` - New hook: postUpdate-based clock sync, mode-guarded, isDestroyed() cleanup
- `frontend/src/App.tsx` - Added import and `useViewerClock(cesiumViewer)` call
- `frontend/src/hooks/__tests__/useViewerClock.test.ts` - Fixed vi.mock hoisting bug (Rule 1)

## Decisions Made
- postUpdate pattern confirmed — fires synchronously inside CesiumJS render frame, guarantees zero frame lag vs useEffect on replayTs which fires after paint
- Store read via getState() inside handler — avoids stale closure that would snapshot replayTs at hook mount time

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed vi.mock hoisting in useViewerClock.test.ts**
- **Found during:** Task 1 (TDD GREEN phase — running tests after hook creation)
- **Issue:** `mockFromDate` and `mockGetState` variables declared before `vi.mock()` calls, but `vi.mock()` factories are hoisted to top of file by Vitest; variables read before initialization, causing `ReferenceError: Cannot access 'mockFromDate' before initialization`
- **Fix:** Moved to inline `vi.fn()` inside mock factories, then obtained references via cast from imported mocked modules after the `import` statements — matches the pattern used in `useKeyboardShortcuts.test.ts`
- **Files modified:** `frontend/src/hooks/__tests__/useViewerClock.test.ts`
- **Verification:** All 6 tests pass GREEN
- **Committed in:** `a4939c2` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - bug in pre-existing test file)
**Impact on plan:** Fix required for tests to run. No scope creep — test semantics unchanged, only mock wiring corrected.

## Issues Encountered
- `git stash pop` after checking pre-existing failure status caused a mid-session state where stash-modified files (`PlaybackBar.test.tsx`, `PlaybackBar.tsx`) reappeared as unstaged changes; re-running the full suite confirmed all 168 tests pass with these files present.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Globe day/night shading now tracks replay scrubber position with zero frame lag
- Phase 24 (Satellite Propagation Fix) can proceed — clock sync foundation complete
- Manual visual verification recommended: scrub PlaybackBar to nighttime timestamp (00:00 UTC) and confirm globe hemisphere lighting changes within same render frame

---
*Phase: 23-store-foundation-viewer-clock*
*Completed: 2026-03-13*
