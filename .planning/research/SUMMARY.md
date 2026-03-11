# Project Research Summary

**Project:** OpenSignal Globe (OSINT Geospatial Intelligence Platform)
**Domain:** Browser-based 3D globe with real-time satellite and aircraft tracking
**Researched:** 2026-03-11
**Confidence:** HIGH

## Executive Summary

OpenSignal Globe is an OSINT geospatial intelligence visualization platform that fuses satellite tracking, aircraft ADS-B data, and GNSS anomaly inference into a single cinematic 3D globe interface. Experts build this class of product using a client-heavy WebGL rendering layer (CesiumJS) backed by a stateless async API (FastAPI), a geospatial time-series store (PostgreSQL + PostGIS), and background workers for data ingestion and anomaly detection. The defining architectural principle is that satellites use client-side orbit propagation (satellite.js) for smooth real-time motion, while aircraft require periodic server-side snapshots because their paths are not mathematically predictable. This separation drives the entire data flow and phase structure.

The recommended stack is fully confirmed: React 19 + Vite 6 + TypeScript + CesiumJS 1.139 on the frontend; Python 3.12 + FastAPI 0.135 + Uvicorn on the backend; PostgreSQL 17 + PostGIS 3.5 + SQLAlchemy 2.0 + GeoAlchemy2 for geospatial storage; Redis 8.6 + RQ for caching and task queuing; Docker Compose v2 for deployment. Research resolved two open questions from the spec: Zustand wins over Redux Toolkit (simpler for a single-user tool) and RQ wins over Celery (sufficient for polling jobs, 10x smaller). TanStack Query should be added as the frontend server-state manager — it is 2026 best practice and was omitted from the original spec.

The primary risks are CesiumJS performance at scale and data source integration. Using the Entity API for 5,000+ satellites will produce single-digit frame rates — the Primitive API must be chosen from the first line of satellite rendering code. OpenSky Network deprecated HTTP Basic Auth on March 18, 2026; all aircraft fetching must use OAuth2 client credentials from day one. The CelesTrak TLE format hits its 5-digit catalog number limit around July 2026 — the OMM/JSON format must be used instead of legacy TLE text to remain usable post-cutover. These are not optional refinements; they are architectural decisions that are expensive to reverse.

## Key Findings

### Recommended Stack

The stack is greenfield-ready with all versions verified as of March 2026. The frontend relies on CesiumJS as the only library that handles satellite orbits, terrain, day/night shading, and atmosphere out-of-the-box at the required scale. deck.gl was evaluated and rejected: its globe mode is documented as "very basic" with no rotation/pitch support. satellite.js handles client-side SGP4/SDP4 propagation at 15KB and is browser-optimized. The backend is async-first throughout: FastAPI + Uvicorn handles 20,000+ req/s and is mandatory for non-blocking OpenSky polling. PostgreSQL + PostGIS is the only serious choice for spatial queries ("aircraft within 50km of anomaly cluster") — MongoDB and ClickHouse were evaluated and lack the geospatial query power of PostGIS GIST indexes.

**Core technologies:**
- **CesiumJS 1.139+**: 3D globe rendering — only library purpose-built for geospatial simulation at satellite scale
- **satellite.js 5.x**: Client-side SGP4 orbit propagation — eliminates API latency for satellite position updates
- **React 19 + Vite 6 + TypeScript 5**: UI framework and build — 2026 standard, fastest dev experience
- **Zustand 5 + TanStack Query 6**: State management — Zustand for UI state, TanStack Query for server state (satellites, aircraft)
- **Tailwind CSS 4.2 + shadcn/ui**: UI components — accessible, dark-theme-ready, zero lock-in (copy-paste model)
- **FastAPI 0.135 + Uvicorn 0.41 + Pydantic 2.12**: Async API layer — 5x faster than Flask, auto OpenAPI docs
- **PostgreSQL 17 + PostGIS 3.5**: Geospatial storage — GIST indexes for spatial queries, ACID compliance
- **SQLAlchemy 2.0 + GeoAlchemy2 0.18**: ORM + PostGIS bridge — async support, proven spatial type integration
- **Redis 8.6 + RQ 2.0**: Cache and task queue — single service for both concerns, simpler than Celery
- **Docker Compose v2.40**: Deployment — one-command homelab/VPS deployment of all services

