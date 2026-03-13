---
gsd_state_version: 1.0
milestone: v3.0
milestone_name: UI Refinement
status: executing
stopped_at: Completed 16-03-PLAN.md — Phase 16 complete, all CONFIG requirements satisfied, 8/8 browser checks passed
last_updated: "2026-03-13T09:48:50.518Z"
last_activity: 2026-03-13 — Phase 16 Plan 01 complete
progress:
  total_phases: 4
  completed_phases: 4
  total_plans: 13
  completed_plans: 13
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-12 after v3.0 milestone start)

**Core value:** A unified, visually impressive intelligence picture — satellites orbiting, aircraft moving, anomalies surfacing — all rendered on one polished 3D globe that feels operational and modern.
**Current focus:** Phase 13 — Collapsible Sidebar Layout (ready to plan)

## Current Position

Phase: 16 of 16 (Persistent Settings Panel)
Plan: 1 of 3 in current phase — complete
Status: In progress
Last activity: 2026-03-13 — Phase 16 Plan 01 complete

Progress: [__________] 0% (v3.0 — 0/13 plans complete)

## Performance Metrics

- Plans complete: 0
- Plans in progress: 0
- Phases complete: 0 / 4

## Accumulated Context

### Decisions

**v3.0 Architectural constraints (from research):**

| Decision | Rationale |
|----------|-----------|
| Satellite layer stays on PointPrimitiveCollection — never BillboardCollection | 5,000+ billboard entities degrade frame rate on integrated GPU; hard constraint not a preference |
| CSS sidebar collapse uses grid-template-rows transition (not scrollHeight) | scrollHeight forces synchronous layout reflow on same thread as CesiumJS render loop — halves FPS during animation |
| SVG icon canvases pre-rendered once at layer mount in module scope | Per-entity dynamic SVG strings exhaust TextureAtlas GPU texture budget (DeveloperError at >5,000 entries) |
| LEFT_DOUBLE_CLICK handler removes CesiumJS built-in entity-tracking handler first | Two conflicting camera animations fire simultaneously if built-in not removed via removeInputAction |
| LEFT_CLICK debounced 200ms when double-click zoom is active | CesiumJS issue #1171: both LEFT_CLICK and LEFT_DOUBLE_CLICK fire on double-click; debounce prevents entity panel opening on zoom gesture |
| Billboard migration per-layer in two atomic steps (add new, remove old) | Parallel PointPrimitive + BillboardCollection for same layer causes doubled draw calls and double-pickable entities |

