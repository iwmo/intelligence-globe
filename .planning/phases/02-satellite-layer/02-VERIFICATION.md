---
phase: 02-satellite-layer
verified: 2026-03-11T16:45:00Z
status: human_needed
score: 6/6 must-haves verified
re_verification: false
human_verification:
  - test: "Confirm 5,000+ satellite points are visible on the globe"
    expected: "Dense cyan point cloud at varying orbital altitudes when zooming out"
    why_human: "Cannot count rendered CesiumJS PointPrimitive instances programmatically without running the browser"
  - test: "Click a satellite point and verify the RightDrawer opens with correct metadata"
    expected: "RightDrawer slides in showing NORAD ID (number), object name (string), constellation, altitude in km (100–36000 range), velocity in km/s (3–8 range), inclination degrees, TLE epoch string"
    why_human: "Requires CesiumJS scene.pick() to fire in a live browser session — cannot simulate ScreenSpaceEventHandler without a rendered WebGL context"
  - test: "Verify orbit path and ground track appear on satellite selection"
    expected: "Cyan polyline arc above the globe (orbit path) and gold/yellow line clamped to surface (ground track)"
    why_human: "CesiumJS PolylineCollection rendering requires a live WebGL context"
  - test: "Confirm satellite positions update in real time"
    expected: "Points visibly shift position every ~1 second without flicker or freeze"
    why_human: "Animation and Web Worker IPC cannot be verified without a running browser"
  - test: "Confirm TLE freshness timestamp in bottom bar"
    expected: "Bottom bar shows a UTC date string like 'TLE: Tue, 11 Mar 2026 ...' not 'TLE: loading...'"
    why_human: "Requires /api/satellites/freshness to be reachable from the browser context — depends on Docker stack running"
  - test: "Close the drawer and verify orbit polylines are removed"
    expected: "Clicking the x button closes drawer and both orbit path and ground track disappear from globe"
    why_human: "Requires interacting with live rendered state — verifies Effect 3 orbit cleanup"
---

# Phase 2: Satellite Layer Verification Report

**Phase Goal:** Users can see 5,000+ real-time satellites on the globe, select one for details, and verify orbit path accuracy
**Verified:** 2026-03-11T16:45:00Z
**Status:** human_needed (all automated checks passed)
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|---------|
| 1 | 5,000+ satellite points visible on globe updating position in real time | ? HUMAN NEEDED | CelesTrak ingest confirmed 14,683 records in DB (02-02-SUMMARY); PointPrimitiveCollection built in SatelliteLayer.tsx with 1 Hz rAF loop; rendering requires live browser |
| 2 | Clicking a satellite opens a metadata panel showing NORAD ID, altitude, velocity, TLE epoch, and constellation | ? HUMAN NEEDED | ScreenSpaceEventHandler wired in SatelliteLayer.tsx; SatelliteDetailPanel.tsx fetches /api/satellites/{id} with all required fields; RightDrawer slides on selectedSatelliteId; requires live WebGL |
| 3 | A selected satellite shows its orbit path polyline and ground track rendered on the globe | ? HUMAN NEEDED | COMPUTE_ORBIT handler complete in propagation.worker.ts; PolylineCollection added in SatelliteLayer ORBIT_RESULT handler using Material.fromType and ArcType.NONE; requires live browser |
| 4 | A data freshness indicator shows TLE age | ? HUMAN NEEDED | BottomStatusBar.tsx fetches /api/satellites/freshness on mount and renders timestamp; /api/satellites/freshness endpoint returns MAX(updated_at); requires Docker stack running |

