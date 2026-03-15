---
gsd_state_version: 1.0
milestone: v10.0
milestone_name: ADSB.lol Migration
status: completed
stopped_at: Completed 39-frontend-telemetry-ui plan 02 (39-02-PLAN.md) — v10.0 milestone complete
last_updated: "2026-03-15T09:38:40.629Z"
last_activity: 2026-03-15 — 39-02 roll banking rotation complete; phase 39 and v10.0 milestone done
progress:
  total_phases: 2
  completed_phases: 2
  total_plans: 6
  completed_plans: 6
  percent: 100
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-15 after v10.0 milestone start)

**Core value:** A unified, visually impressive intelligence picture — satellites orbiting, aircraft moving, anomalies surfacing — all rendered on one polished 3D globe that feels operational and modern.
**Current focus:** v10.0 ADSB.lol Migration — replacing OpenSky + airplanes.live with ADSB.lol

## Current Position

Phase: 39 — Frontend Telemetry UI (complete — 2/2 plans done)
Status: 39-02 complete; roll banking rotation with computeIconRotation helper; v10.0 ADSB.lol Migration milestone complete
Last activity: 2026-03-15 — 39-02 roll banking rotation complete; phase 39 and v10.0 milestone done

Progress: [██████████] 100% (2/2 plans in phase 39 — milestone complete)

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

### Decisions (Phase 39)

- 39-01: Used data-testid attributes for emergency-badge, nav-modes-section, ias-row, tas-row, mach-row — precise test targeting without relying on text content
- 39-01: Nav modes and airspeed rows placed after the existing divider — keeps new telemetry alongside altitude/speed/heading block
- 39-01: Emergency badge placed immediately after the Flight callsign header row — highest-urgency information surfaces first
- 39-01: SatelliteLayer.cleanup.test.tsx 2 pre-existing failures confirmed via git stash — out of scope, deferred
- 39-02: computeIconRotation extracted as named export from AircraftLayer.tsx — enables unit testing without Cesium mocks; roll applied as additive offset to heading: toRadians(-(trueTrack ?? 0) + (roll ?? 0))
- 39-02: ac.roll passed directly (typed number | null from AircraftRecord) — no ?? null needed since type already nullable

### Decisions (Phase 38)

- 38-01: Module-level import of ingest_adsbiol (not importorskip) — all 13 tests fail atomically at collection time, cleaner RED signal
- 38-01: test_ingest_aircraft.py replaced with module-level pytest.skip to retire OpenSky ingest tests without collection errors
- 38-01: test_no_opensky_references uses xfail+FileNotFoundError guard — transitions from xfail to real assertion in Plan 03
- 38-02: Hand-written migration only — position_snapshots is range-partitioned, autogenerate would corrupt it
- 38-02: MilitaryAircraft registration and aircraft_type left unchanged — already exist in original schema
- 38-02: nav_modes stored as JSONB (list of mode strings) matching ADSB.lol field shape
- 38-03: Synchronous redis_client at module level — test mock contract requires MagicMock, not aioredis AsyncMock
- 38-03: os.getenv() inside function body for adsbio_base_url — settings singleton cannot reflect patched env; getenv reads fresh each call
- 38-03: Tombstone sweep guarded by box_param is None — viewport bbox queries must not tombstone out-of-view aircraft
- 38-04: Retired test_ingest_military.py with module-level pytest.skip (mirrors test_ingest_aircraft.py pattern from Plan 01); file was not pre-retired as plan assumed

### Pending Todos

None.

### Blockers/Concerns

None.

## Session Continuity

Last session: 2026-03-15T09:33:53Z
Stopped at: Completed 39-frontend-telemetry-ui plan 02 (39-02-PLAN.md) — v10.0 milestone complete
Resume file: None
Next action: v10.0 ADSB.lol Migration milestone complete — all 6 plans across 2 phases done