**v2.0 decisions still valid — see PROJECT.md Key Decisions table.**
| Phase 13-collapsible-sidebar-layout P01 | 8 | 2 tasks | 4 files |
- [Phase 13-collapsible-sidebar-layout]: Used grid-template-rows transition (not scrollHeight) for sidebar collapse — avoids CesiumJS render thread reflow
- [Phase 13-collapsible-sidebar-layout]: All CollapsibleSection animation via inline styles — tw-animate-css activation not confirmed
| Phase 13-collapsible-sidebar-layout P02 | 2 | 2 tasks | 2 files |
- [Phase 13-collapsible-sidebar-layout]: PostProcessPanel moves from App.tsx fixed overlay into VISUAL ENGINE CollapsibleSection — eliminates panel overlap (LAYOUT-02)
- [Phase 13-collapsible-sidebar-layout]: App.tsx owns no floating UI panels that belong in sidebar — panels live in LeftSidebar sections
| Phase 14 P01 | 2m | 2 tasks | 3 files |
- [Phase 14]: Export canvas constants (not unexported) so downstream billboard plans can import the same HTMLCanvasElement reference for CesiumJS TextureAtlas deduplication
| Phase 14-entity-icons-altitude-scaling P02 | 3 | 2 tasks | 2 files |
- [Phase 14]: Ship heading uses 511-sentinel fallback to cog; military heading uses track field directly
- [Phase 14]: alignedAxis: Cartesian3.ZERO for screen-space billboard rotation — icons face camera, not globe surface normal
| Phase 14-entity-icons-altitude-scaling P03 | 4 | 1 tasks | 1 files |
- [Phase 14-entity-icons-altitude-scaling]: id: ac.icao24 (bare icao24, no prefix) preserved on billboards — unified LEFT_CLICK handler requires no changes
- [Phase 14-entity-icons-altitude-scaling]: rAF lerp loop closure captures module-scope billboardsByIcao24 — no structural change to lerp architecture
| Phase 14-entity-icons-altitude-scaling P04 | 1 | 1 tasks | 1 files |
- [Phase 14-entity-icons-altitude-scaling]: scaleByDistance set post-add on PointPrimitive instance (not in collection.add options) — NearFarScalar(5e5, 1.5, 5e7, 0.3) on satellites
| Phase 14-entity-icons-altitude-scaling P04 | 10 | 2 tasks | 1 files |
- [Phase 14-entity-icons-altitude-scaling]: NearFarScalar(5e5, 1.5, 5e7, 0.3) starting values passed human zoom test without tuning — approved as-is
| Phase 13-collapsible-sidebar-layout P03 | 30 | 2 tasks | 2 files |
- [Phase 13-collapsible-sidebar-layout]: Replaced sliding sidebar with free-floating DraggablePanel components — hamburger eliminated, each section independent
- [Phase 13-collapsible-sidebar-layout]: DraggablePanel persists {x, y, width, height} in localStorage keyed by panel id — survives page reload
- [Phase 13-collapsible-sidebar-layout]: +/- collapse replaces chevron/grid-template-rows — simpler in floating context
| Phase 15-camera-navigation-controls P01 | 6 | 3 tasks | 4 files |
- [Phase 15-camera-navigation-controls]: zoomStep factor=0.3 for button zoom (vs 0.12 for wheel) — deliberate, perceptible step
- [Phase 15-camera-navigation-controls]: CameraControlWidget positioned at bottom:120px right:12px — clears all existing bottom-right HUD elements
- [Phase 15-camera-navigation-controls]: cancelFlight before setView in setPitchPreset — consistent with flyToLandmark pattern already in registry
| Phase 15 P02 | 3 | 2 tasks | 4 files |
- [Phase 15]: removeInputAction(LEFT_DOUBLE_CLICK) before custom handler — prevents dual flyTo conflict (CesiumJS architecture constraint)
- [Phase 15]: clickTimer at module scope — persists across re-renders, cleared on cleanup; 200ms debounce matches CesiumJS issue #1171 double-click window
| Phase 15-camera-navigation-controls P03 | 10 | 2 tasks | 0 files |
- [Phase 15-camera-navigation-controls]: All 13 NAV browser checks passed first run — double-click zoom, tilt presets, zoom buttons, and widget layout approved without fixes
| Phase 16-persistent-settings-panel P01 | 5 | 2 tasks | 2 files |
- [Phase 16-persistent-settings-panel]: useSettingsStore is separate from useAppStore — prevents transient runtime values (selectedId, replayTs, replayWindowStart) from being persisted
- [Phase 16-persistent-settings-panel]: persist name 'globe-settings' — no partialize needed, entire state is configuration
- [Phase 16-persistent-settings-panel]: defaultCamera: null is the sentinel for 'no flyTo on boot' — null is explicitly typed and preserved in localStorage
- [Phase 16-persistent-settings-panel]: Initial defaultLayers exactly mirrors useAppStore initial defaults so first-ever load produces identical behavior
| Phase 16-persistent-settings-panel P02 | 2 | 2 tasks | 3 files |
- [Phase 16-persistent-settings-panel]: radToDeg inline helper replaces CesiumMath.toDegrees in SettingsPanel — eliminates cesium mock complexity in unit tests
- [Phase 16-persistent-settings-panel]: Gear icon NOT gated by cleanUI — settings must remain accessible in cinematic mode
- [Phase 16-persistent-settings-panel]: SettingsPanel uses unmount-based toggle (not display:none) — consistent with DraggablePanel pattern
| Phase 16-persistent-settings-panel P03 | 15 | 2 tasks | 2 files |
- [Phase 16-persistent-settings-panel]: import type { VisualPreset } required in useSettingsStore — isolatedModules rejects value-import of type-only export
- [Phase 16-persistent-settings-panel]: All four settings boot wiring in single onViewerReady callback — camera requires registered viewer, co-locating all settings eliminates ordering bugs

### Pending Todos

None.

### Blockers/Concerns

- **NearFarScalar scale values**: Starting ranges from research (satellites: 5e5–5e7, aircraft/ships: 1e4–5e6) require in-browser tuning with continuous zoom test — mandatory before Phase 14 marked complete.
- **tw-animate-css plugin registration**: Confirm `require('tw-animate-css')` present in `tailwind.config.js` before Phase 13 — installed but may not be active.
- **PointPrimitive.scaleByDistance API signature**: Verify exact property name on PointPrimitive (vs Billboard.scaleByDistance) before Phase 14 Plan 04 — used in v1.0/v2.0 but scaleByDistance was not.

## Session Continuity

Last session: 2026-03-13T09:48:50.516Z
Stopped at: Completed 16-03-PLAN.md — Phase 16 complete, all CONFIG requirements satisfied, 8/8 browser checks passed
Resume: Execute 16-02-PLAN.md (Settings Panel UI)
