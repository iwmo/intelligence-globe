# Project Research Summary

**Project:** Intelligence Globe v2.0 — WorldView Parity
**Domain:** Browser-based 3D OSINT geospatial intelligence platform (CesiumJS + FastAPI)
**Researched:** 2026-03-11
**Confidence:** HIGH (CesiumJS architecture, USGS, NOAA, OSM patterns) / MEDIUM (ADSB Exchange auth, AIS availability) / LOW (gpsjam.org data access)

## Executive Summary

Intelligence Globe v2.0 adds 12 new features onto a validated v1.0 foundation (CesiumJS 1.139, React 19, FastAPI, PostgreSQL + PostGIS, Redis, RQ, Docker Compose). The core architectural insight from research is that these 12 features split cleanly into four integration tiers: pure frontend visual changes, external tile services piped through CesiumJS ImageryLayer, new backend data pipelines, and new snapshot/event storage infrastructure. This tiered view drives both the build order and the risk profile — Tier 1 and 2 features carry zero backend risk and deliver instant visual payoff; Tier 4 (4D replay and OSINT event correlation) is the most architecturally complex and has a time dependency because the snapshot recorder must run for 24-48 hours before replay data is useful. Front-loading the lower-risk visual engine and tile overlay phases is the correct approach.

The two most dangerous implementation traps are the CesiumJS post-processing scope and the snapshot storage schema. Post-processing stages in CesiumJS apply to the entire scene's framebuffer — there is no per-layer scope — and stages must be created once at init and toggled, never created and destroyed per preset switch. The snapshot table must be range-partitioned by time from day one; retrofitting a live unpartitioned table of billions of rows requires downtime and is the single most likely source of catastrophic failure in the 4D replay phase. Both of these constraints must be treated as hard architectural requirements, not implementation details to address later. Three external data source risks require explicit fallback planning: ADSB Exchange migrated to a paid RapidAPI model in March 2025 with a tight monthly request budget, aisstream.io is beta with no SLA and server-initiated disconnects every 2 minutes, and gpsjam.org has no public API — the GPS jamming heatmap must be independently replicated by aggregating NIC/NACp fields from aircraft ADS-B data.

The recommended build order is: visual engine and cinematic HUD (Tier 1, frontend-only), tile overlay layers including weather radar and GPS jamming (Tier 2, no backend), new data pipelines for military flights and maritime AIS (Tier 3, new backend workers and routes), then snapshot infrastructure followed by the replay engine and OSINT event correlation (Tier 4). Street traffic particle simulation is architecturally isolated and can be deferred without blocking any other feature. The total v2.0 effort is approximately 7-8 weeks for a single developer working sequentially, with Tier 3 and Tier 4 parallelizable if a second contributor is available.

## Key Findings

### Recommended Stack

The v1.0 base stack requires no changes. v2.0 adds exactly three new npm packages: `mgrs` (2.1.0) for MGRS coordinate display in the HUD, `h3-js` (4.1.0) for decoding gpsjam H3 hex cell IDs into polygon boundaries, and `osmtogeojson` (3.0.0-beta.5) for converting Overpass API responses to GeoJSON for the particle simulation. No new Python packages are required for the backend — all new data sources are consumed either directly by the frontend (USGS, NOAA WMS, Overpass), relayed via existing FastAPI endpoints (AIS WebSocket), or fetched by existing RQ worker infrastructure (gpsjam CSV daily ingest). The entire post-processing visual system — NVG, Bloom, Black-and-White, Blur, Depth of Field — is built into CesiumJS 1.139's `PostProcessStageLibrary` and `PostProcessStageCollection`. FLIR and CRT effects require custom GLSL fragment shaders but no additional libraries.

