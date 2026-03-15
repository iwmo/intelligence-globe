# Milestones

## v10.0 ADSB.lol Migration (Shipped: 2026-03-15)

**Phases completed:** 6 phases (38–43), 15 plans
**Files modified:** 49 files, +4,124 / -967 lines
**Codebase:** ~12,410 TypeScript LOC, ~3,141 Python LOC (backend/app)
**Timeline:** 2026-03-15 (single-day sprint)

**Key accomplishments:**
- Replaced OpenSky OAuth2 + airplanes.live with single `ingest_adsbiol.py` task handling commercial (`?all_with_pos`) and military (`?all_with_pos&filter_mil`) aircraft; Alembic migration adds emergency, nav_modes, IAS/TAS/Mach, roll, registration, type_code columns; no OAuth2 or credit budget logic remains (INGEST-01–05, SCHEMA-01–06)
- Emergency badge, nav modes chips, and IAS/TAS/Mach rows added to AircraftDetailPanel with conditional rendering and data-testid test coverage (UI-01–03)
- Aircraft billboard icons visually bank during turns — `computeIconRotation(heading, roll)` exported pure helper applies roll as additive offset to heading rotation in Cesium screen-space (UI-04)
- Dead OpenSky worker files deleted, useAircraft.ts poll interval fixed 90s→15s to match ADSB.lol cadence, LabelCollection added to Cesium mock to unblock pre-existing SatelliteLayer test failures (Phase 40 cleanup)
- Registration and type code rendered as conditional rows in AircraftDetailPanel, closing SCHEMA-06-partial gap; `roll` added to detail endpoint return dict, closing list/detail field asymmetry (Phases 41–42)
- Retroactive VALIDATION.md created for all 4 v10.0 phases lacking Nyquist compliance — milestone achieves full Nyquist sign-off across 6 phases (Phase 43)

---

## v9.0 Entity Labels (Shipped: 2026-03-15)

**Phases completed:** 1 phase (37), 5 plans
**Codebase:** ~12,002 TypeScript LOC
**Timeline:** 2026-03-15 (single-day sprint)

