---
gsd_state_version: 1.0
milestone: v2.0
milestone_name: WorldView Parity
status: executing
stopped_at: Completed 08-new-data-pipelines-military-maritime/08-06-PLAN.md
last_updated: "2026-03-12T07:15:00.000Z"
last_activity: 2026-03-12 — Phase 8 gap closure complete (pv === null null guard in propagation.worker.ts; all 9 UAT tests pass)
progress:
  total_phases: 6
  completed_phases: 2
  total_plans: 10
  completed_plans: 10
  percent: 35
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-11 after v2.0 milestone start)

**Core value:** A unified, visually impressive intelligence picture — satellites orbiting, aircraft moving, anomalies surfacing — all rendered on one polished 3D globe that feels operational and modern.
**Current focus:** v2.0 WorldView Parity — ready to begin Phase 7 planning

## Current Position

Phase: 08 — New Data Pipelines: Military + Maritime
Plan: 06 (complete)
Status: Complete — Plans 01, 02, 03, 04, 05, 06 all complete; Phase 8 fully done
Last activity: 2026-03-12 — Phase 8 gap closure complete (pv === null null guard; all UAT tests pass)

Progress: [####______] 40% (v2.0 milestone)

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
| Phase 07-visual-engine-navigation P01 | 8 | 2 tasks | 6 files |
- [Phase 07-visual-engine-navigation]: Wave 0 stub pattern uses vi.mock without static import to avoid Vite import analysis failure on non-existent modules
- [Phase 07-visual-engine-navigation]: VisualPreset and PostProcessUniforms types exported from useAppStore.ts as single source of truth for downstream components
- [Phase 07-visual-engine-navigation]: postProcessUniforms setter uses spread merge pattern to support partial uniform updates from individual UI sliders
| Phase 07-visual-engine-navigation P04 | 3 | 2 tasks | 6 files |
| Phase 07-visual-engine-navigation P03 | 3min | 1 tasks | 3 files |
- [Phase 07-visual-engine-navigation]: LandmarkNav navigation goes through viewerRegistry singleton to avoid prop drilling
- [Phase 07-visual-engine-navigation]: cancelFlight() called before every flyToLandmark to prevent CesiumJS concurrent flight errors on rapid keypresses
- [Phase 07-visual-engine-navigation]: Distance-proportional flight duration: Math.hypot(deltaLon,deltaLat)/30 clamped 0.5s-3.5s
- [Phase 07-visual-engine-navigation]: getCameraGridRef exported from CinematicHUD.tsx (not a separate file) — keeps MGRS logic co-located with its consumer component
- [Phase 07-visual-engine-navigation]: Polar guard uses explicit numeric check (lat > 84 || lat < -80) rather than catching forward() errors — more explicit and testable
| Phase 07-visual-engine-navigation P02 | 5 | 2 tasks | 4 files |
- [Phase 07-visual-engine-navigation]: CRT as PostProcessStageComposite (scanlines + barrel/aberration passes); scene.preRender is scene-level not postProcessStages-level; PostProcessPanel standalone export for Plan 05 App.tsx wiring
| Phase 07-visual-engine-navigation P05 | 20 | 2 tasks | 1 files |
- [Phase 07-visual-engine-navigation]: PostProcessPanel rendered as left-side floating panel — RightDrawer has no children prop
- [Phase 07-visual-engine-navigation]: CinematicHUD and LandmarkNav mounted unconditionally outside cleanUI gate so telemetry and nav persist in Clean UI mode
| Phase 08-new-data-pipelines-military-maritime P01 | 6 | 2 tasks | 6 files |
- [Phase 08-new-data-pipelines-military-maritime]: Wave 0 backend API test pattern: AsyncClient(ASGITransport(app=app)) mirrors aircraft test pattern for military + ships
- [Phase 08-new-data-pipelines-military-maritime]: test_military_detail and test_ship_detail assert 404 (not 422) to force routes to exist before GREEN
- [Phase 08-new-data-pipelines-military-maritime]: Frontend smoke tests use static import after vi.mock() — no vi.hoisted() needed for simple cesium/store/hook mocks
| Phase 08-new-data-pipelines-military-maritime P03 | ~15min | 2 tasks | 9 files |
- [Phase 08-new-data-pipelines-military-maritime]: MMSI returned as raw int from parse_ais_message() to satisfy test assertion (result["mmsi"] == 123456789); str() coercion happens at DB write time in batch_flush_ships_to_pg
- [Phase 08-new-data-pipelines-military-maritime]: routes_ships.py uses lat/lon/heading key aliases (not latitude/longitude/true_heading) to match test_ships.py contract
- [Phase 08-new-data-pipelines-military-maritime]: Ships migration chain: down_revision set to a1b2c3d4e5f6 (military) to resolve dual-head Alembic conflict with Plan 02 migration
- [Phase 08-new-data-pipelines-military-maritime]: websockets import deferred inside run_ais_worker() body to keep module importable in test environments without websockets installed
| Phase 08-new-data-pipelines-military-maritime P02 | 15 | 2 tasks | 6 files |
- [Phase 08-new-data-pipelines-military-maritime]: routes_military.py returns lat/lon keys (matching test contract) not latitude/longitude
- [Phase 08-new-data-pipelines-military-maritime]: MilitaryAircraft model stores altitude in FEET as received from airplanes.live (not normalised to metres)
| Phase 08-new-data-pipelines-military-maritime P04 | 4 | 2 tasks | 11 files |
- [Phase 08-new-data-pipelines-military-maritime]: Ship heading 511 displayed as N/A (AIS standard: value 511 means heading not available)
- [Phase 08-new-data-pipelines-military-maritime]: layers.militaryAircraft and layers.ships default false — user opt-in prevents globe clutter on first load
- [Phase 08-new-data-pipelines-military-maritime]: ShipLayer omits lerp rAF loop — direct position update sufficient for ship update cadence (30s)
| Phase 08-new-data-pipelines-military-maritime P05 | 5 | 1 tasks | 2 files |
- [Phase 08-new-data-pipelines-military-maritime]: MilitaryAircraftLayer and ShipLayer mounted always-on in App.tsx — manage own visibility via store (no conditional mount gate)
- [Phase 08-new-data-pipelines-military-maritime]: ShieldAlert and Anchor icons used for MIL/SHIP toggles — confirmed present in installed lucide-react before editing
| Phase 08-new-data-pipelines-military-maritime P06 | ~10min | 2 tasks | 1 files |
- [Phase 08-new-data-pipelines-military-maritime]: pv === null guard placed before typeof pv.position === 'boolean' check — satellite.js returns null (not { position: false }) for decayed TLEs
- [Phase 08-new-data-pipelines-military-maritime]: All three call sites patched in single commit (PROPAGATE, COMPUTE_ORBIT, GET_POSITION) — split-site patch would leave crash paths open

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

Last session: 2026-03-12T07:15:00.000Z
Stopped at: Completed 08-new-data-pipelines-military-maritime/08-06-PLAN.md
Resume: Phase 8 complete — begin Phase 9 planning (GPS Jamming layer)
