---
phase: 11-replay-engine
plan: "01"
subsystem: replay-engine
tags: [tdd, red-phase, replay, frontend-tests, backend-tests]
dependency_graph:
  requires: []
  provides:
    - frontend/src/store/__tests__/useAppStore.test.ts (replay slice RED assertions)
    - frontend/src/components/__tests__/PlaybackBar.test.tsx (PlaybackBar smoke tests RED)
    - frontend/src/hooks/__tests__/useReplaySnapshots.test.ts (findAdjacentSnapshots unit tests RED)
    - backend/tests/test_replay.py (window route test — passes GREEN, route pre-implemented in Phase 10)
  affects:
    - Plans 02-04 must satisfy these test contracts
tech_stack:
  added: []
  patterns:
    - Static import after vi.mock for RED ModuleNotFoundError signal (established Phase 7-10 pattern)
    - Deferred await import at module level triggers Vite import-analysis failure (RED signal for missing modules)
    - useAppStore.setState in beforeEach to set up replay state
key_files:
  created:
    - frontend/src/components/__tests__/PlaybackBar.test.tsx
    - frontend/src/hooks/__tests__/useReplaySnapshots.test.ts
  modified:
    - frontend/src/store/__tests__/useAppStore.test.ts
    - backend/tests/test_replay.py
decisions:
  - Store replay fields and /api/replay/window were already implemented in Phase 10 Plan 03; useAppStore and backend tests pass GREEN immediately
  - PlaybackBar.test.tsx uses static import (not deferred) — Vite catches missing module at import-analysis stage for correct RED signal
  - useReplaySnapshots.test.ts uses deferred await import at module level — same Vite import-analysis RED pattern established in Phase 9-10
metrics:
  duration: "~6min"
  completed: "2026-03-12"
  tasks_completed: 3
  files_created: 2
  files_modified: 2
---

# Phase 11 Plan 01: TDD RED Phase — Replay Engine Test Stubs Summary

**One-liner:** Four test locations populated with replay contracts; PlaybackBar and useReplaySnapshots produce RED (modules missing), store and window route produce GREEN (pre-implemented in Phase 10).

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Extend useAppStore test with replay slice (RED) | 364219d | frontend/src/store/__tests__/useAppStore.test.ts |
| 2 | Create PlaybackBar and useReplaySnapshots stubs (RED) | 8c6c6ea | frontend/src/components/__tests__/PlaybackBar.test.tsx, frontend/src/hooks/__tests__/useReplaySnapshots.test.ts |
| 3 | Extend backend test_replay.py with window route test | 811a645 | backend/tests/test_replay.py |

## Test Outcomes

### Frontend — RED

- `PlaybackBar.test.tsx`: FAIL — `Failed to resolve import "../PlaybackBar"` (module does not exist)
- `useReplaySnapshots.test.ts`: FAIL — `Failed to resolve import "../useReplaySnapshots"` (module does not exist)

### Frontend — GREEN (pre-implemented)

- `useAppStore.test.ts` replay slice: 28/28 PASS — store replay fields (`replayMode`, `replayTs`, `replaySpeedMultiplier`, `replayWindowStart`, `replayWindowEnd`) were already added in Phase 10 Plan 03

### Backend — GREEN (pre-implemented)

- `test_replay_window_route`: PASS — `/api/replay/window` route was already implemented in Phase 10 as part of routes_replay.py (commit `0bbfeba`)

## Deviations from Plan

### Context Discovery: Phase 10 Pre-Implementation

**Found during:** Task 1 (store test) and Task 3 (backend test)

**Issue:** The plan expected all four test locations to produce RED. However, Phase 10 Plan 03 had already implemented:
  1. `useAppStore` replay slice fields (`replayMode`, `replayTs`, `replaySpeedMultiplier`, `replayWindowStart`, `replayWindowEnd`, setters)
  2. `/api/replay/window` endpoint in `routes_replay.py`

**Outcome:** Not a deviation from the test contracts — the tests still define the correct interface and verify the correct behavior. Plans 02-04 still need to implement `PlaybackBar.tsx` and `useReplaySnapshots.ts`, which produce proper RED signals.

**Impact:** Plans 02-04 scope is reduced — store slice and window route do not need to be implemented again.

### Auto-fix: PlaybackBar test pattern

**Found during:** Task 2

**Issue:** Plan's PlaybackBar test used `await import` inside a non-async `it` block, causing an esbuild transform error rather than a ModuleNotFoundError RED signal.

**Fix:** Rewrote PlaybackBar.test.tsx using static import after vi.mock (established project pattern from Phase 7-10). The second describe block with playback mode tests uses the static mock override rather than a dynamic import.

**Files modified:** `frontend/src/components/__tests__/PlaybackBar.test.tsx`

## Self-Check: PASSED

### Files Created/Modified

- [x] `frontend/src/store/__tests__/useAppStore.test.ts` — replay describe block appended
- [x] `frontend/src/components/__tests__/PlaybackBar.test.tsx` — new file
- [x] `frontend/src/hooks/__tests__/useReplaySnapshots.test.ts` — new file
- [x] `backend/tests/test_replay.py` — `test_replay_window_route` appended

### Commits

- [x] 364219d — test(11-01): add failing replay slice assertions to useAppStore test
- [x] 8c6c6ea — test(11-01): add PlaybackBar and useReplaySnapshots stub tests (RED)
- [x] 811a645 — test(11-01): add test_replay_window_route to backend test_replay.py