**Core technologies (v2.0 additions only):**
- `mgrs@2.1.0` — MGRS coordinate conversion — MIT, zero deps, ships TS types, NGA-origin standard
- `h3-js@4.1.0` — H3 hex cell decode for GPS jamming heatmap — Uber library, native TS types, browser-compatible
- `osmtogeojson@3.0.0-beta.5` — Overpass API JSON to GeoJSON — stable 5+ year API despite beta label, ESM-compatible
- `CesiumJS PostProcessStageLibrary` — NVG, B&W, Bloom built-in — no additional library required
- `aisstream.io WebSocket API` — free AIS vessel positions — free/beta, bbox subscription, requires API key in backend
- `airplanes.live /v2/mil` — military aircraft feed — free, no auth, ADSBExchange v2 JSON schema
- `USGS Earthquake GeoJSON feed` — `all_day.geojson` — CORS-enabled, no auth, stable since 2012
- `NOAA nowCoast NEXRAD WMS` — weather radar overlay — CORS-enabled, WMS-T time support, CesiumJS-native integration
- `Overpass API` — OSM road network for particle simulation — free, bbox-scoped, CORS-enabled

### Expected Features

The 12 v2.0 features divide into three priority tiers. P1 features establish the new visual identity and should ship first. P2 features fill out the intelligence picture. P3 features are high-complexity with limited blocking dependencies and can slip without degrading the platform.

**Must have — table stakes (P1):**
- Visual style presets (NVG, CRT, FLIR, Noir) — no other open-source globe has switchable tactical visual modes; defines platform identity
- Cinematic HUD overlay — classification banner, MGRS readout, telemetry ticker — transforms the product from "web app" to "intelligence terminal"
- Post-processing parameter controls — Bloom, Sharpen, Gain sliders — high perceived quality, low implementation cost
- Landmark / city preset navigation — Q/W/E/R/T shortcuts, 5 curated geopolitical POIs — expected in every mapping tool
- Military flights layer — ADSB Exchange `/v2/mil` — primary reason OSINT researchers use ADSB Exchange over FlightRadar24
- Earthquake layer — USGS GeoJSON — low complexity, standard in all geo-intelligence tools

**Should have — differentiators (P2):**
- Maritime traffic layer — AIS vessels — ships are the third domain of geospatial intelligence; any situational awareness tool without ships is incomplete
- Weather radar overlay — NOAA NEXRAD WMS — operational context for aircraft diversions, maritime hazards, crisis response
- GPS Jamming heatmap — inferred from NIC/NACp fields — unique OSINT layer, no equivalent in any other open tool
- 4D Historical replay — snapshot-driven playback with timeline scrubber — FlightRadar24 charges premium for this; no open-source globe has it

**Defer (v2.1+, P3):**
- OSINT event correlation — satellite overpass lines + event filter tags — depends on replay infrastructure, high complexity, no other feature depends on it
- Street traffic particle simulation — synthetic aesthetic effect only, fully isolated from all other features, complexity-to-value ratio is unfavorable for v2.0

**Anti-features (do not build):**
- Real GPS jammer geolocation — sensor triangulation not possible from ADS-B data; label all cells as inferred degradation anomalies
- CesiumJS default Timeline widget for replay — not customizable enough for event dots, speed presets, and category coloring; build a custom React timeline component
- Per-object post-processing — CesiumJS PostProcessStage is screen-space only; selective per-object effects require stencil buffer hacks that are extremely fragile

### Architecture Approach

The recommended architecture extends the existing v1.0 patterns without structural changes. New frontend layer components follow the established `PointPrimitiveCollection` pattern from `AircraftLayer.tsx`. The unified `ScreenSpaceEventHandler` in `AircraftLayer.tsx` must be extended (not duplicated) to cover military and ship primitive ID namespaces — dual handlers cause race conditions. All new backend work follows the existing FastAPI router + RQ worker + SQLAlchemy model pattern. The AIS WebSocket connection must be maintained in the backend (not the browser) because the API key cannot be exposed in client-side JavaScript. The `useAppStore` Zustand store is extended with new slices for `visualPreset`, `postProcessUniforms`, replay state, and new layer flags; a separate `useReplayStore` Zustand slice is recommended for replay to isolate its state machine from the main store.

