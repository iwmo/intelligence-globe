---
phase: 01-foundation
plan: 03
subsystem: infra
tags: [cesiumjs, react, docker, vite, tanstack-query, fastapi]

# Dependency graph
requires:
  - phase: 01-foundation/01-01
    provides: FastAPI backend with /api/health endpoint and Docker stack
  - phase: 01-foundation/01-02
    provides: CesiumJS globe, React shell, Zustand store, TanStack Query wiring

provides:
  - Phase 1 verified end-to-end: Docker stack healthy, globe cinematic, API connected
  - NaturalEarthII bundled imagery (no ion token required for dev)
  - API connection health check with 5s timeout, retry, and 10s refetch polling
  - Cesium canvas pointer-events fixed for reliable scroll-to-zoom interaction
  - viewer.resize() call on mount to align canvas dimensions with CSS-positioned container
  - Docker container networking fixed — VITE_API_BASE_URL uses service name not localhost

affects: [phase-2-satellite-tracking, phase-3-aircraft]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "TileMapServiceImageryProvider with buildModuleUrl for ion-free bundled NaturalEarthII tileset"
    - "EllipsoidTerrainProvider as no-token terrain fallback"
    - "AbortController with setTimeout for fetch timeouts — prevents indefinite loading state in TanStack Query"
    - "pointer-events: auto !important on Cesium canvas — overrides widget CSS interference with scroll events"
    - "viewer.resize() immediately after Viewer construction — syncs canvas to absolute-positioned container"
    - "viewerRef null-check guard in requestAnimationFrame — prevents StrictMode double-mount from crashing GPU context"

key-files:
  created: []
  modified:
    - docker-compose.yml
    - frontend/src/lib/api.ts
    - frontend/src/components/GlobeView.tsx
    - frontend/src/styles/globe.css

key-decisions:
  - "NaturalEarthII via TileMapServiceImageryProvider from bundled Cesium assets — no ion token required for dev"
  - "VITE_API_BASE_URL=http://backend:8000 hardcoded in docker-compose.yml — localhost resolves to container loopback not host"
  - "AbortController timeout (5s) on health fetch — hanging fetch stays isLoading indefinitely without it"
  - "refetchInterval: 10_000 added to health check — enables automatic reconnection if backend restarts"
  - "pointer-events: auto !important on .cesium-widget canvas — Cesium widget CSS can set pointer-events: none, blocking wheel events"
  - "viewer.resize() on init — canvas reports 0x0 until explicitly sized when container uses position: absolute"
  - "viewerRef.current null-check in requestAnimationFrame — React StrictMode double-invokes effects, second mount finds destroyed Viewer"

patterns-established:
  - "Ion-free globe: TileMapServiceImageryProvider + EllipsoidTerrainProvider as default — add ion token only when terrain is needed"
  - "Container networking: never use localhost as API base in docker-compose env vars — always use service name"
  - "Fetch timeout pattern: AbortController + setTimeout + finally clearTimeout for all health/polling fetches"
  - "Cesium init pattern: guard after async await (StrictMode), explicit resize(), viewerRef guard prevents double-mount"

requirements-completed: [GLOB-01, GLOB-02, INFRA-01, INFRA-02]

# Metrics
duration: 45min
completed: 2026-03-11
---

# Phase 1 Plan 3: Visual Verification and Bug Fix Summary

**NaturalEarthII bundled globe renders cinematically without ion token, API self-heals via AbortController, Docker container networking fixed — Phase 1 fully verified**

## Performance

- **Duration:** ~45 min (including multiple fix iterations during visual verification)
- **Started:** 2026-03-11T11:40:18Z
- **Completed:** 2026-03-11
- **Tasks:** 2 of 2 (Task 1 automated checks green; Task 2 visual verification with bug fixes)
- **Files modified:** 7 across three commits

## Accomplishments

- All 6 automated tests green (test_health.py: 3, test_db.py: 3) and Docker Compose healthy across all 4 services
- Globe renders with NaturalEarthII imagery, cinematic dark theme, day/night lighting, no CesiumJS chrome widgets — human-verified
- API health check shows "API connected · v0.1.0" in status bar — frontend-to-backend connection confirmed
- Scroll-to-zoom and click-to-pan both work smoothly in browser

## Task Commits

1. **Task 1: Run full automated test suite and Docker smoke check** - `24494f5` (fix)
2. **Task 2: Visual verification — cinematic globe and API connection** - `96c7983` (fix), `a75c7f8` (fix)

**Plan metadata:** `361da05` (docs: complete plan — created prior to final fixes)

## Files Created/Modified

- `docker-compose.yml` — Hardcoded VITE_API_BASE_URL=http://backend:8000 for correct container networking
- `frontend/src/lib/api.ts` — Added AbortController 5s timeout, retryDelay 2s, refetchInterval 10s to useHealthCheck
- `frontend/src/components/GlobeView.tsx` — NaturalEarthII TileMapServiceImageryProvider, EllipsoidTerrainProvider fallback, StrictMode guard, wheel event listener, explicit viewer.resize()
- `frontend/src/styles/globe.css` — html overflow hidden, touch-action none on container, pointer-events auto on canvas
- `backend/app/config.py` — Pydantic Settings v2 compatibility (Task 1)
- `backend/pytest.ini` — Test runner config (Task 1)
- `backend/tests/conftest.py` — Async test fixtures (Task 1)

## Decisions Made

