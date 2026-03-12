---
phase: 07-visual-engine-navigation
plan: 01
subsystem: ui
tags: [zustand, vitest, typescript, react, cesiumjs, visual-engine]

# Dependency graph
requires: []
provides:
  - "Extended Zustand store with VisualPreset type union and postProcessUniforms interface"
  - "cleanUI boolean slice for conditional rendering"
  - "Wave 0 test stub files for PostProcessEngine, MGRSReadout, landmarks, and useKeyboardShortcuts"
affects:
  - 07-02-PostProcessEngine
  - 07-03-CinematicHUD
  - 07-04-LandmarkNavigation
  - 07-05-KeyboardShortcuts

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Interface-first ordering: store slices defined before component implementations"
    - "Wave 0 test stubs: vi.mock prevents static import resolution of non-existent modules"
    - "Export types from store (VisualPreset, PostProcessUniforms) for downstream import without re-declaration"

key-files:
  created:
    - frontend/src/components/__tests__/PostProcessEngine.test.tsx
    - frontend/src/components/__tests__/MGRSReadout.test.ts
    - frontend/src/data/__tests__/landmarks.test.ts
    - frontend/src/hooks/__tests__/useKeyboardShortcuts.test.ts
  modified:
    - frontend/src/store/useAppStore.ts
    - frontend/src/store/__tests__/useAppStore.test.ts

key-decisions:
  - "Use vi.mock at top of each stub file (no static import of non-existent module) — Vite's import analysis fails on static imports of absent files even with vi.mock hoisting"
  - "Export VisualPreset and PostProcessUniforms types from useAppStore.ts to prevent re-declaration in downstream components"
  - "postProcessUniforms setter merges (spread pattern) rather than replacing to support partial uniform updates from individual UI sliders"

patterns-established:
  - "Wave 0 stub pattern: vi.mock + describe + it.todo + one concrete passing test — file is runnable before implementation"
  - "Store slice reset in beforeEach: all new slices added to setState reset block to prevent test pollution"

requirements-completed: [VIS-01, VIS-02, VIS-03, VIS-04, NAV-02, NAV-03]

# Metrics
duration: 8min
completed: 2026-03-11
---

# Phase 7 Plan 01: Store Extension + Wave 0 Test Stubs Summary

**Zustand store extended with VisualPreset/PostProcessUniforms/cleanUI slices, plus four Wave 0 vi.mock test stub files enabling interface-first ordering for all Phase 7 component implementations**

## Performance

- **Duration:** 8 min
- **Started:** 2026-03-11T23:00:00Z
- **Completed:** 2026-03-11T23:08:00Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Added `VisualPreset` type union (`'normal' | 'nvg' | 'crt' | 'flir' | 'noir'`) and `PostProcessUniforms` interface exported from store
- Extended `useAppStore` with three new slices: `visualPreset`, `postProcessUniforms`, `cleanUI` — all with correct defaults and setters
- Created four Wave 0 test stub files that run cleanly under vitest with zero failures (14 todos, 4 concrete passing tests)
- Full test suite remains green: 8 files, 40 tests, 0 failures

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend useAppStore with visual engine and clean UI slices** - `1de8cd3` (feat, TDD)
2. **Task 2: Create Wave 0 test stub files for PostProcessEngine, MGRSReadout, landmarks, and keyboard shortcuts** - `85d3960` (feat)

## Files Created/Modified
- `frontend/src/store/useAppStore.ts` - Added VisualPreset/PostProcessUniforms types and three new slices with setters
- `frontend/src/store/__tests__/useAppStore.test.ts` - Added visual engine and clean UI test describe block (7 new tests)
- `frontend/src/components/__tests__/PostProcessEngine.test.tsx` - Wave 0 stubs for VIS-01/VIS-02 (4 todos)
- `frontend/src/components/__tests__/MGRSReadout.test.ts` - Wave 0 stubs for VIS-03 MGRS conversion (3 todos)
- `frontend/src/data/__tests__/landmarks.test.ts` - Wave 0 stubs for NAV-02 landmarks schema (3 todos)
- `frontend/src/hooks/__tests__/useKeyboardShortcuts.test.ts` - Wave 0 stubs for NAV-03 keyboard dispatch (4 todos)

## Decisions Made
- Used `vi.mock` at the top of each stub file without a corresponding static import — Vite's import analysis resolves static imports before vi.mock hoisting takes effect, causing build failures for non-existent modules. The mock alone is sufficient for stubs.
- Exported `VisualPreset` and `PostProcessUniforms` as named types from `useAppStore.ts` to give downstream components a single import source.
- `setPostProcessUniforms` uses spread merge pattern so individual slider components can update one uniform without overwriting others.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed static imports of non-existent modules from stub files**
- **Found during:** Task 2 (Wave 0 stub file creation)
- **Issue:** Plan specified using `vi.mock` with a static import. Vite's import analysis runs before vi.mock hoisting and fails on static imports of non-existent files (`../PostProcessEngine`, etc.)
- **Fix:** Removed the static import lines; `vi.mock` alone is sufficient for the stub pattern to work at runtime. The `module is importable` concrete test still passes.
- **Files modified:** All four stub files
- **Verification:** `npx vitest run` on all four files exits 0 with 4 passed, 14 todo
- **Committed in:** `85d3960` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - bug in plan's stub import pattern)
**Impact on plan:** Necessary fix. Static imports would prevent the stub files from running at all. No scope creep.

## Issues Encountered
- Vite import analysis phase fires before vi.mock hoisting, requiring removal of static imports pointing to non-existent modules. This is a known Vitest/Vite behavior when mocking modules that don't exist yet.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All Wave 1 dependencies satisfied: `useAppStore` exports `VisualPreset`, `PostProcessUniforms`, and all three slices with setters
- Wave 0 test stub files exist as verify targets for Plans 02-05
- Full test suite green — no regressions introduced
- Plans 07-02 (PostProcessEngine), 07-03 (CinematicHUD), 07-04 (LandmarkNavigation), 07-05 (KeyboardShortcuts) can all begin

---
*Phase: 07-visual-engine-navigation*
*Completed: 2026-03-11*