**Major components (new in v2.0):**
1. `PostProcessEngine.tsx` — singleton managing all CesiumJS PostProcessStage lifecycle; exposes `setPreset(name)` and `setUniform(preset, key, value)`; creates all stages at init and toggles them, never recreates on preset switch
2. `CinematicHUD.tsx` + `MGRSReadout.tsx` — React overlay with `pointer-events: none`; reads from Zustand store only, never from `viewer` directly; keeps HUD testable without a live viewer
3. `MilitaryLayer`, `MaritimeLayer`, `EarthquakeLayer`, `WeatherLayer`, `GPSJamLayer`, `TrafficLayer` — new layer components, all follow existing Primitive API pattern; `GPSJamLayer` renders as `GroundPrimitive` (not `ImageryLayer`) to avoid WebGL texture sampler budget pressure
4. `ReplayEngine.ts` — class (not React component) managing snapshot buffer, interpolation, and `viewer.clock` binding; state machine: IDLE | LOADING | PLAYING | PAUSED | SCRUBBING
5. `TimelinePanel.tsx` — custom React scrubber, NOT CesiumJS default widget; drives `ReplayEngine` via `useReplayStore`
6. `traffic.worker.ts` + `gps_jam.worker.ts` — Web Workers for CPU-intensive particle math and H3 polygon decode; zero-copy `Float32Array` transfer matching the existing `propagation.worker.ts` pattern
7. `layer_snapshots` PostgreSQL table — range-partitioned by day from day one; separate tables per layer type rather than polymorphic schema; daily retention job drops old partitions
8. `snapshot_recorder.py` RQ task — runs every 60 seconds, archives all layer states; 7-day rolling retention

### Critical Pitfalls

1. **Post-processing stages apply to the entire scene, not individual layers** — Create all preset stages at application init (never per preset switch) and toggle `stage.enabled`. Use a singleton `PostProcessManager`. Test every preset against the live v1.0 scene with 5,000+ satellites active, not on an empty demo. CesiumJS 1.121+ changed the default tonemapper to PBR Neutral — query and store the pre-existing HDR state on init and restore it when switching to Normal preset.

2. **Snapshot storage grows unboundedly without time partitioning** — Range-partition the `layer_snapshots` table by day from day one. Retrofitting a live unpartitioned table requires downtime. Use separate tables per layer type. At 60-second snapshot intervals across 5 layers, the table will exceed 100M rows within two weeks without partitioning.

3. **gpsjam.org has no public API — the heatmap must be independently replicated** — gpsjam.org derives its hexagonal heatmap from ADSB Exchange NIC/NACp fields. The integration must replicate this: aggregate aircraft with NIC < 7 or NACp < 7 into H3 hex cells, render as `GroundPrimitive` polygons (not `ImageryLayer`), and label every cell "GPS degradation anomaly — inferred from aircraft telemetry, not geolocated."

4. **ADSB Exchange is now fully paid via RapidAPI with a 10,000 req/month budget** — The free tier was discontinued March 2025. Auth is `X-RapidAPI-Key` header (not OpenSky-style Bearer token). Cache all responses in Redis with minimum 300-second TTL. Log daily request count and warn at 280/day. Build a `MilitaryFlightSource` abstraction with `adsb.fi` (free, same JSON schema) as a named fallback.

5. **AISstream.io disconnects every 2 minutes and has no SLA** — The subscription filter message must be sent within 3 seconds of WebSocket open. Implement exponential backoff reconnection. Cache last known vessel positions in Redis with a `stale_at` timestamp so the maritime layer degrades gracefully during reconnect rather than freezing silently.

6. **React HUD overlay blocks CesiumJS canvas pointer events** — Apply `pointer-events: none` to the HUD root element; selectively re-enable `pointer-events: auto` only on interactive sub-elements. Verify camera pan, scroll-zoom, and click-pick work after every HUD element addition.

7. **Multiple simultaneous ImageryLayer instances hit WebGL texture sampler limits** — WebGL 1.0 hardware (integrated GPUs, homelab NUCs) limits texture samplers. Limit active `ImageryLayer` instances to 3. Render the GPS jamming heatmap as `GroundPrimitive` to bypass this limit. Test with all layers enabled on integrated GPU hardware before marking any tile overlay phase complete.

## Implications for Roadmap

Based on research, the dependency graph drives a clear 6-phase structure. The snapshot recorder (Phase 4) must start accumulating data before the replay engine (Phase 5) is useful — this is the critical path constraint that determines the overall schedule.

