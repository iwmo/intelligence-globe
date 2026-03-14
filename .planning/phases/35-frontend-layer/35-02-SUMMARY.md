---
phase: 35-frontend-layer
plan: 02
subsystem: ui
tags: [react-query, zustand, typescript, gdelt, hooks, vitest]

# Dependency graph
requires:
  - phase: 35-01
    provides: useAppStore GDELT slices (replayMode, viewportBbox, gdeltQuadClassFilter) and Wave 0 test stubs
  - phase: 34-backend-foundation
    provides: /api/gdelt-events endpoint returning GdeltEvent[] array
provides:
  - useGdeltEvents React Query hook with VPC-08 bbox-suppression
  - GdeltEvent TypeScript interface exported for GdeltLayer and GdeltDetailPanel
  - 4 passing contract tests for effectiveBbox and refetchInterval behaviour
affects:
  - 35-03 (GdeltLayer consumes useGdeltEvents and GdeltEvent)
  - 35-04 (GdeltDetailPanel consumes GdeltEvent type)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - VPC-08: effectiveBbox = replayMode === 'live' ? viewportBbox : null
    - TDD red-green: test stubs written and confirmed failing before hook created
    - useQuery called directly in test (not renderHook) after mocking useAppStore — avoids React test renderer overhead

key-files:
  created:
    - frontend/src/hooks/useGdeltEvents.ts
    - frontend/src/hooks/__tests__/useGdeltEvents.test.ts (replaced todo stubs with implementations)
  modified: []

key-decisions:
  - "useGdeltEvents tests call the hook function directly (not renderHook) — useQuery is fully mocked so React context is not required"
  - "staleTime matches refetchInterval at 900_000 (15 min) — GDELT 15-min update cadence makes these equivalent"

patterns-established:
  - "VPC-08 bbox-suppression: effectiveBbox is null in playback, equals viewportBbox in live — same pattern as useMilitaryAircraft"
  - "queryKey includes effectiveBbox so viewport pan triggers refetch without manual invalidation"
  - "AbortController with 30s timeout on all data-fetch hooks"

requirements-completed: [GDELT-05, GDELT-06]

# Metrics
duration: 5min
completed: 2026-03-14
---

# Phase 35 Plan 02: useGdeltEvents Hook Summary

**React Query hook with VPC-08 bbox-suppression (effectiveBbox null in playback, live bbox in live mode) and 15-minute refetch interval — GdeltEvent interface exported for consumption by Plans 03 and 04**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-14T18:53:00Z
- **Completed:** 2026-03-14T18:58:00Z
- **Tasks:** 1 (TDD: RED → GREEN)
- **Files modified:** 2

## Accomplishments

- Created `useGdeltEvents.ts` following the `useMilitaryAircraft` template exactly — VPC-08 pattern, AbortController timeout, retry/retryDelay
- Exported `GdeltEvent` TypeScript interface with all 14 fields confirmed from routes_gdelt.py
- Replaced 4 `it.todo()` stubs with concrete contract tests covering both effectiveBbox and refetchInterval contracts
- All 4 contract tests green; zero TypeScript errors

## Task Commits

1. **Task 1: Create useGdeltEvents hook (TDD RED → GREEN)** - `d31e274` (feat)

## Files Created/Modified

- `frontend/src/hooks/useGdeltEvents.ts` — useGdeltEvents hook + GdeltEvent interface
- `frontend/src/hooks/__tests__/useGdeltEvents.test.ts` — 4 contract tests replacing Wave 0 todo stubs

## Decisions Made

- Tests call `useGdeltEvents()` directly without `renderHook` — since `useQuery` and `useAppStore` are both fully mocked, React context is not needed; this avoids test renderer setup overhead
- `staleTime` set to `900_000` to match `refetchInterval` — aligns with GDELT 15-minute update cadence

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- `useGdeltEvents` and `GdeltEvent` are ready for import in Plan 35-03 (GdeltLayer) and Plan 35-04 (GdeltDetailPanel)
- No blockers

---
*Phase: 35-frontend-layer*
*Completed: 2026-03-14*
