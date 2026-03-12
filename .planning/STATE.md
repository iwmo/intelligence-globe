---
gsd_state_version: 1.0
milestone: v3.0
milestone_name: UI Refinement
status: planning
stopped_at: "Checkpoint: 14-04 Task 2 human-verify"
last_updated: "2026-03-12T17:50:33.506Z"
last_activity: 2026-03-12 — v3.0 roadmap created
progress:
  total_phases: 4
  completed_phases: 1
  total_plans: 7
  completed_plans: 6
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-12 after v3.0 milestone start)

**Core value:** A unified, visually impressive intelligence picture — satellites orbiting, aircraft moving, anomalies surfacing — all rendered on one polished 3D globe that feels operational and modern.
**Current focus:** Phase 13 — Collapsible Sidebar Layout (ready to plan)

## Current Position

Phase: 13 of 16 (Collapsible Sidebar Layout)
Plan: — of 3 in current phase
Status: Ready to plan
Last activity: 2026-03-12 — v3.0 roadmap created

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

### Pending Todos

None.

### Blockers/Concerns

- **NearFarScalar scale values**: Starting ranges from research (satellites: 5e5–5e7, aircraft/ships: 1e4–5e6) require in-browser tuning with continuous zoom test — mandatory before Phase 14 marked complete.
- **tw-animate-css plugin registration**: Confirm `require('tw-animate-css')` present in `tailwind.config.js` before Phase 13 — installed but may not be active.
- **PointPrimitive.scaleByDistance API signature**: Verify exact property name on PointPrimitive (vs Billboard.scaleByDistance) before Phase 14 Plan 04 — used in v1.0/v2.0 but scaleByDistance was not.

## Session Continuity

Last session: 2026-03-12T17:50:33.503Z
Stopped at: Checkpoint: 14-04 Task 2 human-verify
Resume: Run `/gsd:plan-phase 13` to begin planning Phase 13
