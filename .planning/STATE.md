---
gsd_state_version: 1.0
milestone: v4.0
milestone_name: Data Reliability & Freshness
status: defining_requirements
stopped_at: Milestone v4.0 started — defining requirements
last_updated: "2026-03-13T00:00:00.000Z"
last_activity: 2026-03-13 — Milestone v4.0 started
progress:
  total_phases: 0
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-13 after v4.0 milestone started)

**Core value:** A unified, visually impressive intelligence picture — satellites orbiting, aircraft moving, anomalies surfacing — all rendered on one polished 3D globe that feels operational and modern.
**Current focus:** Defining requirements for v4.0 Data Reliability & Freshness

## Current Position

Phase: Not started (defining requirements)
Plan: —
Status: Defining requirements
Last activity: 2026-03-13 — Milestone v4.0 started

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

**v4.0 Constraints:**
- Do not switch providers (OpenSky, airplanes.live, aisstream.io, CelesTrak)
- Preserve existing endpoint paths and response fields — backward compatible
- Add new optional fields only; never rename existing keys
- Prefer soft expiry (is_active = false) over hard deletion
- All schema changes require Alembic migrations

### Pending Todos

None.

### Blockers/Concerns

None.
