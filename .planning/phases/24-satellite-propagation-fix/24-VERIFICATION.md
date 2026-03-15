---
phase: 24-satellite-propagation-fix
verified: 2026-03-13T22:30:00Z
status: passed
score: 10/10 must-haves verified
re_verification: false
---

# Phase 24: Satellite Propagation Fix — Verification Report

**Phase Goal:** Satellites render at their historical orbital positions during playback and freeze completely when paused — the most visually prominent layer no longer contradicts the replay timestamp

**Verified:** 2026-03-13T22:30:00Z
**Status:** passed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | resolveTimestamp returns replayTs when replayMode=playback and isPlaying=true | VERIFIED | resolveTimestamp.test.ts line 17-19: asserts result === 1_000_000; resolveTimestamp.ts line 18 returns replayTs |
| 2 | resolveTimestamp returns null when replayMode=playback and isPlaying=false (pause guard) | VERIFIED | resolveTimestamp.test.ts line 10-13: asserts result toBeNull(); resolveTimestamp.ts line 17 returns null |
| 3 | resolveTimestamp returns Date.now() (live) when replayMode=live regardless of isPlaying | VERIFIED | resolveTimestamp.test.ts lines 30-50: 3 tests covering live/true, live/false, live with replayTs=0; resolveTimestamp.ts line 21 returns Date.now() |
| 4 | Propagating with historical timestamp produces a different satellite position than wall-clock | VERIFIED | propagation.test.ts PLAY-02 block lines 215-233: vector distance assertion > 1_000_000 m across 6-hour gap |
| 5 | Satellites render at historical orbital positions during playback | VERIFIED | SatelliteLayer.tsx loop lines 259-272: resolveTimestamp called via getState() on every rAF tick; result passed as payload.timestamp to PROPAGATE worker message |
| 6 | Satellite motion freezes instantly when isPlaying is false in playback mode | VERIFIED | SatelliteLayer.tsx lines 262-266: timestamp === null early-return skips postMessage; rAF kept alive for instant resume |
| 7 | Orbit ring is anchored to the replay timestamp at the moment of satellite selection | VERIFIED | SatelliteLayer.tsx Effect 2 lines 322-327: orbitTimestamp = rm === 'playback' ? rts : Date.now() passed in COMPUTE_ORBIT payload; replayTs excluded from deps (selection-time anchor) |
| 8 | Click-to-fly via SearchBar sends camera to the satellite's replay-timestamp position | VERIFIED | SearchBar.tsx lines 53-58: reads replayMode/replayTs via getState(); satTimestamp = srm === 'playback' ? srts : Date.now() included in GET_POSITION payload |
| 9 | Click-to-fly via globe click (satellite dot) sends camera to the satellite's replay-timestamp position | VERIFIED | SatelliteLayer.tsx Effect 2 lines 328-332: GET_POSITION dispatched alongside COMPUTE_ORBIT with orbitTimestamp; POSITION_RESULT handler line 172-177 calls flyToCartesian |
| 10 | Live mode is unchanged — satellites still move at 1 Hz using wall-clock time | VERIFIED | resolveTimestamp.ts line 21 returns Date.now() in live mode; COMPUTE_ORBIT/GET_POSITION handlers line 98/136 fall back to Date.now() when payload.timestamp is undefined |

**Score:** 10/10 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `frontend/src/lib/resolveTimestamp.ts` | Pure function: resolveTimestamp(replayMode, isPlaying, replayTs) -> number or null | VERIFIED | 22 lines; all three branches implemented; exports resolveTimestamp |
| `frontend/src/lib/__tests__/resolveTimestamp.test.ts` | Unit tests for all PLAY-02 timestamp-resolution branches | VERIFIED | 52 lines; 6 tests across 3 describe blocks; covers all four input combinations |
| `frontend/src/workers/__tests__/propagation.test.ts` | Extended with PLAY-02 describe block proving propagation differs across timestamps | VERIFIED | Lines 158-257; 4 tests; deterministic reference time; 1000 km distance threshold |
| `frontend/src/components/SatelliteLayer.tsx` | Loop reads replayMode/isPlaying/replayTs via getState(); Effect 2 sends timestamp in COMPUTE_ORBIT and GET_POSITION | VERIFIED | Import on line 21; loop lines 259-272; Effect 2 lines 313-334 |
| `frontend/src/workers/propagation.worker.ts` | COMPUTE_ORBIT uses payload.timestamp ?? Date.now(); GET_POSITION uses payload.timestamp ?? Date.now() | VERIFIED | ComputeOrbitMessage line 28; GetPositionMessage line 33; startMs line 98; now line 136 |
| `frontend/src/components/SearchBar.tsx` | GET_POSITION payload includes timestamp from store when in playback mode | VERIFIED | Lines 53-58; replayMode/replayTs read from getState(); conditional timestamp included |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `resolveTimestamp.ts` | `SatelliteLayer.tsx` (loop) | import + return value drives postMessage or early-return | WIRED | Line 21 import; line 261 call; line 262 null check; line 268 passes result as payload.timestamp |
| `resolveTimestamp.ts` | `SatelliteLayer.tsx` (Effect 2) | Not used directly — orbitTimestamp computed inline | N/A | Effect 2 reads getState() directly and applies same logic; resolveTimestamp not called here by design |
| SatelliteLayer Effect 2 | propagation.worker.ts COMPUTE_ORBIT handler | postMessage with timestamp: orbitTimestamp | WIRED | SatelliteLayer line 324-327 sends COMPUTE_ORBIT with timestamp; worker line 92-98 reads payload.timestamp |
| SatelliteLayer Effect 2 | propagation.worker.ts GET_POSITION handler | postMessage with timestamp: orbitTimestamp | WIRED | SatelliteLayer lines 329-332 send GET_POSITION with timestamp; worker line 130-136 reads payload.timestamp |
| SearchBar GET_POSITION dispatch | propagation.worker.ts GET_POSITION handler | postMessage with timestamp: srm === 'playback' ? srts : Date.now() | WIRED | SearchBar lines 53-58 confirmed; worker lines 129-150 confirmed |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| PLAY-02 | 24-01, 24-02 | Satellites propagate at replayTs during playback; propagation loop skips dispatch when isPlaying is false | SATISFIED | resolveTimestamp.ts implements pause guard and replayTs passthrough; SatelliteLayer loop wired to it; worker handlers accept payload.timestamp; all 178 tests passing |