### Phase 1: Visual Engine
**Rationale:** Zero backend risk, instant visual payoff, establishes the platform aesthetic before any data layers are added. Building this first forces the `PostProcessEngine` singleton to be established correctly before subsequent layers complicate the scene — catching the stage scope and stale uniform pitfalls here is far cheaper than retrofitting with live data layers present.
**Delivers:** Visual style presets (NVG, CRT, FLIR, Noir), post-processing parameter sliders (Bloom, Sharpen, Gain, Scanlines, Pixelation), Cinematic HUD overlay (classification banner, MGRS readout, telemetry ticker, REC timestamp), Landmark preset navigation (Q/W/E/R/T shortcuts + bottom quick-jump bar with 5 curated geopolitical POIs).
**Addresses:** P1 features — visual identity and navigation foundation.
**Avoids:** PostProcessStage scope bleed (all preset stages created at init, never on switch), stale uniform closures (uniforms as functions reading from store ref, not captured values), HUD pointer-event blocking (`pointer-events: none` on root, per-element opt-in for interactive controls).

### Phase 2: Tile Overlay Layers
**Rationale:** No backend changes required. Leverages CesiumJS `WebMapServiceImageryProvider` and `GroundPrimitive` patterns. Adds three high-value intelligence layers in approximately 3-4 days total. Running this before Phase 3 confirms the WebGL texture sampler budget on target hardware before backend pipeline work begins.
**Delivers:** Weather radar overlay (NOAA NEXRAD WMS, `WebMapServiceImageryProvider`, opacity slider), GPS Jamming heatmap (NIC/NACp aggregation from ADSB Exchange data, H3 hex polygons via `h3-js` in a Web Worker, rendered as `GroundPrimitive` with green/yellow/red severity coloring), Earthquake layer (USGS GeoJSON `all_day.geojson`, magnitude-scaled `PointPrimitiveCollection`, 5-minute refresh).
**Uses:** `h3-js`, `WebMapServiceImageryProvider`, USGS GeoJSON feed, NOAA nowCoast WMS endpoint.
**Avoids:** WebGL texture sampler budget overrun (GPS jam as `GroundPrimitive`, not `ImageryLayer`); NOAA WMS `TIME` parameter must be included in GetMap requests from the start; USGS feed must not be polled faster than 5-minute intervals (60-second cache on the USGS side).

### Phase 3: New Data Pipelines
**Rationale:** Follows established RQ worker + FastAPI router + SQLAlchemy model pattern from v1.0. Military and ships pipelines are independent of each other and can be parallelized. Street traffic is fully isolated and can be deprioritized within this phase if schedule pressure increases.
**Delivers:** Military flights layer (ADSB Exchange `/v2/mil` via `airplanes.live`, Redis cache with 300s TTL, amber `PointPrimitiveCollection`), Maritime traffic layer (AIS via `aisstream.io` WebSocket relayed through FastAPI backend, exponential backoff reconnection, cyan `PointPrimitiveCollection`), Street traffic particle simulation (OSM Overpass API, `traffic.worker.ts`, single batched `PointPrimitiveCollection`, viewport-gated below 500 km altitude).
**Implements:** `models/military.py`, `models/ship.py`, `tasks/ingest_military.py`, `workers/ingest_ships.py`, `api/routes_military.py`, `api/routes_ships.py`, `MilitaryLayer.tsx`, `MaritimeLayer.tsx`, `TrafficLayer.tsx`.
**Avoids:** ADSB Exchange request budget exhaustion (300s TTL, daily request counter, warn at 280/day); AIS silent freeze (exponential backoff, Redis position cache with `stale_at`, visible connection status indicator); one `ParticleSystem` per road segment (single batched `PointPrimitiveCollection` with Web Worker — `ParticleSystem` is one WebGL draw call per instance and collapses at 200+ segments).