**Automated score:** 6/6 supporting artifacts and key links verified. All 4 observable truths have complete code paths — human visual confirmation is the remaining gate.

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `backend/app/models/satellite.py` | Satellite ORM model with all OMM fields + JSONB raw_omm | VERIFIED | All 13 orbital element columns present; JSONB raw_omm; CONSTELLATION_MAP and derive_constellation() helper |
| `backend/app/api/routes_satellites.py` | list, freshness, detail endpoints | VERIFIED | Three endpoints; freshness defined before /{norad_cat_id} to prevent routing conflict; vis-viva altitude/velocity derivation in detail endpoint |
| `backend/app/main.py` | satellites_router included at /api/satellites | VERIFIED | `app.include_router(satellites_router, prefix="/api/satellites")` at line 26 |
| `backend/tests/test_satellites.py` | Five async tests covering all three endpoints | VERIFIED | 5 test functions; all substantive (not empty); tests seed and clean up their own data |
| `backend/alembic/versions/ac9bb4b6e929_add_satellites_table.py` | Alembic migration for satellites table | VERIFIED | File exists in backend/alembic/versions/ |
| `backend/app/tasks/ingest_satellites.py` | fetch_and_upsert_satellites (async) + sync_fetch_and_upsert_satellites (RQ wrapper) | VERIFIED | Async function fetches CelesTrak URL with httpx, upserts via on_conflict_do_update; sync wrapper calls asyncio.run() then self-re-enqueues with enqueue_in(timedelta(hours=2)) |
| `backend/app/worker.py` | RQ Worker entry point enqueuing first ingest on startup | VERIFIED | main() creates Queue, enqueues by string path, starts Worker with_scheduler=True |
| `docker-compose.yml` | worker service depending on postgres + redis healthchecks | VERIFIED | worker service present; depends_on postgres (service_healthy) and redis (service_healthy) |
| `frontend/src/workers/propagation.worker.ts` | LOAD_OMM, PROPAGATE, COMPUTE_ORBIT handlers | VERIFIED | All three handlers implemented; PROPAGATE uses Float64Array with transferable buffer; km to meters conversion; satrec.error guard; typeof pv.position === 'boolean' guard |
| `frontend/src/hooks/useSatellites.ts` | TanStack Query hook with 2-hour staleTime and refetchInterval | VERIFIED | queryKey ['satellites']; fetch /api/satellites/ with 30s AbortController timeout; staleTime: 7_200_000; refetchInterval: 7_200_000 |
| `frontend/src/store/useAppStore.ts` | selectedSatelliteId and tleLastUpdated state fields | VERIFIED | Both fields present with setters; existing fields (sidebarOpen, layers) preserved |
| `frontend/src/components/SatelliteLayer.tsx` | PointPrimitiveCollection + Worker lifecycle + click handler + orbit rendering | VERIFIED | All three Effects present; Effect 1 (init + propagation loop); Effect 2 (COMPUTE_ORBIT on selection); Effect 3 (orbit cleanup on deselection); cleanup returns properly |
| `frontend/src/components/SatelliteDetailPanel.tsx` | Metadata panel with NORAD ID, name, constellation, altitude, velocity, epoch | VERIFIED | All six fields rendered; enabled guard on selectedId !== null |
| `frontend/src/components/RightDrawer.tsx` | Slide-in drawer driven by selectedSatelliteId | VERIFIED | CSS transition on right: selectedId !== null ? 0 : '-320px'; renders SatelliteDetailPanel |
| `frontend/src/components/BottomStatusBar.tsx` | TLE freshness timestamp display | VERIFIED | useEffect fetches /api/satellites/freshness on mount; renders formattedTle string |
| `frontend/src/components/GlobeView.tsx` | onViewerReady prop exposing initialized Viewer | VERIFIED | GlobeViewProps interface with onViewerReady?: (viewer: Viewer) => void; called after viewerRef.current = viewer |
| `frontend/src/App.tsx` | cesiumViewer state passed to SatelliteLayer | VERIFIED | useState<Viewer | null>; GlobeView onViewerReady={setCesiumViewer}; SatelliteLayer viewer={cesiumViewer} |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `backend/app/main.py` | `routes_satellites.py` | `app.include_router(satellites_router, prefix="/api/satellites")` | WIRED | Line 26 of main.py confirms router mount |
| `routes_satellites.py` | `satellite.py` | `from app.models.satellite import Satellite` | WIRED | Line 15 of routes_satellites.py |
| `worker.py` | `ingest_satellites.py` | `queue.enqueue("app.tasks.ingest_satellites.sync_fetch_and_upsert_satellites")` | WIRED | String-addressed enqueue in worker.py line 18 |
| `ingest_satellites.py` | `satellite.py` | `from app.models.satellite import Satellite, derive_constellation` | WIRED | Line 11 of ingest_satellites.py; uses insert(Satellite).on_conflict_do_update |
| `GlobeView.tsx` | `SatelliteLayer.tsx` | viewer prop passed via App.tsx useState | WIRED | App.tsx passes cesiumViewer state to SatelliteLayer; GlobeView calls onViewerReady?(viewer) |
| `SatelliteLayer.tsx` | `propagation.worker.ts` | `new Worker(new URL('../workers/propagation.worker.ts', import.meta.url), { type: 'module' })` | WIRED | Line 53-56 of SatelliteLayer.tsx |
| `SatelliteLayer.tsx` | `useAppStore.ts` | `useAppStore.getState().setSelectedSatelliteId(picked.id)` | WIRED | Line 144 of SatelliteLayer.tsx; click handler calls store setter |
| `SatelliteDetailPanel.tsx` | `GET /api/satellites/{norad_id}` | `fetch('/api/satellites/${selectedId}')` in useQuery queryFn | WIRED | Line 23 of SatelliteDetailPanel.tsx |
| `BottomStatusBar.tsx` | `GET /api/satellites/freshness` | `fetch('/api/satellites/freshness')` in useEffect | WIRED | Line 12 of BottomStatusBar.tsx |
| `propagation.worker.ts` | `satellite.js` | `import * as satellite from 'satellite.js'` | WIRED | Line 1 of propagation.worker.ts; json2satrec, propagate, eciToEcf, gstime, eciToGeodetic all called |

