# Milestones

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

