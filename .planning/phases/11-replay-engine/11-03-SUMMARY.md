---
phase: 11-replay-engine
plan: "03"
subsystem: ui
tags: [react, zustand, tanstack-query, vitest, binary-search, requestAnimationFrame]

requires:
  - phase: 11-replay-engine/11-02
    provides: /api/replay/window endpoint, useAppStore replay slice

provides:
  - useReplaySnapshots hook with findAdjacentSnapshots binary search helper
  - osintEvents.ts seed data (empty for Phase 11, ready for Phase 12 DB injection)
  - PlaybackBar component with LIVE/PLAYBACK toggle, scrubber, speed presets, rAF loop

affects:
  - 11-04 (PlaybackBar wiring into App.tsx, layer snapshot interpolation)
  - 12 (OSINT events DB-driven population via osintEvents.ts injection pattern)

tech-stack:
  added: []
  patterns:
    - "useReplaySnapshots returns placeholderData: new Map() so callers never receive undefined"
    - "findAdjacentSnapshots pure function (no React deps) exported separately for use in layer components"
    - "rAF playback loop reads replayTs via useAppStore.getState() to avoid stale closure — replayTs excluded from useEffect deps"
    - "Mock state mutation pattern for per-describe vi.fn() mock override without beforeEach"

key-files:
  created:
    - frontend/src/hooks/useReplaySnapshots.ts
    - frontend/src/data/osintEvents.ts
    - frontend/src/components/PlaybackBar.tsx
  modified:
    - frontend/src/components/__tests__/PlaybackBar.test.tsx

key-decisions:
  - "PlaybackBar test mock uses mutable mockState object so per-describe replayMode override works without module re-import"
  - "OSINT_EVENTS kept as empty array in Phase 11 — PlaybackBar gracefully handles zero markers"
  - "snapshotWindowStart/End calculated from replayWindowEnd ±1 hour — fetch on playback mode entry only"

patterns-established:
  - "Mutable mockState object pattern: share a single mock object and mutate .replayMode per describe block"
  - "findAdjacentSnapshots binary search: upper-bound with (lo + hi + 1) >> 1 ensures last-at-or-before semantics"

requirements-completed: [REP-02, REP-03, REP-04]

duration: 3min
completed: 2026-03-12
---

# Phase 11 Plan 03: Replay Engine Frontend Modules Summary

**PlaybackBar UI with rAF loop, useReplaySnapshots binary-search hook, and OSINT event seed data — all tests GREEN**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-12T13:02:58Z
- **Completed:** 2026-03-12T13:06:52Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- `useReplaySnapshots` hook returns `Map<entityId, SnapshotRecord[]>` sorted by ts; `findAdjacentSnapshots` pure function handles 4 edge cases via binary search
- `PlaybackBar` renders PLAYBACK toggle in live mode, LIVE toggle + scrubber + speed presets (1m/s, 3m/s, 5m/s, 15m/s, 1h/s) in playback mode; rAF loop uses `getState()` to avoid stale closure
- `OSINT_EVENTS` is empty array for Phase 11; PlaybackBar handles zero event markers without crashing
- All 6 targeted tests GREEN; 72 of 73 total tests GREEN (pre-existing GpsJammingLayer regression, out of scope)

## Task Commits

Each task was committed atomically:

1. **Task 1: useReplaySnapshots hook with findAdjacentSnapshots binary search** - `a095b65` (feat)
2. **Task 2: osintEvents seed data and PlaybackBar component** - `6c32f5e` (feat)

## Files Created/Modified

- `frontend/src/hooks/useReplaySnapshots.ts` - SnapshotRecord interface, findAdjacentSnapshots pure function, useReplaySnapshots React Query hook
- `frontend/src/data/osintEvents.ts` - OsintEvent interface, EVENT_COLORS map, empty OSINT_EVENTS array
- `frontend/src/components/PlaybackBar.tsx` - LIVE/PLAYBACK toggle, scrubber with event marker overlay, speed presets, rAF playback advancement loop
- `frontend/src/components/__tests__/PlaybackBar.test.tsx` - Fixed missing mock override in second describe block (was always using replayMode=live for both describes)

## Decisions Made

- **PlaybackBar test mock pattern:** Pre-written test had a bug — both describe blocks used the same `replayMode: 'live'` mock, but the second described "playback mode" behaviors requiring LIVE button + speed presets. Fixed by introducing a mutable `mockState` object that each describe block mutates before rendering.
- **OSINT_EVENTS empty:** Per spec, Phase 11 seeds an empty array. No markers render, no crash — the component handles this correctly via conditional rendering on `hasWindow && OSINT_EVENTS.map(...)`.
- **staleTime: Infinity for snapshot cache:** Snapshot history is immutable — once fetched for a time window, it never changes. No background re-fetches during playback.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed PlaybackBar test mock: second describe lacked replayMode override**

- **Found during:** Task 2 verification
- **Issue:** Pre-written `PlaybackBar.test.tsx` had both describe blocks using the same module-level mock with `replayMode: 'live'`. The second describe ("PlaybackBar playback mode") expected `LIVE` button and speed presets which only render when `replayMode === 'playback'`, so the test always failed.
- **Fix:** Introduced mutable `mockState` object at module level; each describe mutates `mockState.replayMode` before calling `render()`. Module-level `vi.mock` reads the object by reference so the per-describe value is seen by the component.
- **Files modified:** `frontend/src/components/__tests__/PlaybackBar.test.tsx`
- **Verification:** Both describe blocks now pass; 6/6 targeted tests GREEN.
- **Committed in:** `6c32f5e` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 — bug in pre-written test fixture)
**Impact on plan:** Bug fix was necessary for tests to be meaningful. Component behavior matches plan exactly.

## Issues Encountered

- **Pre-existing GpsJammingLayer regression (deferred):** `SatelliteLayer.cleanup.test.tsx` Pitfall 1 static audit fails because GpsJammingLayer.tsx (modified before Plan 03) uses pattern matching `EntityCollection|viewer.entities`. This is a pre-existing issue in uncommitted working tree changes, not caused by Plan 03 files. Logged to `.planning/phases/11-replay-engine/deferred-items.md`.

## Next Phase Readiness

- Plan 04 can import `PlaybackBar` from `../components/PlaybackBar` and mount it in App.tsx
- Plan 04 can import `useReplaySnapshots` and `findAdjacentSnapshots` for layer-level snapshot interpolation
- `useAppStore.replayMode`, `replayTs`, `replayWindowStart/End` are all wired and ready for layer consumers

---
*Phase: 11-replay-engine*
*Completed: 2026-03-12*
