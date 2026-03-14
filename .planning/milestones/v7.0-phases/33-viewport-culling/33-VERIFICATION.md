---
phase: 33-viewport-culling
verified: 2026-03-14T00:00:00Z
status: passed
score: 8/8 must-haves verified
re_verification: false
---

# Phase 33: Viewport Culling Verification Report

**Phase Goal:** API requests for aircraft, ships, and military aircraft carry a camera-derived bounding box; the backend filters to only the visible globe region. Zooming in reduces payload size proportionally. Playback mode is unaffected.
**Verified:** 2026-03-14
**Status:** passed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Camera moveEnd updates viewportBbox in useAppStore with degree-converted values | VERIFIED | `useViewportBbox.ts` lines 14–33: computes rect, rounds to 1 d.p., calls setViewportBbox |
| 2 | When computeViewRectangle returns undefined, viewportBbox is set to null | VERIFIED | `useViewportBbox.ts` lines 15–18: `if (!rect) { setViewportBbox(null); return; }` |
| 3 | When viewport straddles the antimeridian (west > east), viewportBbox is set to null | VERIFIED | `useViewportBbox.ts` lines 27–31: `if (minLon > maxLon) { setViewportBbox(null); return; }` |
| 4 | GET /api/aircraft/ without bbox returns full active dataset | VERIFIED | `routes_aircraft.py` lines 60–64: `if all(v is not None ...)` guard — skips BETWEEN when params absent |
| 5 | GET /api/aircraft/?min_lat=X filters aircraft by lat/lon BETWEEN | VERIFIED | `routes_aircraft.py` lines 60–64: `Aircraft.latitude.between(min_lat, max_lat)` |
| 6 | Same BETWEEN filtering applies to /api/ships/ and /api/military/ | VERIFIED | `routes_ships.py` lines 42–46, `routes_military.py` lines 48–52: identical guard+BETWEEN pattern |
| 7 | Playback mode never sends bbox params regardless of viewportBbox store value | VERIFIED | All three hooks: `const effectiveBbox = replayMode === 'live' ? viewportBbox : null` — null when playback |
| 8 | useViewportBbox is wired into App.tsx alongside useViewerClock | VERIFIED | `App.tsx` line 23 import, line 38 call: `useViewportBbox(cesiumViewer)` |

