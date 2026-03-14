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

## Milestone: v4.0 — Data Reliability & Freshness

**Shipped:** 2026-03-13
**Phases:** 6 | **Plans:** 13 | **LOC:** ~9,704 Python (+9,704 lines, 71 files)
**Test suite:** 95 passed, 2 skipped, 0 failed

### What Was Built

- Alembic hand-written migration adds freshness lifecycle columns to all 4 tables (`aircraft`, `military_aircraft`, `ships`, `gps_jamming_cells`) with zero-downtime safe defaults — `is_active=server_default='true'`, all timestamps nullable
- `app/freshness.py` module with `stale_cutoff()` and `is_stale()` helpers; env-var configurable thresholds via pydantic-settings (`AIRCRAFT_STALE_SECONDS=120`, `MILITARY=600`, `SHIP=900`, `GPS_JAMMING=600`)
- Aircraft, military, ship list endpoints filter by `is_active=True AND timestamp >= stale_cutoff` — only fresh entities reach the frontend
- GPS jamming transparency: `aggregated_at`, `source_fetched_at`, `source_is_stale` propagated to API envelope; stale cells returned with `source_is_stale=true` (not empty set) to preserve observability
- Full DB-level integration test suite: 95 passing tests across freshness unit tests, stale filtering, ingest correctness, route preservation — with human-checkpoint approval gate

### What Worked

- **TDD discipline throughout** — all 6 phases applied RED→GREEN; `freshness.py` tests were committed before the module existed; route filter tests were written before implementations; 0 test failures during human QA
- **`stale_cutoff()` inside handler body pattern** — identified during Phase 18 research; module-scope call would freeze the cutoff at server start; calling inside the handler body means every request computes fresh cutoff
- **Tombstone guard pattern** — `if seen_ids: ... tombstone sweep` prevents mass false-deactivation on feed-down (empty set → no tombstone); implemented consistently across aircraft, military, and ships ingest
- **Audit-first approach** — running `/gsd:audit-milestone` before archiving confirmed 20/20 requirements satisfied and 14/14 cross-phase integrations wired; no post-archive surprises
- **GPS jamming non-empty policy** — `source_is_stale=true` on stale cells rather than empty response preserves globe layer observability; the decision was validated during Phase 21

### What Was Inefficient

- **TDD sequence inversion in Phase 21** — plans 21-02 and 21-03 were implemented before 21-01 wrote tests; noted in audit as process deviation; contracts are valid and tests pass but the sequence inverts the TDD intent
- **Nyquist VALIDATION.md scaffold-only** — all 6 VALIDATION.md files were created as scaffolds but frontmatter was never updated to reflect TDD execution; `nyquist_compliant: false` across all phases despite wave-0 behavior being present
- **Two-loop architecture in aircraft ingest** — `tasks/ingest_aircraft.py` has its own inline upsert loop duplicating `workers/ingest_aircraft.py::upsert_aircraft()`; acknowledged in audit as a maintenance surface but not fixed in v4.0

### Patterns Established

- **`from datetime import datetime` (not `import datetime`)** — module-level import name is required for `patch('app.freshness.datetime')` to target correctly in tests
- **All freshness fields explicit in `set_={}` dict** — SQLAlchemy `onupdate` is silently ignored on `on_conflict_do_update`; never rely on it for freshness columns
- **`stale_cutoff()` inside handler body** — never at module scope; module-scope call is frozen at server start time
- **AIS `is_active` from Redis key presence** — uniform timestamp threshold incorrectly marks moored vessels (ITU-R M.1371: report every 3 min) as inactive; Redis TTL is authoritative for AIS
- **`TRUNCATE TABLE` for GPS jamming test isolation** — `cells[0]` metadata lift pattern requires clean table; TRUNCATE before insert guarantees the test row is cells[0]

### Key Lessons

1. **stale_cutoff() call placement is correctness-critical** — a module-scope call looks identical to a handler-body call but produces wrong results; document this as a required rule in freshness patterns
2. **Tombstone guard is non-negotiable** — mass false-deactivation on feed-down (empty response → all rows tombstoned) would blank the globe layer; `if seen_ids:` guard is required in every tombstone sweep
3. **GPS jamming non-empty policy is architectural** — returning stale cells with metadata is the correct behavior; an empty response silently converts a staleness event into a blank layer with no observability
4. **onupdate is unreliable on upsert** — SQLAlchemy `onupdate` on model columns is silently ignored on conflict-do-update paths; always write freshness columns explicitly in the `set_={}` dict
5. **Nyquist VALIDATION.md must be updated at execution time** — creating scaffold files is not sufficient; the `nyquist_compliant` and `wave_0_complete` frontmatter fields must be updated when TDD wave-0 is executed

### Cost Observations

