# Requirements: OpenSignal Globe

**Defined:** 2026-03-14
**Milestone:** v8.0 — GDELT Integration
**Core Value:** A unified, visually impressive intelligence picture — satellites orbiting, aircraft moving, anomalies surfacing — all rendered on one polished 3D globe that feels operational and modern.

## v1 Requirements

### Backend Ingestion & Storage

- [x] **GDELT-01**: System stores GDELT events in `gdelt_events` PostgreSQL table with UNIQUE `global_event_id`, `occurred_at`/`discovered_at` columns, lat/lon floats, `quad_class`, `goldstein_scale`, `num_mentions`, actor codes, `source_url`, and `source_is_stale` freshness field
- [x] **GDELT-02**: RQ worker polls `lastupdate.txt` every 15 minutes; downloads bulk CSV ZIP in-memory; applies 3-layer deduplication (Redis file-level skip, ON CONFLICT DO NOTHING on global_event_id, null-coordinate filter); filters to conflict-relevant events at ingest time; self-re-enqueues
- [x] **GDELT-03**: `GET /api/gdelt-events` returns bbox-filtered, QuadClass-filtered events with `since`/`until` time-range params and `source_is_stale` freshness metadata
- [x] **GDELT-04**: RQ worker runs 7-day rolling cleanup on `gdelt_events`; table stays within ~150k row ceiling

### Frontend Layer & UX

- [ ] **GDELT-05**: GDELT event markers are visible on globe using `CustomDataSource` + `EntityCluster` + `PointGraphics` with QuadClass colour coding (blue/green/yellow/red)
- [ ] **GDELT-06**: GDELT layer has a sidebar toggle; bbox params are suppressed in replay mode (VPC-08 pattern); React Query refetches every 15 minutes in live mode only
- [ ] **GDELT-07**: User can filter visible GDELT events by QuadClass via 4-chip filter (Verbal Cooperation / Material Cooperation / Verbal Conflict / Material Conflict)
- [ ] **GDELT-08**: Clicking a GDELT marker opens a `GdeltDetailPanel` (DraggablePanel) showing source URL, actor names, GoldsteinScale score, tone, and an automated-extraction disclaimer
- [ ] **GDELT-09**: `GdeltDetailPanel` includes a "Log as OSINT Event" button that pre-populates `OsintEventPanel` with the GDELT event's location, timestamp, and source URL

### Replay & Freshness

- [ ] **GDELT-10**: `useGdeltEvents` hook loads events once per replay session using a `since`/`until` time window; events accumulate client-side as the scrubber advances, anchored at `occurred_at` (SQLDATE position)
- [ ] **GDELT-11**: GDELT events appear as coloured dots on the PlaybackBar timeline scrubber track (same pattern as existing OSINT event dots)
- [ ] **GDELT-12**: GDELT layer card shows `source_is_stale` freshness indicator when the last ingest cycle is stale (same pattern as GPS jamming layer)

## v2 Requirements (Deferred)

### Polish & Enrichment

- **GDELT-13**: GoldsteinScale drives marker pixel size (`4 + Math.abs(goldsteinScale) * 0.8`, range 4–12px)
- **GDELT-14**: `num_mentions` drives marker opacity (single-source events visually dimmed)
- **GDELT-15**: Clicking a GDELT conflict event in replay mode triggers satellite overpass correlation (sets `replayTs` to `occurred_at`, fires `COMPUTE_OVERPASS`)

### Advanced Analytics

- **GDELT-16**: Conflict density heatmap mode using H3 hexagon aggregation of QuadClass 3+4 events rendered as GroundPrimitive (mirrors GPS jamming layer pattern)
- **GDELT-17**: 7-day AvgTone sparkline in `GdeltDetailPanel` for the selected location
- **GDELT-18**: Analyst keyword filter parameterising GDELT GEO 2.0 QUERY field in settings panel
- **GDELT-19**: 20-code EventRootCode secondary filter panel for CAMEO-trained analysts

## Out of Scope

| Feature | Reason |
|---------|--------|
| Unfiltered global GDELT ingest | GPU and DB budget violation — up to 500k rows/day globally; conflict filter reduces volume ~75% |
| Direct browser-to-GDELT API calls | Bypasses caching, exposes all user sessions to rate limits; must be backend-proxied |
| 310-code CAMEO subcategory filter | Unusable UI; 4 QuadClasses is the correct granularity for non-specialist users |
| Historical GDELT beyond 7-day retention | Inconsistent with all other layers; positions_snapshots also uses 7-day window |
| `@cesium-extends/heat` npm package | 1 npm dependent, SingleTileImageryProvider WebGL sampler budget risk |
| AviationStack integration | Redundant with existing OpenSky OAuth2; paid tiers for marginal metadata improvement |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| GDELT-01 | Phase 34 | Complete |
| GDELT-02 | Phase 34 | Complete |
| GDELT-03 | Phase 34 | Complete |
| GDELT-04 | Phase 34 | Complete |
| GDELT-05 | Phase 35 | Pending |
| GDELT-06 | Phase 35 | Pending |
| GDELT-07 | Phase 35 | Pending |
| GDELT-08 | Phase 35 | Pending |
| GDELT-09 | Phase 35 | Pending |
| GDELT-10 | Phase 36 | Pending |
| GDELT-11 | Phase 36 | Pending |
| GDELT-12 | Phase 36 | Pending |

**Coverage:**
- v1 requirements: 12 total
- Mapped to phases: 12
- Unmapped: 0 ✓

---
*Requirements defined: 2026-03-14*
*Last updated: 2026-03-14 after initial definition*
