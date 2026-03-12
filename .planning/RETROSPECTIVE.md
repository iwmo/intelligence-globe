# Retrospective: OpenSignal Globe

---

## Milestone: v1.0 — MVP

**Shipped:** 2026-03-11
**Phases:** 6 | **Plans:** 17 | **LOC:** ~4,400 TypeScript/Python

### What Was Built

- Docker Compose full-stack (PostgreSQL+PostGIS, Redis, FastAPI, Vite+React) with automated Alembic migration entrypoint
- 5,000+ real-time satellites on CesiumJS globe via satellite.js Web Worker SGP4 at 1 Hz
- Live aircraft tracking from OpenSky OAuth2 with lerp interpolation and JSONB trail storage
- Unified search + fly-to (satellite name/NORAD ID, callsign/ICAO24) with constellation/altitude/region filter panels
- 60 FPS verified at full scene load with BlendOption.OPAQUE and zero-copy IPC
- Phase 6 gap closure: automated migrations, null-worker guard, dead store cleanup

### What Worked

- **Primitive API decision early** — identifying Entity API collapse at 5,000+ objects before Phase 2 saved a likely full rewrite
- **Web Worker + transferable Float64Array** — zero-copy IPC pattern made the difference between smooth 60 FPS and main-thread jank
- **Phase 6 gap closure** — auditing before archiving caught real gaps (INFRA-01/02, SAT-03) and a dedicated phase closed them cleanly
- **Self-re-enqueue pattern for RQ** — simple, version-stable; Celery would have added unnecessary complexity for homelab use
- **Unified click handler in AircraftLayer** — eliminating the dual-handler race between satellite and aircraft layers was the right call

### What Was Inefficient

- **OpenSky API deprecation discovery** — Basic Auth deprecation (March 18, 2026) was discovered during planning; earlier research would have saved a decision revision
- **Alembic migration gap** — `alembic upgrade head` was not automated in Phase 1 despite being an explicit INFRA requirement; required a dedicated Phase 6 plan to close
- **Phase ordering** — Phase 3 depends on Phase 2 per the roadmap, but the aircraft layer doesn't actually depend on satellite data; the dependency was artificial and slowed parallelization
- **Zustand searchQuery dead state** — accumulated between Phase 4 and Phase 6; earlier linting/grep would have caught it sooner

### Patterns Established

- **CelesTrak OMM/JSON** over legacy TLE text — future-proofed against July 2026 5-digit catalog cutover
- **RQ sync wrapper pattern** (`def sync_task() { asyncio.run(async_task()) }`) — RQ cannot pickle async coroutines
- **30s AbortController on large fetches** — 4MB satellite payload exceeds default 5s timeout
- **EllipsoidTerrainProvider fallback** when ion token absent — prevents dev crash
- **viewerRef guard** (not useState) for CesiumJS Viewer — prevents StrictMode double-mount GPU context destruction

### Key Lessons

1. **Audit before archiving** — running `/gsd:audit-milestone` before declaring done caught three real gaps that would have been silent tech debt
2. **Explicit INFRA success criteria** — "runs via Docker Compose" requirements need to explicitly test clean-checkout migration, not just "runs"
3. **OpenSky OAuth2 is the only path** — document this as a prerequisite for any future aircraft tracking work
4. **BlendOption.OPAQUE is mandatory at scale** — treat this as a standard pattern for any future PointPrimitiveCollection work in this codebase
5. **Phase insertions work** — Phase 6 (gap closure) inserted cleanly after audit; the decimal phase numbering system is solid for future urgent insertions

### Cost Observations

- Sessions: 1 continuous session (2026-03-11, ~8.5 hours)
- Model: balanced profile (sonnet-4.6)
- Notable: all 17 plans executed with parallelization enabled; wave-based execution compressed calendar time significantly

---

## Milestone: v2.0 — WorldView Parity

**Shipped:** 2026-03-12
**Phases:** 6 | **Plans:** 28 | **LOC:** ~9,326 TypeScript/Python (+20,732 lines, 154 files)

### What Was Built