- NaturalEarthII imagery via `TileMapServiceImageryProvider` using `buildModuleUrl` for bundled Cesium assets — eliminates ion token requirement entirely for Phase 1 dev workflow; graceful degradation when no token is present
- `VITE_API_BASE_URL=http://backend:8000` hardcoded in docker-compose.yml — `localhost` inside a container resolves to the container's own loopback interface, not the Docker host, causing silent API failure
- AbortController with 5-second timeout — prevents TanStack Query from staying in `isLoading` indefinitely when backend is slow to start; converts hang into error so retry cycle activates
- `viewerRef.current` null-check before every post-init Viewer operation — React StrictMode double-invokes `useEffect`; the second mount finds a destroyed Viewer instance without this guard, crashing with "Cannot read properties of undefined"
- Direct `wheel` event listener added to Cesium canvas as belt-and-suspenders alongside CSS fix — some Cesium versions set pointer-events on intermediate wrapper elements not covered by canvas selector alone

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Docker VITE_API_BASE_URL resolved to container loopback instead of backend service**
- **Found during:** Task 2 (status bar showed permanent "connecting..." state)
- **Issue:** VITE_API_BASE_URL was unset or set to localhost:8000 — inside the frontend container, localhost refers to itself, not the backend service
- **Fix:** Set `VITE_API_BASE_URL=http://backend:8000` explicitly in docker-compose.yml environment block
- **Files modified:** `docker-compose.yml`
- **Verification:** Status bar transitioned to "API connected · v0.1.0" after fix
- **Committed in:** `a75c7f8`

**2. [Rule 1 - Bug] Ion-dependent default imagery caused blank globe (401 errors on tile requests)**
- **Found during:** Task 2 (globe rendered blank — no imagery visible)
- **Issue:** CesiumJS default imagery provider requires a Cesium ion token; `.env` had no `VITE_CESIUM_ION_TOKEN`, causing 401 errors on all tile requests
- **Fix:** Switched to `TileMapServiceImageryProvider` pointing at bundled `NaturalEarth2` tileset via `buildModuleUrl`; added `EllipsoidTerrainProvider` as terrain fallback
- **Files modified:** `frontend/src/components/GlobeView.tsx`
- **Verification:** Globe rendered NaturalEarth II imagery without any ion token in console
- **Committed in:** `a75c7f8`

**3. [Rule 1 - Bug] API health fetch hangs indefinitely — status bar never resolves from isLoading**
- **Found during:** Task 2 (visual verification — status bar stuck on "connecting")
- **Issue:** `fetch('/api/health')` with no timeout hangs if backend is slow. TanStack Query retry only fires on rejected promises, not stalled connections. Result: `isLoading` stays true forever.
- **Fix:** Wrapped fetch in AbortController with 5s setTimeout; added `retryDelay: 2000` and `refetchInterval: 10000`
- **Files modified:** `frontend/src/lib/api.ts`
- **Verification:** Status bar transitioned from "connecting" to "connected" within 10s of backend becoming healthy
- **Committed in:** `96c7983`

**4. [Rule 1 - Bug] Cesium scroll-to-zoom blocked by CSS pointer-events on widget layer**
- **Found during:** Task 2 (visual verification — scroll wheel did not zoom the globe)
- **Issue:** CesiumJS widget CSS applies `pointer-events: none` to overlay elements; in some configurations this blocks wheel events from reaching the canvas
- **Fix:** Added `pointer-events: auto !important` on `.cesium-widget canvas` in globe.css; added direct `wheel` event listener on canvas in GlobeView.tsx; added `touch-action: none` on container
- **Files modified:** `frontend/src/styles/globe.css`, `frontend/src/components/GlobeView.tsx`
- **Verification:** Scroll-to-zoom worked in browser after fix; human confirmed in visual verification
- **Committed in:** `96c7983`, `a75c7f8`

**5. [Rule 1 - Bug] Cesium Viewer crashes on React StrictMode double-mount in requestAnimationFrame**
- **Found during:** Task 2 (console error: "Cannot read properties of undefined" on resize)
- **Issue:** React StrictMode double-invokes `useEffect`; the cleanup and second mount race with a `requestAnimationFrame` resize callback that references the already-destroyed Viewer
- **Fix:** Added `if (!viewerRef.current) return` guard inside the `requestAnimationFrame` callback
- **Files modified:** `frontend/src/components/GlobeView.tsx`
- **Verification:** No errors in console; canvas fills container correctly in development mode
- **Committed in:** `a75c7f8`

---

**Total deviations:** 5 auto-fixed (all Rule 1 - Bug)
**Impact on plan:** All fixes required for Phase 1 success criteria. No scope creep — each fix directly addressed a failing visual verification item.

## Issues Encountered

- CesiumJS ion token absent caused blank globe — resolved by switching to bundled NaturalEarthII tileset (ion-free approach now the established pattern for Phase 1 dev)
- Docker container networking for Vite environment variables required explicit service-name URL — localhost anti-pattern now documented in patterns-established

## User Setup Required

None - no external service configuration required beyond what was established in 01-01 and 01-02.

## Next Phase Readiness

- Phase 1 complete: Docker stack healthy, globe cinematic, backend reachable, all 6 pytest tests green
- Phase 2 (satellite tracking) can begin: CelesTrak OMM/JSON ingestion, satellite.js in Web Worker, Cesium Primitive API for orbital rendering
- Pre-Phase 2 reminder: spike satellite.js json2satrec() with CelesTrak OMM format before committing ingestion design (noted in STATE.md blockers)

---
*Phase: 01-foundation*
*Completed: 2026-03-11*
