---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: planning
stopped_at: "Completed 02-satellite-layer/02-04-PLAN.md — satellite layer rendering: 5,000+ points, click-to-select, orbit path, ground track, ESRI basemap, human verification approved"
last_updated: "2026-03-11T13:43:50.225Z"
last_activity: 2026-03-11 — Roadmap created, all 17 v1 requirements mapped to 5 phases
progress:
  total_phases: 5
  completed_phases: 2
  total_plans: 7
  completed_plans: 7
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-11)

**Core value:** A unified, visually impressive intelligence picture — satellites orbiting, aircraft moving — all rendered on one polished 3D globe that feels operational and modern.
**Current focus:** Phase 1 — Foundation

## Current Position

Phase: 1 of 5 (Foundation)
Plan: 0 of TBD in current phase
Status: Ready to plan
Last activity: 2026-03-11 — Roadmap created, all 17 v1 requirements mapped to 5 phases

Progress: [░░░░░░░░░░] 0%

## Performance Metrics

**Velocity:**
- Total plans completed: 0
- Average duration: —
- Total execution time: —

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| - | - | - | - |

**Recent Trend:**
- Last 5 plans: —
- Trend: —

*Updated after each plan completion*
| Phase 01-foundation P01 | 5 | 3 tasks | 18 files |
| Phase 01-foundation P02 | 10min | 2 tasks | 15 files |
| Phase 01-foundation P03 | 20 | 2 tasks | 3 files |
| Phase 01-foundation P03 | 45 | 2 tasks | 7 files |
| Phase 02-satellite-layer P01 | 3 | 2 tasks | 7 files |
| Phase 02-satellite-layer P03 | 86s | 2 tasks | 4 files |
| Phase 02-satellite-layer P02 | 10 | 2 tasks | 6 files |
| Phase 02-satellite-layer P04 | 60min | 3 tasks | 6 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [Pre-Phase 1]: Use CelesTrak OMM/JSON (not legacy TLE text) — avoids July 2026 5-digit catalog cutover
- [Pre-Phase 1]: Use OpenSky OAuth2 (not Basic Auth) — Basic Auth deprecated March 18, 2026
- [Pre-Phase 1]: Primitive API (not Entity API) for satellite rendering — Entity API collapses at 5,000+ objects
- [Pre-Phase 1]: satellite.js runs in Web Worker — main-thread propagation causes UI jank at scale
- [Pre-Phase 1]: RQ over Celery, Zustand over Redux, TanStack Query added for server state
- [Phase 01-foundation]: AsyncAttrs imported from sqlalchemy.ext.asyncio not sqlalchemy.orm (version build-specific)
- [Phase 01-foundation]: Pydantic Settings uses model_config = ConfigDict() for v2 compatibility
- [Phase 01-foundation]: Test execution uses python3.11 (homebrew) due to conda environment path collision
- [Phase 01-foundation]: viewerRef guard (not useState) for CesiumJS Viewer — prevents StrictMode double-mount destroying GPU context
- [Phase 01-foundation]: Tailwind v3 (not v4) with shadcn/ui — v4 CSS import pattern incompatible with existing Vite config
- [Phase 01-foundation]: EllipsoidTerrainProvider fallback when VITE_CESIUM_ION_TOKEN absent — no crash on dev without ion token
- [Phase 01-foundation]: AbortController timeout (5s) on health fetch prevents indefinite isLoading state in TanStack Query
- [Phase 01-foundation]: pointer-events: auto !important on .cesium-widget canvas fixes scroll-to-zoom blocked by Cesium widget CSS
- [Phase 01-foundation]: viewer.resize() on Cesium init aligns canvas dimensions with CSS absolute-positioned container
- [Phase 01-foundation]: NaturalEarthII via TileMapServiceImageryProvider from bundled Cesium assets — no ion token required for dev
- [Phase 01-foundation]: VITE_API_BASE_URL hardcoded to http://backend:8000 in docker-compose.yml — localhost resolves incorrectly inside container
- [Phase 01-foundation]: AbortController timeout (5s) on health fetch enables TanStack Query retry cycle without indefinite isLoading
- [Phase 01-foundation]: viewerRef.current null-check in requestAnimationFrame prevents React StrictMode double-mount from crashing GPU context
- [Phase 02-satellite-layer]: Alembic env.py uses asyncio.run() with async engine and run_sync — avoids needing a separate sync DB URL for migrations
- [Phase 02-satellite-layer]: Dual GET decorator on list_satellites (@router.get('') + @router.get('/')) handles trailing-slash without disabling redirect_slashes globally
- [Phase 02-satellite-layer]: include_object filter in alembic/env.py excludes reflected PostGIS/tiger tables from autogenerate
- [Phase 02-satellite-layer]: satellite.js json2satrec guards satrec.error !== 0 to silently discard malformed OMM records
- [Phase 02-satellite-layer]: PROPAGATE uses transferable Float64Array (zero-copy IPC) packing [x,y,z,norad]*N in meters
- [Phase 02-satellite-layer]: 30s AbortController timeout on /api/satellites/ fetch — large (~4 MB) payload exceeds typical 5s window
- [Phase 02-satellite-layer]: httpx moved to production requirements — needed at runtime by ingest task in worker container
- [Phase 02-satellite-layer]: Self-re-enqueue pattern over RQ Repeat(times=-1) — Repeat API is version-unstable; self-re-enqueue works reliably across RQ versions
- [Phase 02-satellite-layer]: RQ sync wrapper pattern: def sync_task() wraps asyncio.run(async_task()) — RQ cannot pickle async coroutines directly
- [Phase 02-satellite-layer]: Material.fromType('Color', {color}) required for PolylineCollection — inline fabric object literal rejected at runtime by CesiumJS
- [Phase 02-satellite-layer]: ESRI World Imagery (UrlTemplateImageryProvider) replaces NaturalEarthII — satellite photo basemap, free, no ion token, dramatically better visual quality
- [Phase 02-satellite-layer]: ArcType.NONE on all orbit polylines — orbital paths are ECEF straight segments, not geodesic arcs

### Pending Todos

None yet.

### Blockers/Concerns

- [Phase 2]: satellite.js `json2satrec()` with CelesTrak OMM format — medium confidence; spike before committing ingestion design
- [Phase 3]: OpenSky credit limit on anonymous tier (400/day) — register OAuth2 credentials before Phase 3 begins
- [Phase 5]: DBSCAN parameters for anomaly detection are deferred to v2, but performance targets require empirical validation at full load

## Session Continuity

Last session: 2026-03-11T13:33:27.601Z
Stopped at: Completed 02-satellite-layer/02-04-PLAN.md — satellite layer rendering: 5,000+ points, click-to-select, orbit path, ground track, ESRI basemap, human verification approved
Resume file: None