**Key accomplishments:**
- `showEntityLabels` boolean added to `useSettingsStore` with localStorage persistence; Entity Labels checkbox in SettingsPanel Display section — opt-in toggle controls all labels globally (LBL-01, LBL-02)
- Satellite labels: floating cyan (#00D4FF) `object_name` text above PointPrimitives via separate LabelCollection; NearFarScalar(5e5, 1.2, 5e7, 0.0) keeps labels readable from city zoom to global altitude (LBL-03, LBL-04)
- Aircraft labels: floating orange (#FF8C00) callsign/ICAO24 text via LabelCollection alongside BillboardCollection; military aircraft labels in red (#EF4444); ship labels in green (#22C55E) matching entity icon colors (LBL-05 to LBL-10)
- Gap closure (Plan 37-04): satellite labels not visible on initial load fixed — `showEntityLabels` applied immediately in LOADED handler; aircraft minimum NearFarScalar scale floor 0.3 prevents Cesium culling at ~2893km globe altitude
- Gap closure (Plan 37-05): military aircraft and ship labels stuck in show:false on initial load fixed — `.data` added to Effect 4 dependency array ensures visibility effect fires after data populates label maps

---

## v8.0 GDELT Integration (Shipped: 2026-03-14)

**Phases completed:** 3 phases (34–36), 11 plans
**Files modified:** 65 files, +9,630 / -110 lines
**Timeline:** 2026-03-14 (single-day sprint)

**Key accomplishments:**
- `gdelt_events` PostgreSQL table with UNIQUE `global_event_id`, Alembic migration, SQLAlchemy ORM model; RQ worker polls every 15 min with 3-layer dedup (Redis file-level skip, ON CONFLICT DO NOTHING, null-coordinate filter) and 7-day rolling cleanup
- Conflict-filtered ingest pipeline reduces GDELT volume ~75%; `GET /api/gdelt-events` with bbox/QuadClass/time-range params and `source_is_stale` freshness metadata
- `GdeltLayer` using CesiumJS `CustomDataSource` + `PointGraphics` with blue/green/yellow/red QuadClass colour coding, viewport-bbox filtering (VPC-08 pattern), and sidebar toggle
- `GdeltDetailPanel` (DraggablePanel) showing source URL, actor names, GoldsteinScale, avg tone, and automated-extraction disclaimer; 4-chip QuadClass filter in LeftSidebar
- "Log as OSINT Event" bridge — `GdeltDetailPanel` LOG button pre-populates `OsintEventPanel` via store-slice pattern; reactive `App.tsx` open gate prevents re-trigger loop
- 4D replay integration — `useGdeltEvents` single-load per session with `since`/`until` window; Effect 3 temporal visibility accumulates events at `occurred_at` without entity churn; PlaybackBar coloured GDELT timeline dots + `GEO STALE` freshness overlay

---

## v7.0 Viewport Culling (Shipped: 2026-03-14)

**Phases completed:** 1 phase (33), 4 plans, 9 tasks
**Files modified:** 9 files, +185 / -40 lines
**Timeline:** 2026-03-14 (single-day sprint)
**Git range:** `feat(33-01)` → `feat(33-04)` (6 commits)
**Test suite:** 217 frontend + 102 backend tests passing

**Key accomplishments:**
- TDD RED scaffold — 5 test files (2 frontend, 3 backend extended) covering all 8 VPC requirements before any implementation
- Zustand viewportBbox store slice + useViewportBbox hook with camera moveEnd listener, null guard (undefined rect), and IDL antimeridian guard (west > east → null fallback)
- Backend bbox BETWEEN filtering on aircraft, ships, and military routes using existing B-tree indexed lat/lon columns — zero schema changes, 0 new indexes
- Three live-data React Query hooks (useAircraft, useShips, useMilitaryAircraft) wired with `effectiveBbox` pattern — queryKey includes bbox for auto-refetch on camera pan; playback mode suppresses bbox (VPC-08)
- Full E2E loop verified: camera pan → setViewportBbox → queryKey change → URLSearchParams → backend BETWEEN filter → reduced payload

---

## v6.0 Production Ready (Shipped: 2026-03-14)

**Phases completed:** 6 phases (27–32), 7 plans
**Files modified:** 57 files, +6,463 / -178 lines
**Codebase:** ~15,883 LOC (TypeScript + Python)
**Timeline:** 2026-03-14 (single-day sprint)

**Key accomplishments:**
- Secrets hardened — docker-compose.yml uses `:?error` mandatory syntax for all credentials; `.dockerignore` files prevent `.env` from entering build contexts; `.env.example` documents all 5 required variables
- Static API key auth on write endpoints — FastAPI `verify_api_key` dependency protects `POST /api/osint-events` with `X-API-Key` header; 6-test suite covers all auth paths; fail-secure empty-default pattern
- Production Docker stack — nginx reverse-proxy on port 80 serves compiled Vite bundle and proxies `/api/` to backend; healthchecks on all services; `docker-compose.override.yml` preserves dev workflow
- GitHub Actions CI — 4 parallel jobs gate every push/PR: `pytest`, `vitest + tsc`, gitleaks secret scanning, and Docker image build verification
- Operator documentation — README with numbered quick-start, API keys table, architecture diagram, and credential rotation warning; MIT LICENSE added
- CI gap closed (Phase 32) — `VITE_API_KEY` build arg wired into Dockerfile and CI workflow so production images bundle a working API key header; `OsintEventPanel` sends `X-API-Key` on every POST

---

## v5.0 Playback (Shipped: 2026-03-13)

**Phases completed:** 4 phases, 14 plans, 4 tasks

**Key accomplishments:**
- (none recorded)

---

## v4.0 Data Reliability & Freshness (Shipped: 2026-03-13)

**Phases completed:** 6 phases, 13 plans
**Lines of code:** ~6,216 Python (+9,704 lines across 71 files)
**Git range:** `feat(17-01)` → `feat(22-02)` (45 commits)
**Timeline:** 2026-03-13 (single day sprint)
**Test suite:** 95 passed, 2 skipped, 0 failed

**Key accomplishments:**
- Alembic hand-written migration adds freshness lifecycle columns across all 4 tables (aircraft, military_aircraft, ships, gps_jamming_cells) with zero-downtime safe defaults
- Reusable `app/freshness.py` module with env-var configurable stale thresholds (pydantic-settings) shared across all routes and ingest workers
- Aircraft, military, and ship API endpoints filter stale/inactive entities — only fresh data reaches the frontend via `is_active + fetched_at >= stale_cutoff` pattern
- GPS jamming staleness transparency: `source_is_stale=true` propagated when military source data is stale, preventing silent empty-set feed-down masking
- Full 95-test DB-level integration suite verifying all freshness contracts, stale filtering, ingest correctness, and route preservation — with human checkpoint approval gate

---

## v3.0 UI Refinement (Shipped: 2026-03-13)

**Phases completed:** 4 phases, 13 plans
**Lines of code:** ~12,415 TypeScript/Python (+8,275 lines across 65 files)
**Git range:** docs(13-collapsible-sidebar-layout) → docs(phase-16)

**Key accomplishments:**
- Replaced rigid sliding sidebar with free-floating draggable panels — each panel has independent position/size persistence via localStorage, +/− collapse, and resize handle; no hamburger button
- Custom SVG billboard icons for commercial aircraft (airplane silhouette), military flights (distinct shape), and ships (vessel hull) with NearFarScalar altitude scaling from 500m to 20,000km
- CameraControlWidget with double-click zoom toward cursor (CesiumJS LEFT_DOUBLE_CLICK, 200ms LEFT_CLICK debounce), on-screen +/− zoom buttons, and Top-down/45°/Horizon tilt presets
- Persistent settings panel (Zustand v5 persist middleware, `globe-settings` localStorage key) — configurable defaultLayers, defaultPreset, defaultMode, defaultCamera applied in onViewerReady boot sequence
- 15/15 requirements shipped; 129 tests green, 13 NAV browser checks and 8 CONFIG browser checks validated

---

## v2.0 WorldView Parity (Shipped: 2026-03-12)

**Phases completed:** 6 phases, 28 plans
**Lines of code:** ~9,326 TypeScript/Python (+20,732 lines across 154 files)

**Key accomplishments:**
- Visual style engine with 5 GLSL presets (NVG, CRT, FLIR, Noir, Normal), real-time post-processing sliders, and cinematic HUD overlay with MGRS readout, classification markings, and Clean UI mode
- Military flights layer (airplanes.live /v2/mil) and AIS maritime traffic layer with WebSocket reconnect and click-to-inspect metadata panels for both
- GPS jamming heatmap via H3 hexagons derived from NIC/NACp ADS-B fields with honest anomaly labeling; street traffic particle simulation viewport-scoped to OSM road network
- Time-partitioned PostgreSQL snapshot infrastructure recording all entity positions at 60s intervals with auto-partition DDL and 7-day retention
- Full replay engine: LIVE/PLAYBACK toggle, timeline scrubber, 5-speed playback with binary-search snapshot interpolation, and OSINT event markers on timeline
- OSINT event correlation: satellite SGP4 overpass arc lines to area of interest, OsintEventPanel form, TLE staleness warning, and category chip filtering (KINETIC/AIRSPACE/MARITIME/SEISMIC/JAMMING)

---

## v1.0 MVP (Shipped: 2026-03-11)

**Phases completed:** 6 phases, 17 plans
**Lines of code:** ~4,400 TypeScript/Python

**Key accomplishments:**
- Full Docker Compose stack (PostgreSQL+PostGIS, Redis, FastAPI, Vite+React) deployable from clean checkout with automated Alembic migrations
- 5,000+ real-time satellites rendered on CesiumJS globe via satellite.js Web Worker SGP4 propagation at 1 Hz without frame-rate collapse
- Live aircraft tracking from OpenSky Network OAuth2 API with smooth lerp interpolation and trail polylines
- Unified search (satellite name/NORAD ID, aircraft callsign/ICAO24) with globe fly-to, plus constellation/altitude/region filter panels
- 60 FPS sustained at full scene load (BlendOption.OPAQUE, transferable Float64Array IPC, partial B-tree spatial index)
- Phase 6 gap closure: automated Alembic entrypoint, SearchBar null-worker guard, dead Zustand state removed

---

