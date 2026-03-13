---
phase: 24-satellite-propagation-fix
plan: 02
subsystem: frontend/satellite-propagation
tags: [satellite, replay, propagation, playback, worker, timestamp]
dependency_graph:
  requires: [24-01]
  provides: [PLAY-02-implementation]
  affects: [SatelliteLayer, propagation.worker, SearchBar]
tech_stack:
  added: []
  patterns: [resolveTimestamp-pause-guard, payload-timestamp-fallback, globe-click-fly-to]
key_files:
  created: []
  modified:
    - frontend/src/components/SatelliteLayer.tsx
    - frontend/src/workers/propagation.worker.ts
    - frontend/src/components/SearchBar.tsx
    - frontend/src/components/__tests__/SearchBar.nullguard.test.tsx
decisions:
  - "orbitTimestamp read via getState() inside Effect 2 body — not in deps — so orbit anchors to selection moment, not latest scrub"
  - "GET_POSITION added to Effect 2 alongside COMPUTE_ORBIT — globe click fly-to path fixed without any change to AircraftLayer"
  - "SearchBar.nullguard.test.tsx: useAppStore.getState() mocked returning live defaults; assertion updated to payload: { norad, timestamp: any(Number) }"
metrics:
  duration: "~8 min"
  completed: "2026-03-13T19:27:41Z"
  tasks_completed: 4
  files_modified: 4
---

# Phase 24 Plan 02: Satellite Propagation Fix — Code Mutations Summary

Four targeted code mutations that wire the satellite propagation system to `replayTs`, making satellite positions replay-accurate and visually confirming the entire replay timestamp pipeline end-to-end.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Patch SatelliteLayer.tsx — loop pause guard + COMPUTE_ORBIT timestamp | dac0e11 | SatelliteLayer.tsx |
| 2 | Patch propagation.worker.ts — COMPUTE_ORBIT and GET_POSITION timestamp handlers | 3f5aa73 | propagation.worker.ts |
| 3 | Patch SearchBar.tsx — include replayTs in GET_POSITION dispatch | 8aea022 | SearchBar.tsx, SearchBar.nullguard.test.tsx |
| 4 | Patch SatelliteLayer.tsx Effect 2 — add GET_POSITION for globe click fly-to | 0f2b27e | SatelliteLayer.tsx |

## What Was Built

**Task 1 — SatelliteLayer loop + COMPUTE_ORBIT:**
- Added `import { resolveTimestamp } from '../lib/resolveTimestamp'`
- rAF loop now calls `resolveTimestamp(replayMode, isPlaying, replayTs)` via `getState()` on each tick
- `null` return: keeps rAF alive but skips `postMessage` — satellites freeze instantly when paused
- Non-null return: passed as `payload.timestamp` to `PROPAGATE`
- Effect 2 computes `orbitTimestamp = rm === 'playback' ? rts : Date.now()` and includes it in `COMPUTE_ORBIT` payload

**Task 2 — Worker handler upgrades:**
- `ComputeOrbitMessage.payload` gains `timestamp?: number`
- `GetPositionMessage.payload` gains `timestamp?: number`
- `COMPUTE_ORBIT` handler: `const startMs = timestamp ?? Date.now()` — orbit loop uses `startMs` instead of hardcoded `Date.now()`
- `GET_POSITION` handler: `const now = new Date(timestamp ?? Date.now())` — position computed at replay time

**Task 3 — SearchBar fly-to fix:**
- Reads `replayMode` and `replayTs` from `useAppStore.getState()` inside `handleSearch`
- `GET_POSITION` payload now includes `timestamp: srm === 'playback' ? srts : Date.now()`
- Search-triggered camera fly-to targets satellite's historical position in playback mode

**Task 4 — Globe click fly-to fix:**
- Effect 2 now dispatches `GET_POSITION` alongside `COMPUTE_ORBIT` when `selectedId` changes
- Uses the same `orbitTimestamp` computed in Task 1's Effect 2 edit
- `POSITION_RESULT` handler (already present) calls `flyToCartesian` — globe click fly-to now works historically

## Verification

Full vitest suite: **28 test files, 178 tests, all passing** — no regressions.

Visual confirmation criteria (manual, per 24-VALIDATION.md):
- Scrub to 6 hours ago → satellite cluster positions visibly shift from real-time layout
- Press pause → all satellite dots stop moving instantly
- Select satellite in playback → orbit ring anchored to scrubber time
- Search for satellite in playback → camera flies to historical position
- Click satellite dot on globe in playback → camera flies to historical position

## Deviations from Plan

**Auto-fixed: SearchBar.nullguard.test.tsx test assertion update**

The plan noted in Task 4's action that `SearchBar.nullguard.test.tsx` might need updating if it asserted the exact GET_POSITION payload shape. It did — the assertion `payload: { norad: 25544 }` was failing because Task 3 added `timestamp` to the payload.

Fix applied during Task 3 execution:
- Mocked `useAppStore.getState()` to return `{ replayMode: 'live', replayTs: 0 }`
- Updated assertion to `payload: { norad: 25544, timestamp: expect.any(Number) }`

This was anticipated in the plan spec and applied proactively to keep the suite green.

## Self-Check: PASSED

- FOUND: `.planning/phases/24-satellite-propagation-fix/24-02-SUMMARY.md`
- FOUND: commit `dac0e11` (Task 1)
- FOUND: commit `3f5aa73` (Task 2)
- FOUND: commit `8aea022` (Task 3)
- FOUND: commit `0f2b27e` (Task 4)