- Sessions: 1 continuous session (2026-03-13, ~6 hours)
- Model: balanced profile (sonnet-4.6)
- Notable: 13 plans across 6 phases entirely backend; the most test-heavy milestone to date; human-checkpoint gate for test suite approval added verifiable confidence at milestone boundary

---

## Milestone: v5.0 — Playback

**Shipped:** 2026-03-14
**Phases:** 4 | **Plans:** 14 | **LOC:** ~12,261 (combined TS/TSX/Python; 71 files changed, +7,364/-163 lines this milestone)

### What Was Built

- `isPlaying` promoted from `PlaybackBar` local state to `useAppStore` global store; `useViewerClock` hook syncs CesiumJS globe day/night shading to `replayTs` via `postUpdate` listener
- `resolveTimestamp` pure function: sends historical `replayTs` to propagation worker in playback mode, returns `null` on pause (satellites freeze instantly), `Date.now()` in live mode
- All 5 live-data layers (aircraft lerp, ships/military Effect 2, GPS jamming poll, street traffic particles) guarded against playback contamination; `queryClient.invalidateQueries()` on LIVE return
- End-to-end 2-hour replay verified: PlaybackBar tick() auto-stop at window boundary, all speed presets, FPS gate ≥30 at 15m/s — no optimization pass needed
- Stale entity grey-tint VIS-01: `is_stale` from backend routes serialized through React Query to Cesium billboard `Color.GRAY.withAlpha(0.4)` in aircraft, ships, and military layers

### What Worked

- **`resolveTimestamp` as pure function** — extracting the three-branch logic into a pure function enabled 6 deterministic unit tests without any Cesium or rAF mocking; TDD on this function was the most efficient test work of any milestone
- **`getState()` inside rAF pattern** — documenting this as the mandatory pattern for animation loops prevented stale-closure bugs across satellite loop, aircraft lerp, and `useViewerClock`
- **`replayModeRef` pattern for street traffic** — discovering that `useRef` synced from the selector each render is the correct approach for values read inside animation loops; clean solution to a subtle closure problem
- **FPS gate passed with no optimization** — the scrubber and interpolation were already efficient; the verification phase confirmed quality without requiring a follow-up engineering pass
- **Manual VRFY-01 checkpoint in plan 26-03** — having a formal human approval gate for the E2E scrub created a clear handoff point; the user confirmed all 5 checks in one session

### What Was Inefficient

- **VALIDATION.md files remain in `draft` status** — all 4 phases have VALIDATION.md files but `nyquist_compliant: false` throughout; not updated at execution time despite the tests being green; a recurring cross-milestone pattern
- **Phase 23 store migration could have been 2 plans** — the 4-plan structure (scaffold → store migration → hook → HUD/gate) was correct but the scaffold plan (23-01) was lightweight; could have merged 23-01 + 23-02 without loss of clarity
- **`useSatellites` refetchInterval gap** — the TLE polling freeze was never added to requirements; discovered post-execution as a tech debt item; adding it to the Phase 25 requirements at planning time would have closed it cleanly

### Patterns Established

- **`getState()` in rAF/postUpdate callbacks** — mandatory pattern for reading Zustand store inside CesiumJS animation loops; selector captured at render time goes stale
- **`replayModeRef` pattern** — `useRef` synced from selector each render, read inside rAF body — prevents stale closure without the overhead of a selector inside the animation frame
- **`resolveTimestamp` pure function** — single testable function for all timestamp resolution logic; replaces ad-hoc `Date.now()` calls scattered across multiple components
- **Null-as-skip in rAF dispatchers** — returning `null` from a resolution function means "skip this tick" with unambiguous semantics; avoids sending 0/undefined which could be valid values
- **`queryClient` singleton from `lib/queryClient.ts`** — `PlaybackBar` and `main.tsx` must import the exact same instance; named export from a shared module is the only reliable pattern

### Key Lessons

1. **`getState()` vs selector in animation loops is a correctness issue, not a style issue** — a captured selector looks correct but produces subtle frame-delayed reads; document this as a hard rule for any future rAF work in this codebase
2. **Null semantics for skip beats undefined/0** — `resolveTimestamp` returning `null` to mean "don't dispatch" is explicit and type-safe; callers can't accidentally use it as a timestamp
3. **FPS gate should be the last plan in a verification phase** — having it as plan 26-04 meant it could only run after all implementation was confirmed working; correct ordering, re-confirm this pattern for v6.0
4. **VALIDATION.md lifecycle needs enforcement** — four consecutive milestones (v2-v5) have phases with `nyquist_compliant: false`; add updating VALIDATION frontmatter to the execute-phase checklist
5. **Manual E2E gate before FPS gate** — VRFY-01 (human 2-hour scrub) before VRFY-02 (FPS measurement) is the right order; visual correctness must be confirmed before performance is measured

### Cost Observations

