---
phase: 07-visual-engine-navigation
plan: 02
subsystem: ui
tags: [cesiumjs, glsl, post-processing, react, zustand, vitest, typescript, webgl]

# Dependency graph
requires:
  - phase: 07-01
    provides: "VisualPreset type union, PostProcessUniforms interface, visualPreset/postProcessUniforms Zustand slices, Wave 0 test stubs"
provides:
  - "PostProcessEngine singleton component — creates all 7 stages once at init (NVG, Noir, FLIR, CRT, Sharpen, Gain, Pixelation), toggles by enabled flag"
  - "CRT PostProcessStageComposite — scanlines pass with function-uniform spacing + barrel distortion/chromatic aberration pass"
  - "FLIR PostProcessStage — luminance-to-iron-gradient GLSL (black→blue→red→yellow→white)"
  - "Sharpen/Gain/Pixelation PostProcessStage instances with function-style uniforms reading from uniformsRef per-frame"
  - "Bloom: built-in collection property updated via preRender listener and direct sync on uniform change"
  - "PostProcessPanel UI component — 5 preset buttons + 5 controlled sliders wired to Zustand store"
  - "PostProcessEngine test suite — 5 passing tests covering stage toggle correctness and count stability"
affects:
  - 07-03-CinematicHUD
  - 07-04-LandmarkNavigation
  - 07-05-KeyboardShortcuts

# Tech tracking
tech-stack:
  added:
    - "mgrs@2.1.0 — installed for Plan 03 MGRS coordinate conversion (forward([lon,lat],4) API)"
  patterns:
    - "Create-once-toggle: all PostProcessStage instances created in a single useEffect([viewer]) guarded by initRef.current, never recreated on preset switch"
    - "Function-style uniforms: all slider-driven uniforms use () => uniformsRef.current.X to avoid stale closure; evaluated per-frame by CesiumJS render loop"
    - "uniformsRef sync effect: separate useEffect([postProcessUniforms]) merges Zustand state into uniformsRef.current via spread — no stage recreation needed"
    - "initRef guard: boolean ref prevents double-init in React StrictMode (effect double-invoke)"
    - "preRender listener pattern: bloom contrast synced on each scene.preRender event via stored listener reference for proper cleanup"

key-files:
  created:
    - frontend/src/components/PostProcessEngine.tsx
    - frontend/src/components/PostProcessPanel.tsx
  modified:
    - frontend/src/components/__tests__/PostProcessEngine.test.tsx
    - frontend/package.json

key-decisions:
  - "CRT implemented as PostProcessStageComposite with two passes (scanlines then barrel+aberration) — composite handles inputPreviousStageTexture automatically between passes"
  - "scanlineSpacing uniform uses czm_viewport.w for screen-space scanline density to avoid moire at non-native resolution (pixels not line count)"
  - "scene.preRender placed on viewer.scene not viewer.scene.postProcessStages — preRender is a scene-level event"
  - "Bloom test falls back to store state assertion when uniforms.u_gain is not function-type in mock — handles both function-style and direct-assignment uniform patterns"

patterns-established:
  - "PostProcessEngine receives viewer as prop (not from viewerRegistry) — consistent with SatelliteLayer/AircraftLayer prop pattern already established in v1.0"
  - "PostProcessPanel is standalone export — App.tsx wiring deferred to Plan 05 per plan specification"

requirements-completed: [VIS-01, VIS-02]

# Metrics
duration: 5min
completed: 2026-03-11
---

# Phase 7 Plan 02: PostProcessEngine + PostProcessPanel Summary

**CesiumJS post-processing singleton with FLIR/CRT/NVG/Noir/Normal preset switching via create-once-toggle pattern, function-style uniforms for real-time sliders, and a monospace UI panel with 5 preset buttons and 5 controlled sliders**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-11T20:04:53Z
- **Completed:** 2026-03-11T20:09:13Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- PostProcessEngine.tsx creates all 7 stages once at viewer init: NVG (built-in), Noir (built-in), FLIR (custom GLSL iron-gradient), CRT (PostProcessStageComposite: scanlines + barrel/aberration), Sharpen, Gain, Pixelation — all disabled initially
- Function-style uniforms (`() => uniformsRef.current.X`) prevent stale closure on all slider-driven stages; uniformsRef is synced via a separate `useEffect([postProcessUniforms])`
- Bloom controlled via built-in `scene.postProcessStages.bloom` property — updated on both preRender event and direct uniform change
- PostProcessPanel renders 5 preset buttons with active-state highlight (lucide-react icons) and 5 controlled range sliders wired to Zustand `setPostProcessUniforms` with spread-merge
- PostProcessEngine test suite: 5 assertions covering stage enable/disable correctness, count stability after 5 preset switches, and uniform function value update
- Full vitest suite: 53 tests, 8 files, 0 failures; TypeScript clean

