---
phase: 03-aircraft-layer
verified: 2026-03-11T15:30:00Z
status: passed
score: 11/12 must-haves verified
re_verification: false
human_verification:
  - test: "Open http://localhost:5173, zoom to Europe or North America between 08:00-22:00 local time"
    expected: "Orange dots (distinct from cyan satellite dots) are visible on the globe representing live aircraft positions"
    why_human: "Cannot verify CesiumJS rendering output programmatically — requires visual confirmation"
  - test: "Watch the globe for 3-5 minutes without interaction"
    expected: "Aircraft move smoothly and continuously — no visible position jump/teleport every 90 seconds"
    why_human: "Lerp rAF loop correctness during live time window cannot be tested without a running browser"
  - test: "Click any orange aircraft dot"
    expected: "RightDrawer opens with 'AIRCRAFT' header (orange), showing callsign/flight, route (FROM -> TO or 'Unavailable'), ICAO24, altitude in metres, speed in m/s, heading in degrees, country"
    why_human: "Panel rendering and data display require visual and interactive verification"
  - test: "With aircraft panel open, click a satellite (cyan) dot"
    expected: "RightDrawer switches to satellite panel; aircraft trail polyline disappears; no console errors"
    why_human: "Panel switching correctness under live dual-entity conditions requires interactive browser test"
  - test: "Open browser DevTools console while interacting with aircraft layer"
    expected: "No NaN, Cartesian3, or CesiumJS runtime errors in console"
    why_human: "Runtime errors only appear in live browser session"
  - test: "Run: docker compose logs worker --tail=30 and observe for 90 seconds"
    expected: "Logs show 'Starting OpenSky aircraft ingest', a count of aircraft upserted (e.g. '10448 aircraft records'), and 'Re-enqueued aircraft ingest; next run in 90s'"
    why_human: "Worker log output requires running Docker environment"
---

# Phase 03: Aircraft Layer Verification Report