### Phase 4: Snapshot Infrastructure
**Rationale:** The snapshot recorder must be deployed and running before replay is useful. Building and starting it early — while the replay UI is still being designed — gives data time to accumulate. This is the critical path gate for Phase 5. Starting it during Phase 3 (as a parallel backend task) is recommended over waiting for Phase 3 to complete.
**Delivers:** `layer_snapshots` range-partitioned PostgreSQL schema (daily partitions per layer type: `snapshots_aircraft`, `snapshots_ships`, `snapshots_military`), `snapshot_recorder.py` RQ task (60-second interval, batch INSERT, 7-day rolling retention via partition drop), `routes_replay.py` read-only endpoints (data starts flowing immediately, UI built in Phase 5).
**Avoids:** Snapshot table unbounded growth (partitioning must be in the initial schema — retrofitting a live table requires hours of downtime); monolithic polymorphic snapshots table (use per-layer tables for independent retention and simpler queries); 1Hz snapshot rate (60s + frontend interpolation is visually sufficient at 1/3600th the storage cost).

### Phase 5: Replay Engine
**Rationale:** Requires snapshot data accumulated from Phase 4 (minimum 24-48 hours of live data for meaningful replay). The most complex frontend work in the entire v2.0 scope. Drives modification of all existing layer components to respect `replayActive` state.
**Delivers:** `ReplayEngine.ts` class (snapshot buffer, linear interpolation between 60s snapshots, `viewer.clock` binding), `useReplayStore.ts` Zustand slice (state machine: IDLE | LOADING | PLAYING | PAUSED | SCRUBBING), `TimelinePanel.tsx` (custom scrubber, play/pause/speed controls at 0.25x/1x/5x/10x/60x/600x, event dots by category), LIVE/PLAYBACK mode toggle. All layer components modified to read from replay positions when `replayActive === true`.
**Avoids:** CZML for replay (not flexible enough for multi-layer custom timeline UI); CesiumJS default Timeline widget (not customizable enough — confirmed anti-feature); replay JSON overwhelming the browser (paginate by 10-minute chunks, stream via time-bounded API calls); SGP4 propagation on main thread during scrub (use snapshot table for aircraft/ships, propagate satellites from TLEs using the existing worker).

### Phase 6: OSINT Event Correlation
**Rationale:** Depends on satellite data already in the database (v1.0). Benefits from the platform being visually complete and replay working — it is the capstone "intelligence analyst" feature. Independent from replay but most powerful when used in playback mode to correlate satellite overpasses with historical events.
**Delivers:** `OSINTEventLayer.tsx` (event markers as `BillboardCollection`, satellite overpass arc lines as `PolylineCollection`), `OSINTEventPanel.tsx` (manual event entry form, event list, tag filter chips: KINETIC / AIRSPACE / MARITIME / SEISMIC / JAMMING), `routes_osint.py` (event CRUD + SGP4-based overpass computation endpoint), `models/osint_event.py` (PostGIS spatial point, tags array, source URL, timestamp).
**Avoids:** Overpass line computation for all 5,000 satellites on the main thread (backend computes, filters elevation > 5° before returning results, caches by event_id + TLE version); stale TLEs for overpass accuracy (assert TLE age < 7 days before computation, fail visibly if exceeded — SGP4 error grows to kilometers beyond 7 days).

### Phase Ordering Rationale

- **Frontend-first ordering (Phases 1-2)** eliminates backend risk from the critical path during the most uncertain early phase. Both phases can be demo'd without touching the backend.
- **Snapshot recorder starts in Phase 4**, not Phase 5, because time-series data cannot be retroactively generated. Starting it as a parallel task during Phase 3 backend work is the optimal path.
- **Street traffic (Phase 3) is the lowest-priority item** in any phase — it has no dependencies and no dependents. If Phases 3-5 run long, street traffic slips to v2.1 without affecting any other feature.
- **AIS backend (Phase 3) must be backend-proxied** — this is a hard security constraint from aisstream.io's key-in-subscription-message design, not an architectural preference.
- **OSINT event correlation (Phase 6) is last** because it is the highest-complexity feature that depends on stable satellite data, a working event model, and benefits from a complete replay context.

### Research Flags