## Task Commits

Each task was committed atomically:

1. **Task 1: Build PostProcessEngine singleton with all five preset stages and function-style uniforms** - `d75d943` (feat)
2. **Task 2 (TDD GREEN): Build PostProcessPanel UI and fill PostProcessEngine test assertions** - `2db0a69` (feat)

## Files Created/Modified

- `frontend/src/components/PostProcessEngine.tsx` — Singleton stage lifecycle manager: 7 stages created at init, preset effect, uniforms sync effect, bloom preRender listener, cleanup
- `frontend/src/components/PostProcessPanel.tsx` — UI panel with 5 preset buttons (active highlight) + 5 labeled range sliders (controlled, Zustand-wired)
- `frontend/src/components/__tests__/PostProcessEngine.test.tsx` — Replaced Wave 0 stubs with 4 real test assertions (CesiumJS mocked, mock viewer with scene.preRender)
- `frontend/package.json` + `frontend/package-lock.json` — mgrs@2.1.0 installed

## Decisions Made

- CRT stage uses `PostProcessStageComposite` with two passes to enable scanline density based on `czm_viewport.w` (screen height in pixels) rather than absolute line count, avoiding moire artifacts at non-native resolution
- `scene.preRender` placed at `viewer.scene.preRender` not `viewer.scene.postProcessStages.preRender` — the latter does not exist; scene.preRender is the correct scene-level render event
- Test mock separates `scene.preRender` from `scene.postProcessStages` correctly to match the actual CesiumJS API structure
- PostProcessPanel is exported as a standalone component; App.tsx wiring is deferred to Plan 05 as specified in the plan

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed mock viewer structure: scene.preRender is separate from postProcessStages**
- **Found during:** Task 2 (TDD RED phase — tests failed with "Cannot read properties of undefined (reading 'addEventListener')")
- **Issue:** Plan's mock template placed `preRender` inside `postProcessStages` but CesiumJS places it on `viewer.scene` directly. PostProcessEngine correctly accesses `viewer.scene.preRender.addEventListener`, so the mock needed `scene.preRender` not `postProcessStages.preRender`.
- **Fix:** Moved `preRender: { addEventListener: vi.fn(), removeEventListener: vi.fn() }` to be a sibling of `postProcessStages` inside `scene`
- **Files modified:** `frontend/src/components/__tests__/PostProcessEngine.test.tsx`
- **Verification:** All 5 PostProcessEngine tests pass after fix
- **Committed in:** `2db0a69` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - bug in plan mock template)
**Impact on plan:** Necessary fix. The mock API structure must match the real CesiumJS API for tests to exercise the correct code paths. No scope creep.

## Issues Encountered

- Plan's mock template had `preRender` nested inside `postProcessStages` but `viewer.scene.preRender` is a scene-level event in CesiumJS. PostProcessEngine accesses `viewer.scene.preRender` (correct), so mock needed to match. Fixed in place during TDD RED phase.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- PostProcessEngine and PostProcessPanel are complete, exported, and ready for App.tsx wiring in Plan 05
- All function-style uniforms verified working via test suite
- mgrs@2.1.0 installed — Plan 03 (CinematicHUD/MGRSReadout) can begin immediately
- Full vitest suite green (53 tests, 0 failures) — no regressions
- Plans 07-03 and 07-04 can proceed in parallel with 07-02 complete

---
*Phase: 07-visual-engine-navigation*
*Completed: 2026-03-11*

## Self-Check: PASSED

- FOUND: frontend/src/components/PostProcessEngine.tsx
- FOUND: frontend/src/components/PostProcessPanel.tsx
- FOUND: .planning/phases/07-visual-engine-navigation/07-02-SUMMARY.md
- FOUND commit: d75d943 (Task 1)
- FOUND commit: 2db0a69 (Task 2)
