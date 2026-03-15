---
phase: 07-visual-engine-navigation
plan: 03
subsystem: ui
tags: [react, cesiumjs, mgrs, typescript, vitest, tdd, hud, overlay]

# Dependency graph
requires:
  - "07-01: cleanUI/selectedSatelliteId slices in useAppStore"
  - "07-01: MGRSReadout.test.ts Wave 0 stub file"
  - "mgrs package (installed in 07-02)"
provides:
  - "CinematicHUD.tsx component — persistent tactical overlay with pointer-events: none root"
  - "getCameraGridRef() exported pure helper for MGRS conversion with UPS polar handling"
affects:
  - 07-05-AppWiring (CinematicHUD must be added to App.tsx)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Full-viewport overlay with pointer-events: none root; only interactive children re-enable with pointer-events: auto"
    - "Pure helper function (getCameraGridRef) extracted and exported from component file for testability"
    - "CSS @keyframes injected via <style> tag inside component for self-contained animation"
    - "MGRS polar guard: lat > 84 or lat < -80 returns UPS before calling forward()"

key-files:
  created:
    - frontend/src/components/CinematicHUD.tsx
  modified:
    - frontend/src/components/__tests__/MGRSReadout.test.ts
    - frontend/src/components/__tests__/PostProcessEngine.test.tsx

key-decisions:
  - "getCameraGridRef exported from CinematicHUD.tsx (not a separate MGRSReadout.ts file) — keeps MGRS logic co-located with its consumer component"
  - "UPS polar guard implemented as pre-check (lat > 84 || lat < -80) rather than relying on mgrs.forward() throwing — more explicit and testable"
  - "Telemetry panel displays selectedSatelliteId from store as placeholder; real orbital data integration deferred to future phase per research open question #2"

patterns-established:
  - "Pointer-events overlay pattern: fixed-inset div with pointer-events: none; button children explicitly set pointer-events: auto"

requirements-completed: [VIS-03, VIS-04]

# Metrics
duration: 3min
completed: 2026-03-11
---

# Phase 7 Plan 03: CinematicHUD Overlay Summary

**CinematicHUD.tsx tactical overlay with classification banner, live MGRS grid reference (UPS polar guard), satellite telemetry readout, REC timestamp with pulsing dot, and Clean UI toggle — full pointer-events: none root with button exception**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-11T20:05:10Z
- **Completed:** 2026-03-11T20:07:47Z
- **Tasks:** 1
- **Files modified:** 3

## Accomplishments

- Created `CinematicHUD.tsx` with five overlay elements in correct corner positions, all inside a `pointer-events: none` root
- Exported `getCameraGridRef([lon, lat])` pure helper: returns `'UPS'` for polar regions (lat > 84 or lat < -80), calls `forward()` from mgrs package otherwise, returns `'---'` on error
- Camera `moveEnd` event drives live MGRS string, altitude in km, and lat/lon decimal display
- `setInterval(1000)` drives live UTC clock in REC timestamp
- Clean UI toggle reads and writes `cleanUI` slice from Zustand store
- Replaced MGRSReadout.test.ts Wave 0 stubs with four real `getCameraGridRef` assertions — all pass (4/4)
- Full vitest suite: 8/8 files, 53/53 tests passing (up from 46 in 07-01, 53 todos resolved)

## Task Commits

1. **Task 1: Build CinematicHUD component with MGRS readout, telemetry, and Clean UI toggle** — `24fa06a` (feat, TDD)

## Files Created/Modified

- `frontend/src/components/CinematicHUD.tsx` — NEW: Full cinematic overlay component with getCameraGridRef export
- `frontend/src/components/__tests__/MGRSReadout.test.ts` — Updated: Wave 0 stubs replaced with 4 real test assertions
- `frontend/src/components/__tests__/PostProcessEngine.test.tsx` — Fixed: mock viewer preRender location corrected (Rule 1 auto-fix)

## Decisions Made

- `getCameraGridRef` is exported from `CinematicHUD.tsx` rather than a separate file — the function is tightly coupled to this component and has no other current consumers; extracting it would add indirection without benefit
- Polar guard uses explicit numeric check rather than catching `forward()` errors — makes the UPS boundary visible in code and directly testable
- Telemetry panel shows `selectedSatelliteId` as a label only; orbital parameter integration (ORB, PASS, GSD, SUN EL) is out of Phase 7 scope per research open question #2

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed PostProcessEngine.test.tsx mock: scene.preRender placed at wrong level**
- **Found during:** Task 1 (full vitest suite run)
- **Issue:** `PostProcessEngine.test.tsx` had `viewer.scene.postProcessStages.preRender` but `PostProcessEngine.tsx` calls `viewer.scene.preRender.addEventListener()`. This caused TypeError on 4 tests in the PostProcessEngine suite.
- **Fix:** Moved `preRender: { addEventListener, removeEventListener }` from inside `postProcessStages` to directly on `scene` in `makeMockViewer()`. Removed the duplicate from `postProcessStages`.
- **Files modified:** `frontend/src/components/__tests__/PostProcessEngine.test.tsx`
- **Commit:** `24fa06a`

---

**Total deviations:** 1 auto-fixed (Rule 1 - bug in test mock from Plan 02)
**Impact on plan:** Necessary fix. 4 PostProcessEngine tests were silently broken; fixing them restored the full suite to green without scope creep.

## Issues Encountered

- PostProcessEngine.test.tsx was delivered from Plan 02 with `preRender` mocked at the wrong level (`postProcessStages.preRender` vs `scene.preRender`). The test file appeared to work as todos but failed once the todos became real assertions. Fixed as Rule 1 deviation.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- `CinematicHUD.tsx` is ready for App.tsx wiring in Plan 05
- `getCameraGridRef` export is verified clean for any future test or utility consumption
- Full test suite is green (53/53) with zero todos remaining
- Plan 07-04 (LandmarkNavigation) can proceed independently

## Self-Check: PASSED

- FOUND: frontend/src/components/CinematicHUD.tsx
- FOUND: frontend/src/components/__tests__/MGRSReadout.test.ts
- FOUND: .planning/phases/07-visual-engine-navigation/07-03-SUMMARY.md
- FOUND: commit 24fa06a

---
*Phase: 07-visual-engine-navigation*
*Completed: 2026-03-11*
