---
phase: 23-store-foundation-viewer-clock
verified: 2026-03-13T22:00:00Z
status: passed
score: 11/11 must-haves verified
re_verification: false
---

# Phase 23: Store Foundation + Viewer Clock Verification Report

**Phase Goal:** Establish a shared Zustand store slice and a CesiumJS viewer clock hook so that all Phase 24–26 components can read playback state without prop-drilling, and so that CinematicHUD displays the correct replay timestamp.
**Verified:** 2026-03-13T22:00:00Z
**Status:** passed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| #  | Truth                                                                                      | Status     | Evidence                                                                                    |
|----|--------------------------------------------------------------------------------------------|------------|---------------------------------------------------------------------------------------------|
| 1  | `isPlaying` lives in `useAppStore`, not in `PlaybackBar` local state                      | VERIFIED   | `useAppStore.ts` lines 66-67 (interface) and 143-145 (impl); no `useState` for isPlaying in PlaybackBar |
| 2  | Any component that calls `useAppStore(s => s.isPlaying)` gets the same value              | VERIFIED   | Global Zustand store — all selectors share single source of truth; 4 isPlaying slice tests GREEN |
| 3  | `rAF tick` calls `useAppStore.getState().setIsPlaying(false)` at window end               | VERIFIED   | `PlaybackBar.tsx` line 98: `useAppStore.getState().setIsPlaying(false)` inside tick()       |
| 4  | `handleModeToggle` calls `useAppStore.getState().setIsPlaying(false)` when returning to LIVE | VERIFIED | `PlaybackBar.tsx` line 129: `useAppStore.getState().setIsPlaying(false)` in handleModeToggle |
| 5  | Globe day/night shading tracks `replayTs` via `postUpdate` listener                       | VERIFIED   | `useViewerClock.ts` lines 23-25: `postUpdate.addEventListener(handler)`, handler sets `viewer.clock.currentTime` |
| 6  | Clock sync happens inside the CesiumJS render frame, not after paint                      | VERIFIED   | `useViewerClock.ts` uses `viewer.scene.postUpdate.addEventListener` — fires inside render frame |
| 7  | In LIVE mode, `viewer.clock.currentTime` is NOT overridden                                | VERIFIED   | `useViewerClock.ts` line 20: `if (replayMode !== 'playback') return;` guards the set; test GREEN |
| 8  | No DeveloperError on unmount during CesiumJS destroy lifecycle                            | VERIFIED   | `useViewerClock.ts` lines 24-28: `if (!viewer.isDestroyed())` guard before removeEventListener; test GREEN |
| 9  | CinematicHUD shows `REPLAY` + ISO timestamp when `replayMode` is `playback`               | VERIFIED   | `CinematicHUD.tsx` lines 177-182: conditional renders REPLAY + ISO string; 3 tests GREEN    |
| 10 | CinematicHUD shows pulsing `REC` dot + live UTC clock when `replayMode` is `live`         | VERIFIED   | `CinematicHUD.tsx` lines 169-176: live branch unchanged; test GREEN                         |
| 11 | Play button disabled with "Loading snapshots..." while snapshot fetch in progress          | VERIFIED   | `PlaybackBar.tsx` lines 178, 190: `disabled={!hasWindow || snapshotsLoading}` and label; 2 tests GREEN |

**Score:** 11/11 truths verified

---

### Required Artifacts

