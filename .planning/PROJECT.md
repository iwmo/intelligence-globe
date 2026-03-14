# OpenSignal Globe

## What This Is

A browser-based 3D geospatial intelligence platform that visualizes satellites, aircraft, military flights, ships, GPS jamming, and OSINT events on an interactive globe using only open-source tools and public data sources. Built for homelab/VPS deployment with Docker, featuring a cinematic dark-themed UI with switchable visual style presets (NVG, CRT, FLIR), a 4D timeline replay engine, OSINT event correlation with satellite overpass lines, fully polished draggable panels and custom SVG entity icons, and data reliability guarantees — stale positions filtered from all live endpoints, freshness metadata exposed in every API response.

## Core Value

A unified, visually impressive intelligence picture — satellites orbiting, aircraft moving, anomalies surfacing — all rendered on one polished 3D globe that feels operational and modern.

## Requirements

### Validated

- ✓ 3D CesiumJS globe with terrain, atmosphere, day/night shading, stars — v1.0
- ✓ Satellite tracking with orbit paths and ground tracks from CelesTrak TLEs — v1.0
- ✓ Aircraft tracking with trails from OpenSky Network API — v1.0
- ✓ Layer toggles for each data type — v1.0
- ✓ Click-to-inspect metadata panels (satellites and aircraft) — v1.0
- ✓ Search by satellite name, NORAD ID, callsign, ICAO24 — v1.0
- ✓ Region/altitude/constellation filtering — v1.0
- ✓ Dark cinematic theme with glowing accents — v1.0
- ✓ Docker Compose deployment stack (automated migrations) — v1.0
- ✓ FastAPI backend with PostgreSQL + PostGIS — v1.0
- ✓ 60 FPS at full scene load (5,000+ satellites + aircraft) — v1.0
- ✓ Visual style presets: NVG, CRT, FLIR, Noir, Normal with real-time sliders — v2.0
- ✓ Cinematic HUD overlay with MGRS coordinates, classification markings, REC timestamp — v2.0
- ✓ Clean UI mode (hide all chrome for screenshots) — v2.0
- ✓ Landmark/city quick-jump navigation with keyboard shortcuts (Q/W/E/R/T) — v2.0
- ✓ Military flights layer (airplanes.live /v2/mil, orange icons, 300s cadence) — v2.0
- ✓ AIS maritime traffic layer with WebSocket worker and click-to-inspect — v2.0
- ✓ GPS jamming heatmap via H3 hexagons from NIC/NACp ADS-B field aggregation — v2.0
- ✓ Street traffic particle simulation, altitude-gated, viewport-scoped OSM road fetch — v2.0
- ✓ Time-partitioned PostgreSQL snapshot infrastructure (60s intervals, 7-day retention) — v2.0
- ✓ LIVE/PLAYBACK toggle with timeline scrubber, speed controls (1m/s–1h/s) — v2.0
- ✓ OSINT event markers on timeline with category filtering — v2.0
- ✓ Satellite overpass arc lines to area of interest during replay — v2.0
- ✓ OSINT event entry panel (location, timestamp, category, source URL) — v2.0
- ✓ Free-floating draggable panels replacing sidebar — position/size in localStorage, +/− collapse — v3.0
- ✓ Custom SVG billboard icons for aircraft, military, ships with NearFarScalar altitude scaling — v3.0
- ✓ Satellite PointPrimitive markers with scaleByDistance (GPU budget constraint — no billboards at 5,000+ entities) — v3.0
- ✓ Double-click zoom toward cursor with 200ms LEFT_CLICK debounce — v3.0
- ✓ CameraControlWidget: on-screen +/− zoom buttons and Top-down/45°/Horizon tilt presets — v3.0
- ✓ Persistent settings panel (Zustand persist, localStorage) — defaultLayers, defaultPreset, defaultMode, defaultCamera — v3.0
- ✓ Alembic hand-written migration adds freshness lifecycle columns across all 4 tables with zero-downtime defaults — v4.0
- ✓ Shared `app/freshness.py` module with env-var configurable stale thresholds (pydantic-settings) — v4.0
- ✓ Commercial aircraft freshness: time_position, geo_altitude, vertical_rate, position_source, fetched_at, is_active; stale rows filtered from /api/aircraft — v4.0
- ✓ Military aircraft freshness: fetched_at, last_seen_at, is_active lifecycle; tombstone sweep; stale filter on /api/military — v4.0
- ✓ Ship freshness: last_seen_at, is_active lifecycle derived from Redis AIS TTL; stale filter on /api/ships — v4.0
- ✓ GPS jamming freshness transparency: aggregated_at, source_fetched_at, source_is_stale metadata; stale cells returned with source_is_stale=true (not empty set) — v4.0
- ✓ Full 95-test DB-level integration suite verifying all freshness contracts and route preservation — v4.0
- ✓ `isPlaying` promoted to `useAppStore`; `useViewerClock` hook syncs CesiumJS globe day/night shading to replay timestamp — v5.0
- ✓ `resolveTimestamp` pure function drives satellite historical propagation; pause guard freezes satellites instantly (null → skip PROPAGATE dispatch) — v5.0
- ✓ All 5 live-data layers (aircraft, ships, military, GPS jamming, street traffic) guarded against playback contamination; `queryClient.invalidateQueries()` on LIVE return eliminates 90s stale-data window — v5.0
- ✓ End-to-end 2-hour replay verified; PlaybackBar tick() auto-stop at window boundary; FPS gate ≥30 at 15m/s with all layers active — v5.0
- ✓ Stale entity grey-tint (`Color.GRAY.withAlpha(0.4)`) in LIVE mode: `is_stale` field from backend routes serialised through React Query to Cesium billboards in aircraft, ships, and military layers — v5.0
- ✓ docker-compose.yml uses `:?error` mandatory syntax for all credentials; `.dockerignore` files prevent `.env` from build contexts; `.env.example` documents all required variables — v6.0
- ✓ Static API key auth on `POST /api/osint-events` via `X-API-Key` header; `verify_api_key` FastAPI dependency; 6-test auth suite — v6.0
- ✓ nginx reverse-proxy on port 80 serves compiled Vite bundle and proxies `/api/`; healthchecks on all services; dev override restores port 8000 — v6.0
- ✓ GitHub Actions CI: 4 parallel jobs (pytest, vitest+tsc, gitleaks, docker build) gating every push/PR — v6.0
- ✓ Root README.md with numbered quick-start, API keys table, architecture diagram, credential rotation warning; MIT LICENSE added — v6.0
- ✓ `VITE_API_KEY` build arg wired into Dockerfile and CI; `OsintEventPanel` sends `X-API-Key` on every POST — v6.0 (Phase 32 gap closure)