Phases likely needing `/gsd:research-phase` deeper research during planning:
- **Phase 3 (Military flights):** ADSB Exchange RapidAPI current rate limits and the `airplanes.live` community endpoint reliability should be confirmed by live testing before writing the ingestion worker. Also confirm the `adsb.fi` fallback endpoint serves identical JSON schema.
- **Phase 3 (Maritime AIS):** Register for aisstream.io API key and run a test connection before designing reconnection logic. Observe the actual disconnect timing and subscription window behavior rather than relying on documentation alone.
- **Phase 4 (Snapshot schema):** PostgreSQL daily range partition DDL, automatic partition creation (pg_partman or manual), and the drop schedule should be prototyped before the Alembic migration is written.
- **Phase 5 (Replay interpolation):** The linear lerp strategy between 60-second snapshots should be validated for visual acceptability at 10x and 60x playback speeds before committing to 60s granularity.

Phases with well-documented patterns (skip research-phase):
- **Phase 1 (Visual Engine):** CesiumJS `PostProcessStageLibrary` built-in stages are verified in official docs. React CSS overlay with `pointer-events: none` is a standard pattern.
- **Phase 2 (Tile Overlays):** `WebMapServiceImageryProvider` and `GroundPrimitive` are established CesiumJS patterns. USGS and NOAA endpoints are verified federal services with stable APIs.
- **Phase 6 (OSINT Events):** SGP4 propagation already runs in v1.0 via the satellite worker. FastAPI CRUD router pattern is established. No new patterns required.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | CesiumJS, USGS, NOAA, Overpass all verified via official docs. `mgrs`, `h3-js`, `osmtogeojson` verified on npm with TS types confirmed. AIS and military flight sources are MEDIUM — community-run services with no SLA. |
| Features | HIGH | Feature set is grounded in verified APIs and established CesiumJS patterns. Complexity estimates (LOW/MEDIUM/HIGH) are internally consistent. Anti-features are clearly sourced (gpsjam.org no-API confirmed from GitHub source; CesiumJS PostProcessStage screen-scope limitation confirmed from official community tracker). |
| Architecture | HIGH | Integration tiers, component boundaries, and data flow diagrams are derived from CesiumJS official docs and confirmed v1.0 patterns. AIS proxy requirement is a hard security constraint. Snapshot partitioning strategy is sourced from PostgreSQL community and production case studies. |
| Pitfalls | HIGH | Post-processing scope (CesiumJS official community), snapshot growth (PostgreSQL partitioning case study), ADSB Exchange paid API (official ADSB Exchange API page, confirmed March 2025 change), gpsjam.org no-API (confirmed from project GitHub repo), AISstream.io disconnect behavior (confirmed from aisstream.io GitHub). |

**Overall confidence:** HIGH

### Gaps to Address

- **gpsjam.org CSV URL format** — The URL pattern `https://gpsjam.org/data/YYYY-MM-DD.csv` is inferred from community references and source code analysis, not officially documented. Before writing the RQ ingest worker, verify by fetching the URL directly. If inaccessible, the NIC/NACp aggregation path from ADSB Exchange data is the implementation route — no fallback research needed, the approach is already designed.
- **ADSB Exchange RapidAPI current pricing and rate limits** — Confirmed as paid; the 10,000 req/month figure is from the Basic plan. Confirm current plan options before committing to a polling interval design. `airplanes.live` and `adsb.fi` are free fallbacks with identical JSON schema that eliminate this dependency entirely if the budget is prohibitive.
- **aisstream.io API key registration and live behavior** — Must register via GitHub OAuth before writing any AIS code. The 3-second subscription window and 2-minute disconnect cadence should be observed in a test connection before the reconnection logic is designed.
- **NOAA nowCoast WMS rate limits** — No published SLA or rate limit documentation found. If multiple browser sessions hammer the WMS endpoint, the homelab VPS IP may be rate-limited silently. Implement backend tile caching in Redis as a contingency plan — the architecture supports this without structural changes.
- **WebGL texture sampler headroom on target hardware** — Test with all Phase 2 layers active simultaneously on the intended deployment hardware (especially integrated GPU machines) before Phase 3 begins to confirm the 3-layer `ImageryLayer` budget is not already exceeded by v1.0 layers.