| Artifact                                                            | Expected                                         | Status     | Details                                                                           |
|---------------------------------------------------------------------|--------------------------------------------------|------------|-----------------------------------------------------------------------------------|
| `frontend/src/store/useAppStore.ts`                                 | `isPlaying: boolean, setIsPlaying action`        | VERIFIED   | Interface line 66-67, impl lines 143-145; defaults false; accepts bool or fn updater |
| `frontend/src/hooks/useViewerClock.ts`                              | `useViewerClock(viewer)` hook                    | VERIFIED   | 31 lines; exports `useViewerClock`; postUpdate pattern; isDestroyed guard         |
| `frontend/src/App.tsx`                                              | `useViewerClock(cesiumViewer)` mounted at root   | VERIFIED   | Line 22: import; line 36: `useViewerClock(cesiumViewer)` call                     |
| `frontend/src/components/CinematicHUD.tsx`                          | Conditional REC/REPLAY render based on replayMode | VERIFIED  | Lines 35-39: per-selector reads; lines 169-183: conditional block                 |
| `frontend/src/components/PlaybackBar.tsx`                           | `snapshotsLoading` gate on play button           | VERIFIED   | Lines 66-68: destructures `isLoading as snapshotsLoading`; lines 178, 190: gated  |
| `frontend/src/store/__tests__/useAppStore.test.ts`                  | isPlaying slice describe block                   | VERIFIED   | Lines 242-269: 4 tests, all GREEN                                                  |
| `frontend/src/hooks/__tests__/useViewerClock.test.ts`               | PLAY-03 test scaffold                            | VERIFIED   | 6 tests, all GREEN; postUpdate, live/playback mode, cleanup with isDestroyed guard |
| `frontend/src/components/__tests__/CinematicHUD.test.tsx`           | VIS-02 test scaffold                             | VERIFIED   | 4 tests, all GREEN; live REC, playback REPLAY, ISO timestamp, no REC in playback  |
| `frontend/src/components/__tests__/PlaybackBar.test.tsx`            | isPlaying + snapshotsLoading mock fields         | VERIFIED   | mockState includes `isPlaying: false` and `setIsPlaying: vi.fn()`; loading gate tests present |
| `frontend/src/components/__tests__/PlaybackBar.category.test.tsx`   | isPlaying mock field                             | VERIFIED   | mockState includes `isPlaying: false` and `setIsPlaying: vi.fn()`                 |

---

### Key Link Verification

| From                                        | To                                         | Via                                       | Status  | Details                                                                      |
|---------------------------------------------|--------------------------------------------|-------------------------------------------|---------|------------------------------------------------------------------------------|
| `PlaybackBar.tsx`                           | `useAppStore.ts` isPlaying slice           | `useAppStore(s => s.isPlaying)` line 36   | WIRED   | Selector present; no useState for isPlaying in file                          |
| `PlaybackBar.tsx` rAF tick                  | `useAppStore.getState().setIsPlaying`      | `getState()` call inside tick() line 98   | WIRED   | Stale-closure-safe pattern confirmed                                          |
| `PlaybackBar.tsx` handleModeToggle          | `useAppStore.getState().setIsPlaying`      | `getState()` call line 129                | WIRED   | Confirmed present                                                             |
| `useViewerClock.ts`                         | `viewer.scene.postUpdate`                  | `addEventListener` in useEffect line 23   | WIRED   | Pattern: `postUpdate.addEventListener(handler)`                               |
| `useViewerClock.ts`                         | `useAppStore.getState()`                   | Direct getState() call inside handler line 19 | WIRED | No stale closure; reads store inline each frame                              |
| `App.tsx`                                   | `useViewerClock.ts`                        | `useViewerClock(cesiumViewer)` line 36    | WIRED   | Import on line 22, call on line 36 — before return statement                 |
| `CinematicHUD.tsx` REC block               | `useAppStore` replayMode selector          | `useAppStore(s => s.replayMode)` line 38  | WIRED   | Per-selector pattern; conditional render on line 169                         |
| `PlaybackBar.tsx` play button               | `useReplaySnapshots` isLoading             | `disabled={!hasWindow || snapshotsLoading}` line 178 | WIRED | Return value destructured (not discarded); gate applied                    |

---

### Requirements Coverage

| Requirement | Source Plan | Description                                                                          | Status    | Evidence                                                                  |
|-------------|-------------|--------------------------------------------------------------------------------------|-----------|---------------------------------------------------------------------------|
| PLAY-01     | 23-02       | `isPlaying` promoted from PlaybackBar local state to `useAppStore`                   | SATISFIED | `useAppStore.ts` lines 66-67, 143-145; PlaybackBar reads via selector; no useState |
| PLAY-03     | 23-03       | Globe day/night shading follows `replayTs` via `useViewerClock` hook                 | SATISFIED | `useViewerClock.ts` exists and is wired in App.tsx; 6 tests GREEN         |
| VIS-02      | 23-04       | CinematicHUD shows `REPLAY [ISO timestamp]` instead of `REC` in playback mode       | SATISFIED | CinematicHUD.tsx conditional block; 4 CinematicHUD tests GREEN            |
| VIS-03      | 23-04       | Play button disabled with "Loading snapshots…" while snapshot fetch in progress      | SATISFIED | `disabled={!hasWindow || snapshotsLoading}` + label; 2 loading gate tests GREEN |