**Deferred to future milestones:**
- [ ] Dedicated freshness endpoints: /api/military/freshness and /api/ships/freshness (FRESH-03, deferred from v4.0)
- [ ] Earthquake layer — USGS 24h GeoJSON feed, magnitude-scaled markers (LAY-05, deferred)
- [ ] Weather radar overlay — NOAA NEXRAD WMS tiles on globe (LAY-06, deferred)
- [ ] Keyboard shortcuts: Space for play/pause, L for LIVE/PLAYBACK toggle (KYBD-01, deferred from v5.0)
- [ ] Replay speed readout ("60×") beside timestamp in CinematicHUD (LIVE-02, deferred from v5.0)
- [ ] Replay window time-range labels at scrubber track ends (LIVE-03, deferred from v5.0)

### Out of Scope

- Real-time chat or collaboration — single-user tool
- Mobile app — web-first; responsive web works on tablet
- Precise jammer geolocation — honest anomaly inference only, labeled as such
- Proprietary data sources — OSINT only
- Multi-user auth — personal homelab use
- Real-time video feeds — bandwidth intensive
- Automated target tracking — user selects manually only
- CZML-based replay — wrong pattern for snapshot-driven dynamic data
- gpsjam.org API — no public API exists; NIC/NACp aggregation is correct approach
- Category filter on layer visibility — deferred to avoid regression risk (chips filter event markers only)

## Context

**Shipped v1.0:** 2026-03-11 — Live multi-layer globe (satellites, aircraft, search, filters)
**Shipped v2.0:** 2026-03-12 — WorldView Parity (visual engine, new layers, replay, OSINT)
**Shipped v3.0:** 2026-03-13 — UI Refinement (draggable panels, SVG icons, camera controls, settings)
**Shipped v4.0:** 2026-03-13 — Data Reliability & Freshness (stale filtering, freshness metadata, full test suite)
**Shipped v5.0:** 2026-03-14 — Playback (replay engine correctness, layer guards, stale indicators, 213 tests)
**Shipped v6.0:** 2026-03-14 — Production Ready (secrets hardened, API key auth, nginx stack, CI pipeline, README+LICENSE)
**Stack:** CesiumJS + React + TypeScript + Vite (frontend), FastAPI + PostgreSQL + PostGIS + Redis + RQ (backend), Docker Compose, nginx
**Codebase:** ~15,883 LOC (frontend TS/TSX + backend Python); 92 plans across 32 phases