**Critical version note:** Node.js 22 LTS required (Vite 6 minimum); Node.js 20 reaches EOL April 2026. CelesTrak OMM/JSON format must be used instead of TLE text — legacy TLE hits 5-digit catalog limit around July 2026.

### Expected Features

Research confirms the feature set against five reference platforms: FlightRadar24, N2YO, Track The Sky, LeoLabs, and OpenSky Network. This platform has a genuine differentiated position: no public platform fuses satellites + aircraft + GNSS anomaly inference in one view. That fusion is the core value proposition and must be preserved through scope discipline.

**Must have (table stakes):**
- 3D interactive globe with terrain, atmosphere, day/night shading — core experience
- Real-time satellite tracking (5,000+ simultaneously) — primary use case
- Orbit path visualization — makes satellites comprehensible
- Real-time aircraft tracking with trails — parallel primary use case
- Click-to-inspect detail panel — essential interaction
- Search by NORAD ID / callsign / ICAO24 — users must find specific objects
- Layer toggle controls — manage visual clutter
- Filter by region (bounding box) and altitude band
- Dark cinematic theme — mission control aesthetic, differentiates from Google Earth
- Performance at scale — 5,000+ satellites, 1,000+ aircraft, 60 FPS

**Should have (competitive differentiators):**
- GNSS anomaly visualization — unique capability, no public platform has this; honest labeling as inference is mandatory
- Multi-source data fusion — satellites + aircraft + anomalies in one view
- Historical replay with time slider — requires snapshot storage; FlightRadar24 Gold tier benchmark
- Alert / notification system for high-severity anomaly escalation
- Event feed / timeline — narrative layer over raw data
- Cinematic UI polish — glowing trails, smooth animations, bloom effects

**Defer (v2+):**
- Pass predictor (when will satellite be visible from my location)
- Naked eye visibility calculations
- Weather layer overlay (external API dependency)
- Space weather context (niche, NOAA API required)
- SDR sensor integration (requires anomaly layer to exist first)
- Coverage footprint visualization (satellite sensing cones)
- Export / screenshot (user request driven)
- Public API access (when external integrations are needed)

**Anti-features to enforce:** No real-time collaboration, no mobile native app, no precise jammer geolocation (confidence problem), no proprietary data sources, no automated target tracking.

### Architecture Approach

The architecture follows a six-layer model verified against production geospatial platforms: frontend rendering (CesiumJS + React), stateless REST API (FastAPI), geospatial time-series storage (PostgreSQL + PostGIS), read cache (Redis), background workers (RQ), and external integrations (CelesTrak, OpenSky). The key architectural insight driving all performance decisions is the split between client-side propagation for satellites (TLE-driven, mathematically predictable) and server-side snapshots for aircraft (real-time external data, not propagatable). The layered API pattern (routes → services → repositories) must be established in Phase 1 and never violated — it is the testability and maintainability foundation.

**Major components:**
1. **Frontend rendering layer** (CesiumJS + React + satellite.js + Zustand + TanStack Query) — WebGL globe, entity management, client-side orbit propagation, UI panels
2. **Backend API layer** (FastAPI + Pydantic + Redis) — stateless REST endpoints, request validation, cache-aside serving, CORS and rate limiting
3. **Data storage layer** (PostgreSQL + PostGIS + SQLAlchemy + GeoAlchemy2 + Alembic) — satellites, aircraft snapshots, anomaly clusters, sensor events, alerts with full spatial indexing
4. **Background workers layer** (RQ + Redis) — satellite TLE ingestion (every 4-6h), aircraft state ingestion (every 10-30s), anomaly detection (triggered + periodic), data retention cleanup
5. **Caching layer** (Redis) — TLE catalog cache (6-12h TTL), aircraft positions (10-30s TTL), anomaly clusters (1-5min TTL), cache-aside pattern throughout
6. **External integrations** (CelesTrak OMM/JSON, OpenSky OAuth2) — circuit breaker, exponential backoff, rate limit tracking, local mirroring