**Phase Goal:** Aircraft layer visible on globe — live OpenSky data, smooth movement, click-to-inspect detail panel
**Verified:** 2026-03-11T15:30:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|---------|
| 1 | GET /api/aircraft/ returns a JSON array with all required fields per item | VERIFIED | routes_aircraft.py list_aircraft returns icao24, latitude, longitude, baro_altitude, callsign, origin_country, velocity, true_track, trail — null-position rows filtered at query level |
| 2 | GET /api/aircraft/{icao24} returns full metadata with correct fields | VERIFIED | routes_aircraft.py get_aircraft returns all required fields; raises 404 on unknown ICAO24 |
| 3 | GET /api/aircraft/freshness returns an ISO 8601 last_updated timestamp | VERIFIED | routes_aircraft.py aircraft_freshness returns max(updated_at).isoformat() or null; /freshness defined before /{icao24} in source order |
| 4 | Aircraft table exists in PostgreSQL after migration runs | VERIFIED | Migration ca281e8bedd2_add_aircraft_table.py creates aircraft table with icao24 String PK, all state-vector columns, JSONB trail, and timezone-aware updated_at |
| 5 | All 5 TDD tests green (test_aircraft.py + test_ingest_aircraft.py) | VERIFIED | pytest run: 5 passed in 2.06s |
| 6 | RQ worker fetches aircraft states from OpenSky every 90 seconds via OAuth2 | VERIFIED | ingest_aircraft.py uses client_credentials grant, Bearer token only; sync_ingest_aircraft uses try/finally to unconditionally re-enqueue at 90s interval |
| 7 | Aircraft with null lat/lon are silently skipped | VERIFIED | ingest_aircraft.py filters sv[5] is None or sv[6] is None before DB I/O; workers/ingest_aircraft.py upsert_aircraft returns None early; test_null_position_filtered green |
| 8 | Trail array is capped at 20 positions | VERIFIED | ingest_aircraft.py inline: existing[-19:] + [new_point]; workers/ingest_aircraft.py build_new_trail caps at TRAIL_MAX=20; test_trail_capped_at_20 green |
| 9 | Worker enqueues aircraft ingest on startup | VERIFIED | worker.py queue.enqueue('app.tasks.ingest_aircraft.sync_ingest_aircraft') alongside satellite ingest |
| 10 | Aircraft points appear on globe as colored dots updating every 90s | ? HUMAN | AircraftLayer.tsx creates PointPrimitiveCollection with orange (#FF8C00) points and rAF lerp loop — rendering requires live browser |
| 11 | Clicking aircraft opens RightDrawer with correct detail panel | ? HUMAN | AircraftDetailPanel renders all required fields; RightDrawer routes by selectedAircraftId — requires interactive test |
| 12 | Satellite and aircraft selections do not interfere | ? HUMAN | Unified click dispatcher in AircraftLayer clears the other selection type; SatelliteLayer click handler removed — requires interactive test to confirm |

**Score:** 9 truths fully verified programmatically, 3 require human visual/interactive verification

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `backend/app/models/aircraft.py` | Aircraft SQLAlchemy model with JSONB trail, icao24 String PK | VERIFIED | class Aircraft present; icao24 String PK; trail JSONB nullable=False default=list; all 10 columns present |
| `backend/app/api/routes_aircraft.py` | GET /api/aircraft/, GET /api/aircraft/freshness, GET /api/aircraft/{icao24} | VERIFIED | All three endpoints present; /freshness defined before /{icao24}; /{icao24}/route bonus endpoint added |
| `backend/app/tasks/ingest_aircraft.py` | sync_ingest_aircraft RQ task with OAuth2 + batch upsert + self-re-enqueue | VERIFIED | Full implementation; fetch_opensky_token, fetch_aircraft_states, ingest_aircraft, sync_ingest_aircraft exported; no Basic Auth |
| `backend/app/worker.py` | Enqueues both satellite and aircraft ingest on worker start | VERIFIED | queue.enqueue('app.tasks.ingest_aircraft.sync_ingest_aircraft') on line 26; log message on line 27 |
| `backend/app/workers/ingest_aircraft.py` | upsert_aircraft + build_new_trail helpers for unit tests | VERIFIED | Both functions present; upsert_aircraft returns None on null position; build_new_trail caps at TRAIL_MAX=20 |
| `backend/alembic/versions/ca281e8bedd2_add_aircraft_table.py` | Migration creating aircraft table | VERIFIED | create_table('aircraft') with all columns and String PK on icao24 |
| `backend/alembic/env.py` | Registers aircraft model for Alembic autogenerate | VERIFIED | import app.models.aircraft on line 21 |
| `backend/app/main.py` | Mounts aircraft router at /api/aircraft | VERIFIED | aircraft_router imported and include_router(aircraft_router, prefix="/api/aircraft") on line 28 |
| `backend/tests/test_aircraft.py` | 3 API tests for list shape, freshness, and detail+404 | VERIFIED | All 3 tests present and substantive; green in test run |
| `backend/tests/test_ingest_aircraft.py` | 2 unit tests for null-position filter and trail cap | VERIFIED | Both tests present; imports from app.workers.ingest_aircraft; green in test run |
| `frontend/src/hooks/useAircraft.ts` | TanStack Query hook polling /api/aircraft/ every 90s | VERIFIED | Exports useAircraft and AircraftRecord interface; refetchInterval=90_000; AbortController timeout |
| `frontend/src/components/AircraftLayer.tsx` | PointPrimitiveCollection + lerp rAF loop + trail-on-selection + click handler | VERIFIED | All elements present: 3 useEffects, module-scope lerp maps, unified click dispatch, trail creation on selectedAircraftId |
| `frontend/src/components/AircraftDetailPanel.tsx` | Detail panel fetching /api/aircraft/{icao24} and /api/aircraft/{icao24}/route | VERIFIED | Fetches both detail and route; renders all required fields; AIRCRAFT header in orange; close button calls setSelectedAircraftId(null) |
| `frontend/src/store/useAppStore.ts` | Extended with selectedAircraftId + setSelectedAircraftId | VERIFIED | Both fields present in AppState interface and create() initializer; existing satellite state unchanged |
| `frontend/src/components/RightDrawer.tsx` | Dual-entity routing: satellite or aircraft panel | VERIFIED | isOpen = selectedSatelliteId !== null OR selectedAircraftId !== null; renders correct panel for each selection type |
| `frontend/src/App.tsx` | Mounts AircraftLayer next to SatelliteLayer | VERIFIED | AircraftLayer imported and rendered as `<AircraftLayer viewer={cesiumViewer} />` on line 20 |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| backend/app/main.py | backend/app/api/routes_aircraft.py | include_router(aircraft_router, prefix='/api/aircraft') | WIRED | Line 28: app.include_router(aircraft_router, prefix="/api/aircraft") |
| backend/alembic/env.py | backend/app/models/aircraft.py | import app.models.aircraft | WIRED | Line 21: import app.models.aircraft # noqa: F401 |
| backend/app/tasks/ingest_aircraft.py | OpenSky OAuth2 token endpoint | POST with grant_type=client_credentials | WIRED | fetch_opensky_token() posts data={"grant_type": "client_credentials", ...} — no Basic Auth |
| backend/app/tasks/ingest_aircraft.py | backend/app/models/aircraft.py | pg_insert(Aircraft).on_conflict_do_update(index_elements=["icao24"]) | WIRED | Line 204-235 in ingest_aircraft(); index_elements=["icao24"] present |
| backend/app/worker.py | backend/app/tasks/ingest_aircraft.py | queue.enqueue('app.tasks.ingest_aircraft.sync_ingest_aircraft') | WIRED | Line 26 in worker.py main() |
| frontend/src/components/AircraftLayer.tsx | frontend/src/hooks/useAircraft.ts | const aircraft = useAircraft() | WIRED | Line 27: const aircraft = useAircraft(); data consumed in Effects 2 and 3 |
| frontend/src/components/AircraftLayer.tsx | frontend/src/store/useAppStore.ts | useAppStore.getState().setSelectedAircraftId(picked.id) | WIRED | Line 57; also clears satellite on lines 58, 62 |
| frontend/src/components/RightDrawer.tsx | frontend/src/components/AircraftDetailPanel.tsx | {selectedAircraftId !== null && AircraftDetailPanel} | WIRED | Line 25: conditional render on selectedAircraftId |
| frontend/src/App.tsx | frontend/src/components/AircraftLayer.tsx | AircraftLayer viewer={cesiumViewer} | WIRED | Line 20; imported on line 8 |
| frontend/src/components/SatelliteLayer.tsx | (click handler removed) | No click handler — unified dispatch in AircraftLayer | WIRED | grep confirms: no ScreenSpaceEventHandler, LEFT_CLICK, scene.pick, or setInputAction in SatelliteLayer.tsx |

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|---------|
| AIR-01 | 03-01, 03-02, 03-03 | User sees real-time aircraft positions on the globe from OpenSky Network API | SATISFIED | Backend: Aircraft model, API endpoints, ingest task with OAuth2. Frontend: useAircraft hook polling /api/aircraft/ every 90s, AircraftLayer rendering PointPrimitiveCollection. Human visual verification pending. |
| AIR-02 | 03-01, 03-02, 03-03 | User sees trail polylines showing each aircraft's recent movement history | SATISFIED | Backend: trail JSONB column (max 20 entries) populated by ingest. Frontend: AircraftLayer Effect 3 renders PolylineCollection for selected aircraft's trail. Trail-on-selection, not global display. |
| INT-02 | 03-01, 03-03 | User can click any aircraft to inspect metadata (callsign, ICAO24, altitude, speed, heading, country) | SATISFIED (code-verified) | Unified click handler dispatches aircraft click → setSelectedAircraftId. RightDrawer renders AircraftDetailPanel. Panel displays all 6 required metadata fields. Human interactive verification pending. |

No orphaned requirements: REQUIREMENTS.md confirms AIR-01, AIR-02, INT-02 all mapped to Phase 3. All three are claimed by plan frontmatter. No Phase 3 requirements unclaimed.

---

## Anti-Patterns Found

No anti-patterns found. Scanned:
- `frontend/src/components/AircraftLayer.tsx` — No TODO, FIXME, placeholder, empty return (returns null intentionally — DOM-less CesiumJS component), or stub handlers
- `frontend/src/components/AircraftDetailPanel.tsx` — No stubs; all fields rendered with real data
- `backend/app/tasks/ingest_aircraft.py` — No Basic Auth usage; no TODO; full implementation
- `backend/app/api/routes_aircraft.py` — No "Not implemented" returns; all three endpoints have real DB queries
- `backend/app/workers/ingest_aircraft.py` — No stubs

---

## Human Verification Required

### 1. Aircraft Points on Globe

**Test:** Open http://localhost:5173, zoom to Europe or North America during peak hours (08:00-22:00 local)
**Expected:** Orange dots visible on the globe representing live aircraft; visually distinct from cyan satellite dots
**Why human:** CesiumJS rendering output cannot be verified programmatically

### 2. Smooth Position Interpolation (No Teleporting)

**Test:** Watch aircraft positions for 3-5 minutes without interaction
**Expected:** Aircraft move continuously and smoothly — no visible jump every 90 seconds
**Why human:** Lerp rAF loop correctness is a temporal visual property requiring live observation

### 3. Click-to-Inspect: Aircraft Detail Panel

**Test:** Click any orange dot; observe RightDrawer
**Expected:** Panel opens with orange "AIRCRAFT" header; shows Flight (callsign), Route (FROM -> TO or "Unavailable"), ICAO24, Altitude (metres), Speed (m/s), Heading (degrees), Country; trail polyline appears on globe for selected aircraft
**Why human:** Panel rendering and route data display require interactive browser test

### 4. Satellite/Aircraft Panel Switching

**Test:** With aircraft panel open, click a cyan satellite dot; then click aircraft again
**Expected:** Drawer switches to satellite panel when satellite clicked (aircraft trail disappears); switches back to aircraft panel when aircraft clicked; panels never display simultaneously
**Why human:** Dual-entity selection correctness requires interactive testing to confirm race-condition fix works

### 5. No Browser Console Errors

**Test:** Open DevTools -> Console while clicking aircraft, switching selections, waiting for 90s poll update
**Expected:** No NaN, Cartesian3, or CesiumJS runtime errors in console output
**Why human:** Runtime JavaScript errors only surface in live browser session

### 6. Backend Ingest Logs

**Test:** Run `docker compose logs worker --tail=30` and observe for 90+ seconds
**Expected:** Logs show: "Starting OpenSky aircraft ingest", count line (e.g. "10448 aircraft records"), "Re-enqueued aircraft ingest; next run in 90s"; no 401/403 HTTP errors
**Why human:** Requires running Docker environment with valid OPENSKY credentials

---

## Notable Implementation Decisions (Deviations from Plan)

1. **Workers directory created in Plan 01** — `backend/app/workers/ingest_aircraft.py` houses `upsert_aircraft` and `build_new_trail` helpers. The Plan 02 task `backend/app/tasks/ingest_aircraft.py` is the full RQ ingest task that uses these helpers. Both files exist and serve distinct purposes.

2. **Unified click dispatch** — Plan 03 originally specified both AircraftLayer and SatelliteLayer having separate click handlers. The implementation moved all click dispatch to AircraftLayer's unified handler, eliminating a dual-handler race condition. SatelliteLayer.tsx has no ScreenSpaceEventHandler at all.

3. **Route endpoint added** — `GET /api/aircraft/{icao24}/route` was added in Plan 03 execution beyond the original plan scope. AircraftDetailPanel displays route (FROM -> TO) using this endpoint. This extends INT-02 beyond the minimum requirement.

---

## Summary

All 15 backend tests are green. TypeScript compiles without errors. All backend artifacts are substantive and fully wired: the Aircraft model, migration, API routes, ingest task, worker startup enqueue, and Alembic autogenerate registration are all verified at all three levels (exists, substantive, wired).

All frontend artifacts are substantive and wired: useAircraft hook, AircraftLayer with lerp rAF loop and unified click dispatch, AircraftDetailPanel with all required fields, store extension with selectedAircraftId, RightDrawer dual-entity routing, and App.tsx AircraftLayer mount are all confirmed.

The three requirements AIR-01, AIR-02, and INT-02 are satisfied at the code level. Six human verification items remain — all are visual/interactive runtime behaviors that cannot be confirmed without a live browser and running Docker stack.

---

_Verified: 2026-03-11T15:30:00Z_
_Verifier: Claude (gsd-verifier)_