---

## Requirements Coverage

| Requirement | Source Plans | Description | Status | Evidence |
|-------------|-------------|-------------|--------|---------|
| SAT-01 | 02-01, 02-02, 02-03, 02-04 | User sees 5,000+ real-time satellites rendered on the globe from CelesTrak TLE/GP data | SATISFIED (human confirm) | CelesTrak ingest pipeline fetches 14,683+ records; PointPrimitiveCollection renders them via SGP4 Web Worker; requires live browser confirmation |
| SAT-02 | 02-03, 02-04 | User sees orbit path polylines and ground tracks for selected satellites | SATISFIED (human confirm) | COMPUTE_ORBIT handler returns orbitPoints and groundPoints; SatelliteLayer renders cyan orbit polyline (ArcType.NONE) and gold ground track at 10km altitude; requires live browser confirmation |
| INT-01 | 02-01, 02-04 | User can click any satellite to inspect metadata (NORAD ID, altitude, velocity, TLE epoch, constellation) | SATISFIED (human confirm) | ScreenSpaceEventHandler fires setSelectedSatelliteId; SatelliteDetailPanel fetches /api/satellites/{id} returning all six fields; requires live browser confirmation |

No orphaned requirements. GLOB-03 is correctly assigned to Phase 4 (full per-layer toggle indicator). The Phase 2 TLE freshness bar in BottomStatusBar.tsx satisfies ROADMAP success criterion 4 but is a subset of the broader GLOB-03 requirement.

---

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `SatelliteLayer.tsx` | 201 | `return null` | Info | Intentional — component manages CesiumJS scene.primitives, not DOM. Correct pattern for CesiumJS integration. |
| `SatelliteDetailPanel.tsx` | 31 | `return null` | Info | Intentional guard: renders nothing when no satellite is selected. Correct behavior. |

No blocker or warning anti-patterns found. No TODO/FIXME/placeholder comments in any phase 2 files.

---

## Commit Verification

All commits claimed in SUMMARY files confirmed to exist in git history:

