---
phase: 36-replay-and-freshness
plan: 02
subsystem: ui
tags: [react, vitest, tanstack-query, cesium, gdelt, playback]

# Dependency graph
requires:
  - phase: 36-replay-and-freshness/36-01
    provides: useGdeltEvents hook with single-load replay session, QUAD_CLASS_HEX palette, GdeltLayer Effect 3 temporal visibility, GEO STALE indicator
provides:
  - GDELT-11: coloured event timeline dots on PlaybackBar scrubber track using QUAD_CLASS_HEX, frac*100% positioning, playback-only rendering
  - Six GDELT-11 Vitest tests (Tests A-F) covering position, colour, live suppression, window filtering
affects: [PlaybackBar, GdeltLayer, Phase 36 human verification]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "PlaybackBar calls useGdeltEvents() directly — TanStack Query deduplicates on same queryKey; no extra network request"
    - "GDELT dots rendered inside replayMode==='playback' block — absent in live mode by structure, not by condition"
    - "JSDOM hex-to-rgb normalisation: test colour assertions use toMatch regex accepting both #hex and rgb() forms"

key-files:
  created: []
  modified:
    - frontend/src/components/PlaybackBar.tsx
    - frontend/src/components/__tests__/PlaybackBar.test.tsx
    - frontend/src/components/__tests__/PlaybackBar.category.test.tsx

key-decisions:
  - "GDELT dots use cursor:default not pointer — clicking a scrubber dot does not seek; only OSINT dots seek"
  - "JSDOM normalises hex to rgb() in style assertions; tests use toMatch regex to accept both forms"
  - "useGdeltEvents mock added to PlaybackBar.category.test.tsx (Rule 1 auto-fix) — PlaybackBar now calls useGdeltEvents which requires QueryClientProvider without mock"

patterns-established:
  - "Any test file rendering PlaybackBar must vi.mock useGdeltEvents alongside useOsintEvents and useReplaySnapshots"

requirements-completed: [GDELT-11]

# Metrics
duration: 3min
completed: 2026-03-14
---

# Phase 36 Plan 02: GDELT-11 Timeline Dots Summary

**GDELT event coloured dots overlaid on PlaybackBar scrubber track using frac*100% positioning and QUAD_CLASS_HEX palette, rendered only in playback mode via TanStack Query cache hit**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-03-14T17:39:48Z
- **Completed:** 2026-03-14T17:42:38Z
- **Tasks:** 2 automated (Task 3 is human-verify checkpoint — paused)
- **Files modified:** 3

## Accomplishments

- PlaybackBar.tsx imports useGdeltEvents, GdeltEvent, QUAD_CLASS_HEX and renders coloured scrubber dots for all GDELT events inside the playback block
- Six new GDELT-11 Vitest tests (A-F): dot position at frac=50%, blue/red colour mapping for quad_class 1 and 4, absent in live mode, out-of-window filtering
- Full test suite: 263 tests passing across 34 files

## Task Commits

1. **Task 1: Add GDELT dots to PlaybackBar scrubber track** - `dfe4467` (feat + test — TDD)
2. **Task 2: Full test suite smoke check** - `a217791` (fix — Rule 1 auto-fix for category test file)

**Plan metadata:** (pending final commit)

_Note: TDD — RED phase confirmed 3 failures (A, B, C) before implementation; GREEN phase achieved all 6 passing._

## Files Created/Modified

- `frontend/src/components/PlaybackBar.tsx` - Added useGdeltEvents hook call and GDELT dot rendering block inside playback section
- `frontend/src/components/__tests__/PlaybackBar.test.tsx` - Added vi.mock for useGdeltEvents and GDELT-11 describe block with Tests A-F
- `frontend/src/components/__tests__/PlaybackBar.category.test.tsx` - Added missing useGdeltEvents mock (Rule 1 auto-fix)

## Decisions Made

- `cursor: 'default'` on GDELT dots (not pointer) — GDELT scrubber dots are informational markers; clicking does not seek or select
- JSDOM normalises hex colour values to `rgb()` format in `.style.background`; Tests B and C use `toMatch(/#hex|rgb(...)/)` regex to be resilient to both forms

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] JSDOM hex-to-rgb colour normalisation in Tests B and C**
- **Found during:** Task 1 (GREEN phase — after first test run)
- **Issue:** `expect(dot.style.background).toBe('#3B82F6')` failed — JSDOM returns `rgb(59, 130, 246)` for hex inline styles
- **Fix:** Changed both colour assertions to `toMatch(/#hex|rgb(...)/i)` regex pattern
- **Files modified:** `frontend/src/components/__tests__/PlaybackBar.test.tsx`
- **Verification:** All 6 GDELT-11 tests pass after fix
- **Committed in:** `dfe4467` (Task 1 commit)

**2. [Rule 1 - Bug] Missing useGdeltEvents mock in PlaybackBar.category.test.tsx**
- **Found during:** Task 2 (full suite run)
- **Issue:** Adding `useGdeltEvents()` to PlaybackBar.tsx caused `No QueryClient set` errors in the category test file which didn't mock the hook
- **Fix:** Added `vi.mock('../../hooks/useGdeltEvents', ...)` returning `{ data: [] }` alongside existing useOsintEvents mock
- **Files modified:** `frontend/src/components/__tests__/PlaybackBar.category.test.tsx`
- **Verification:** Full suite 263/263 green
- **Committed in:** `a217791` (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (both Rule 1 — bugs in test assertions/mock coverage)
**Impact on plan:** Both fixes necessary for test correctness. No scope creep.

## Issues Encountered

None — implementation proceeded cleanly; deviations were test-infrastructure issues only.

## Next Phase Readiness

- GDELT-11 complete: PlaybackBar scrubber shows coloured timeline dots per QuadClass
- Awaiting Task 3 human-verify gate: single GDELT load per session, temporal accumulation, scrubber dots visible, stale indicator
- Phase 36 v8.0 milestone ready for human confirmation

---
*Phase: 36-replay-and-freshness*
*Completed: 2026-03-14*
