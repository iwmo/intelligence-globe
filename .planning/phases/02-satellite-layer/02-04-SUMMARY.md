---
phase: 02-satellite-layer
plan: 04
subsystem: frontend-rendering
tags: [cesium, point-primitive-collection, web-worker, sgp4, orbit-path, ground-track, tanstack-query, zustand, right-drawer]
dependency_graph:
  requires:
    - phase: 02-02
      provides: satellite database with 14,683 OMM records via /api/satellites/ endpoint
    - phase: 02-03
      provides: propagation.worker.ts SGP4 engine, useSatellites hook, useAppStore satellite state
  provides:
    - PointPrimitiveCollection rendering 5,000+ live satellite points at 1 Hz
    - Click-to-select with orbit path (cyan polyline, ArcType.NONE) and ground track (gold line)
    - SatelliteDetailPanel with NORAD ID, name, constellation, altitude, velocity, TLE epoch
    - RightDrawer slide-in/out on satellite selection
    - BottomStatusBar TLE freshness timestamp
  affects: [03-aircraft-layer, 05-operational-ui]
tech_stack:
  added: []
  patterns:
    - PointPrimitiveCollection-fixed-index — add all points once, update only .position each frame (never removeAll + re-add)
    - viewer-prop-callback — GlobeView exposes initialized Viewer via onViewerReady prop; parent holds state
    - Material.fromType — use Material.fromType('Color', {color}) for PolylineCollection materials (not inline fabric object)
    - orbit-polyline-replace — remove previous PolylineCollection from scene.primitives before adding new one
    - esri-world-imagery — UrlTemplateImageryProvider pointing to ArcGIS World Imagery tile server; free, high-res, no ion token
key_files:
  created:
    - frontend/src/components/SatelliteLayer.tsx
    - frontend/src/components/SatelliteDetailPanel.tsx
  modified:
    - frontend/src/components/GlobeView.tsx
    - frontend/src/components/RightDrawer.tsx
    - frontend/src/components/BottomStatusBar.tsx
    - frontend/src/App.tsx
key_decisions:
  - "Material.fromType('Color', {color}) required for PolylineCollection — inline fabric object literal rejected at runtime by CesiumJS"
  - "ESRI World Imagery (UrlTemplateImageryProvider) replaces NaturalEarthII — satellite photo basemap visible through orbital point cloud improves operational readability"
  - "ArcType.NONE on all orbit/ground-track polylines — orbital paths are ECEF straight segments, not geodesic arcs"
  - "Effect 3 in SatelliteLayer: watch selectedId === null to explicitly remove orbit PolylineCollection on drawer close"
  - "picked.id > 1000 guard in click handler — rejects Cesium internal picks (terrain, globe) which may have numeric ids below satellite NORAD catalog range"
patterns_established:
  - "viewer-prop-callback: GlobeView.onViewerReady passes initialized Viewer to parent; parent holds useState<Viewer|null> and passes to child layers"
  - "SatelliteLayer renders null — all CesiumJS objects live in scene.primitives, not the DOM"
  - "Fixed-index PointPrimitive: collection built once on LOADED, indices stable, only .position mutated each POSITIONS frame"
requirements_completed:
  - SAT-01
  - SAT-02
  - INT-01
metrics:
  duration: ~60min
  completed: 2026-03-11
  tasks_completed: 3
  files_changed: 6
---

# Phase 02 Plan 04: Satellite Layer Rendering Summary

**CesiumJS PointPrimitiveCollection rendering 5,000+ live satellite points at 1 Hz via SGP4 Web Worker, with click-to-select orbit path, ground track polylines, metadata drawer, and ESRI World Imagery basemap.**

## Performance

- **Duration:** ~60 min
- **Completed:** 2026-03-11
- **Tasks:** 3 (2 auto + 1 human-verify checkpoint)
- **Files modified:** 6

## Accomplishments

- 5,000+ cyan satellite points rendered on globe as PointPrimitiveCollection, positions updated at 1 Hz from SGP4 Web Worker without flicker
- Click any satellite point — RightDrawer slides in with NORAD ID, name, constellation, altitude (km), velocity (km/s), inclination, TLE epoch fetched from /api/satellites/{id}
- Selected satellite shows cyan orbit path arc (ArcType.NONE ECEF polyline above atmosphere) and gold ground track line clamped at 10 km altitude
- BottomStatusBar displays TLE last-updated timestamp fetched from /api/satellites/freshness
- Basemap upgraded to ESRI World Imagery (high-resolution satellite photo tiles, no ion token required)
- Human visual verification: all 8 checks approved

## Task Commits

| # | Task | Commit | Type |
|---|------|--------|------|
| 1 | SatelliteLayer — points, click handler, orbit path | 331bd51 | feat |
| 2 | SatelliteDetailPanel, RightDrawer, TLE freshness | e9be974 | feat |
| 3 | Polyline Material.fromType fix + ESRI World Imagery | 0e1c2ba | fix |

## Files Created/Modified

