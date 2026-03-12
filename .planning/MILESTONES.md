# Milestones

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

