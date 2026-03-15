---
phase: 11-replay-engine
plan: "02"
subsystem: api, ui
tags: [fastapi, sqlalchemy, zustand, react-query, replay, typescript]

# Dependency graph
requires:
  - phase: 10-snapshot-infrastructure
    provides: position_snapshots partitioned table with ts, layer_type, entity_id columns
  - phase: 11-replay-engine/11-01
    provides: test_replay_window_route RED test in test_replay.py; replay slice RED assertions in useAppStore.test.ts

provides:
  - GET /api/replay/window endpoint returning oldest_ts and newest_ts (ISO string or null)
  - Zustand AppState replay slice: replayMode, replayTs, replaySpeedMultiplier, replayWindowStart, replayWindowEnd with typed setters
  - useAircraft, useMilitaryAircraft, useShips pause refetchInterval when replayMode === 'playback'

affects:
  - 11-replay-engine/11-03 (PlaybackBar component and useReplaySnapshots hook depend on these contracts)
  - 11-replay-engine/11-04 (full replay engine wiring depends on store slice)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "sqlalchemy func.min/max aggregate in FastAPI async route for timestamp range discovery"
    - "Zustand refetchInterval conditional: replayMode === 'live' ? interval : false to pause polling in playback mode"

key-files:
  created: []
  modified:
    - backend/app/api/routes_replay.py
    - frontend/src/store/useAppStore.ts
    - frontend/src/hooks/useAircraft.ts
    - frontend/src/hooks/useMilitaryAircraft.ts
    - frontend/src/hooks/useShips.ts

key-decisions:
  - "func.min/MAX aggregate in single SELECT to get oldest_ts and newest_ts — avoids two separate queries"
  - "null returned (not zero/epoch) when position_snapshots table is empty — frontend can distinguish cold-start from populated state"
  - "refetchInterval: false only stops future refetches — in-flight requests complete and update cache, acceptable per research"
  - "replayTs initialized to Date.now() at store creation — accurate starting point for live-to-playback transition"

patterns-established:
  - "Replay mode gate: replayMode === 'live' ? interval : false pattern now established for all polling hooks"

requirements-completed: [REP-02, REP-03]

# Metrics
duration: 7min
completed: 2026-03-12
---

# Phase 11 Plan 02: Replay Window Endpoint and Store Slice Summary

**GET /api/replay/window endpoint via SQLAlchemy MIN/MAX aggregate; Zustand replay slice with live polling pause across three data hooks**

## Performance

- **Duration:** 7 min
- **Started:** 2026-03-12T12:52:24Z
- **Completed:** 2026-03-12T12:59:44Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Added `/api/replay/window` FastAPI route returning oldest/newest snapshot timestamps; test_replay_window_route turns GREEN
- Extended useAppStore with full replay slice: replayMode, replayTs, replaySpeedMultiplier, replayWindowStart, replayWindowEnd
- Paused live polling in useAircraft (90s), useMilitaryAircraft (300s), useShips (30s) when replayMode === 'playback'
- All 28 store tests pass GREEN including all 10 replay slice tests

## Task Commits

Each task was committed atomically:

1. **Task 1: Add /api/replay/window endpoint** - `0bbfeba` (feat)
2. **Task 2: Extend Zustand store with replay slice and pause live polling hooks** - `813c40c` (feat)

## Files Created/Modified
- `backend/app/api/routes_replay.py` - Added func import and GET /window route with MIN/MAX aggregate query
- `frontend/src/store/useAppStore.ts` - Added replay slice to AppState interface and create() implementation
- `frontend/src/hooks/useAircraft.ts` - Import useAppStore, conditional refetchInterval
- `frontend/src/hooks/useMilitaryAircraft.ts` - Import useAppStore, conditional refetchInterval
- `frontend/src/hooks/useShips.ts` - Import useAppStore, conditional refetchInterval

## Decisions Made
- Used single SELECT with func.min/func.max to retrieve both timestamps atomically in one DB round-trip
- Returns null (not 0 or epoch) when table is empty to allow frontend to distinguish cold-start state
- refetchInterval set to `false` (not `0`) in playback mode — React Query semantics: false disables auto-refetch, 0 would refetch continuously
- Initialized replayTs to Date.now() at store creation as a sensible default for the replay head

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- Anaconda Python (3.11.5) had SQLAlchemy 1.4.39 which lacks `async_sessionmaker`. Tests required running via `/opt/homebrew/opt/python@3.11/bin/python3.11` which has SQLAlchemy 2.0.48 (installed). Pre-existing environment mismatch unrelated to this plan.
- `SatelliteLayer.cleanup.test.tsx` Pitfall 1 failing due to pre-existing uncommitted changes to `GpsJammingLayer.tsx` (uses `viewer.entities` API). This is out of scope — logged to deferred items.

## Next Phase Readiness
- `/api/replay/window` endpoint live and tested — PlaybackBar can call this on mount to discover replay range
- Store replay slice fully typed and exported — Plan 03 (PlaybackBar, useReplaySnapshots) can import setReplayMode, setReplayWindow, replayTs, replaySpeedMultiplier
- Live polling pauses correctly in playback mode — no stale data interference during historical replay

---
*Phase: 11-replay-engine*
*Completed: 2026-03-12*
