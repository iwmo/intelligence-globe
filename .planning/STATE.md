---
gsd_state_version: 1.0
milestone: v2.0
milestone_name: WorldView Parity
status: roadmap_complete
stopped_at: ~
last_updated: "2026-03-11T00:00:00.000Z"
last_activity: 2026-03-11 — Roadmap created for v2.0 milestone (Phases 7-12)
progress:
  total_phases: 6
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-11 after v2.0 milestone start)

**Core value:** A unified, visually impressive intelligence picture — satellites orbiting, aircraft moving, anomalies surfacing — all rendered on one polished 3D globe that feels operational and modern.
**Current focus:** v2.0 WorldView Parity — ready to begin Phase 7 planning

## Current Position

Phase: 7 — Visual Engine + Navigation (not started)
Plan: —
Status: Roadmap complete, awaiting phase planning
Last activity: 2026-03-11 — v2.0 roadmap written (Phases 7-12, 17 requirements mapped)

Progress: [__________] 0% (v2.0 milestone)

## Performance Metrics

- Plans complete: 0
- Plans in progress: 0
- Phases complete: 0 / 6

## Accumulated Context

### Decisions

**v2.0 Architecture decisions (from research):**

| Decision | Rationale |
|----------|-----------|
| PostProcessEngine singleton created at init, never recreated | CesiumJS PostProcessStage applies to entire scene framebuffer; recreating on preset switch causes stale uniforms and is expensive |
| Snapshot table range-partitioned by day from day one | Retrofitting a live unpartitioned table at scale requires downtime; 100M+ rows within two weeks at 60s intervals |
| GPS jamming rendered as GroundPrimitive (not ImageryLayer) | WebGL texture sampler budget limited; GroundPrimitive bypasses ImageryLayer sampler limit |
| AIS proxied through FastAPI backend (not direct browser WebSocket) | aisstream.io API key would be exposed in client JS if connected from browser |
| airplanes.live /v2/mil as primary military source (not ADSB Exchange) | ADSB Exchange moved to paid RapidAPI model March 2025; airplanes.live is free, same JSON schema |
| Custom React TimelinePanel (not CesiumJS default Timeline widget) | CesiumJS widget lacks speed presets, event dot coloring, and category filtering; confirmed anti-feature in research |
| LIVE/PLAYBACK mode toggle drives viewer.clock directly | CZML replay is not flexible enough for multi-layer custom timeline UI |
| 60-second snapshot interval with frontend lerp interpolation | 1/3600th the storage cost vs 1Hz; visually sufficient at all replay speeds |
| Street traffic gated below 500 km altitude, viewport-scoped road fetch | Full road network at global zoom is unusable; Overpass bbox query scoped to viewport |
| TLE age > 7 days triggers visible overpass warning | SGP4 error grows to kilometers beyond 7 days; fail visibly rather than show inaccurate overpass lines |

All v1.0 key decisions remain valid — see PROJECT.md Key Decisions table.

### Pending Todos

- Register aisstream.io API key before Phase 8 planning (requires GitHub OAuth)
- Verify airplanes.live /v2/mil JSON schema matches ADSB Exchange v2 schema before writing ingestion worker
- Confirm gpsjam.org CSV URL pattern (https://gpsjam.org/data/YYYY-MM-DD.csv) by direct fetch before Phase 9 planning
- Prototype PostgreSQL daily range partition DDL before writing Phase 10 Alembic migration
- Validate 60s lerp interpolation is visually acceptable at 10x and 60x playback before committing to Phase 11 granularity

### Blockers/Concerns

- **AIS availability:** aisstream.io is beta with no SLA and 2-minute server-initiated disconnects. Exponential backoff reconnect with Redis position cache required. Must test live connection before designing reconnect logic.
- **ADSB Exchange rate limit:** 10,000 req/month on Basic plan. airplanes.live /v2/mil is the safer primary source; ADSB Exchange as fallback only.
- **WebGL texture sampler budget:** Must test with all Phase 8-9 layers active simultaneously on integrated GPU hardware before marking Phase 9 complete.
- **Replay data cold start:** Phase 11 requires minimum 24-48 hours of Phase 10 snapshot data before replay is meaningfully testable. Build Phase 10 first and let it accumulate.

## Session Continuity

Last session: 2026-03-11
Stopped at: v2.0 roadmap created
Resume: Start with `/gsd:plan-phase 7`
