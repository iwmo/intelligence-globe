---
gsd_state_version: 1.0
milestone: v10.0
milestone_name: ADSB.lol Migration
status: completed
stopped_at: Completed 43-04-PLAN.md
last_updated: "2026-03-15T11:11:08.144Z"
last_activity: "2026-03-15 — Phase 43-02 complete: Phase 39 VALIDATION.md created with nyquist_compliant: true covering UI-01 through UI-04"
progress:
  total_phases: 6
  completed_phases: 6
  total_plans: 15
  completed_plans: 15
  percent: 73
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-15 after v10.0 milestone start)

**Core value:** A unified, visually impressive intelligence picture — satellites orbiting, aircraft moving, anomalies surfacing — all rendered on one polished 3D globe that feels operational and modern.
**Current focus:** v10.0 ADSB.lol Migration — replacing OpenSky + airplanes.live with ADSB.lol

## Current Position

Phase: 43 — Nyquist Validation Catchup (in progress)
Status: Phase 43 plan 01 complete — Phase 38 VALIDATION.md nyquist_compliant: true
Last activity: 2026-03-15 — Phase 43 plan 01 complete: Phase 38 VALIDATION.md updated to nyquist_compliant: true with all 13 task rows green and Sign-Off approved

Progress: [██████████████] 100% (15/15 plans across 6 phases)

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

### Decisions (Phase 43)

- 43-03: Phase 40 VALIDATION.md created from verified facts in 40-VERIFICATION.md (7/7 must-haves) — all per-task commands and statuses grounded in real evidence
- 43-03: Wave 0 marked N/A for phase 40 — plans 01/02 are filesystem/grep-verifiable (no test scaffold), plan 03 extended a pre-existing test file
- 43-01: All 13 per-task rows in 38-VALIDATION.md flipped to green — evidence from 38-VERIFICATION.md (11/11 passed 2026-03-15)
- 43-01: Wave 0 note added clarifying tests were created in plan 01 TDD RED phase, not pre-existing infrastructure
- 43-01: Approval date set to 2026-03-15 matching 38-VERIFICATION.md verified timestamp
- 43-02: wave_0_complete: true for Phase 39 VALIDATION.md — Vitest was installed in prior phases; no new test infrastructure was needed for phase 39
- 43-02: All four tasks individually listed in per-task map (39-01-01, 39-01-02, 39-02-01, 39-02-02) — both tasks in each plan share test file and requirement IDs but are mapped separately for traceability
- 43-04: Created Phase 41 VALIDATION.md retroactively from existing VERIFICATION.md and SUMMARY.md — both were complete and accurate, enabling exact field population
- 43-04: Wave 0 documented as TDD RED commit 88708d1; tests added to pre-existing file (not new file); wave_0_complete: true

### Decisions (Phase 42)

- 42-01: roll placed after type_code in detail return dict — matches list endpoint field order and groups with telemetry block
- 42-01: roll: number | null in TypeScript — matches Python Float | None; consistent with ias, tas, mach nullable numeric fields
- 42-01: No JSX roll render row added — phase 42 scope is API + interface parity only, not UI rendering
- 42-01: Docker VM disk full (100%) during execution — recovered by docker builder prune and postgres container restart; no schema changes needed

### Decisions (Phase 41)

- 41-01: registration-row and type-row placed after Mach row, before nav_modes chips — groups identification fields after performance telemetry (natural scan order)
- 41-01: Label abbreviations "Reg:" and "Type:" used — compact, fits monospace panel style without truncation
- 41-01: No refactor step needed — two JSX blocks are self-contained and match existing patterns exactly

### Decisions (Phase 40)

- 40-01: ingest_aircraft.py was never committed to git (untracked on disk) — git rm deleted from filesystem; --allow-empty commit recorded the event; file confirmed deleted
- 40-01: ingest_adsbiol.py lives at backend/app/tasks/ingest_adsbiol.py (not workers/) — plan artifact path was inaccurate but objective (delete dead OpenSky worker) was correct and achieved
- 40-02: staleTime and refetchInterval both set to 15_000 — matches ADSB.lol backend refresh (~15s), eliminates up-to-90s data lag; OpenSky comment removed as it referenced a retired data source
- 40-03: Added length and get to MockLabelCollection beyond plan spec — SatelliteLayer.tsx accesses labelColl.length and labelColl.get(i) in LOADED/POSITIONS handlers; required for render-time correctness
- 40-03: Cesium mock completeness rule established — every symbol in the component's cesium import block must appear in vi.mock('cesium') or the import resolves to undefined and crashes at module-scope instantiation

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

Last session: 2026-03-15T11:11:08.139Z
Stopped at: Completed 43-04-PLAN.md
Resume file: None
Next action: Plan and execute Phase 43 (Nyquist catch-up)
