---
phase: 36-replay-and-freshness
plan: 01
subsystem: ui
tags: [react, cesium, zustand, vitest, gdelt, replay, temporal-filter]

# Dependency graph
requires:
  - phase: 35-frontend-layer
    provides: GdeltLayer.tsx with Effect 1/2, useGdeltEvents hook, GdeltEvent interface
provides:
  - QUAD_CLASS_HEX canonical palette in gdeltColors.ts (shared by GdeltLayer and PlaybackBar)
  - useGdeltEvents since/until replay window params — single load per playback session
  - GdeltLayer Effect 3 — per-tick temporal visibility without entity rebuild
  - GEO STALE overlay at top:85px when source_is_stale=true
  - GDELT-10 test coverage (queryKey, since/until URL params, null guard, live unchanged)
  - GDELT-12 test coverage (stale indicator renders/absent)
affects:
  - 36-02 (PlaybackBar uses QUAD_CLASS_HEX from gdeltColors.ts for CSS dot colours)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Separate Effect 2 (entity rebuild on data) from Effect 3 (per-tick show update) — avoids entity churn on scrubber advance"
    - "tsMapRef/quadMapRef: O(1) Map lookup for temporal and quad-class visibility, keyed by String(global_event_id)"
    - "ConstantProperty wraps boolean show for CesiumJS compatibility when entity was initialised with plain boolean"
    - "QUAD_CLASS_HEX hex palette extracted to gdeltColors.ts; CesiumJS Color objects derived via Object.fromEntries"
    - "getShowValue() test helper: unwraps show from plain boolean or ConstantProperty.value for backward-compatible assertions"

key-files:
  created:
    - frontend/src/data/gdeltColors.ts
  modified:
    - frontend/src/hooks/useGdeltEvents.ts
    - frontend/src/components/GdeltLayer.tsx
    - frontend/src/hooks/__tests__/useGdeltEvents.test.ts
    - frontend/src/components/__tests__/GdeltLayer.test.tsx

key-decisions:
  - "queryKey excludes replayTs — only window bounds [since, until] are in the key; per-tick temporal is client-side only"
  - "String(global_event_id) key in tsMapRef/quadMapRef — guards against numeric ids in test fixtures vs string ids in production"
  - "ConstantProperty(bool) used in Effect 3 rather than plain boolean — CesiumJS tracks the property correctly after initial entity construction with a plain boolean show"
  - "getShowValue helper in test: unwraps plain boolean or ConstantProperty.value — GDELT-07 tests updated to use it after Effect 3 overwrites initial show"

patterns-established:
  - "Effect ordering: Effect 2 builds (O(n) work), Effect 3 updates show (O(n) walk, no CesiumJS entity allocation)"
  - "Stale indicator at top:85px — avoids collision with GpsJammingLayer GPS LIVE DATA overlay at top:60px"

requirements-completed: [GDELT-10, GDELT-12]

# Metrics
duration: 7min
completed: 2026-03-14
---

# Phase 36 Plan 01: Replay Window + Temporal Visibility Summary

**GDELT single-load replay via since/until window params, per-tick temporal entity show via Effect 3 with tsMapRef, and GEO STALE freshness indicator — all backed by 13 new passing tests**

## Performance

- **Duration:** 7 min
- **Started:** 2026-03-14T17:30:35Z
- **Completed:** 2026-03-14T17:37:09Z
- **Tasks:** 3
- **Files modified:** 5 (4 modified, 1 created)

## Accomplishments

- Extracted `QUAD_CLASS_HEX` to `gdeltColors.ts` as canonical hex palette shared by GdeltLayer and Plan 02 (PlaybackBar)
- Wired `useGdeltEvents` with `replayWindowStart`/`replayWindowEnd` → `since`/`until` URL params; queryKey now `['gdelt-events', bbox, since, until]` — `replayTs` never in queryKey
- Added Effect 3 to `GdeltLayer` with `tsMapRef`/`quadMapRef` for O(1) per-tick entity show update without entity rebuild; `ConstantProperty` wrapper for CesiumJS compatibility
- Added `GEO STALE` div at `top: 85px` when any event has `source_is_stale=true`
- Full test suite green: 257/257 across 34 files, including 8 new GDELT-10 tests and 5 new GDELT-12/temporal tests

## Task Commits