- `frontend/src/components/SatelliteLayer.tsx` — PointPrimitiveCollection, Worker lifecycle, ScreenSpaceEventHandler, orbit/ground-track polylines
- `frontend/src/components/SatelliteDetailPanel.tsx` — TanStack Query fetch of /api/satellites/{id}, metadata display
- `frontend/src/components/GlobeView.tsx` — added onViewerReady prop; switched to ESRI World Imagery basemap
- `frontend/src/components/RightDrawer.tsx` — slide-in drawer driven by selectedSatelliteId store state
- `frontend/src/components/BottomStatusBar.tsx` — TLE freshness fetch on mount, timestamp display
- `frontend/src/App.tsx` — viewer state passed to SatelliteLayer via onViewerReady

## Decisions Made

- **Material.fromType required:** Inline `{ fabric: { type: 'Color', uniforms: {...} } }` object passed to PolylineCollection.add() caused a CesiumJS runtime error. `Material.fromType('Color', { color })` is the correct API — this was caught during visual verification.
- **ESRI World Imagery:** Switched from NaturalEarthII (low-res bundled tiles) to ESRI World Imagery tile server. Satellite photo basemap provides dramatically better visual context for an orbital tracking application. Free tier, no ion token required.
- **Effect 3 for orbit cleanup:** Added a third useEffect in SatelliteLayer watching `selectedId === null` to remove the PolylineCollection when the drawer is closed — the plan didn't specify this but it is required for the "close drawer → polylines disappear" behavior that was part of visual verification check 8.
- **picked.id > 1000 guard:** Click handler rejects numeric ids below 1000 to prevent Cesium-internal scene objects being treated as satellites.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Material.fromType API for orbit/ground-track polylines**
- **Found during:** Task 3 (human visual verification — polylines not rendering)
- **Issue:** Plan specified inline fabric object `{ fabric: { type: 'Color', uniforms: { color: ... } } }` for PolylineCollection material. CesiumJS rejected this at runtime with a material type error.
- **Fix:** Replaced with `Material.fromType('Color', { color: ... })` — the correct CesiumJS imperative API for creating materials on primitives.
- **Files modified:** `frontend/src/components/SatelliteLayer.tsx`
- **Verification:** Orbit path (cyan) and ground track (gold) both rendered correctly after fix; human visual verification check 6 confirmed.
- **Committed in:** 0e1c2ba

**2. [Rule 1 - Bug] ESRI World Imagery basemap (NaturalEarthII too low-resolution)**
- **Found during:** Task 3 (human visual verification — globe basemap appeared pixelated)
- **Issue:** NaturalEarthII bundled tiles render at very low resolution, making the globe look unpolished for an operational tracking application.
- **Fix:** Switched GlobeView to UrlTemplateImageryProvider pointing to ArcGIS World Imagery tile server. High-resolution satellite photos, free, no ion token.
- **Files modified:** `frontend/src/components/GlobeView.tsx`
- **Verification:** Globe shows high-resolution Earth imagery; human visual verification check 3 confirmed satellite point cloud visible against real-world basemap.
- **Committed in:** 0e1c2ba

**3. [Rule 2 - Missing Critical] Effect 3 — orbit polyline cleanup on deselection**
- **Found during:** Task 3 (human visual verification — polylines persisted after closing drawer)
- **Issue:** Plan defined Effects 1 and 2 but did not specify cleanup of orbit polylines when selectedId returns to null (drawer close).
- **Fix:** Added Effect 3 in SatelliteLayer that watches `selectedId === null` and removes the PolylineCollection from scene.primitives.
- **Files modified:** `frontend/src/components/SatelliteLayer.tsx`
- **Verification:** Closing the drawer removes both orbit path and ground track; human visual verification check 8 confirmed.
- **Committed in:** 0e1c2ba (included in same fix commit)

---

**Total deviations:** 3 auto-fixed (1 bug, 1 bug/UX, 1 missing critical)
**Impact on plan:** All fixes required for correct visual output and the approved human verification. No scope creep.

## Issues Encountered

None beyond the deviations documented above. All fixes resolved before human approval.

## User Setup Required

None — ESRI World Imagery is a free public tile service, no credentials required.

## Next Phase Readiness

Phase 2 (Satellite Layer) is now complete. All three plans executed:
- 02-02: CelesTrak ingest pipeline, 14,683 satellites in database
- 02-03: SGP4 propagation Web Worker, useSatellites hook, Zustand store
- 02-04: CesiumJS rendering layer, metadata panel, visual verification approved

Ready for Phase 3 (Aircraft Layer) — OpenSky OAuth2 credentials should be registered before starting (noted as a blocker in STATE.md).

## Self-Check

- [x] `frontend/src/components/SatelliteLayer.tsx` — exists
- [x] `frontend/src/components/SatelliteDetailPanel.tsx` — exists
- [x] `frontend/src/components/GlobeView.tsx` — modified with onViewerReady and ESRI imagery
- [x] `frontend/src/components/RightDrawer.tsx` — modified with slide-in drawer
- [x] `frontend/src/components/BottomStatusBar.tsx` — modified with TLE freshness
- [x] Commit 331bd51 — Task 1 (SatelliteLayer)
- [x] Commit e9be974 — Task 2 (SatelliteDetailPanel, RightDrawer, TLE bar)
- [x] Commit 0e1c2ba — Task 3 fix (Material.fromType + ESRI imagery + Effect 3)
- [x] Human visual verification: all 8 checks approved

---
*Phase: 02-satellite-layer*
*Completed: 2026-03-11*
