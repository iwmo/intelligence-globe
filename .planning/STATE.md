---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: executing
stopped_at: Completed 34-03-PLAN.md — GET /api/gdelt-events route with bbox + quad_class + time-range filtering
last_updated: "2026-03-14T15:05:36.670Z"
last_activity: "2026-03-14 — 34-02 complete: GDELT RQ ingest worker with Redis dedup and 7-day cleanup"
progress:
  total_phases: 3
  completed_phases: 0
  total_plans: 4
  completed_plans: 3
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-14 after v8.0 milestone start)

**Core value:** A unified, visually impressive intelligence picture — satellites orbiting, aircraft moving, anomalies surfacing — all rendered on one polished 3D globe that feels operational and modern.
**Current focus:** v8.0 GDELT Integration — Phase 34: Backend Foundation

## Current Position

Phase: 34 — Backend Foundation
Plan: 03 complete — ready for 34-04
Status: In Progress — 3/4 plans complete in Phase 34
Last activity: 2026-03-14 — 34-03 complete: GET /api/gdelt-events route with bbox + quad_class + time-range filtering

```
v8.0 Progress: [██████████] 99% (0/3 phases complete, 3/4 plans in Phase 34)
Phase 34 ███  Phase 35 _  Phase 36 _
```

## Performance Metrics

| Metric | v8.0 Target | Current |
|--------|-------------|---------|
| Requirements covered | 12/12 | 12/12 (roadmap) |
| Phases planned | 3 | 3 |
| Plans complete | TBD | 1 |
| Phase 34-backend-foundation P01 | 3min | 2 tasks | 4 files |
| Phase 34 P02 | 3min | 2 tasks | 1 files |
| Phase 34-backend-foundation P03 | 4min | 1 tasks | 2 files |

## Accumulated Context

### Roadmap Evolution

- Phases 34-36 added: v8.0 GDELT Integration

### Key Decisions (v8.0 — Roadmap)

- Bulk CSV ingest via `lastupdate.txt`, NOT the GEO 2.0 REST API — GEO 2.0 lacks stable GLOBALEVENTID (deduplication impossible) and has undocumented rate limits; switching after data has accumulated requires a full worker rewrite
- UNIQUE constraint on `global_event_id` from day one in Phase 34 migration — GDELT files overlap across 15-minute boundaries; adding UNIQUE CONCURRENTLY after rows are present requires downtime if duplicates exist
- `occurred_at` from SQLDATE, `discovered_at` from DATEADDED — never conflate; SQLDATE is the event's temporal anchor for replay; DATEADDED is ingestion bookkeeping only
- `event_code` stored as VARCHAR(4), not INTEGER — code `040` as integer becomes `40`, a different CAMEO event type with no recovery path short of full re-ingest
- Filter at ingestion time (`quad_class IN (2,3,4)` or configurable `GDELT_INGEST_QUAD_CLASSES` env var) — unfiltered global GDELT is 100k-500k rows/day; post-hoc filtering requires full re-ingest
- `PointGraphics` not `BillboardGraphics` inside CustomDataSource — CesiumJS issue #4536: BillboardGraphics in CustomDataSource does not cluster on initial render; PointGraphics avoids this and the TextureAtlas exhaustion risk
- Single GDELT API load per replay session — `useGdeltEvents` fetches once on entering playback with a since/until window, filters client-side as replayTs advances; per-tick fetching saturates the backend at any speed above 1x
- `gdelt_events` is a regular (non-partitioned) table — 7-day rolling retention caps rows at ~100-150k; partitioning overhead only justified at tens-of-millions of rows
- Phase 34 before 35: frontend cannot be meaningfully validated without real data; schema bugs (dedup failures, coordinate precision) only appear at actual GDELT volume
- Phase 35 before 36: replay wiring requires the layer's client-side temporal filter logic to exist; PlaybackBar integration against a non-functional rendering layer produces undefined behaviour
- Migration revision b2c3d4e5f6a1 used for GDELT (a1b2c3d4e5f6 was already taken by military_aircraft migration); down_revision set to actual head a4f7c2e9b1d3
- parse_gdelt_row accepts both list[str] (CSV pipeline) and dict[str, str] (unit tests) — dual-dispatch via isinstance; test stubs are authoritative spec
- cleanup_old_events takes no args, opens its own session — matches test stub; aligns with test-first design
- asyncio.iscoroutine guard on Redis sadd result — single code path for sync Redis (prod) and AsyncMock (tests); no aioredis dependency
- Response uses latitude/longitude keys (not lat/lon) — test contract is authoritative over plan's response shape example

### Phase Dependency Map

```
Phase 34 (Backend Foundation)
  └─► Phase 35 (Frontend Layer)
        └─► Phase 36 (Replay and Freshness)
```

### Preserved from v7.0

- `useAppStore.getState()` inside rAF/postUpdate callbacks required — selectors captured at render time go stale
- Hand-written Alembic migrations only — never autogenerate (position_snapshots is range-partitioned)
- `useSettingsStore` separate from `useAppStore` — prevents transient runtime values persisting
- Detail endpoints unaffected by stale filtering — replay engine needs historical rows
- `stale_cutoff()` called inside handler body (not module scope)
- `effectiveBbox = replayMode === 'live' ? viewportBbox : null` pattern for all live-data hooks (VPC-08)
- All 4 bbox params required for filter to activate — partial bbox silently ignored

### CRITICAL: Credential Rotation Required Before Public Release

User must revoke and rotate the following before making the repo public — real keys are in git history via old docker-compose.yml hardcoded fallbacks:
- OpenSky OAuth2 client secret
- AISStream API key

Phase 27 (SEC-01) removes the fallbacks from the compose file but does NOT purge git history. User action required: `git filter-repo` or GitHub repo reset.

Also: replace `<Author Name>` in LICENSE with real name before public release.

### Pending Todos

None.

### Blockers/Concerns

None. All three phases are independently researchable without blockers. Phase 4 (future v9.0 H3 heatmap) is deferred and does not block any v8.0 phase.

## Session Continuity

Last session: 2026-03-14T15:05:36.667Z
Stopped at: Completed 34-03-PLAN.md — GET /api/gdelt-events route with bbox + quad_class + time-range filtering
Resume file: None
Next action: `/gsd:plan-phase 34` — Backend Foundation (GDELT-01 through GDELT-04)