No orphaned requirements — REQUIREMENTS.md maps PLAY-02 to Phase 24 only, and both plans claim it.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| SatelliteLayer.tsx | 426 | `return null` | Info | Normal React component render return — not a stub; component only renders DOM when tleStalenessWarning is true |
| SearchBar.tsx | 96 | `placeholder=...` | Info | HTML input placeholder attribute — not a code stub |

No blockers. No warnings.

---

### Human Verification Required

The following behaviors require visual inspection with the running application. All automated checks pass.

#### 1. Satellite position shift on scrub

**Test:** Enter playback mode. Scrub the timeline to 6 hours ago. Observe the satellite cluster positions on the globe.
**Expected:** Satellite dots visibly relocate to positions different from their current real-time layout. The cluster pattern should look noticeably different, not merely shifted slightly.
**Why human:** ECEF coordinate rendering accuracy against actual visual globe output cannot be verified by grep or unit test.

#### 2. Satellite motion freeze on pause

**Test:** While satellites are moving in playback mode (isPlaying=true), press pause.
**Expected:** All satellite dots stop moving instantly on the next rAF tick (~16ms). No further position updates should occur while paused.
**Why human:** rAF loop behaviour and visual freeze cannot be asserted in unit tests (no Cesium renderer in test environment).

#### 3. Orbit ring anchored to scrubber time

**Test:** Scrub to a historical time. Click on a satellite to select it.
**Expected:** The orbit ring that appears is anchored to the scrubber's timestamp, not wall-clock time. The ring should start at the satellite's historical position, not its current live position.
**Why human:** Orbit ring visual position requires rendering inspection; no test covers the visual anchor point.

#### 4. SearchBar fly-to historical position

**Test:** In playback mode with timeline scrubbed to 6 hours ago, type "ISS" in the search bar and select the ISS.
**Expected:** Camera flies to the ISS position at the historical replay timestamp, not its current real-time position.
**Why human:** flyToCartesian destination requires visual confirmation against expected historical position.

#### 5. Globe-click fly-to historical position

**Test:** In playback mode, click directly on a satellite dot on the globe.
**Expected:** Camera flies to that satellite's position at the replay timestamp. The fly-to destination should match the dot's visual position on the globe.
**Why human:** POSITION_RESULT → flyToCartesian path requires verifying the camera lands on the correct historical location.

---

### Gaps Summary

None. All automated truths verified. Phase goal achieved by automated evidence.

---

## Test Suite Results

```
Test Files  28 passed (28)
Tests       178 passed (178)
Duration    4.35s
```

All 6 phase commits verified in git history:
- `558d39b` — test(24-01): failing tests for resolveTimestamp and PLAY-02 propagation (RED)
- `ce015f0` — feat(24-01): implement resolveTimestamp pure function (GREEN)
- `dac0e11` — feat(24-02): patch SatelliteLayer loop pause guard + COMPUTE_ORBIT timestamp
- `3f5aa73` — feat(24-02): patch worker COMPUTE_ORBIT and GET_POSITION to accept payload timestamp
- `8aea022` — feat(24-02): patch SearchBar GET_POSITION to include replay timestamp
- `0f2b27e` — feat(24-02): patch SatelliteLayer Effect 2 — add GET_POSITION for globe click fly-to

---

_Verified: 2026-03-13T22:30:00Z_
_Verifier: Claude (gsd-verifier)_