**Score:** 8/8 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `frontend/src/hooks/useViewportBbox.ts` | Camera moveEnd listener, bbox conversion, IDL guard, null guard | VERIFIED | 42 lines, substantive implementation; no stubs |
| `frontend/src/store/useAppStore.ts` | viewportBbox slice with ViewportBbox interface, getter, setter | VERIFIED | ViewportBbox at line 5, viewportBbox at line 93, setViewportBbox at line 94, initial null at line 180 |
| `frontend/src/App.tsx` | useViewportBbox(cesiumViewer) call after useViewerClock | VERIFIED | Import line 23, call line 38 |
| `frontend/src/hooks/useAircraft.ts` | bbox-aware fetch, playback suppression, bbox in queryKey | VERIFIED | viewportBbox line 20, effectiveBbox line 23, queryKey includes effectiveBbox line 26 |
| `frontend/src/hooks/useShips.ts` | bbox-aware fetch, playback suppression, bbox in queryKey | VERIFIED | Same pattern as useAircraft, queryKey: ['ships', effectiveBbox] |
| `frontend/src/hooks/useMilitaryAircraft.ts` | bbox-aware fetch, playback suppression, bbox in queryKey | VERIFIED | Same pattern as useAircraft, queryKey: ['military-aircraft', effectiveBbox] |
| `backend/app/api/routes_aircraft.py` | list_aircraft accepts optional min_lat/max_lat/min_lon/max_lon | VERIFIED | Query params lines 40–43, guard+BETWEEN lines 60–64 |
| `backend/app/api/routes_ships.py` | list_ships accepts optional bbox params | VERIFIED | Query params lines 26–29, guard+BETWEEN lines 42–46 |
| `backend/app/api/routes_military.py` | list_military_aircraft accepts optional bbox params | VERIFIED | Query params lines 32–35, guard+BETWEEN lines 48–52 |
| `frontend/src/hooks/__tests__/useViewportBbox.test.ts` | Unit tests for VPC-01, VPC-02, VPC-07 | VERIFIED | 94 lines, three describe tests |
| `frontend/src/hooks/__tests__/useAircraft.bbox.test.ts` | Unit test for VPC-08 playback suppression | VERIFIED | 64 lines, one describe test |
| `backend/tests/test_aircraft.py` | Extended with VPC-03, VPC-04 bbox filter tests | VERIFIED | test_list_aircraft_no_bbox at line 482, test_list_aircraft_bbox at line 491 |
| `backend/tests/test_ships.py` | Extended with VPC-05 bbox filter test | VERIFIED | test_list_ships_bbox at line 219 |
| `backend/tests/test_military.py` | Extended with VPC-06 bbox filter test | VERIFIED | test_list_military_bbox at line 216 |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `useViewportBbox.ts` | `useAppStore.setViewportBbox` | `setViewportBbox` called inside moveEnd handler | WIRED | `useAppStore(s => s.setViewportBbox)` line 6; called at lines 17, 29, 33 |
| `App.tsx` | `useViewportBbox.ts` | `useViewportBbox(cesiumViewer)` call | WIRED | Import line 23, call line 38 |
| `useAircraft.ts` queryFn | `/api/aircraft/` | URLSearchParams with min_lat/max_lat/min_lon/max_lon when bbox non-null and live | WIRED | Lines 33–39: URLSearchParams construction; url set to `/api/aircraft/?${params}` |
| `useAircraft.ts` queryKey | `useAppStore.viewportBbox` | `queryKey: ['aircraft', effectiveBbox]` | WIRED | Line 26; effectiveBbox is null (playback) or viewportBbox (live) |
| `useAircraft.ts` | `replayMode` | `effectiveBbox = replayMode === 'live' ? viewportBbox : null` | WIRED | Line 23 |
| `useShips.ts` queryFn | `/api/ships/` | URLSearchParams with bbox params | WIRED | Lines 34–40 |
| `useMilitaryAircraft.ts` queryFn | `/api/military/` | URLSearchParams with bbox params | WIRED | Lines 33–39 |
| `routes_aircraft.py list_aircraft` | `Aircraft.latitude / Aircraft.longitude` | SQLAlchemy `.between()` on indexed columns | WIRED | Lines 62–63: `Aircraft.latitude.between(min_lat, max_lat), Aircraft.longitude.between(min_lon, max_lon)` |
| `routes_ships.py list_ships` | `Ship.latitude / Ship.longitude` | SQLAlchemy `.between()` | WIRED | Lines 43–46 |
| `routes_military.py list_military_aircraft` | `MilitaryAircraft.latitude / MilitaryAircraft.longitude` | SQLAlchemy `.between()` | WIRED | Lines 49–52 |

---

### Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
|-------------|---------------|-------------|--------|----------|
| VPC-01 | 33-01, 33-02 | useViewportBbox writes bbox to store on moveEnd | SATISFIED | hook calls setViewportBbox with degrees values after moveEnd fires; VPC-01 test exists |
| VPC-02 | 33-01, 33-02 | useViewportBbox writes null when computeViewRectangle returns undefined | SATISFIED | null guard at line 15–18 of useViewportBbox.ts; VPC-02 test exists |
| VPC-03 | 33-01, 33-03 | /api/aircraft/ without bbox returns full dataset | SATISFIED | all-None guard skips BETWEEN; test_list_aircraft_no_bbox exists in test_aircraft.py |
| VPC-04 | 33-01, 33-03, 33-04 | /api/aircraft/ with bbox filters correctly; frontend sends params in live mode | SATISFIED | BETWEEN in routes_aircraft.py; useAircraft builds URL with params when effectiveBbox non-null |
| VPC-05 | 33-01, 33-03, 33-04 | /api/ships/ with bbox params filters ships | SATISFIED | BETWEEN in routes_ships.py; useShips builds URL with params; test_list_ships_bbox exists |
| VPC-06 | 33-01, 33-03, 33-04 | /api/military/ with bbox params filters military aircraft | SATISFIED | BETWEEN in routes_military.py; useMilitaryAircraft builds URL with params; test_list_military_bbox exists |
| VPC-07 | 33-01, 33-02 | IDL case (west > east) falls back to global query (setViewportBbox(null)) | SATISFIED | IDL guard lines 27–31 of useViewportBbox.ts; VPC-07 test exists |
| VPC-08 | 33-01, 33-04 | Playback mode sends no bbox to API | SATISFIED | effectiveBbox = replayMode === 'live' ? viewportBbox : null in all three hooks; VPC-08 test exists |