1. **Task 1: Extract gdeltColors.ts + modify useGdeltEvents for replay window** - `f40b0f5` (feat)
2. **Task 2: GdeltLayer Effect 3 temporal visibility + stale indicator** - `6df739c` (feat)
3. **Task 3: Full test suite smoke check** - `c690919` (test)

## Files Created/Modified

- `frontend/src/data/gdeltColors.ts` - Canonical QUAD_CLASS_HEX record `{1:'#3B82F6', 2:'#22C55E', 3:'#EAB308', 4:'#EF4444'}`
- `frontend/src/hooks/useGdeltEvents.ts` - Added replayWindowStart/End selectors; queryKey includes since/until; queryFn appends since/until params
- `frontend/src/components/GdeltLayer.tsx` - QUAD_CLASS_HEX import; tsMapRef/quadMapRef; Effect 3 temporal show; GEO STALE indicator
- `frontend/src/hooks/__tests__/useGdeltEvents.test.ts` - GDELT-10 test suite: Tests A-D covering queryKey shape, URL params, null guard, live unchanged
- `frontend/src/components/__tests__/GdeltLayer.test.tsx` - ConstantProperty in Cesium mock; entities.values getter; GDELT-10/12 tests; getShowValue helper; GDELT-07 updated for ConstantProperty shape

## Decisions Made

- `String(global_event_id)` key in `tsMapRef`/`quadMapRef` — the test fixture uses numeric IDs (`1001`, `1002`) but the interface declares `string`; Map key coercion prevents silent lookup failures where `Map.get('1002') !== Map.get(1002)`
- `ConstantProperty(bool)` in Effect 3 instead of plain boolean — CesiumJS PointGraphics `.show` property initialized as a plain boolean internally becomes a `ConstantProperty`; reassigning with `new ConstantProperty(val)` guarantees the property change is tracked correctly by the rendering engine
- GDELT-07 tests updated (not reverted) — Effect 3 deliberately overwrites the initial `show` from Effect 2; the test assertions reflect the post-Effect-3 final state, which is the authoritative answer for visibility

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed tsMapRef/quadMapRef key type mismatch**
- **Found during:** Task 2 (GREEN phase — tests passing live mode but not playback mode)
- **Issue:** `event.global_event_id` stored as a number key (`Map.set(1001, ...)`) from test fixtures; Effect 3 retrieved with string key (`Map.get('1001')`) → always `undefined` → `temporalOk = true` for all events
- **Fix:** `const evtKey = String(event.global_event_id)` in Effect 2 map population; both maps always use string keys
- **Files modified:** `frontend/src/components/GdeltLayer.tsx`
- **Verification:** Tests E, F, G all pass with correct true/false per temporal position
- **Committed in:** `6df739c` (Task 2 commit)

**2. [Rule 1 - Bug] Updated GDELT-07 tests to use getShowValue helper**
- **Found during:** Task 2 (GREEN phase — GDELT-07 tests broke after Effect 3 added)
- **Issue:** Effect 3 overwrites `entity.point.show` with `new ConstantProperty(bool)` even in live mode; existing GDELT-07 tests asserted plain boolean `=== false`/`=== true` and broke
- **Fix:** Added `getShowValue()` test helper that unwraps `.value` from ConstantProperty or returns plain boolean; updated GDELT-07 assertions to use it; switched from `mockEntitiesAdd.mock.calls` to `mockEntitiesList` for post-Effect-3 state
- **Files modified:** `frontend/src/components/__tests__/GdeltLayer.test.tsx`
- **Verification:** All 13 GdeltLayer tests pass
- **Committed in:** `6df739c` (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (both Rule 1 — Bug)
**Impact on plan:** Both fixes necessary for correct test coverage. No scope creep. Production behaviour unchanged (real GdeltEvent.global_event_id is always a string).

## Issues Encountered

- vi.mock hoisting constraint required careful placement of `mockEntitiesList` array inside the hoisted factory; the array is module-scope so closures inside the factory capture it by reference correctly

## Next Phase Readiness

- `QUAD_CLASS_HEX` is exported and ready for Plan 02 (PlaybackBar dot colouring)
- `useGdeltEvents` sends `since`/`until` — backend `/api/gdelt-events` handler must already accept them (Phase 34 implementation)
- Effect 3 is dependency-free of PlaybackBar — replay scrubber can wire `replayTs` from any source and entities update without layer reload

---
*Phase: 36-replay-and-freshness*
*Completed: 2026-03-14*