**Key patterns:**
- Primitive API (not Entity API) for all bulk satellite rendering
- Dirty flag pattern for entity updates (only update changed entities)
- LOD rendering — points at global zoom, orbit arcs only on selection or close zoom
- Bounding box queries — frontend sends viewport bbox, backend returns only visible aircraft
- Cache-aside with TTL jitter (±10%) to prevent cache stampede
- Web Worker for satellite propagation (off main thread)
- Background workers ingest data asynchronously; API serves cached/stored data only (no synchronous external calls in request path)

### Critical Pitfalls

1. **Entity API for 5,000+ satellites** — use `PointPrimitiveCollection` / `BillboardCollection` / `PolylineCollection` (Primitive API) from the first line of satellite rendering code. Entity API collapses to single-digit FPS at scale. Recovery requires a full rewrite of the satellite layer — there is no incremental path.

2. **Main-thread orbit propagation** — move all `satellite.propagate()` calls to a Web Worker. Propagating 5,000 satellites in the main thread blocks the event loop and causes severe UI jank. Must be architected before any satellite is added to the render loop.

3. **ECI/ECEF coordinate frame confusion** — satellite.js outputs TEME (ECI-variant), CesiumJS renders in ECEF. Skipping `satellite.eciToEcf(positionEci, gmst)` produces catastrophically wrong satellite positions. Validate with ISS ground track cross-check against Heavens-Above on first render.

4. **OpenSky Basic Auth (deprecated March 18, 2026)** — implement OAuth2 client credentials from day one. HTTP Basic Auth returns 401; aircraft layer silently stops working. No incremental migration — this must be correct at first implementation.

5. **CesiumJS viewer not destroyed on React unmount** — React 18 Strict Mode double-mounts effects. Missing `viewer.destroy()` in `useEffect` cleanup causes GPU memory leaks and duplicate Cesium instances. Must be correct in Phase 1 before anything else is built on top.

6. **All orbit paths rendered simultaneously** — orbit paths are a detail feature, not a bulk feature. Only render for selected satellites or satellites within current viewport below a zoom threshold. 300,000 position evaluations per render cycle (5,000 sats × 60 points) saturates the GPU.

7. **Stale TLE data causing silent position drift** — TLE accuracy degrades within hours for LEO objects. Implement a backend TLE refresh scheduler (every 4-6h) with a user-visible TLE age indicator. Silent drift is hard to detect and erodes trust in the platform.

8. **Aircraft positions jumping instead of interpolating** — at 10-second polling intervals, aircraft teleport ~2.5km per update without interpolation. Maintain previous/current position with timestamps; use linear interpolation in the render loop or CesiumJS `SampledPositionProperty`.

9. **Cesium Ion token hardcoded in source or Docker build** — token ends up in git history, bundle, and Docker layers. Use Docker secrets / env files excluded from VCS; restrict token to specific allowed domains in the Cesium Ion dashboard.

## Implications for Roadmap

Based on combined research, the build order is driven by hard dependencies: the globe must exist before any entity can be placed on it; satellite ingestion patterns establish the worker architecture before aircraft adds real-time complexity; anomaly detection requires aircraft snapshots to exist. The architecture research provides a verified 7-phase build sequence that maps cleanly to the feature landscape.

### Phase 1: Foundation and Globe Shell
**Rationale:** No feature can be built without a working globe, running services, and proven CesiumJS-React integration. Three critical pitfalls must be solved here before any entity code exists — they cannot be retrofitted: Primitive API architecture decision, viewer cleanup on unmount, Ion token security. Docker Compose establishes the deployment model that all subsequent phases rely on.
**Delivers:** Running services (PostgreSQL + PostGIS, Redis, FastAPI skeleton, React app), empty 3D globe with terrain/atmosphere/dark theme, health endpoints, confirmed service communication
**Addresses:** Dark cinematic theme, responsive UI shell, performance architecture foundation
**Avoids:** Viewer GPU leak (Pitfall 7), Ion token exposure (Pitfall 8), Entity API lock-in (Pitfall 1 — architecture decision made here)

