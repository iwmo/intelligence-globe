---
phase: 09-gps-jamming-street-traffic
plan: "03"
subsystem: frontend
tags: [cesium, street-traffic, overpass, particles, animation, raf, zustand, typescript]

# Dependency graph
requires:
  - phase: 09-02
    provides: streetTraffic layer key in Zustand store (default false)
  - phase: 09-01
    provides: StreetTrafficLayer.test.tsx RED smoke test

provides:
  - frontend/src/hooks/useStreetTraffic.ts — Hook managing Overpass road fetch, viewport-scoped, altitude-gated at 100 km
  - frontend/src/components/StreetTrafficLayer.tsx — CesiumJS PointPrimitiveCollection particle layer animated via rAF

affects:
  - 09-05 (LayerControlPanel toggle for streetTraffic — component now exists to toggle)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Altitude-gated visibility (500 km) + fetch gate (100 km) via camera.moveEnd subscription
    - Inline Overpass JSON parser (no osmtogeojson import — deferred to Plan 05)
    - Lazy CesiumJS Color initialization to avoid module-load call breaking test mocks
    - rAF animation loop with layerVisibleRef + roadsRef to access latest state without re-subscribing
    - 2-second debounce on Overpass fetch using ref-stored timestamp

key-files:
  created:
    - frontend/src/hooks/useStreetTraffic.ts
    - frontend/src/components/StreetTrafficLayer.tsx
  modified: []

key-decisions:
  - "Lazy Color.fromCssColorString initialization: module-level Color call crashes test mocks — computed on first particle creation instead"
  - "Inline Overpass JSON parser instead of osmtogeojson import — library not yet installed (Plan 05 runs npm install)"
  - "roadsRef + layerVisibleRef pattern in rAF loop avoids stale closure on road data updates without restarting the loop"
  - "validRoads filter (coordinates.length >= 2) prevents getPosition crash on single-node ways returned by Overpass"

patterns-established:
  - "Pattern: Lazy CesiumJS object initialization for module-scope constants that break test mocks"
  - "Pattern: useRef mirror of state/props for rAF loop access without closure staleness"

requirements-completed:
  - LAY-04

# Metrics
duration: ~2min
completed: 2026-03-12
---

# Phase 09 Plan 03: Street Traffic Frontend Summary

**useStreetTraffic hook + StreetTrafficLayer component: viewport-scoped Overpass road fetch altitude-gated at 100 km, with up to 500 sky-blue particles animated via requestAnimationFrame along road segment coordinates**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-03-12T09:59:42Z
- **Completed:** 2026-03-12T10:02:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Created `useStreetTraffic.ts` hook: manages Overpass road geometry state via useState+useEffect, subscribes to camera.moveEnd, fetches road segments below 100 km altitude, uses inline Overpass JSON parser (no osmtogeojson), 2s debounce on fetch
- Created `StreetTrafficLayer.tsx` component: PointPrimitiveCollection with up to 500 sky-blue particles, altitude gate at 500 km, rAF animation loop advancing particles along road segment coordinates via linear interpolation
- StreetTrafficLayer.test.tsx smoke test GREEN (was RED before this plan)
- TypeScript compiles with 0 errors across entire frontend

## Task Commits

Each task was committed atomically:

1. **Task 1: useStreetTraffic hook** - `7277c42` (feat)
2. **Task 2: StreetTrafficLayer component** - `cbe53ba` (feat)

## Files Created/Modified

- `frontend/src/hooks/useStreetTraffic.ts` — RoadSegment + StreetTrafficState types; hook that subscribes to camera.moveEnd, altitude-gates at 100 km/500 km, POSTs to Overpass API, parses response inline
- `frontend/src/components/StreetTrafficLayer.tsx` — PointPrimitiveCollection particle layer; lazy Color init; rAF loop with ref-mirrored state; camera.moveEnd visibility gate at 500 km; layerVisible toggle via store

## Decisions Made

- `Color.fromCssColorString('#38BDF8')` computed lazily (on first particle creation) rather than at module scope — calling CesiumJS at module load crashes vitest mocks, which don't provide `fromCssColorString` on the `Color` mock
- Inline Overpass JSON parser: `data.elements` filtered by `type === 'way' && geometry exists`, each way's geometry array `{lat, lon}[]` converted to `[lon, lat][]` — avoids osmtogeojson import before Plan 05's npm install
- `roadsRef` + `layerVisibleRef` pattern in rAF loop: allows the animation loop to see latest roads/visibility without restarting the loop on every render, preventing particle recreation churn
- `validRoads.filter(r => r.coordinates.length >= 2)` guard prevents `getPosition` from crashing on single-node Overpass ways

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Lazy Color initialization to fix test mock crash**
- **Found during:** Task 2 smoke test run
- **Issue:** `Color.fromCssColorString('#38BDF8')` at module scope executed before vitest mocks took effect, causing `TypeError: Color.fromCssColorString is not a function`
- **Fix:** Replaced module-scope `PARTICLE_COLOR` constant with `getParticleColor()` lazy getter that computes the color on first call inside an effect
- **Files modified:** `frontend/src/components/StreetTrafficLayer.tsx`
- **Commit:** `cbe53ba` (included in Task 2 commit)

## Issues Encountered

- Pre-existing failure: `GpsJammingLayer.test.tsx` fails because `GpsJammingLayer.tsx` does not exist yet (belongs to a sibling plan — likely 09-04 or renamed plan). Confirmed pre-existing via `git stash` verification. Not caused by this plan.

## User Setup Required

None — no external service configuration required. Overpass API is a public endpoint with no auth.

## Next Phase Readiness

- `useStreetTraffic.ts` and `StreetTrafficLayer.tsx` are complete and ready for App.tsx wiring in Plan 05
- Plan 05 must run `npm install osmtogeojson` before the hook can use it (currently uses inline parser; swap is straightforward)
- GpsJammingLayer RED test from Plan 01 remains pending — belongs to Plan 09-04

---
*Phase: 09-gps-jamming-street-traffic*
*Completed: 2026-03-12*