- Sessions: 1 continuous session (2026-03-13 → 2026-03-14, ~3 hours)
- Model: balanced profile (sonnet-4.6)
- Notable: 14 plans across 4 phases; shortest milestone by wall-clock time; audit + milestone completion in same session as final plan execution

---

## Milestone: v6.0 — Production Ready

**Shipped:** 2026-03-14
**Phases:** 6 (27–32) | **Plans:** 7 | **Files:** 57 changed, +6,463/-178 lines

### What Was Built

- Credential hygiene: `:?error` mandatory syntax in docker-compose.yml; `.dockerignore` in both service dirs; `.env.example` with all 5 credential vars
- API key auth middleware: `verify_api_key` FastAPI dependency; `POST /api/osint-events` returns 401 without correct `X-API-Key`; 6-test auth suite
- Production nginx stack: port 80 reverse proxy; compiled Vite bundle; healthchecks on backend/worker/ais-worker; dev override preserves port 8000
- GitHub Actions CI: 4 parallel jobs (pytest, vitest+tsc, gitleaks, docker build) gating every push/PR
- README + LICENSE: numbered quick-start, API keys table, architecture diagram, credential rotation warning, MIT LICENSE with placeholder
- Phase 32 gap closure: `VITE_API_KEY` build arg wired end-to-end into Dockerfile + CI + OsintEventPanel fetch headers

### What Worked

- **Audit-then-gap-close pattern** — running `/gsd:audit-milestone` before completion found the VITE_API_KEY wiring gap (CI bundling empty string); Phase 32 closed it cleanly before archiving
- **`:?message` fail-loud pattern** — mandatory error syntax forced immediately visible failures when `.env` absent; `:- fallback` would have silently passed empty credentials through all CI runs
- **Build ARG pattern from Phase 29** — VITE_CESIUM_ION_TOKEN pattern established in Phase 29 made VITE_API_KEY in Phase 32 a direct template copy; no research needed
- **Commit-SHA gitleaks allowlist** — narrowest-scope allowlist for historical commits; does not suppress future detections; correct balance between unblocking CI and maintaining hygiene
- **4-job parallel CI** — splitting pytest, vitest+tsc, gitleaks, and docker-build into parallel jobs kept total CI time minimal despite covering all four gates

### What Was Inefficient

- **Phase 32 required at all** — the VITE_API_KEY gap existed because Phase 28 (API key auth) and Phase 29 (docker stack) were planned independently without tracing the full env var chain; a single integration checklist at Phase 28 planning would have caught it
- **VALIDATION.md files still draft** — fifth consecutive milestone with `nyquist_compliant: false` across all phases; the pattern has been identified four times and still not addressed in the execute-phase flow
- **Credential rotation is a user action** — real credentials (OpenSky client secret, AISStream key) in git history pre-Phase-27 require user action (`git filter-repo`) before public release; this was not surfaced as a blocking gate in the milestone workflow
- **ROADMAP.md plan checkbox inconsistency** — Phases 28–30, 32 had `[ ]` unchecked plan boxes in ROADMAP despite plans being complete (execution happened without updating ROADMAP); required cleanup at milestone close

### Patterns Established

- **`.dockerignore` co-located with Dockerfile** — always place `.dockerignore` in the same directory as `Dockerfile`; Docker build context for `./frontend` does not read a project-root `.dockerignore`
- **`VITE_*` vars must be build ARGs** — never try to inject `VITE_*` vars as runtime env on the nginx container; Vite inlines them at bundle compile time; the nginx container has no access to the bundle's build-time vars
- **gitleaks with full history** — `fetch-depth: 0` is mandatory on the secret-scan job; shallow clone misses the historical commits that are the primary threat
- **4-parallel CI job pattern** — pytest / vitest+tsc / gitleaks / docker-build as independent parallel jobs is the correct structure for this codebase's CI gates

### Key Lessons

1. **Env var chain tracing at planning time** — when adding auth to a route (Phase 28), immediately trace the full chain: backend env → compose env → frontend build ARG → fetch header; gaps in the chain are integration bugs, not implementation gaps
2. **VALIDATION.md must be updated during execution** — five milestones of `nyquist_compliant: false` is a process failure, not a content failure; add VALIDATION frontmatter update as a required step in execute-phase checklist
3. **Rotate credentials before making the repo public** — git history purge is a user action that cannot be automated; surface it as an explicit gate in the milestone audit rather than a note
4. **`:?message` over `:-default` for all secrets** — fail-loud mandatory syntax is the only correct pattern for credential variables; soft defaults are security liabilities masquerading as convenience
5. **Audit-before-archive caught a real production bug** — without the audit, the production Docker image would have bundled an empty `VITE_API_KEY` string, silently breaking OSINT event submission on every POST; the audit workflow paid for itself here

### Cost Observations