### Phase 2: Satellite Tracking Layer
**Rationale:** Satellites use daily-refresh TLEs and client-side propagation — simpler ingestion cycle than aircraft. Proves the worker architecture, the CelesTrak integration, and the ECI→ECEF rendering pipeline before adding real-time complexity. Establishes the Primitive API patterns and Web Worker propagation that aircraft rendering will reuse.
**Delivers:** 5,000+ satellites visible in real-time with orbit paths on selection, click-to-inspect panel, search by NORAD ID, TLE age indicator, satellite ingestion worker running on schedule
**Uses:** CelesTrak OMM/JSON format (not TLE), satellite.js in Web Worker, PointPrimitiveCollection, RQ background worker, Redis TLE cache
**Implements:** Satellite ingestion pipeline, client-side propagation architecture
**Avoids:** ECI/ECEF confusion (Pitfall 6 — validate ISS ground track), main-thread propagation (Pitfall 3), orbit path overload (Pitfall 2), stale TLEs (Pitfall 4)

### Phase 3: Aircraft Tracking Layer
**Rationale:** Builds on worker architecture from Phase 2. Adds real-time complexity (10-30s polling) and the OpenSky OAuth2 integration that is a hard requirement post-March 2026. Aircraft counts (hundreds to low thousands) allow Entity API with `SampledPositionProperty` for smooth interpolation — simpler than satellite Primitive API. Spatial bounding box queries (PostGIS GIST) must be proven here before anomaly engine adds more complex spatial work.
**Delivers:** Real-time aircraft with smooth trails, bounding box filtering, search by callsign/ICAO24, click-to-inspect panel, OpenSky OAuth2 integration, Redis geospatial aircraft cache
**Uses:** OpenSky OAuth2 (not Basic Auth), PostgreSQL aircraft_snapshots with GIST + B-tree indexes, Redis geospatial commands, CesiumJS SampledPositionProperty
**Implements:** Aircraft ingestion pipeline, real-time polling architecture, spatial query patterns
**Avoids:** OpenSky auth failure (Pitfall 5 — OAuth2 from day one), aircraft position jumping (Pitfall 9 — SampledPositionProperty), unbounded DB growth (rolling 2h window minimum)

### Phase 4: Layer Controls, Search, and UI Polish
**Rationale:** With two data layers working, layer management and search become urgent usability needs. This phase converts a functional prototype into a polished intelligence dashboard. Cinematic polish (glowing trails, smooth animations, bloom) is a competitive differentiator and should be applied while both layers are visible so visual design decisions are informed by the full scene.
**Delivers:** Layer toggle controls (satellites, aircraft), advanced filtering (constellation, altitude, aircraft type), region filter, full search UX, cinematic visual polish, data freshness indicators, responsive layout
**Uses:** Zustand for layer toggle state, TanStack Query for data fetching, shadcn/ui components, Tailwind CSS dark theme
**Implements:** UI state management patterns, filter architecture that anomaly layer will extend
**Avoids:** Label overload (5,000 satellite labels off by default — Pitfall UX section), tiny click targets, premature layer toggles before data loads

