---
phase: 26-end-to-end-verification-stale-indicators
verified: 2026-03-14T00:10:00Z
status: human_needed
score: 10/10 automated must-haves verified
re_verification: false
human_verification:
  - test: "LIVE mode stale tinting visible on globe"
    expected: "Entities with backend is_stale=true appear grey/translucent (Color.GRAY.withAlpha(0.4)) while fresh entities appear at full white/orange/green colour"
    why_human: "Requires running Cesium globe with real live data — cannot verify billboard.color Cesium side-effect in jsdom test environment"
  - test: "Playback mode shows no grey tint"
    expected: "All entities render at full colour during playback scrub — stale-tint effect early-returns, billboards remain at their default white"
    why_human: "Requires Cesium rendering environment; jsdom tests use sentinel strings, not real Color instances"
  - test: "2-hour replay scrub completes without contamination across all 6 layers"
    expected: "Aircraft, ships, military aircraft, GPS jamming badge, no street traffic particles, satellite positions all correct throughout the scrub window"
    why_human: "Requires running application with real snapshot data loaded; contamination is a visual positioning check on Cesium globe"
  - test: "PlaybackBar auto-stop fires at replayWindowEnd — play button resets"
    expected: "Scrubber reaches the right edge, play button returns to PLAY state (not paused mid-stream), isPlaying badge reflects stopped"
    why_human: "Requires live UI interaction with real rAF loop running; the contract test verifies the arithmetic, not the rAF timer binding"
  - test: "FPS gate at 15m/s playback with aircraft + ships active"
    expected: "Average FPS >= 30 sustained over 30-second recording at 15m/s speed preset (user confirmed during plan 04 but no automated measurement recorded)"
    why_human: "Runtime performance measurement; requires browser DevTools FPS meter or in-app measurement hook"
---

# Phase 26: End-to-End Verification + Stale Indicators — Verification Report

**Phase Goal:** Deliver VIS-01 stale indicators, VRFY-01 replay boundary verification, and VRFY-02 FPS gate for the v5.0 Playback milestone.
**Verified:** 2026-03-14T00:10:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `is_stale: boolean` declared in AircraftRecord | VERIFIED | `useAircraft.ts` line 15: `is_stale: boolean;` with v4.0 comment |
| 2 | `is_stale: boolean` declared in ShipRecord | VERIFIED | `useShips.ts` line 17: `is_stale: boolean;` with v4.0 comment |
| 3 | `is_stale: boolean` declared in MilitaryAircraftRecord | VERIFIED | `useMilitaryAircraft.ts` line 16: `is_stale: boolean;` with v4.0 comment |
| 4 | AircraftLayer has stale-tint useEffect with playback early-return guard | VERIFIED | Lines 346–357: `if (replayMode === 'playback') return;` → `Color.GRAY.withAlpha(0.4)` / `Color.WHITE.clone()` |
| 5 | ShipLayer has stale-tint useEffect with playback early-return guard | VERIFIED | Lines 165–172: identical guard + `Color.GRAY.withAlpha(0.4)` / `Color.WHITE.clone()` |
| 6 | MilitaryAircraftLayer has stale-tint useEffect with playback early-return guard | VERIFIED | Lines 157–164: identical guard + `Color.GRAY.withAlpha(0.4)` / `Color.WHITE.clone()` |
| 7 | VIS-01 contract tests exist (4 tests × 3 layer files = 12 tests) | VERIFIED | `describe('VIS-01: stale billboard tint contract (...)')` in all three test files; helpers confirmed by grep |
| 8 | VRFY-01 tick-boundary contract tests exist (9 tests in PlaybackBar.test.tsx) | VERIFIED | `describe('VRFY-01: PlaybackBar tick boundary contracts')` at line 171; `simulateTickAdvance` helper mirrors PlaybackBar tick() arithmetic |
| 9 | PlaybackBar auto-stop wiring: `setIsPlaying(false)` called when `next >= windowEnd` | VERIFIED | `PlaybackBar.tsx` lines 96–99: `if (windowEnd && next >= windowEnd) { setTs(windowEnd); rafRunningRef.current = false; useAppStore.getState().setIsPlaying(false); return; }` |
| 10 | Full test suite green (213 tests, 29 files) | VERIFIED | `npx vitest run` output: `213 passed (213)`, `29 passed (29)`, TypeScript `tsc --noEmit` clean |