- Sessions: 1 continuous session (2026-03-14, ~4 hours)
- Model: balanced profile (sonnet-4.6)
- Notable: 6 phases, 7 plans; infra-heavy milestone with no frontend UI work; Phase 32 was a post-audit gap closure inserted after phases 27–31 were complete

---

## Milestone: v7.0 — Viewport Culling

**Shipped:** 2026-03-14
**Phases:** 1 (33) | **Plans:** 4 | **Files:** 9 changed, +185/-40 lines

### What Was Built

- TDD RED scaffold: 5 test files (2 frontend, 3 backend) covering VPC-01 through VPC-08 before any implementation
- Zustand viewportBbox store slice + useViewportBbox hook (moveEnd listener, null guard, IDL antimeridian guard, 1 d.p. rounding)
- Backend optional bbox query params on aircraft, ships, and military routes using SQLAlchemy BETWEEN on existing B-tree indexed columns
- effectiveBbox pattern in all 3 live-data React Query hooks — queryKey includes bbox for auto-refetch; playback mode suppresses bbox
- Full E2E loop verified: camera pan → store update → queryKey change → URLSearchParams → backend filter → reduced payload (217+102 tests)

### What Worked

- **TDD RED scaffold as plan 01** — writing all 8 failing tests before any implementation made the acceptance criteria unambiguous; green-phase plans had zero ambiguity about what "done" meant
- **Stub-first TDD pattern** — creating a no-op `useViewportBbox.ts` stub alongside the tests let vitest collect immediately; "does NOT call" assertions passed vacuously during RED phase without being misleading
- **Null = global dataset fallback** — both IDL crossing and undefined rect call `setViewportBbox(null)`; downstream hooks treat null as "load full dataset"; consistent pattern across all 3 hooks with zero special cases
- **effectiveBbox naming** — making the playback suppression explicit in a named variable (`effectiveBbox = replayMode === 'live' ? viewportBbox : null`) made VPC-08 self-documenting across all 3 hooks
- **No new indexes required** — existing `idx_aircraft_latlon_not_null` B-tree index covered the BETWEEN filter hot path; zero schema changes for a meaningful backend optimization

### What Was Inefficient

- **VALIDATION.md nyquist gap** — sixth consecutive milestone with `nyquist_compliant: false`; the audit noted it as a documentation gap, not a code gap, but the pattern persists
- **Docker VM disk full during Plan 33-03** — 19.5GB of build cache caused Postgres crash loop; `docker builder prune` is now a known prerequisite for backend test runs after extended development sessions

### Patterns Established

- **effectiveBbox pattern** — `effectiveBbox = replayMode === 'live' ? viewportBbox : null` is the correct template for any future hook that should respect playback mode isolation
- **queryKey includes bbox object (not serialised string)** — React Query deep-compares objects; no manual invalidation needed when camera bounds change
- **All 4 bbox params required guard** — `if all(v is not None for v in (min_lat, max_lat, min_lon, max_lon))` before filter activation; partial bbox silently falls back to full dataset

### Key Lessons

1. **TDD plan as Wave 0** — putting the test scaffold in its own plan (33-01) before any implementation plan keeps the RED phase clean and makes each subsequent plan's acceptance criteria concrete
2. **ViewportBbox interface ownership** — define shared types in the store, not in the hook; hook imports store, so defining in the hook creates circular import; this is the correct pattern for any future store-typed data
3. **IDL crossing must be handled at the hook layer** — the backend BETWEEN clause has no semantics for west > east; the hook is the correct place to guard and return null, not the backend

### Cost Observations

- Sessions: 1 continuous session (2026-03-14, ~1 hour)
- Model: balanced profile (sonnet-4.6)
- Notable: single-phase, 4-plan milestone; TDD discipline made execution fast — clear RED→GREEN progression with no rework

---

## Cross-Milestone Trends

| Milestone | Phases | Plans | LOC | Key Pattern |
|-----------|--------|-------|-----|-------------|
| v1.0 MVP | 6 | 17 | ~4,400 | Primitive API + Web Worker for scale |
| v2.0 WorldView Parity | 6 | 28 | ~9,326 | Singleton engine + partitioned storage + replay |
| v3.0 UI Refinement | 4 | 13 | ~12,415 | DraggablePanel + SVG icons + camera controls + settings |
| v4.0 Data Reliability | 6 | 13 | ~9,704 | Freshness lifecycle columns + stale filtering + DB-level tests |
| v5.0 Playback | 4 | 14 | ~12,261 | getState() in rAF + resolveTimestamp pure fn + layer guards |
| v6.0 Production Ready | 6 | 7 | ~15,883 | Fail-loud credential pattern + VITE build ARG + 4-job parallel CI |
| v7.0 Viewport Culling | 1 | 4 | +185 net | effectiveBbox + queryKey bbox + BETWEEN on indexed columns |