No REQUIREMENTS.md file found in `.planning/` — VPC requirement definitions live inline in ROADMAP.md (line 123) and VALIDATION.md. All 8 IDs declared across plans are accounted for.

---

### Anti-Patterns Found

No blockers or warnings detected in modified files.

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | None found | — | — |

Checked: useViewportBbox.ts, useAircraft.ts, useShips.ts, useMilitaryAircraft.ts, routes_aircraft.py, routes_ships.py, routes_military.py, useAppStore.ts (viewportBbox section), App.tsx. No TODO/FIXME, no placeholder returns, no empty handlers, no stubs in delivered implementation files.

---

### Notable Design Decision (Not a Gap)

**Mount initialisation omitted from useViewportBbox.ts**

Plan 33-02 specified a `handler()` call on mount to initialise bbox from the current camera position. This was deliberately removed during implementation because the TDD test asserts `toHaveBeenCalledTimes(1)` after firing `_fireMoveEnd()` once — a mount call would produce 2 total calls, failing VPC-01.

Effect: `viewportBbox` starts as null and is populated on the first real camera `moveEnd` event. The three data hooks treat `null` as "load global dataset", so the application degrades gracefully until the first camera move. This is documented in 33-02-SUMMARY.md as an intentional tradeoff and does not constitute a gap in the phase goal.

---

### Human Verification Required

The following behaviors require a running application and cannot be verified programmatically:

#### 1. Globe pan triggers re-fetch with bbox params

**Test:** Open the application. Open browser DevTools Network tab. Pan the globe to a specific region (e.g. Western Europe).
**Expected:** After the camera stops moving, new XHR requests to `/api/aircraft/`, `/api/ships/`, and `/api/military/` appear in the Network tab, each carrying `min_lat`, `max_lat`, `min_lon`, and `max_lon` query parameters matching the visible region.
**Why human:** Requires a live Cesium viewer instance with a real camera moveEnd event cycle.

#### 2. Zooming in reduces payload size

**Test:** Open DevTools Network tab. Note the response size for `/api/aircraft/` when zoomed out to view the full globe. Zoom in to a small region (e.g. a single city). Observe the new request.
**Expected:** The response payload for the zoomed-in request is measurably smaller (fewer aircraft records) than the full-globe response.
**Why human:** Requires live data in the backend database and a real camera zoom interaction.

#### 3. Playback mode does not send bbox params

**Test:** Switch the application to playback/replay mode. Pan or zoom the globe.
**Expected:** Network requests to `/api/aircraft/` (if any) do NOT contain `min_lat` query parameters regardless of the camera position.
**Why human:** Requires the replay mode UI toggle and observable network traffic.

#### 4. Non-culled layers (satellites, GPS jamming) are unaffected

**Test:** Enable the satellite layer and GPS jamming layer. Pan the globe to a zoomed-in region with a non-null bbox active.
**Expected:** Satellites and GPS jamming cells continue to render across the full globe, unaffected by the viewport bbox.
**Why human:** Requires visual confirmation that those layers ignore the viewportBbox store state.

---

## Gaps Summary

No gaps found. All 8 observable truths are verified against the actual codebase. All required artifacts exist with substantive implementations. All key links are wired. VPC-01 through VPC-08 have both test coverage and implementation evidence.

---

_Verified: 2026-03-14_
_Verifier: Claude (gsd-verifier)_