REQUIREMENTS.md Traceability confirms all four IDs are exclusively mapped to Phase 23. No orphaned requirements found for this phase.

---

### Anti-Patterns Found

No anti-patterns detected in phase 23 files.

- No `TODO/FIXME/PLACEHOLDER` comments in implementation files
- No `return null` / `return {}` stub bodies
- No discarded API return values (`useReplaySnapshots` now destructured)
- `useState` not used for `isPlaying` in PlaybackBar (confirmed: grep returned no matches)
- `isPlaying` absent from `useSettingsStore.ts` (confirmed: grep returned no matches)
- `viewer.clock.shouldAnimate` not set (confirmed: absent from `useViewerClock.ts`)

---

### Human Verification Required

The following behavior cannot be verified programmatically:

#### 1. Globe Lighting Tracks Replay Scrubber

**Test:** In the running app, switch to PLAYBACK mode. Scrub the timeline to a timestamp at 00:00 UTC (midnight). Observe the globe.
**Expected:** The hemisphere facing away from the sun should visibly darken within the same render frame as the scrubber position — no visible lag between scrubber movement and globe lighting change.
**Why human:** CesiumJS postUpdate timing and rendering fidelity cannot be asserted by Vitest.

#### 2. REPLAY Timestamp Accuracy

**Test:** In PLAYBACK mode, note the ISO timestamp displayed in CinematicHUD top-left. Scrub to a specific position. Verify the HUD timestamp matches what PlaybackBar shows as `formattedTs`.
**Expected:** Both timestamps show the same value (within the same second).
**Why human:** Requires visual inspection of two DOM regions in a running browser.

#### 3. Play Button Loading State

**Test:** Clear any cached snapshot data, switch to PLAYBACK mode rapidly, and observe the play button.
**Expected:** Button reads "Loading snapshots..." and is non-clickable during the fetch, then transitions to "PLAY" when data is ready.
**Why human:** Network timing and loading states require a live browser with a connected backend.

---

### Commits Verified

All 9 commits referenced in plan summaries confirmed in git history:

| Commit    | Description                                                  |
|-----------|--------------------------------------------------------------|
| `6d48d21` | test(23-02): add failing tests for isPlaying slice           |
| `0c99e4f` | test(23-01): add isPlaying describe block + PlaybackBar mocks |
| `ee75cb9` | test(23-01): create useViewerClock.test.ts and CinematicHUD.test.tsx stubs |
| `5198889` | feat(23-02): add isPlaying slice to useAppStore              |
| `a7f8f0d` | feat(23-02): migrate PlaybackBar isPlaying from useState to useAppStore |
| `a4939c2` | feat(23-03): create useViewerClock hook for CesiumJS clock sync |
| `86d9af8` | feat(23-03): wire useViewerClock in App.tsx                  |
| `ba41d5b` | feat(23-04): update CinematicHUD with conditional REC/REPLAY block |
| `4f4a750` | feat(23-04): gate PlaybackBar play button with snapshot loading state |

---

### Test Suite Results (Live Run)

```
Test Files: 5 passed (5)
     Tests: 59 passed (59)
  Duration: 1.17s
```

Files and test counts:
- `useAppStore.test.ts` — 35 tests GREEN (includes 4 isPlaying slice tests)
- `useViewerClock.test.ts` — 6 tests GREEN
- `CinematicHUD.test.tsx` — 4 tests GREEN
- `PlaybackBar.test.tsx` — 5 tests GREEN (includes 2 new loading gate tests)
- `PlaybackBar.category.test.tsx` — 5 tests GREEN (no regressions)

---

### Gaps Summary

No gaps. All 11 observable truths verified. All 10 artifacts exist, are substantive, and are wired. All 8 key links confirmed. All 4 requirement IDs (PLAY-01, PLAY-03, VIS-02, VIS-03) satisfied with implementation evidence.

---

_Verified: 2026-03-13T22:00:00Z_
_Verifier: Claude (gsd-verifier)_
