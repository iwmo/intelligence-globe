---
gsd_state_version: 1.0
milestone: v4.0
milestone_name: Data Reliability & Freshness
status: roadmap_ready
stopped_at: Roadmap created — ready to plan Phase 17
last_updated: "2026-03-13T00:00:00.000Z"
last_activity: 2026-03-13 — v4.0 roadmap created (6 phases, 20 requirements)
progress:
  total_phases: 6
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-13 after v4.0 milestone started)

**Core value:** A unified, visually impressive intelligence picture — satellites orbiting, aircraft moving, anomalies surfacing — all rendered on one polished 3D globe that feels operational and modern.
**Current focus:** v4.0 Data Reliability & Freshness — Phase 17 ready to plan

## Current Position

Phase: 17 — Schema Migration (not started)
Plan: —
Status: Roadmap ready, awaiting first plan
Last activity: 2026-03-13 — v4.0 roadmap created

## Progress Bar

```
v4.0: [ ] [ ] [ ] [ ] [ ] [ ]
       17  18  19  20  21  22
0% complete (0/6 phases)
```

## Performance Metrics

| Metric | v1.0 | v2.0 | v3.0 | v4.0 |
|--------|------|------|------|------|
| Phases | 6 | 6 | 4 | 6 (planned) |
| Plans | 17 | 28 | 13 | TBD |
| LOC added | ~4,400 | ~20,732 | ~8,275 | TBD |

## Accumulated Context

### Decisions

**v4.0 Architectural constraints:**

| Decision | Rationale |
|----------|-----------|
| All schema changes hand-written Alembic migrations only — never autogenerate | `position_snapshots` is range-partitioned by day; autogenerate may generate `drop_table` for partition child tables |
| `is_active` column uses `server_default = sa.text('true')` | Avoids NOT NULL violation on live table rows post-migration; existing rows treated as active immediately with no backfill UPDATE |
| All new freshness timestamp columns are nullable | Avoids NOT NULL constraint violation on rows that predate the migration |
| SQLAlchemy `onupdate` not relied upon — all freshness fields written explicitly in every `set_={}` dict | `onupdate` is silently ignored on the `on_conflict_do_update` path; existing AIS worker has this bug already |
| `time_position` (sv[3]) used for positional freshness, not `last_contact` (sv[4]) | OpenSky persists state vectors 300s after last contact — recent `last_contact` does not mean a fresh GPS position fix |
| GPS jamming cells returned with `source_is_stale=true` when military source is stale (not empty set) | Empty response on feed-down silently converts a staleness event into a blank globe layer |
| `is_active` for AIS ships derived from Redis key presence (not nav_status-aware timestamp arithmetic) | ITU-R M.1371 moored/anchored vessels report every 3 minutes — uniform timestamp threshold incorrectly marks them inactive |
| Stale filtering on list endpoints only — detail endpoints unaffected | Replay engine and click-to-inspect panels need historical rows; hard deletion or detail filtering breaks time-scrubber behavior |

**Preserved from v3.0:**
- useSettingsStore separate from useAppStore — prevents transient runtime values from persisting
- Settings gear icon NOT gated by cleanUI — settings must remain accessible in cinematic mode
- SVG icon canvases pre-rendered at module scope — TextureAtlas budget constraint

### Pending Todos

- Verify `position_source` (sv[16]) presence in live OpenSky data before writing assertions (may require authenticated endpoint)
- Confirm AIS nav_status threshold strategy: research recommends Redis-TTL-only for v4.0 simplicity

### Blockers/Concerns

None at roadmap stage. Two items flagged for Phase 19 and Phase 20 validation respectively (see Pending Todos).