| Commit | Message | Plan |
|--------|---------|------|
| b732094 | test(02-01): add failing test scaffold | 02-01 |
| db7475e | feat(02-01): satellite model, Alembic migration, API routes | 02-01 |
| 401a6fa | feat(02-02): satellite ingest task, RQ worker | 02-02 |
| 3a27f35 | feat(02-02): add worker service to docker-compose | 02-02 |
| 832fcd7 | feat(02-03): install satellite.js and create SGP4 propagation Web Worker | 02-03 |
| 77ab7d5 | feat(02-03): add useSatellites hook and extend Zustand store | 02-03 |
| 331bd51 | feat(02-04): SatelliteLayer — PointPrimitiveCollection, click handler, orbit path | 02-04 |
| e9be974 | feat(02-04): SatelliteDetailPanel, RightDrawer slide-in, TLE freshness indicator | 02-04 |
| 0e1c2ba | fix(02-04): polyline Material.fromType fix and ESRI World Imagery switch | 02-04 |

---

## Human Verification Required

### 1. Satellite Point Cloud Visible on Globe

**Test:** Open http://localhost:3000 with `docker compose up -d` running. Zoom out the globe.
**Expected:** Dense cloud of cyan points at orbital altitudes (LEO dots near surface, GEO dots higher). Point count clearly in the thousands.
**Why human:** CesiumJS PointPrimitiveCollection.length cannot be queried without a running WebGL context.

### 2. Satellite Click Opens Metadata Panel

**Test:** Click any visible satellite point on the globe.
**Expected:** RightDrawer slides in from right edge with: NORAD ID (positive integer), object name (string like "STARLINK-XXXX"), constellation (e.g. "Starlink", "GPS", or "Unknown"), altitude in km (100–36,000 is valid), velocity in km/s (3–8 is valid), inclination in degrees (0–98 typical), TLE epoch (date string).
**Why human:** ScreenSpaceEventHandler.setInputAction requires a live rendered scene for scene.pick() to return satellite primitives.

### 3. Orbit Path and Ground Track Render on Selection

**Test:** After clicking a satellite, observe the globe surface and orbital space.
**Expected:** A cyan polyline arc above the globe following the orbital path, and a gold/yellow line on or near the surface tracing the ground track.
**Why human:** PolylineCollection rendering requires a live WebGL context.

### 4. Real-Time Position Updates

**Test:** Observe the satellite point cloud for 5–10 seconds.
**Expected:** Points shift position visibly every ~1 second without flicker, freeze, or mass disappearance.
**Why human:** rAF propagation loop and Web Worker IPC require a running browser to observe.

### 5. TLE Freshness Timestamp in Bottom Bar

**Test:** Read the bottom status bar after the page loads.
**Expected:** Right side of bar shows a UTC date string (e.g. "TLE: Tue, 11 Mar 2026 ..."), not "TLE: loading...".
**Why human:** Requires /api/satellites/freshness to return a non-null last_updated from the running Docker stack.

### 6. Drawer Close Removes Orbit Polylines

**Test:** After selecting a satellite (orbit path visible), click the × button in the RightDrawer.
**Expected:** Drawer slides out to the right AND both the orbit path and ground track disappear from the globe simultaneously.
**Why human:** Verifies Effect 3 (orbit cleanup on deselection) in a live rendering context.

---

## Summary

All automated verification checks pass across all four plans in Phase 2:

- **Backend data layer** (02-01): Satellite ORM model, Alembic migration, three API endpoints, five passing pytest tests — all substantive, all wired.
- **Ingest pipeline** (02-02): CelesTrak fetch/upsert task, RQ sync wrapper, worker entry point, docker-compose worker service — all substantive, all wired.
- **Frontend propagation engine** (02-03): satellite.js Web Worker with all three message handlers, TanStack Query hook with correct staleTime, Zustand store extended correctly — all substantive, all wired.
- **Globe rendering layer** (02-04): PointPrimitiveCollection management, 1 Hz propagation loop, click handler, COMPUTE_ORBIT orbit path, SatelliteDetailPanel with all required fields, RightDrawer, TLE freshness bar, GlobeView viewer callback, App.tsx wiring — all substantive, all wired.

The code path for every Phase 2 success criterion is complete and connected. The remaining gate is human visual confirmation that the WebGL rendering layer works in a live browser session, which the SUMMARY documents as having been approved (all 8 visual checks) but cannot be re-verified programmatically without running the stack.

---

_Verified: 2026-03-11T16:45:00Z_
_Verifier: Claude (gsd-verifier)_
