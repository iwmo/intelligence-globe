# OpenSignal Globe

## What This Is

A browser-based 3D geospatial intelligence platform that visualizes satellites, aircraft, military flights, ships, GPS jamming, and OSINT events on an interactive globe using only open-source tools and public data sources. Built for homelab/VPS deployment with Docker, featuring a cinematic dark-themed UI with switchable visual style presets (NVG, CRT, FLIR), a 4D timeline replay engine, OSINT event correlation with satellite overpass lines, and a fully polished UI with draggable panels, custom SVG entity icons, and persistent user settings.

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

### Active

- [ ] Earthquake layer — USGS 24h GeoJSON feed, magnitude-scaled markers (LAY-05)
- [ ] Weather radar overlay — NOAA NEXRAD WMS tiles on globe (LAY-06)

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
**Stack:** CesiumJS + React + TypeScript + Vite (frontend), FastAPI + PostgreSQL + PostGIS + Redis + RQ (backend), Docker Compose
**Codebase:** ~12,415 LOC TypeScript/Python across 58 plans

**Key learnings from v3.0:**
- CSS sidebar collapse must use `grid-template-rows` (not `scrollHeight`) — scrollHeight forces synchronous layout reflow on CesiumJS render thread, halving FPS during animation
- SVG icon canvases must be pre-rendered once at module scope — per-entity dynamic SVG strings exhaust TextureAtlas GPU texture budget (DeveloperError at >5,000 entries)
- LEFT_DOUBLE_CLICK must remove CesiumJS built-in entity-tracking handler first — two conflicting flyTo animations fire simultaneously otherwise
- LEFT_CLICK debounce (200ms) required when double-click zoom is active — CesiumJS issue #1171: both LEFT_CLICK and LEFT_DOUBLE_CLICK fire on double-click
- Billboard migration per-layer must be done in two atomic steps (add new, remove old) — parallel PointPrimitive + BillboardCollection causes doubled draw calls and double-pickable entities
- useSettingsStore separate from useAppStore — prevents transient runtime values from being persisted to localStorage

**Key learnings from v2.0:**
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

---
*Last updated: 2026-03-13 after v3.0 UI Refinement milestone*
