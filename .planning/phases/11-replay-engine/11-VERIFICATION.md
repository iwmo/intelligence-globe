---
phase: 11-replay-engine
verified: 2026-03-12T16:21:00Z
status: passed
score: 15/15 must-haves verified
re_verification: false
human_verification:
  - test: "Full LIVE/PLAYBACK toggle end-to-end with snapshot data"
    expected: "PLAYBACK button appears, clicking it freezes live entity polling, scrubber drives entity positions at replayTs, speed presets change advancement rate, LIVE button restores polling within one poll interval, PlaybackBar persists in Clean UI mode"
    why_human: "Requires CesiumJS globe running, real/accumulated snapshot data in DB, and visual inspection of entity movement — cannot verify Cartesian3 position mutations or requestAnimationFrame behavior in vitest"
    status: "APPROVED — confirmed in Plan 04 Task 3 human verification checkpoint"
---

# Phase 11: Replay Engine Verification Report

**Phase Goal:** Implement a complete time-travel replay engine — backend snapshot storage, REST window endpoint, Zustand replay slice, PlaybackBar UI, snapshot retrieval hook, and layer interpolation — so operators can scrub through historical ADS-B/AIS data on the globe.

**Verified:** 2026-03-12T16:21:00Z
**Status:** PASSED
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | GET /api/replay/window returns 200 with oldest_ts and newest_ts (ISO string or null) | VERIFIED | routes_replay.py line 83-105: func.min/max aggregate SELECT; test_replay_window_route passes GREEN |
| 2 | Zustand store has replayMode, replayTs, replaySpeedMultiplier, replayWindowStart, replayWindowEnd with typed setters | VERIFIED | useAppStore.ts lines 54-64 (interface) and 111-120 (implementation); 28/28 store tests GREEN |
| 3 | useAircraft, useMilitaryAircraft, useShips pause refetchInterval when replayMode === 'playback' | VERIFIED | useAircraft.ts line 32, useMilitaryAircraft.ts line 33, useShips.ts line 34: `refetchInterval: replayMode === 'live' ? N : false` |
| 4 | findAdjacentSnapshots pure function exported from useReplaySnapshots returns correct [before, after] bracket | VERIFIED | useReplaySnapshots.ts lines 18-38: binary search with upper-bound semantics; 4/4 unit tests GREEN |
| 5 | useReplaySnapshots hook returns Map<entityId, SnapshotRecord[]> keyed by entity_id, sorted by ts ascending | VERIFIED | useReplaySnapshots.ts lines 49-106: React Query hook with placeholderData: new Map(); sort by ts at line 97 |
| 6 | PlaybackBar renders PLAYBACK button in live mode, LIVE button in playback mode | VERIFIED | PlaybackBar.tsx line 149: `{replayMode === 'live' ? 'PLAYBACK' : 'LIVE'}`; 2/2 smoke tests GREEN |
| 7 | PlaybackBar renders speed preset buttons (1m/s, 3m/s, 5m/s, 15m/s, 1h/s) only in playback mode | VERIFIED | PlaybackBar.tsx lines 7-13 (SPEED_PRESETS) and 231-251 (conditional render inside replayMode === 'playback' block); playback mode test GREEN |
| 8 | PlaybackBar renders colored event marker dots for each item in OSINT_EVENTS when in playback mode | VERIFIED | PlaybackBar.tsx lines 188-216: OSINT_EVENTS.map with data-event-id; OSINT_EVENTS is empty array in Phase 11 per spec — zero markers, no crash |
| 9 | Clicking an event marker calls setReplayTs with the event ts | VERIFIED | PlaybackBar.tsx line 196: `onClick={() => setReplayTs(evt.ts)}` |
| 10 | rAF playback advancement loop reads replayTs via useAppStore.getState() to avoid stale closure | VERIFIED | PlaybackBar.tsx lines 71-72: destructures replayTs from useAppStore.getState() inside tick(); replayTs excluded from useEffect deps (line 92) |
| 11 | AircraftLayer wires useReplaySnapshots and findAdjacentSnapshots for playback interpolation | VERIFIED | AircraftLayer.tsx lines 17, 73-78 (hook call), 265-288 (playback effect guarded by replayMode === 'playback') |
| 12 | MilitaryAircraftLayer wires useReplaySnapshots and findAdjacentSnapshots for playback interpolation | VERIFIED | MilitaryAircraftLayer.tsx lines 11, 30-35 (hook call), 93-116 (playback effect) |
| 13 | ShipLayer wires useReplaySnapshots and findAdjacentSnapshots for playback interpolation | VERIFIED | ShipLayer.tsx lines 11, 30-35 (hook call), 97-120 (playback effect) |
| 14 | PlaybackBar is mounted in App.tsx outside the cleanUI gate | VERIFIED | App.tsx line 18 (import) and line 61: `<PlaybackBar />` placed between LandmarkNav and the `{!cleanUI && ...}` conditional block |
| 15 | Backend replay router is mounted at /api/replay prefix in main.py | VERIFIED | main.py line 12 (import as replay_router) and line 36 (app.include_router with prefix="/api/replay") |