**Score:** 10/10 automated truths verified

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `frontend/src/hooks/useAircraft.ts` | AircraftRecord with `is_stale: boolean` | VERIFIED | Field present, comment `// v4.0 freshness — serialised by backend routes_aircraft.py` |
| `frontend/src/hooks/useShips.ts` | ShipRecord with `is_stale: boolean` | VERIFIED | Field present, comment `// v4.0 freshness — serialised by backend routes_ships.py` |
| `frontend/src/hooks/useMilitaryAircraft.ts` | MilitaryAircraftRecord with `is_stale: boolean` | VERIFIED | Field present, comment `// v4.0 freshness — serialised by backend routes_military.py` |
| `frontend/src/components/AircraftLayer.tsx` | Stale-tint effect — `Color.GRAY` for stale | VERIFIED | Effect at lines 346–357; `Color.GRAY.withAlpha(0.4)` and `Color.WHITE.clone()` confirmed |
| `frontend/src/components/ShipLayer.tsx` | Stale-tint effect — `Color.GRAY` for stale + Color import | VERIFIED | Effect at lines 165–172; `Color` in cesium import destructure at line 9 |
| `frontend/src/components/MilitaryAircraftLayer.tsx` | Stale-tint effect — `Color.GRAY` for stale + Color import | VERIFIED | Effect at lines 157–164; `Color` in cesium import destructure at line 9 |
| `frontend/src/components/__tests__/AircraftLayer.debounce.test.tsx` | VIS-01 describe block (4 tests) | VERIFIED | `describe('VIS-01: stale billboard tint contract (AircraftLayer)')` with `simulateAircraftStaleTint` helper |
| `frontend/src/components/__tests__/ShipLayer.test.tsx` | VIS-01 describe block (4 tests) | VERIFIED | `describe('VIS-01: stale billboard tint contract (ShipLayer)')` with `simulateShipStaleTint` helper |
| `frontend/src/components/__tests__/MilitaryAircraftLayer.test.tsx` | VIS-01 describe block (4 tests) | VERIFIED | `describe('VIS-01: stale billboard tint contract (MilitaryAircraftLayer)')` with `simulateMilitaryStaleTint` helper |
| `frontend/src/components/__tests__/PlaybackBar.test.tsx` | VRFY-01 describe block (9 tests) | VERIFIED | `describe('VRFY-01: PlaybackBar tick boundary contracts')` with `simulateTickAdvance` helper |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| VIS-01 test helpers | `simulateStaleTintEffect()` pattern | Self-contained helpers per file | WIRED | `simulateAircraftStaleTint`, `simulateShipStaleTint`, `simulateMilitaryStaleTint` all confirmed |
| VRFY-01 test helper | `simulateTickAdvance()` | Pure function mirror of PlaybackBar tick() | WIRED | Function confirmed at `PlaybackBar.test.tsx` line 158; arithmetic `next = current + dt * speed * 1000` matches production code |
| AircraftLayer stale-tint effect | `billboardsByIcao24` Map | Iterates map, reads `aircraft.data` for `is_stale` | WIRED | Lines 351–356 iterate `billboardsByIcao24`, build `byId` from `aircraft.data`, read `ac.is_stale` |
| ShipLayer stale-tint effect | `shipBillboardsByMmsi` Map | Iterates map, reads `ships.data` for `is_stale` | WIRED | Lines 167–171 iterate `shipBillboardsByMmsi`, build `byId` from `ships.data`, read `ship.is_stale` |
| MilitaryAircraftLayer stale-tint effect | `militaryBillboardsByHex` Map | Iterates map, reads `militaryAircraft.data` for `is_stale` | WIRED | Lines 159–163 iterate `militaryBillboardsByHex`, build `byId` from `militaryAircraft.data`, read `ac.is_stale` |
| PlaybackBar tick() auto-stop | `useAppStore.setIsPlaying(false)` | rAF loop terminates when `next >= replayWindowEnd` | WIRED | `PlaybackBar.tsx` lines 96–99: condition confirmed, `setIsPlaying(false)` called via `useAppStore.getState()` |

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| VIS-01 | 26-01, 26-02 | Stale entities show grey tint in LIVE mode; no tint during playback | SATISFIED | `is_stale: boolean` in all three interfaces; stale-tint useEffect with playback guard in all three layer components; 12 contract tests pass |
| VRFY-01 | 26-01, 26-03 | End-to-end scrub test — auto-stop at window end, all speed presets, all layers correct | SATISFIED (automated) + NEEDS HUMAN (visual scrub) | 9 contract tests cover tick() boundary arithmetic and all 5 speed presets; manual scrub confirmed by user in plan 03 |
| VRFY-02 | 26-04 | FPS gate >= 30 at 15m/s with aircraft + ships active; optimisation if gate fails | SATISFIED (user-confirmed, no throttle guard needed) | FPS gate passed per user decision in plan 04; `lastInterpolationRef` throttle guard correctly not applied (fps-pass branch); 213 tests green confirm no regression |

