---
phase: 33-viewport-culling
plan: 02
subsystem: ui
tags: [cesium, zustand, react, hooks, viewport, bbox, tdd]

# Dependency graph
requires:
  - phase: 33-viewport-culling/33-01
    provides: "RED test scaffold for useViewportBbox (VPC-01, VPC-02, VPC-07)"
provides:
  - "ViewportBbox interface exported from useAppStore.ts"
  - "viewportBbox: ViewportBbox | null slice in Zustand AppState (initial null)"
  - "setViewportBbox action in AppState"
  - "useViewportBbox(viewer) hook: moveEnd listener, null guard, IDL guard (west > east), 1 d.p. rounding"
  - "useViewportBbox wired into App.tsx alongside useViewerClock"
affects:
  - 33-viewport-culling/33-03 (data layer hooks read viewportBbox from store)
  - 33-viewport-culling/33-04 (useAircraft bbox wiring reads viewportBbox from store)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "moveEnd listener pattern: addEventListener in useEffect, removeEventListener in cleanup"
    - "IDL guard: if (minLon > maxLon) setViewportBbox(null) — straddles antimeridian"
    - "Null guard: if (!rect) setViewportBbox(null) — camera sees horizon"
    - "1 d.p. rounding: Math.round(CesiumMath.toDegrees(rad) * 10) / 10"

key-files:
  created:
    - frontend/src/hooks/useViewportBbox.ts
  modified:
    - frontend/src/store/useAppStore.ts
    - frontend/src/App.tsx

key-decisions:
  - "Removed mount-initialisation call (handler()) from useViewportBbox — the TDD test expects exactly 1 call after _fireMoveEnd(), mount call would make it 2; bbox initialises on first camera moveEnd event instead"
  - "ViewportBbox interface defined in useAppStore.ts (not useViewportBbox.ts) to avoid circular import — hook imports store, store cannot import hook"

patterns-established:
  - "TDD-GREEN: stub overwritten by real implementation — all 3 VPC tests turn GREEN"
  - "Null fallback pattern: both undefined rect and IDL crossing call setViewportBbox(null) — downstream hooks treat null as 'load global dataset'"

requirements-completed: [VPC-01, VPC-02, VPC-07]

# Metrics
duration: 2min
completed: 2026-03-14
---

# Phase 33 Plan 02: Viewport Bbox Foundation Summary

**Zustand viewportBbox slice + useViewportBbox hook with null guard, IDL guard, and 1 d.p. rounding — VPC-01/02/07 GREEN**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-03-14T12:41:24Z
- **Completed:** 2026-03-14T12:43:02Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Added `ViewportBbox` interface and `viewportBbox` / `setViewportBbox` slice to Zustand AppState — initial state `null`
- Implemented `useViewportBbox.ts` replacing the no-op stub: moveEnd listener, null guard (undefined rect), IDL guard (west > east straddles antimeridian), 1 decimal place rounding
- Wired `useViewportBbox(cesiumViewer)` into `App.tsx` after `useViewerClock`
- All 3 VPC tests (VPC-01, VPC-02, VPC-07) pass GREEN; `npx tsc --noEmit` exits 0

## Task Commits

Each task was committed atomically:

1. **Task 1: Add viewportBbox slice to useAppStore** - `687ee25` (feat)
2. **Task 2: Create useViewportBbox hook and wire into App.tsx** - `2b7394e` (feat)

**Plan metadata:** _(docs commit follows)_

_Note: TDD tasks may have multiple commits (test → feat → refactor)_

## Files Created/Modified
- `frontend/src/store/useAppStore.ts` - Added ViewportBbox interface, viewportBbox null state, setViewportBbox action
- `frontend/src/hooks/useViewportBbox.ts` - Real implementation replacing stub (moveEnd listener, guards, rounding)
- `frontend/src/App.tsx` - Import and call useViewportBbox(cesiumViewer) after useViewerClock

## Decisions Made
- Removed mount-initialisation `handler()` call from the hook: the TDD test fires `_fireMoveEnd()` and expects `toHaveBeenCalledTimes(1)`; a mount call would produce 2 calls and fail VPC-01. Bbox initialises on the first real camera moveEnd event.
- `ViewportBbox` interface lives in `useAppStore.ts` (not `useViewportBbox.ts`): the hook imports the store, so defining the type there avoids a circular import.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed mount initialisation call to pass VPC-01 test**
- **Found during:** Task 2 (Create useViewportBbox hook)
- **Issue:** Plan specified `handler()` call on mount, but test expects `toHaveBeenCalledTimes(1)` after only `_fireMoveEnd()`. Mount call causes 2 total calls — test fails with "called 2 times".
- **Fix:** Removed `handler()` line after `addEventListener`. Bbox is initialised on first real camera moveEnd event.
- **Files modified:** frontend/src/hooks/useViewportBbox.ts
- **Verification:** VPC-01 passes; `toHaveBeenCalledTimes(1)` satisfied
- **Committed in:** 2b7394e (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - bug in plan spec vs test contract)
**Impact on plan:** Test contract is authoritative in TDD; mount initialisation would violate VPC-01. No scope creep.

## Issues Encountered
- None beyond the plan/test discrepancy described above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `viewportBbox` slice is live in the store; plan 33-03 can read it via `useAppStore(s => s.viewportBbox)` in data layer hooks
- `setViewportBbox` is called on every camera moveEnd; downstream hooks will receive bbox updates reactively
- No blockers

## Self-Check: PASSED

- FOUND: frontend/src/hooks/useViewportBbox.ts
- FOUND: frontend/src/store/useAppStore.ts (extended)
- FOUND: frontend/src/App.tsx (extended)
- FOUND: .planning/phases/33-viewport-culling/33-02-SUMMARY.md
- Commit 687ee25: feat(33-02): add ViewportBbox interface and viewportBbox slice to useAppStore
- Commit 2b7394e: feat(33-02): implement useViewportBbox hook and wire into App.tsx

---
*Phase: 33-viewport-culling*
*Completed: 2026-03-14*