**Score:** 15/15 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `frontend/src/hooks/useReplaySnapshots.ts` | SnapshotRecord interface, findAdjacentSnapshots pure function, useReplaySnapshots hook | VERIFIED | 107 lines; all three exports present; substantive implementation |
| `frontend/src/data/osintEvents.ts` | OsintEvent interface, EVENT_COLORS map, OSINT_EVENTS array | VERIFIED | 22 lines; all three exports present; empty array per Phase 11 spec |
| `frontend/src/components/PlaybackBar.tsx` | LIVE/PLAYBACK toggle, scrubber, speed presets, rAF loop, event markers | VERIFIED | 257 lines; full implementation with rAF loop, scrubber, event marker infrastructure |
| `backend/app/api/routes_replay.py` | /api/replay/snapshots and /api/replay/window endpoints | VERIFIED | 106 lines; both routes implemented with real DB queries |
| `frontend/src/store/useAppStore.ts` | Replay slice: replayMode, replayTs, replaySpeedMultiplier, replayWindowStart, replayWindowEnd | VERIFIED | Lines 54-64 interface + lines 111-120 implementation; all setters typed |
| `frontend/src/components/AircraftLayer.tsx` | Playback interpolation effect; live lerp unchanged | VERIFIED | Lines 265-288 additive useEffect; live rAF lerp at lines 197-215 untouched |
| `frontend/src/components/MilitaryAircraftLayer.tsx` | Playback interpolation effect; live poll unchanged | VERIFIED | Lines 93-116 additive useEffect; live data update effect at lines 57-84 untouched |
| `frontend/src/components/ShipLayer.tsx` | Playback interpolation effect; ships have no live lerp | VERIFIED | Lines 97-120 additive useEffect; live direct-update effect at lines 58-88 untouched |
| `frontend/src/App.tsx` | PlaybackBar mounted outside cleanUI gate | VERIFIED | Line 61: `<PlaybackBar />` unconditionally rendered; cleanUI gate begins at line 64 |
| `frontend/src/store/__tests__/useAppStore.test.ts` | Replay slice test assertions | VERIFIED | 28 tests total including replay describe block; all GREEN |
| `frontend/src/components/__tests__/PlaybackBar.test.tsx` | PlaybackBar smoke tests | VERIFIED | 2 tests; both GREEN |
| `frontend/src/hooks/__tests__/useReplaySnapshots.test.ts` | findAdjacentSnapshots unit tests | VERIFIED | 4 tests; all GREEN |
| `backend/tests/test_replay.py` | Backend replay route tests including window route | VERIFIED | 4 tests total; all GREEN |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| backend/app/main.py | routes_replay.router | app.include_router(replay_router, prefix="/api/replay") | WIRED | Line 36 in main.py confirmed |
| PlaybackBar.tsx | useReplaySnapshots | import from '../hooks/useReplaySnapshots' | WIRED | Line 3 of PlaybackBar.tsx; called at line 47 |
| PlaybackBar.tsx rAF loop | useAppStore.getState().replayTs | Direct getState() call inside tick() | WIRED | Lines 71-72: destructures from getState() inside rAF callback |
| PlaybackBar.tsx event markers | OSINT_EVENTS | import from '../data/osintEvents' | WIRED | Line 4 import; used at line 188 |
| AircraftLayer.tsx | useReplaySnapshots + findAdjacentSnapshots | import from '../hooks/useReplaySnapshots' | WIRED | Line 17 import; hook call lines 73-78; function call line 276 |
| MilitaryAircraftLayer.tsx | useReplaySnapshots + findAdjacentSnapshots | import from '../hooks/useReplaySnapshots' | WIRED | Line 11 import; hook call lines 30-35; function call line 104 |
| ShipLayer.tsx | useReplaySnapshots + findAdjacentSnapshots | import from '../hooks/useReplaySnapshots' | WIRED | Line 11 import; hook call lines 30-35; function call line 108 |
| useAircraft.ts | useAppStore replayMode | refetchInterval conditional | WIRED | Line 17 selector; line 32 conditional |
| useMilitaryAircraft.ts | useAppStore replayMode | refetchInterval conditional | WIRED | Line 18 selector; line 33 conditional |
| useShips.ts | useAppStore replayMode | refetchInterval conditional | WIRED | Line 19 selector; line 34 conditional |
| App.tsx | PlaybackBar | import + unconditional mount | WIRED | Line 18 import; line 61 JSX render outside cleanUI gate |

---

### Requirements Coverage