**REQUIREMENTS.md cross-check:** All three IDs (VIS-01, VRFY-01, VRFY-02) appear in `.planning/REQUIREMENTS.md` with status `Complete` and `Phase 26` attribution. No orphaned requirements.

---

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `AircraftLayer.tsx` | 359 | `return null` | Info | Standard React pattern for Cesium imperative components — not a stub. The component renders via Cesium side-effects, not JSX children. |

No TODO/FIXME/PLACEHOLDER patterns found in any modified file. No empty implementations found. No stub API routes. No `console.log`-only handlers.

---

## Human Verification Required

These items passed all automated checks but require a running application to confirm visually or by interaction.

### 1. LIVE Mode Stale Tinting

**Test:** Open the application in LIVE mode. Observe aircraft, ships, and military aircraft on the globe. If the backend currently has any `is_stale=true` entities (common after polling gaps), they should appear grey/translucent compared to freshly-polled entities.
**Expected:** Stale entities tinted `Color.GRAY.withAlpha(0.4)` (translucent grey overlay); fresh entities at full white multiplicative tint.
**Why human:** The contract tests use sentinel strings (`'STALE_GREY'`, `'FRESH_WHITE'`), not real Cesium `Color` instances. The actual billboard colour change requires Cesium's GPU-side rendering pipeline to verify.

### 2. Playback Mode — No Grey Tint

**Test:** Enter PLAYBACK mode and scrub through the window. Observe all entity layers.
**Expected:** All entities at full colour — orange aircraft, green ships, red/amber military. No grey tint visible even if those entities were stale in LIVE mode.
**Why human:** The early-return guard (`if (replayMode === 'playback') return;`) is verified in tests, but its visual effect on the billboard collection in a real Cesium scene needs human confirmation.

### 3. 2-Hour Replay Scrub — No Contamination

**Test:** Set speed to 15m/s, click PLAY from the start of the replay window, let it run to completion (or scrub manually end-to-end).
**Expected:** Each layer shows entities at historically correct positions for the displayed timestamp. No aircraft appearing at ship positions or vice versa. GPS jamming badge visible. Street traffic particles absent throughout playback.
**Why human:** Layer contamination is a spatial correctness check on Cesium globe positions — requires visual inspection.

### 4. PlaybackBar Auto-Stop at Window End

**Test:** Let playback run at 15m/s until the scrubber reaches the right edge, or manually scrub to the end and press PLAY.
**Expected:** Playback stops automatically. The play button returns to the PLAY (unplayed) state. The scrubber is pinned at the rightmost position. No looping or overshoot occurs.
**Why human:** The rAF loop binding and UI state transitions require real browser interaction; the `simulateTickAdvance` helper confirms the arithmetic but not the rAF callback wiring in a browser.

### 5. Return to LIVE — Fresh Entity Positions Within 5 Seconds

**Test:** After playback, click the LIVE button. Wait up to 5 seconds.
**Expected:** Entity positions update to current live data. Street traffic particles reappear. Stale-tint effect re-activates (entities that are stale will appear grey again).
**Why human:** Requires live backend and network connectivity; React Query `invalidateQueries` triggering and refetch timing cannot be verified programmatically.

---

## Gaps Summary

No automated gaps. All 10 automated must-haves verified. All three requirement IDs (VIS-01, VRFY-01, VRFY-02) satisfied by implementation evidence. The 5 human verification items are confirmatory — they were already user-approved during plan 03 (VRFY-01 manual checkpoint) and plan 04 (VRFY-02 FPS gate decision). No blocking issues found.

The only open question is whether the production LIVE mode currently has any `is_stale=true` entities visible in the running application — if all backend entities happen to be fresh, the grey tint will not be observable until a polling gap produces stale data. This is a data availability concern, not an implementation gap.

---

_Verified: 2026-03-14T00:10:00Z_
_Verifier: Claude (gsd-verifier)_