## Sources

### Primary (HIGH confidence)
- [CesiumJS PostProcessStageLibrary docs](https://cesium.com/learn/cesiumjs/ref-doc/PostProcessStageLibrary.html) — built-in stage functions verified
- [CesiumJS PostProcessStageCollection docs](https://cesium.com/learn/cesiumjs/ref-doc/PostProcessStageCollection.html) — bloom property, stage management, FXAA
- [CesiumJS Clock docs](https://cesium.com/learn/cesiumjs/ref-doc/Clock.html) — multiplier, clockRange, onTick
- [CesiumJS WebMapServiceImageryProvider docs](https://cesium.com/learn/ion-sdk/ref-doc/WebMapServiceImageryProvider.html) — WMS-T clock integration
- [CesiumJS 1.121 release notes](https://cesium.com/blog/2024/09/04/cesium-releases-in-september-2024/) — PBR Neutral tonemapper, 4x MSAA defaults
- [USGS Earthquake GeoJSON feed](https://earthquake.usgs.gov/earthquakes/feed/v1.0/geojson.php) — official feed format, 60-second cache policy
- [NOAA nowCoast NEXRAD WMS GetCapabilities](https://nowcoast.noaa.gov/arcgis/services/nowcoast/radar_meteo_imagery_nexrad_time/MapServer/WMSServer?request=GetCapabilities&service=WMS) — endpoint and layer structure verified
- [ADSB Exchange API Lite — RapidAPI](https://www.adsbexchange.com/api-lite/) — paid model confirmed, March 2025 migration confirmed
- [airplanes.live API guide](https://airplanes.live/api-guide/) — `/v2/mil` endpoint, free/no-auth confirmed
- [aisstream.io documentation](https://aisstream.io/documentation) — WebSocket endpoint, auth, subscription format, beta status
- [aisstream.io GitHub](https://github.com/aisstream/aisstream) — 3-second subscription window, disconnect behavior confirmed
- [gpsjam.org FAQ](https://gpsjam.org/faq) — NIC/NACp derivation confirmed, no public API confirmed
- [gpsjam.org GitHub (guofengji)](https://github.com/guofengji/gpsjam.org) — "each day of data is in one CSV file" confirmed
- [Overpass API OSM wiki](https://wiki.openstreetmap.org/wiki/Overpass_API) — query language, bbox constraints, per-query limits
- [h3-js GitHub](https://github.com/uber/h3-js) — v4.1.0, native TS types, browser-compatible
- [CesiumJS issue: ImageryLayer texture sampler limits](https://github.com/CesiumGS/cesium/issues/3857) — sampler budget constraint confirmed
- [CesiumJS community: PostProcessStage scope limitation](https://community.cesium.com/t/shaders-and-selected-primitives-in-postprocessstage/8904) — scene-wide scope confirmed, selected array limitations documented
- [CesiumJS community: HTML overlay pointer events](https://community.cesium.com/t/html-overlay-touch-gestures-problem/9987) — pointer-events: none requirement confirmed

### Secondary (MEDIUM confidence)
- [adsb.fi opendata GitHub](https://github.com/adsbfi/opendata) — free fallback for military data, same ADSBExchange v2 JSON schema confirmed
- [osmtogeojson npm](https://www.npmjs.com/package/osmtogeojson) — beta label stable in practice, 5+ year unchanged API
- [PostgreSQL partitioning case study](https://medium.com/@mbhatt2018/how-we-supercharged-our-snapshot-table-with-postgresql-partitioning-saved-big-on-infrastructure-2d9c10d23254) — range partition strategy for time-series tables validated
- [SGP4 accuracy with TLE age](https://github.com/skyfielders/python-skyfield/discussions/929) — 7-day TLE freshness requirement for acceptable position accuracy

### Tertiary (LOW confidence)
- gpsjam.org CSV URL pattern `https://gpsjam.org/data/YYYY-MM-DD.csv` — inferred from community references and Express app source structure; not officially documented; must be verified by direct URL fetch before building the ingest worker

---
*Research completed: 2026-03-11*
*Ready for roadmap: yes*
