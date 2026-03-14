---
phase: 35-frontend-layer
plan: 01
subsystem: ui
tags: [zustand, react, vitest, gdelt, testing]

# Dependency graph
requires:
  - phase: 34-backend-foundation
    provides: GDELT events API and database schema for frontend consumption
provides:
  - useAppStore GDELT slices (gdeltQuadClassFilter, toggleGdeltQuadClass, selectedGdeltEventId, gdeltOsintPrefill)
  - layers.gdelt boolean in store (default false)
  - Wave 0 test stubs defining contracts for GdeltLayer, useGdeltEvents, GdeltDetailPanel
affects:
  - 35-02-PLAN (useGdeltEvents hook implementation reads store slices)
  - 35-03-PLAN (GdeltLayer component reads layers.gdelt + gdeltQuadClassFilter)
  - 35-04-PLAN (GdeltDetailPanel reads selectedGdeltEventId + gdeltOsintPrefill)
  - 35-05-PLAN (PlaybackBar integration)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "toggleGdeltQuadClass uses spread append ([...existing, qc]) for add, filter() for remove — same pattern as toggleCategory"
    - "Wave 0 stubs: describe.skip for components not yet created, it.todo() for contract declaration"

key-files:
  created:
    - frontend/src/components/__tests__/GdeltLayer.test.tsx
    - frontend/src/hooks/__tests__/useGdeltEvents.test.ts
    - frontend/src/components/__tests__/GdeltDetailPanel.test.tsx
  modified:
    - frontend/src/store/useAppStore.ts
    - frontend/src/store/__tests__/useAppStore.test.ts

key-decisions:
  - "layers.gdelt defaults to false — GDELT layer starts hidden to avoid visual overload on initial load"
  - "gdeltQuadClassFilter lives in global store (not component local state) so filter persists across layer toggle/hide cycles"
  - "Wave 0 test stubs use describe.skip for GdeltLayer smoke test since GdeltLayer.tsx does not exist yet — avoids import errors while preserving contract declaration"
  - "Test casts use Record<string,unknown> pattern (consistent with existing test file) to avoid TypeScript inference issues in .setState() calls"

patterns-established:
  - "TDD RED→GREEN: failing tests committed before implementation in same logical unit"
  - "Wave 0 stub pattern: create test contracts before components exist using it.todo() and describe.skip()"

requirements-completed: [GDELT-06, GDELT-07]

# Metrics
duration: 8min
completed: 2026-03-14
---

# Phase 35 Plan 01: GDELT Store Foundation and Wave 0 Test Stubs Summary

**Zustand store extended with 7 GDELT slices (gdeltQuadClassFilter with toggle, selectedGdeltEventId, gdeltOsintPrefill, layers.gdelt) and three Wave 0 test stubs defining contracts for Plans 35-02 through 35-04**

## Performance

- **Duration:** 8 min
- **Started:** 2026-03-14T18:48:00Z
- **Completed:** 2026-03-14T18:56:00Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- Extended useAppStore with 7 new GDELT-specific fields and actions, all backed by 11 new tests (51 total, 0 failures)
- Added `gdelt: boolean` to `layers` object (default `false`) — setLayerVisible('gdelt', ...) works without new action
- Created three Wave 0 test stubs that declare contracts for GdeltLayer (GDELT-07), useGdeltEvents (GDELT-06/VPC-08), and GdeltDetailPanel (GDELT-08/09) for Plans 35-02, 35-03, 35-04 to fulfill
- Full test suite: 228 passed, 0 failed, 12 todos, 1 skip — no regressions

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend useAppStore with GDELT slices** - `42ebce7` (feat)
2. **Task 2: Create Wave 0 test stubs** - `4f6dc53` (test)

## Files Created/Modified

- `frontend/src/store/useAppStore.ts` — Added `gdelt: boolean` to layers; added 7 GDELT slice fields and implementations
- `frontend/src/store/__tests__/useAppStore.test.ts` — New `describe('useAppStore — GDELT slices')` block with 11 tests
- `frontend/src/components/__tests__/GdeltLayer.test.tsx` — Wave 0 stub: describe.skip smoke + 3 QuadClass filter todos
- `frontend/src/hooks/__tests__/useGdeltEvents.test.ts` — Wave 0 stub: 4 VPC-08 / refetchInterval contract todos
- `frontend/src/components/__tests__/GdeltDetailPanel.test.tsx` — Wave 0 stub: 4 render todos + 1 OSINT bridge todo

## Decisions Made

- `layers.gdelt` defaults to `false` — GDELT layer starts hidden to avoid visual overload on initial globe load
- `gdeltQuadClassFilter` lives in global Zustand store, not component local state — ensures filter persists when layer is hidden/shown
- GdeltLayer smoke test uses `describe.skip` (not dynamic import) since GdeltLayer.tsx does not exist yet; avoids import resolution errors while keeping the contract stub visible in the test file
- Used `Record<string, unknown>` casts in tests for consistency with existing test file patterns

## Deviations from Plan

**1. [Rule 1 - Bug] Fixed TypeScript syntax error in test — `typeof useAppStore.getState()['layers']` inside generic**

- **Found during:** Task 1 (RED phase — running tests)
- **Issue:** esbuild rejected `keyof typeof useAppStore.getState()['layers']` inside a generic parameter in the test; parser expects `)` but found `(`
- **Fix:** Replaced with `(useAppStore.getState().setLayerVisible as (layer: string, visible: boolean) => void)('gdelt', true)` — consistent with existing test file casting patterns
- **Files modified:** `frontend/src/store/__tests__/useAppStore.test.ts`
- **Verification:** Tests compile and pass (51 green)
- **Committed in:** `42ebce7` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 — inline TypeScript syntax error in test)
**Impact on plan:** Fix required for compilation; no behavior change. No scope creep.

## Issues Encountered

None beyond the auto-fixed TypeScript syntax deviation above.

## Next Phase Readiness

- Plan 35-02 (`useGdeltEvents` hook) can read `replayMode` and `viewportBbox` from store; its test stub (`useGdeltEvents.test.ts`) declares the VPC-08 contracts to fulfill
- Plan 35-03 (`GdeltLayer` component) can read `layers.gdelt` and `gdeltQuadClassFilter`; its stub declares QuadClass filter contracts
- Plan 35-04 (`GdeltDetailPanel`) can read `selectedGdeltEventId` and `gdeltOsintPrefill`; its stub declares render and OSINT bridge contracts
- TypeScript clean (`npx tsc --noEmit` — no errors)

## Self-Check: PASSED

- FOUND: `frontend/src/store/useAppStore.ts`
- FOUND: `frontend/src/store/__tests__/useAppStore.test.ts`
- FOUND: `frontend/src/components/__tests__/GdeltLayer.test.tsx`
- FOUND: `frontend/src/hooks/__tests__/useGdeltEvents.test.ts`
- FOUND: `frontend/src/components/__tests__/GdeltDetailPanel.test.tsx`
- FOUND: `.planning/phases/35-frontend-layer/35-01-SUMMARY.md`
- FOUND commit: `42ebce7` (feat: GDELT store slices)
- FOUND commit: `4f6dc53` (test: Wave 0 stubs)

---
*Phase: 35-frontend-layer*
*Completed: 2026-03-14*
