---
phase: 25-layer-audit
plan: 04
subsystem: frontend-layers
tags: [playback-guard, street-traffic, query-invalidation, tdd, LAYR-04, PLAY-04]

# Dependency graph
requires:
  - phase: 25-layer-audit
    plan: 01
    provides: Shared queryClient at lib/queryClient.ts and RED test stubs for LAYR-04, PLAY-04

provides:
  - StreetTrafficLayer: replayModeRef + Effect 5 (hide/show) + animate() guard
  - useStreetTraffic: replayModeRef guard in handleMoveEnd (no road fetch in playback)
  - PlaybackBar: queryClient.invalidateQueries() call on return to LIVE

affects:
  - frontend/src/components/StreetTrafficLayer.tsx
  - frontend/src/hooks/useStreetTraffic.ts
  - frontend/src/components/PlaybackBar.tsx

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "replayModeRef pattern: useRef synced each render, read inside rAF body — avoids stale closure in requestAnimationFrame loop"
    - "Dual-effect visibility: Effect 4 handles layerVisible toggle, Effect 5 handles replayMode — both set show = layerVisible && replayMode !== 'playback'"
    - "vi.hoisted for mock values that must exist before vi.mock factory executes — fixes temporal dead zone for mocked module factories"

key-files:
  modified:
    - frontend/src/components/StreetTrafficLayer.tsx
    - frontend/src/hooks/useStreetTraffic.ts
    - frontend/src/components/PlaybackBar.tsx
    - frontend/src/components/__tests__/StreetTrafficLayer.test.tsx
    - frontend/src/components/__tests__/PlaybackBar.test.tsx

key-decisions:
  - "Effect 5 added alongside Effect 4 rather than merging — keeps layerVisible and replayMode concerns separate; both deps trigger independently"
  - "useAppStore.getState mock added to PlaybackBar test — handleModeToggle uses getState() for imperative calls; selector mock alone was insufficient"
  - "vi.hoisted used for mockInvalidateQueries to avoid temporal dead zone in vi.mock factory — factory is hoisted before const declarations"

# Metrics
duration: 5min
completed: 2026-03-13
---

# Phase 25 Plan 04: Street Traffic Playback Guard + LIVE Cache Flush Summary

**Street traffic particles hidden during playback via replayModeRef + Effect 5, rAF loop frozen, road fetch debounce blocked; queryClient.invalidateQueries() wired into PlaybackBar return-to-LIVE path — LAYR-04 and PLAY-04 turn GREEN; full 192-test suite passes**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-03-13T20:08:59Z
- **Completed:** 2026-03-13T20:13:52Z
- **Tasks:** 2
- **Files modified:** 5 (3 production, 2 test)

## Accomplishments

- Added `replayMode` selector and `replayModeRef` to `StreetTrafficLayer.tsx`; added animate() early return guard when `replayModeRef.current === 'playback'`; added Effect 5 setting `p.primitive.show = layerVisible && replayMode !== 'playback'`
- Added `useAppStore` import and `replayModeRef` to `useStreetTraffic.ts`; added early return in `handleMoveEnd` when `replayModeRef.current === 'playback'` — road fetches suppressed during playback
- Added `queryClient` import and `queryClient.invalidateQueries()` call in `PlaybackBar.tsx handleModeToggle` LIVE branch
- Fixed `PlaybackBar.test.tsx`: added `getState()` to `useAppStore` mock for imperative calls; moved `vi.mock('../../lib/queryClient')` before component import; used `vi.hoisted` for `mockInvalidateQueries`
- Updated `StreetTrafficLayer.test.tsx` contract helper to include `replayMode !== 'playback'` guard

## Task Commits

1. **Task 1: Hide street traffic particles and freeze debounce in playback (LAYR-04)** — `53af3f5`
2. **Task 2: Call invalidateQueries on return to LIVE (PLAY-04)** — `22a9ccb`

## Files Created/Modified

- `frontend/src/components/StreetTrafficLayer.tsx` — replayMode selector, replayModeRef, animate() guard, Effect 5
- `frontend/src/hooks/useStreetTraffic.ts` — useAppStore import, replayModeRef, handleMoveEnd playback guard
- `frontend/src/components/PlaybackBar.tsx` — queryClient import, invalidateQueries() call in LIVE branch
- `frontend/src/components/__tests__/StreetTrafficLayer.test.tsx` — updated contract helper to use guarded logic
- `frontend/src/components/__tests__/PlaybackBar.test.tsx` — vi.hoisted for mockInvalidateQueries, getState() on mock, vi.mock ordering fixed

## Decisions Made

- Effect 5 added as a new effect rather than modifying Effect 4 — keeps layerVisible and replayMode change handling separate and explicitly reactive to each dep independently
- `replayModeRef` used (not direct replayMode in deps) inside animate() rAF body — ref pattern prevents stale closure across effect re-creations
- `invalidateQueries()` with no filter is safe — snapshot queries have `enabled: false` in LIVE mode and will not re-fetch (documented in RESEARCH.md open question 2)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] vi.mock hoisting failure for mockInvalidateQueries in PlaybackBar.test.tsx**
- **Found during:** Task 2 verification
- **Issue:** `const mockInvalidateQueries = vi.fn()` declared at module scope after `vi.mock` factory — Vitest hoists `vi.mock` calls before module code, causing "Cannot access 'mockInvalidateQueries' before initialization" error
- **Fix:** Used `vi.hoisted(() => vi.fn())` to create the mock before hoisting, and moved `vi.mock('../../lib/queryClient')` before the component import
- **Files modified:** `frontend/src/components/__tests__/PlaybackBar.test.tsx`
- **Commit:** `22a9ccb`

**2. [Rule 1 - Bug] Missing getState() on useAppStore mock in PlaybackBar.test.tsx**
- **Found during:** Task 2 verification (same test run as above)
- **Issue:** `handleModeToggle` calls `useAppStore.getState().setIsPlaying(false)` imperatively; mock only provided the selector hook function, not `.getState()` — threw `TypeError: useAppStore.getState is not a function`
- **Fix:** Added plain `getState = () => mockState` to the `mockUseAppStore` function; restructured mock as a named function with `.getState` property
- **Files modified:** `frontend/src/components/__tests__/PlaybackBar.test.tsx`
- **Commit:** `22a9ccb`

## Issues Encountered

None beyond the auto-fixed test infrastructure bugs above.

## User Setup Required

None.

## Next Phase Readiness

- All five Phase 25 test blocks (LAYR-01 through LAYR-04, PLAY-04) are GREEN
- Phase 25 complete — all four plans executed
- Phase 26 (End-to-End Verification + Stale Indicators) ready to start

---
*Phase: 25-layer-audit*
*Completed: 2026-03-13*

## Self-Check: PASSED
