---
gsd_state_version: 1.0
milestone: v10.0
milestone_name: ADSB.lol Migration
status: planning
stopped_at: ~
last_updated: "2026-03-15"
last_activity: 2026-03-15 — v10.0 milestone started, requirements defined
progress:
  total_phases: 0
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-15 after v10.0 milestone start)

**Core value:** A unified, visually impressive intelligence picture — satellites orbiting, aircraft moving, anomalies surfacing — all rendered on one polished 3D globe that feels operational and modern.
**Current focus:** v10.0 ADSB.lol Migration — replacing OpenSky + airplanes.live with ADSB.lol

## Current Position

Phase: Not started (defining roadmap)
Status: Requirements defined — ready for roadmap creation
Last activity: 2026-03-15 — v10.0 milestone started

## Accumulated Context

### ADSB.lol API (verified live)

- Base URL: `https://re-api.adsb.lol`
- Access: feeder-only, IP-restricted (user is an active ADSB.lol feeder — confirmed)
- Auth: none (IP-based)
- Key endpoints: `/?all_with_pos` (all aircraft with position), `/?all_with_pos&filter_mil` (military only), `/?box=<lat_s>,<lat_n>,<lon_w>,<lon_e>` (bounding box)
- Response tested live: 4,717 aircraft with position; 25 military aircraft
- Data freshness: `seen` field in seconds — aircraft update sub-second vs OpenSky's 90s poll
- All fields in feet (alt_baro, alt_geom) — same as airplanes.live, different from OpenSky (metres)
- Rich fields available: `emergency`, `nav_modes`, `ias`, `tas`, `mach`, `roll`, `r` (registration), `t` (type), `desc`

### Architecture Impact

- `ingest_aircraft.py` and `ingest_military.py` → replaced by single `ingest_adsbiol.py`
- `aircraft` table: altitude already in feet (airplanes.live was also feet; OpenSky was metres → need to verify current state)
- `military_aircraft` table: same schema update path
- Remove: OPENSKY_CLIENT_ID, OPENSKY_CLIENT_SECRET env vars; OAuth2 token fetch loop; credit budget logic
- Add: ADSBIO_BASE_URL env var (default: `https://re-api.adsb.lol`)
- Polling interval: can be reduced from 90s to ~15s (no credit cap)

### Preserved from v9.0

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

None.

## Session Continuity

Last session: 2026-03-15
Stopped at: v10.0 milestone start — roadmap pending
Resume file: None
Next action: /gsd:plan-phase 38
