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

## Milestone: v3.0 — UI Refinement

**Shipped:** 2026-03-13
**Phases:** 4 | **Plans:** 13 | **LOC:** ~12,415 TypeScript/Python (+8,275 lines, 65 files)

### What Was Built

- Free-floating draggable panels replacing the entire sidebar — independent position/size per panel, localStorage persistence, +/− collapse, resize handle
- Custom SVG billboard icons for aircraft (airplane silhouette), military (distinct shape), ships (vessel hull) — NearFarScalar altitude scaling from 500m to 20,000km; satellites stay on PointPrimitive due to 5,000+ GPU texture budget constraint
- CameraControlWidget with double-click zoom toward cursor (LEFT_DOUBLE_CLICK handler, 200ms LEFT_CLICK debounce), on-screen +/− zoom buttons, and Top-down/45°/Horizon tilt presets
- Persistent settings panel (Zustand v5 persist, `globe-settings` localStorage) — defaultLayers, defaultPreset, defaultMode, defaultCamera wired into onViewerReady boot sequence

### What Worked

- **Human-approved pivot in Phase 13** — when collapsible sidebar was built, browser validation revealed the floating DraggablePanel approach was superior; the plan checkpoint absorbed the change cleanly
- **Two-step billboard migration** — add-then-remove-old per layer was the only safe migration path; prevented doubled draw calls and double-pickable entities during transition
- **TDD RED/GREEN discipline throughout** — 129 tests green before Phase 16 browser validation; zero test failures discovered during human QA
- **onViewerReady as the single boot wiring point** — co-locating all four settings applications in one callback eliminated ordering bugs between settings categories

### What Was Inefficient

- **Phase 13 plan descriptions became stale immediately** — the pivot from collapsible sections to DraggablePanel happened in Plan 03, making Plan 01 and 02 descriptions partially misleading in ROADMAP; plan descriptions assume linear execution
- **No Phase 14 human validation plan initially** — scaleByDistance tuning was flagged as requiring in-browser tuning but NearFarScalar(5e5, 1.5, 5e7, 0.3) passed without changes; concern noted in STATE.md as blocker then resolved in-plan
- **v3.0 milestone completed without prior audit** — `/gsd:audit-milestone` was not run; all requirements were 15/15 checked so risk was low, but the audit step was skipped

### Patterns Established

- **DraggablePanel as the standard floating UI primitive** — any new panel added to the globe should use DraggablePanel with localStorage position persistence and +/− collapse
- **`grid-template-rows` CSS transition for collapse** (not scrollHeight) — scrollHeight causes synchronous layout reflow on CesiumJS render thread
- **Module-scope SVG canvas pre-render** — pre-render icon canvases once at layer mount; never generate per-entity to avoid TextureAtlas GPU budget exhaustion
- **removeInputAction before custom handler** — always remove CesiumJS built-in camera action before registering a replacement; prevents dual flyTo conflict
- **`import type` for type-only exports in isolatedModules** — value-import of type-only exports causes TypeScript error under Vite's isolatedModules config

### Key Lessons

1. **Human validation checkpoints absorb pivots** — the DraggablePanel pivot was expensive to plan but cheap to execute because the validation plan was a proper checkpoint, not an afterthought
2. **Satellite layer billboard limit is a hard constraint** — 5,000+ BillboardCollection entries degrade integrated GPU frame rate to unacceptable levels; document as non-negotiable for any future satellite visualization work
3. **useSettingsStore must stay separate from useAppStore** — mixing persistent config with transient runtime state causes localStorage pollution; keep all persisted state isolated
4. **LEFT_CLICK debounce is not optional with double-click zoom** — CesiumJS fires both LEFT_CLICK and LEFT_DOUBLE_CLICK on a double-click; without debounce, entity panels open on zoom gestures
5. **Settings gear must not be gated by cleanUI** — learned in Phase 16: if settings are accessible only in normal UI mode, users are locked out of reverting cleanUI via settings

### Cost Observations

- Sessions: 1 continuous session (2026-03-13, ~4 hours)
- Model: balanced profile (sonnet-4.6)
- Notable: 13 plans across 4 phases; Phase 13 human pivot absorbed cleanly via DraggablePanel decision; faster execution than v2.0 due to cleaner UI-only scope

---

## Cross-Milestone Trends

| Milestone | Phases | Plans | LOC | Key Pattern |
|-----------|--------|-------|-----|-------------|
| v1.0 MVP | 6 | 17 | ~4,400 | Primitive API + Web Worker for scale |
| v2.0 WorldView Parity | 6 | 28 | ~9,326 | Singleton engine + partitioned storage + replay |
| v3.0 UI Refinement | 4 | 13 | ~12,415 | DraggablePanel + SVG icons + camera controls + settings |