**Key learnings from v3.0:**
- CSS sidebar collapse must use `grid-template-rows` (not `scrollHeight`) — scrollHeight forces synchronous layout reflow on CesiumJS render thread, halving FPS during animation
- SVG icon canvases must be pre-rendered once at module scope — per-entity dynamic SVG strings exhaust TextureAtlas GPU texture budget (DeveloperError at >5,000 entries)
- LEFT_DOUBLE_CLICK must remove CesiumJS built-in entity-tracking handler first — two conflicting flyTo animations fire simultaneously otherwise
- LEFT_CLICK debounce (200ms) required when double-click zoom is active — CesiumJS issue #1171: both LEFT_CLICK and LEFT_DOUBLE_CLICK fire on double-click
- Billboard migration per-layer must be done in two atomic steps (add new, remove old) — parallel PointPrimitive + BillboardCollection causes doubled draw calls and double-pickable entities
- useSettingsStore separate from useAppStore — prevents transient runtime values from being persisted to localStorage

**Key learnings from v5.0:**
- `useAppStore.getState()` inside rAF/postUpdate callbacks is required — selectors captured at render time become stale in animation loops; `getState()` reads the always-current store value
- Satellite rAF pause guard must return `null`, not `0`/`undefined` — `0` is a valid Unix epoch timestamp that would propagate satellites to 1970
- `resolveTimestamp` as a pure function (not inlined) is the correct pattern — enables full branch coverage in unit tests without mocking CesiumJS or rAF
- `queryClient` must be a module-level singleton exported from `lib/queryClient.ts` — components that call `invalidateQueries()` imperatively must import the exact same instance as `QueryClientProvider`
- `replayModeRef` pattern required for rAF loops: `useRef` synced from the Zustand selector each render, read inside rAF body — prevents stale closure on `replayMode` in animation frames
- FPS gate at 15m/s playback passed without any throttle guard — snapshot interpolation was already efficient; no optimization needed at milestone close

**Key learnings from v4.0:**
- OpenSky persists state vectors 300s after last contact — use `time_position` (sv[3]) not `last_contact` (sv[4]) for positional freshness
- `onupdate` is silently ignored on SQLAlchemy's `on_conflict_do_update` path — all freshness fields must be explicit in every `set_={}` dict
- AIS vessels moored/anchored report every 3 minutes — uniform timestamp threshold would incorrectly mark them inactive; use Redis key presence (TTL) not timestamp arithmetic
- GPS jamming empty response on feed-down silently converts a staleness event into a blank globe layer — `source_is_stale=true` preserves observability
- `is_active = server_default=true` avoids NOT NULL violation on pre-migration rows with no backfill required
- Import `from datetime import datetime` (not `import datetime`) in freshness helpers for `patch()` patchability in tests
- stale_cutoff() must be called inside handler body (never at module scope) — module-scope call freezes the cutoff at server start time

**Key learnings from v3.0:**
- PostProcessEngine must be a singleton created at init — recreating on preset switch causes stale uniforms
- aisstream.io has 2-minute server-initiated disconnects; exponential backoff reconnect + Redis position cache required
- airplanes.live /v2/mil replaced ADSB Exchange (moved to paid RapidAPI March 2025)
- PostgreSQL range partitioning must be designed in from day one — retrofitting at scale requires downtime
- 60s snapshot interval with frontend lerp interpolation is visually acceptable at all replay speeds
- SGP4 overpass accuracy degrades significantly after 7-day TLE age — fail visibly rather than silently
- Wave 0 stub files (not just vi.mock) required for non-existent modules due to Vite static import analysis

## Constraints