- GLSL post-processing engine (5 presets: NVG, CRT, FLIR, Noir, Normal) with real-time uniform sliders and cinematic HUD with MGRS readout
- Military flights layer (airplanes.live /v2/mil) and AIS maritime layer (WebSocket worker with exponential backoff reconnect)
- GPS jamming H3 heatmap from NIC/NACp ADS-B field aggregation; street traffic particle simulation gated below 500km altitude
- Time-partitioned PostgreSQL snapshot infrastructure (60s intervals, daily auto-partition, 7-day retention)
- LIVE/PLAYBACK replay engine: timeline scrubber, 5 speed presets, binary-search lerp interpolation between 60s snapshots
- OSINT event panel, SGP4 overpass arc lines to area of interest, TLE staleness warning, category chip filtering

### What Worked

- **Phase 8 gap closure (Plan 06)** — the `pv === null` guard for satellite.js decayed TLEs was caught immediately by UAT; gap closure plan pattern from v1.0 holds
- **Wave 0 TDD pattern** — RED stub → GREEN implementation maintained discipline across 6 phases with no test debt
- **Singleton pattern for PostProcessEngine** — correctly identified in research; never recreating on preset switch was essential for CesiumJS stability
- **Replay design** — custom Timeline panel + viewer.clock approach was correct; CZML-based replay would have been a dead end for multi-layer dynamic data
- **Deferred imports in backend tests** — `ModuleNotFoundError` as the correct RED signal for Python tests requiring new dependencies

### What Was Inefficient

- **Phase 8 plan count underestimate** — 5 plans planned, 6 required (gap closure added in Phase 8.6); the AIS WebSocket reconnect complexity was underestimated
- **ROADMAP Phase 8 status inconsistency** — progress table showed "2/5 In Progress" at milestone completion because Phase 8 expanded from 5→6 plans without updating the table
- **No v2.0 audit** — milestone completed without `/gsd:audit-milestone`; category filter on layer visibility was explicitly deferred as known gap
- **STATE.md accumulated context** — STATE.md grew very large across 6 phases with individual plan decisions; consider periodic summarization for long milestones

### Patterns Established

- **Empty stub files for Wave 0** (not just vi.mock) — Vite static import analysis scans dynamic imports at transform time; stub files needed for non-existent modules
- **Always-on layer mount pattern** — MilitaryAircraftLayer/ShipLayer/GpsJammingLayer/StreetTrafficLayer mounted unconditionally; manage visibility via store (no conditional mount gate)
- **`refetchInterval: mode === 'live' ? interval : false`** — established as standard pattern for all polling hooks in playback mode
- **`useAppStore.getState()` in rAF loops** — avoid stale closures in animation loops; exclude replay state from useEffect deps
- **AIS alt field as conflict field** — `ON CONFLICT (mmsi) DO UPDATE` on vessel position ensures latest position wins

### Key Lessons

1. **Plan count expansion is normal** — phases with external dependencies (WebSocket, partitioned DB) regularly need one extra gap closure plan; budget for it
2. **Wave 0 stub files are not optional** — Vite import analysis fails silently with just vi.mock; always create empty stub files for non-existent modules in Phase N+1
3. **Snapshot partitioning from day one** — retrofitting range partitioning on a live table at scale requires downtime; this was the right v2.0 call
4. **TLE staleness is user-facing** — rendering inaccurate overpass lines silently is worse than a visible warning; fail visibly pattern is correct
5. **airplanes.live over ADSB Exchange** — ADSB Exchange moved to paid RapidAPI March 2025; document source alternatives before writing ingest workers

### Cost Observations

- Sessions: 1 continuous session (2026-03-12, ~10 hours)
- Model: balanced profile (sonnet-4.6)
- Notable: 28 plans across 6 phases in a single day via wave-based parallelization; snapshot infrastructure + replay engine executed back-to-back in same session

---

## Cross-Milestone Trends

| Milestone | Phases | Plans | LOC | Key Pattern |
|-----------|--------|-------|-----|-------------|
| v1.0 MVP | 6 | 17 | ~4,400 | Primitive API + Web Worker for scale |
| v2.0 WorldView Parity | 6 | 28 | ~9,326 | Singleton engine + partitioned storage + replay |
