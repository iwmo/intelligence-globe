---
gsd_state_version: 1.0
milestone: v9.0
milestone_name: Entity Labels
status: completed
stopped_at: Completed 37-04-PLAN.md
last_updated: "2026-03-14T21:44:49.888Z"
last_activity: 2026-03-15 — Plan 37-03 complete (military aircraft + ship labels)
progress:
  total_phases: 1
  completed_phases: 1
  total_plans: 5
  completed_plans: 5
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-15 for v9.0 milestone)

**Core value:** A unified, visually impressive intelligence picture — satellites orbiting, aircraft moving, anomalies surfacing — all rendered on one polished 3D globe that feels operational and modern.
**Current focus:** v9.0 Entity Labels — Phase 37 ready for planning

## Current Position

Phase: 37 (Entity Labels) — complete
Plan: 03 complete (3/3 plans done)
Status: All plans complete — v9.0 milestone achieved
Last activity: 2026-03-15 — Plan 37-03 complete (military aircraft + ship labels)

```
v9.0 Progress: [##########] 100% (Phase 37: 3/3 plans complete)
Phase 37 ██████████
```

## Performance Metrics

| Metric | v9.0 Target | Current |
|--------|-------------|---------|
| Requirements covered | 10/10 | 10/10 (roadmap) |
| Phases planned | 1 | 1 |
| Plans complete | TBD | 0 |
| Phase 37-entity-labels P01 | 3 | 2 tasks | 2 files |
| Phase 37 P03 | 2m | 2 tasks | 2 files |
| Phase 37-entity-labels P05 | 5 | 2 tasks | 2 files |
| Phase 37-entity-labels P04 | 1m | 2 tasks | 2 files |

## Accumulated Context

### Roadmap Evolution

- Phase 37 added: v9.0 Entity Labels (all 10 LBL requirements in single phase)

### Key Decisions (v9.0 — Plan 37-02)

- Labels are a separate LabelCollection primitive, not embedded in PointPrimitiveCollection/BillboardCollection — Cesium GPU architecture requires this
- labelsByIcao24 at module scope mirrors billboardsByIcao24 pattern — same lifecycle, cleared on unmount
- Label show state cross-references entity show state: hidden satellites/aircraft never get visible labels even when toggle is on
- scaleByDistance satellites: NearFarScalar(5e5, 1.2, 5e7, 0.0) — vanish at global altitude, matching point scale range
- scaleByDistance aircraft: NearFarScalar(1e4, 1.4, 5e6, 0.0) — vanish at global altitude, matching billboard scale range

### Key Decisions (v9.0 — Plan 37-01)

- showEntityLabels defaults to false — labels are opt-in, not forced on first load
- DISPLAY section placed above Default Layers in SettingsPanel for global rendering preferences distinct from per-layer toggles
- Field placed inside persist() so value is serialised to globe-settings localStorage key alongside all other settings

### Key Decisions (v9.0 — Roadmap)

- All 10 requirements fit in one phase — toggle infrastructure (LBL-01, LBL-02) and all four label implementations (LBL-03 through LBL-10) are tightly coupled; splitting would create a useless half-state where the toggle exists but no labels are wired
- LabelCollection alongside existing primitives — satellites use PointPrimitiveCollection (GPU budget constraint), billboards for aircraft/military/ships; labels are a parallel LabelCollection per layer, not a new entity type
- Toggle in useSettingsStore (not useAppStore) — label visibility is a persisted preference, not transient runtime state; consistent with existing showLabels-style settings pattern
- No backend changes — all 10 requirements are pure frontend; label text comes from fields already in each layer's React Query response (object_name, callsign, vessel_name, etc.)
- scaleByDistance required for all label collections — labels must remain readable at global altitude without obscuring the globe at close zoom; same approach as NearFarScalar on entity icons

### Phase Dependency Map

```
Phase 16 (Persistent Settings Panel — useSettingsStore)
  └─► Phase 37 (Entity Labels)
Phase 14 (Entity Icons — BillboardCollections)
  └─► Phase 37 (Entity Labels)
```

### Preserved from v8.0

- `useAppStore.getState()` inside rAF/postUpdate callbacks required — selectors captured at render time go stale
- Hand-written Alembic migrations only — never autogenerate (position_snapshots is range-partitioned)
- `useSettingsStore` separate from `useAppStore` — prevents transient runtime values persisting
- Detail endpoints unaffected by stale filtering — replay engine needs historical rows
- `stale_cutoff()` called inside handler body (not module scope)
- `effectiveBbox = replayMode === 'live' ? viewportBbox : null` pattern for all live-data hooks (VPC-08)
- All 4 bbox params required for filter to activate — partial bbox silently ignored
- SVG icon canvases pre-rendered at module scope (not per-entity) — TextureAtlas GPU budget exceeded at >5,000 dynamic entries
- Satellite layer stays on PointPrimitiveCollection (never billboards) — hard GPU constraint at 5,000+ entities

### CRITICAL: Credential Rotation Required Before Public Release

User must revoke and rotate the following before making the repo public — real keys are in git history via old docker-compose.yml hardcoded fallbacks:
- OpenSky OAuth2 client secret
- AISStream API key

Phase 27 (SEC-01) removes the fallbacks from the compose file but does NOT purge git history. User action required: `git filter-repo` or GitHub repo reset.

Also: replace `<Author Name>` in LICENSE with real name before public release.

### Pending Todos

None.

### Blockers/Concerns

None. Phase 37 is fully self-contained frontend work with no backend dependencies.

## Session Continuity

Last session: 2026-03-14T21:44:49.884Z
Stopped at: Completed 37-04-PLAN.md
Resume file: None
Next action: Execute 37-03-PLAN.md