### Phase 5: GNSS Anomaly Detection and Visualization
**Rationale:** Anomaly detection depends on aircraft snapshots existing (Phase 3 must have run for time to accumulate data). This is the platform's primary differentiator — the capability that no public platform offers. DBSCAN clustering on aircraft position discontinuities, velocity anomalies, and heading instability produces anomaly clusters stored as PostGIS polygons. Honest labeling as inference (not confirmed intelligence) is a hard requirement — every UI element touching anomalies must carry an inference disclaimer.
**Delivers:** Anomaly detection engine (DBSCAN), anomaly clusters stored as PostGIS polygons, frontend heatmap/polygon visualization with severity color gradient, alert feed for high-severity anomalies, event timeline, explicit inference disclaimers on all anomaly UI
**Uses:** scikit-learn DBSCAN, NumPy/pandas for metric computation, RQ background worker (triggered by new aircraft data), PostGIS polygon storage, CesiumJS gradient primitives (not hard-boundary polygons)
**Implements:** Anomaly detection pipeline, severity scoring, alert generation
**Avoids:** Anomaly mislabeling as confirmed intelligence (Pitfall — ethical/trust risk), hard boundary polygons (implies precision we don't have)

### Phase 6: Historical Replay
**Rationale:** Replay requires historical snapshot data that accumulates organically from Phase 3 onwards. This phase adds the time slider UI and the paginated replay API. TimescaleDB hypertable partitioning (optional but recommended) is worth adding here as aircraft_snapshots tables will be substantial. CesiumJS Clock API integration is the key technical pattern.
**Delivers:** Time slider UI (play/pause/speed controls), replay API with paginated time-bounded queries, CesiumJS Clock API integration, data retention policies (7-day raw, 30-day compressed), optional TimescaleDB hypertable for aircraft_snapshots
**Implements:** Replay data flow, time-series data management
**Avoids:** Overwhelming client with full replay data (chunked 10-minute segments), unbounded DB growth (retention policies enforced here)

### Phase 7: Performance Hardening and Production Readiness
**Rationale:** Performance optimization requires the full scene loaded — optimizing in isolation produces misleading results. This phase validates 60 FPS with full satellite catalog, sub-100ms spatial queries, and confirms all pitfall checklists pass. Monitoring and structured logging are required for a production deployment that runs unattended.
**Delivers:** Verified 60 FPS with 5,000+ satellites, confirmed sub-100ms PostGIS spatial queries (EXPLAIN ANALYZE), structured JSON logging, error tracking (Sentry), Flower for RQ monitoring, README and deployment guide, complete pitfall verification checklist
**Implements:** LOD tuning, query optimization, monitoring stack
**Avoids:** Discovering performance problems only at full load (test at scale throughout, verify in this phase)

### Phase Ordering Rationale

- **Phases 1→2→3** are hard sequential dependencies: no globe = no entities; no satellite worker = no ingestion patterns to build aircraft on; no aircraft snapshots = no anomaly data
- **Phase 4** (UI polish) is inserted before Phase 5 because anomaly visualization UX decisions are easier with both base layers polished and visible
- **Phase 5** (anomaly detection) requires Phase 3 data accumulation — minimum 24-48h of aircraft snapshots for DBSCAN to find meaningful clusters
- **Phase 6** (replay) requires Phase 3 to run for days; cannot be built and tested immediately
- **Phase 7** (hardening) is always last — optimization requires the full system to be observable

### Research Flags

Phases needing deeper research during planning:

- **Phase 2 (Satellite Layer):** CelesTrak OMM/JSON parsing with satellite.js `json2satrec()` needs implementation validation — medium confidence that the function handles all CelesTrak OMM fields correctly. Recommend a spike before committing to the full ingestion design.
- **Phase 5 (Anomaly Detection):** DBSCAN parameter selection (epsilon, minPoints) for aircraft position anomalies requires domain-specific tuning. No authoritative source gives ADS-B-specific values. Requires empirical testing with real OpenSky data. Plan a research sub-task when this phase is planned.
- **Phase 6 (Replay):** CZML format vs custom JSON for CesiumJS time-series animation needs evaluation at the point of implementation. CZML is more efficient for large time-series but adds complexity. Custom JSON is sufficient for MVP replay.

Phases with standard patterns (skip research-phase):

- **Phase 1 (Foundation):** Docker Compose v2 + FastAPI skeleton + CesiumJS init are extremely well-documented. No research needed.
- **Phase 3 (Aircraft):** OpenSky REST API + PostGIS spatial queries are standard patterns with official documentation. OAuth2 flow is documented. No research needed.
- **Phase 4 (UI Polish):** shadcn/ui + Tailwind CSS + Zustand patterns are well-established. No research needed.
- **Phase 7 (Hardening):** CesiumJS performance optimization (Primitive API, LOD) patterns are documented in official Cesium community. Standard monitoring setup. No research needed.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All versions verified against official releases and PyPI/npm as of March 2026. Key choices (Zustand over Redux, RQ over Celery, SQLAlchemy over SQLModel) backed by clear rationale and benchmark data. |
| Features | HIGH | Competitive landscape verified across 6 reference platforms. Table stakes confirmed. Differentiators (GNSS anomaly fusion) validated as genuinely unique. |
| Architecture | HIGH | System component model matches production geospatial platforms. Data flows verified against official API docs (OpenSky, CelesTrak). Build order based on logical dependency analysis. |
| Pitfalls | HIGH | All 9 critical pitfalls sourced from official CesiumJS community forums, official OpenSky API docs, and satellite.js GitHub. Phase-to-pitfall mapping is specific and actionable. |

**Overall confidence:** HIGH

### Gaps to Address

- **satellite.js `json2satrec()` with CelesTrak OMM format:** Core function exists but production validation with CelesTrak's specific OMM JSON field structure is medium-confidence. Spike this in Phase 2 before committing ingestion design.
- **DBSCAN parameters for ADS-B anomaly detection:** No authoritative source provides epsilon/minPoints values for aircraft position discontinuity detection. Requires empirical tuning with real OpenSky data. Budget time for iteration in Phase 5.
- **GeoAlchemy2 + SQLAlchemy 2.0 async compatibility:** Some users report PostGIS schema detection issues with async SQLAlchemy. Workaround (`search_path` in connection string) is known, but should be validated during Phase 1 database setup.
- **CelesTrak TLE format cutover timing:** "Around July 2026" is an estimate, not an announced exact date. OMM/JSON format is the correct choice regardless — use it from Phase 2 and the cutover date is irrelevant.
- **OpenSky credit exhaustion in development:** Anonymous tier (400 credits/day) may be insufficient for development testing with frequent API calls. Register for authenticated access (4,000-8,000 credits/day) before Phase 3 begins.

## Sources

### Primary (HIGH confidence)
- [CesiumJS Official](https://cesium.com/platform/cesiumjs/) — rendering engine, Entity vs Primitive API, March 2026 release notes
- [OpenSky Network REST API](https://openskynetwork.github.io/opensky-api/rest.html) — OAuth2 migration (March 2026), rate limits, state vector format
- [CelesTrak documentation](http://www.celestrak.com/) — TLE format limits, OMM/JSON format, GP catalog update frequency
- [satellite.js GitHub](https://github.com/shashwatak/satellite-js) — SGP4 implementation, `eciToEcf`, `json2satrec`
- [PostGIS Official](https://postgis.net/) — spatial types, GIST indexing, ST_DWithin
- [FastAPI Official](https://fastapi.tiangolo.com/) — async endpoints, Pydantic v2 integration
- [Redis Official](https://redis.io/docs/latest/develop/data-types/geospatial/) — geospatial commands, TTL patterns
- [CesiumJS Community Forums](https://community.cesium.com/) — Entity API performance ceiling, viewer cleanup, coordinate systems, ECI/ECEF confusion
- [GeoAlchemy2 0.18.4 release](https://geoalchemy-2.readthedocs.io/) — SQLAlchemy 2.0 compatibility, geometry types

### Secondary (MEDIUM confidence)
- [Cesium Architecture: Janea Systems](https://www.janeasystems.com/blog/cesium-architecture-3d-geospatial-platform) — component architecture patterns
- [TimescaleDB + PostGIS Optimization](https://medium.com/@marcoscedenillabonet/optimizing-geospatial-and-time-series-queries-with-timescaledb-and-postgis-4978ea2ef8af) — compression and partitioning strategies
- [Redis Caching Strategies 2026](https://www.youngju.dev/blog/database/2026-03-03-redis-caching-strategies.en) — TTL patterns, cache stampede prevention
- [FastAPI + Background Processing Guide](https://blog.greeden.me/en/2026/01/27/the-complete-guide-to-background-processing-with-fastapi-x-celery-redishow-to-separate-heavy-work-from-your-api-to-keep-services-stable/) — worker architecture patterns
- FlightRadar24, N2YO, Track The Sky, LeoLabs — feature landscape competitive analysis

### Tertiary (LOW confidence)
- CelesTrak TLE 5-digit limit timing ("around July 2026") — estimate, exact date not published
- DBSCAN parameters for ADS-B anomaly detection — no authoritative aviation-specific values found; requires empirical tuning

---
*Research completed: 2026-03-11*
*Ready for roadmap: yes*