| Requirement | Source Plans | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| REP-02 | 11-01, 11-02, 11-03, 11-04 | User can switch between LIVE and PLAYBACK modes via a toggle in the top bar | SATISFIED | PlaybackBar LIVE/PLAYBACK toggle wired to setReplayMode; polling hooks pause on 'playback'; human-verified |
| REP-03 | 11-01, 11-02, 11-03, 11-04 | User can scrub through a historical timeline with configurable speed controls (1m/s, 3m/s, 5m/s, 15m/s, 1h/s) | SATISFIED | Scrubber input calls setReplayTs; SPEED_PRESETS mapped to buttons; rAF loop advances replayTs at speedMultiplier rate; human-verified |
| REP-04 | 11-01, 11-03, 11-04 | User sees OSINT event markers on the timeline | SATISFIED (infrastructure) | EVENT_COLORS map and OSINT_EVENTS.map() render loop implemented; OSINT_EVENTS is intentionally empty in Phase 11 (Phase 12 will populate from DB) — the infrastructure satisfies REP-04's structural requirement; human-verified (zero markers, no crash) |

**Note on REP-04:** The REQUIREMENTS.md marks REP-04 as Complete for Phase 11. The implementation delivers the full event marker infrastructure (OsintEvent interface, EVENT_COLORS, OSINT_EVENTS array, render loop with data-event-id attributes and onClick handlers). The seed array is empty per design spec — populated data is Phase 12 scope. This is the intended Phase 11 contract.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `frontend/src/components/GpsJammingLayer.tsx` | 31, 45, 61 | viewer.entities / EntityCollection API usage (flagged by SatelliteLayer Pitfall 1 static audit) | Warning | Pre-existing issue predating Phase 11; tracked in deferred-items.md; causes 1/73 test to fail in full suite but does not affect replay engine functionality |

No anti-patterns found in Phase 11 authored files (useReplaySnapshots.ts, osintEvents.ts, PlaybackBar.tsx, routes_replay.py, useAppStore.ts replay slice, AircraftLayer.tsx, MilitaryAircraftLayer.tsx, ShipLayer.tsx, App.tsx).

---

### Test Suite Results

**Frontend — replay-specific (3 files, 34 tests):** ALL PASSED
- `src/store/__tests__/useAppStore.test.ts`: 28 tests GREEN (includes 10 replay slice tests)
- `src/hooks/__tests__/useReplaySnapshots.test.ts`: 4 tests GREEN (findAdjacentSnapshots all 4 cases)
- `src/components/__tests__/PlaybackBar.test.tsx`: 2 tests GREEN (live mode, playback mode)

**Frontend — full suite (14 files, 73 tests):** 72 passed, 1 pre-existing failure
- Failure: `SatelliteLayer.cleanup.test.tsx` Pitfall 1 — GpsJammingLayer.tsx uses viewer.entities API
- This failure predates Phase 11, is tracked in deferred-items.md, and is not caused by any Phase 11 file
- All 13 other test files pass

**Backend — replay tests (1 file, 4 tests):** ALL PASSED
- `test_replay_route_exists`: GREEN
- `test_replay_layer_filter`: GREEN
- `test_replay_invalid_layer`: GREEN
- `test_replay_window_route`: GREEN

---

### Human Verification Required

The following behavior was verified by the human operator during Plan 04 Task 3 (checkpoint:human-verify gate):

#### 1. Full LIVE/PLAYBACK Toggle End-to-End

**Test:** Open globe at http://localhost:5173; click PLAYBACK button; observe entity freeze; if snapshot data available, click PLAY and scrub timeline; click LIVE to restore.

**Expected:** PLAYBACK button appears in top bar; clicking switches to playback mode freezing live entity polling; scrubber and speed presets appear; entity positions update to match replayTs when scrubbing; LIVE mode restores polling within one poll interval.

**Why human:** CesiumJS Cartesian3 position mutations and requestAnimationFrame behavior cannot be asserted in vitest. Visual inspection of entity movement and timing is required.

**Status: APPROVED** — Human operator confirmed all 7 verification steps in Plan 04 Task 3.

---

## Summary

Phase 11 goal is **fully achieved**. All 15 observable truths are verified in the codebase:

1. The backend replay window endpoint (`/api/replay/window`) exists, queries real data via SQLAlchemy MIN/MAX, and is mounted at the correct prefix.
2. The Zustand replay slice is fully typed and implemented with all five state fields and their setters.
3. All three live polling hooks conditionally pause on `replayMode === 'playback'`.
4. `useReplaySnapshots` and `findAdjacentSnapshots` are substantive implementations with correct binary search logic, tested across all 4 edge cases.
5. `PlaybackBar` is a complete component with LIVE/PLAYBACK toggle, rAF advancement loop using stale-closure-safe `getState()` reads, scrubber, speed presets, and event marker infrastructure.
6. All three layer components (AircraftLayer, MilitaryAircraftLayer, ShipLayer) have additive playback interpolation effects that do not modify the live rendering paths.
7. PlaybackBar is mounted unconditionally in App.tsx outside the cleanUI gate.
8. Human verification confirmed end-to-end replay behavior.

The one failing test in the full suite (`SatelliteLayer.cleanup.test.tsx` Pitfall 1) is a pre-existing regression in `GpsJammingLayer.tsx` that predates Phase 11 and is tracked in `deferred-items.md`.

---

_Verified: 2026-03-12T16:21:00Z_
_Verifier: Claude (gsd-verifier)_
