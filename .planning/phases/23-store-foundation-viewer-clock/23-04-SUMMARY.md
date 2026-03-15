---
phase: 23-store-foundation-viewer-clock
plan: "04"
subsystem: frontend-ui
tags: [cinematic-hud, playback-bar, replay-mode, tdd, loading-state]
dependency_graph:
  requires: [23-02]
  provides: [VIS-02, VIS-03]
  affects: [CinematicHUD, PlaybackBar]
tech_stack:
  added: []
  patterns: [zustand-per-selector, snapshot-loading-gate, conditional-render]
key_files:
  created: []
  modified:
    - frontend/src/components/CinematicHUD.tsx
    - frontend/src/components/PlaybackBar.tsx
    - frontend/src/components/__tests__/PlaybackBar.test.tsx
decisions:
  - Per-selector useAppStore calls in CinematicHUD to avoid re-renders on unrelated store changes
  - snapshotsLoading alias isolates isLoading from useReplaySnapshots to avoid future naming collisions
metrics:
  duration: ~3 min
  completed_date: "2026-03-13"
  tasks_completed: 2
  files_modified: 3
---

# Phase 23 Plan 04: CinematicHUD REPLAY mode + PlaybackBar loading gate Summary

CinematicHUD conditionally renders REPLAY + ISO timestamp in playback mode (vs pulsing REC dot + live clock in live mode); PlaybackBar play button gated by snapshotsLoading from useReplaySnapshots so operators cannot play with empty snapshot data.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Update CinematicHUD conditional REC/REPLAY block | ba41d5b | `CinematicHUD.tsx` |
| 2 | Gate PlaybackBar play button with snapshot loading state | 4f4a750 | `PlaybackBar.tsx`, `PlaybackBar.test.tsx` |

## Implementation Details

### Task 1: CinematicHUD conditional REC/REPLAY block

Changed `useAppStore` destructuring from object pattern to individual per-selector calls (adds `replayMode` and `replayTs`). Replaced static REC block with a conditional:

- `replayMode === 'live'`: pulsing dot + REC + live UTC clock (unchanged behavior)
- `replayMode === 'playback'`: REPLAY text + `new Date(replayTs).toISOString().slice(0, 19) + 'Z'` — no pulsing dot

The `setInterval` UTC clock remains active regardless of mode (only rendered in live branch).

### Task 2: PlaybackBar snapshot loading gate

Changed `useReplaySnapshots(...)` call (previously discarding return value) to `const { isLoading: snapshotsLoading } = useReplaySnapshots(...)`. Updated play/pause button:

- `disabled={!hasWindow || snapshotsLoading}`
- `cursor: (hasWindow && !snapshotsLoading) ? 'pointer' : 'not-allowed'`
- Label: `snapshotsLoading ? 'Loading snapshots...' : isPlaying ? 'PAUSE' : 'PLAY'`

Added two new TDD tests for the loading gate behavior.

## Verification

Full test suite: 168 tests / 27 files — all GREEN, zero regressions.

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check

- [x] `frontend/src/components/CinematicHUD.tsx` modified
- [x] `frontend/src/components/PlaybackBar.tsx` modified
- [x] `frontend/src/components/__tests__/PlaybackBar.test.tsx` modified
- [x] Commit `ba41d5b` exists
- [x] Commit `4f4a750` exists
- [x] 168 tests GREEN

## Self-Check: PASSED