- **Data**: OSINT only — no proprietary or classified sources
- **Deployment**: Must run on homelab/VPS with Docker
- **Honesty**: Anomaly layers must be labeled as inference, not precise geolocation
- **Performance**: UI must handle 5,000+ satellites and thousands of aircraft
- **Stack**: CesiumJS, React, TypeScript, FastAPI, PostgreSQL, PostGIS, Redis

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| CesiumJS over alternatives | Industry standard for 3D globe, excellent satellite/aircraft support | ✓ Good — smooth at scale |
| Frontend orbit propagation (satellite.js Web Worker) | Main-thread propagation causes UI jank at scale | ✓ Good — transferable Float64Array zero-copy IPC |
| PostgreSQL + PostGIS | Spatial queries, time-series data, mature ecosystem | ✓ Good — partial B-tree index effective |
| Docker Compose | Easy homelab deployment, reproducible | ✓ Good — automated with Alembic entrypoint |
| Anomaly Engine in v2 | Foundation (satellites + aircraft) first | ✓ Good — clean separation |
| Time Replay in v2 | Need snapshot infrastructure first | ✓ Good — deferred correctly |
| CelesTrak OMM/JSON (not legacy TLE text) | Avoids July 2026 5-digit catalog cutover | ✓ Good — json2satrec works |
| OpenSky OAuth2 (not Basic Auth) | Basic Auth deprecated March 18, 2026 | ✓ Good — correct choice |
| RQ over Celery | Simpler, sufficient for self-hosted use | ✓ Good — self-re-enqueue reliable |
| Primitive API (not Entity API) | Entity API collapses at 5,000+ objects | ✓ Good — critical decision |
| PostProcessEngine singleton (never recreated) | Recreating on preset switch causes stale uniforms and is expensive | ✓ Good — correct pattern |
| Snapshot table range-partitioned by day from day one | Retrofitting a live unpartitioned table at scale requires downtime | ✓ Good — prevents future pain |
| GPS jamming as GroundPrimitive (not ImageryLayer) | WebGL texture sampler budget limited; GroundPrimitive bypasses sampler limit | ✓ Good — avoids GPU budget blowout |
| AIS proxied through FastAPI (not direct browser WebSocket) | API key would be exposed in client JS if connected from browser | ✓ Good — security requirement |
| airplanes.live /v2/mil as primary military source | ADSB Exchange moved to paid RapidAPI March 2025; airplanes.live free, same schema | ✓ Good — saved API costs |
| Custom React TimelinePanel (not CesiumJS Timeline widget) | CesiumJS widget lacks speed presets, event dot coloring, category filtering | ✓ Good — full control |
| LIVE/PLAYBACK drives viewer.clock directly | CZML replay not flexible enough for multi-layer custom timeline UI | ✓ Good — correct pattern |
| 60s snapshot interval + frontend lerp | 1/3600th storage cost vs 1Hz; visually sufficient at all replay speeds | ✓ Good — balance of cost/quality |
| Street traffic gated below 500km altitude, viewport-scoped | Full road network at global zoom is unusable | ✓ Good — prevents performance collapse |
| TLE age > 7 days triggers visible overpass warning | SGP4 error grows to km beyond 7 days; fail visibly not silently | ✓ Good — honest UX |
| Category filter on event markers only (not layer visibility) | Avoids regression risk in complex multi-layer system | ⚠️ Revisit — full layer gating deferred |
| CSS `grid-template-rows` transition for sidebar collapse | scrollHeight forces synchronous layout reflow on CesiumJS render thread | ✓ Good — no FPS impact |
| Free-floating DraggablePanel over collapsible sidebar sections | Human-approved in Phase 13 browser validation — more flexible UI paradigm | ✓ Good — cleaner UX |
| SVG icon canvases pre-rendered at module scope (not per-entity) | TextureAtlas GPU budget exceeded at >5,000 dynamic entries | ✓ Good — avoids DeveloperError |
| Billboard migration in two atomic steps per layer | Parallel old+new collections cause doubled draw calls and pickable entities | ✓ Good — clean cutover |
| Satellite layer stays on PointPrimitiveCollection (never billboards) | 5,000+ billboard entities degrade frame rate on integrated GPU — hard constraint | ✓ Good — performance critical |
| useSettingsStore separate from useAppStore | Prevents transient runtime values (selectedId, replayTs) from being persisted | ✓ Good — correct separation |
| Settings gear icon NOT gated by cleanUI | Settings must remain accessible in cinematic mode | ✓ Good — correct precedence |
| LEFT_CLICK debounced 200ms when double-click zoom active | CesiumJS issue #1171: both LEFT_CLICK and LEFT_DOUBLE_CLICK fire on double-click | ✓ Good — prevents entity panel on zoom |
| Hand-written Alembic migrations only (no autogenerate) | Autogenerate may drop position_snapshots partition child tables; hand-written is safe | ✓ Good — partitioned table preserved |
| is_active=server_default='true' (no backfill UPDATE) | Pre-migration rows treated as active immediately; backfill UPDATE locks live tables | ✓ Good — zero-downtime migration |
| All freshness fields explicit in upsert set_={} dicts | SQLAlchemy onupdate silently ignored on on_conflict_do_update path | ✓ Good — critical correctness |
| AIS is_active from Redis TTL presence (not timestamp arithmetic) | ITU-R M.1371 moored vessels report every 3 min; threshold-based approach marks them inactive | ✓ Good — preserves ship coverage |
| GPS jamming returns source_is_stale=true on feed-down (not empty set) | Empty response silently converts staleness event into blank layer on the globe | ✓ Good — preserves observability |
| stale_cutoff() called inside handler body (not module scope) | Module-scope call freezes cutoff at server start — all rows would eventually appear fresh | ✓ Good — correctness critical |
| Detail endpoints unaffected by stale filtering | Replay engine and click-to-inspect panels need historical rows; filtering breaks time-scrubber | ✓ Good — list vs detail asymmetry correct |
| `isPlaying` in `useAppStore` (not `useSettingsStore`) | `isPlaying` is transient runtime state, not a persisted preference; `useSettingsStore` uses `persist` middleware | ✓ Good — correct store separation |
| `resolveTimestamp` as pure function (not inline in rAF loop) | Testable in isolation; all three branches (live, playback+playing, playback+paused) unit-tested deterministically | ✓ Good — enables 6-test coverage of PLAY-02 |
| `getState()` inside rAF/postUpdate callbacks (not captured selectors) | Selectors captured at render time go stale in rAF closures; `getState()` always reads current store value | ✓ Good — prevents stale-closure bugs in satellite loop, aircraft lerp, useViewerClock |
| Pause guard: `resolveTimestamp` returns null → skip PROPAGATE (don't send 0/undefined) | `null` is unambiguous "skip this tick"; sending 0 would propagate to Unix epoch 1970 | ✓ Good — explicit skip semantics |
| `queryClient` as shared singleton in `lib/queryClient.ts` (not recreated in components) | `PlaybackBar` needs to call `invalidateQueries()` imperatively; only possible if it imports the same instance as `QueryClientProvider` | ✓ Good — single source of truth for cache invalidation |
| Stale-tint effect reads `aircraft.data` for `is_stale`, does not add a separate query | Avoids extra API round-trip; `is_stale` is already in the list response payload | ✓ Good — zero network cost for VIS-01 |
| `useSatellites` refetchInterval not frozen in playback | TLE data changes on 2h cadence; `resolveTimestamp` provides historically-accurate timestamps regardless; no requirement targets this | — Accepted tech debt (low impact) |
| Static API key (not JWT/session auth) | Homelab tool, single-user; shared secret is sufficient; JWT adds complexity with no benefit at this scale | ✓ Good — simple, correct for use case |
| nginx in main `docker-compose.yml` (not a separate file) | Single source of truth; build targets (`development`/`production`) differentiate dev vs prod without a second compose file | ✓ Good — clean, less operator confusion |
| `:?message` syntax for all credential vars in compose | Fail loud with useful error when `.env` absent; `:- fallback` would silently pass empty credentials | ✓ Good — prevents silent auth failures |
| `.dockerignore` co-located with Dockerfile in service directories | Docker build context is `./frontend` and `./backend`; project-root `.dockerignore` is not read by service-level `COPY . .` | ✓ Good — correctness-critical placement |
| `VITE_*` secrets as build ARGs (not runtime env on nginx) | Vite inlines `VITE_*` env vars at bundle compile time; runtime env on nginx container has no effect on the JS bundle | ✓ Good — prevents silent undefined in production |
| Commit-SHA allowlisting in `.gitleaks.toml` (not path/regex) | Narrowest possible scope to unblock CI; does not silence future detections on new commits | ✓ Good — maintains gitleaks effectiveness |
| fetch-depth: 0 on gitleaks job | gitleaks must scan full history; shallow clone would miss historical credential commits that are the exact target of the scan | ✓ Good — correctness-critical for secret scanning |
| `<Author Name>` placeholder in LICENSE | Real name must not be auto-invented; user fills in before public release | — Pending user action |

---
*Last updated: 2026-03-14 after v6.0 milestone*
