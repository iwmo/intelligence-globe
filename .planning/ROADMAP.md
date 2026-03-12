# Roadmap: OpenSignal Globe

## Milestones

- ✅ **v1.0 MVP** — Phases 1-6 (shipped 2026-03-11) — [Archive](.planning/milestones/v1.0-ROADMAP.md)
- 🔄 **v2.0 WorldView Parity** — Phases 7-12 (active)

## Phases

<details>
<summary>✅ v1.0 MVP (Phases 1-6) — SHIPPED 2026-03-11</summary>

- [x] Phase 1: Foundation (3/3 plans) — completed 2026-03-11
- [x] Phase 2: Satellite Layer (4/4 plans) — completed 2026-03-11
- [x] Phase 3: Aircraft Layer (3/3 plans) — completed 2026-03-11
- [x] Phase 4: Controls and Polish (3/3 plans) — completed 2026-03-11
- [x] Phase 5: Performance (3/3 plans) — completed 2026-03-11
- [x] Phase 6: Deploy Hardening (1/1 plan) — completed 2026-03-11

</details>

### v2.0 WorldView Parity (Phases 7-12)

- [x] **Phase 7: Visual Engine + Navigation** — Post-processing presets, cinematic HUD, and city/landmark navigation (completed 2026-03-12)
- [ ] **Phase 8: New Data Pipelines — Military + Maritime** — Backend workers and frontend layers for military flights and AIS ships
- [ ] **Phase 9: GPS Jamming + Street Traffic** — NIC/NACp aggregation heatmap and OSM particle simulation
- [ ] **Phase 10: Snapshot Infrastructure** — Time-partitioned position recording for all live layers
- [ ] **Phase 11: Replay Engine** — LIVE/PLAYBACK toggle, timeline scrubber, speed controls, and event markers
- [ ] **Phase 12: OSINT Event Correlation** — Satellite overpass lines, event entry, and category tag filtering

## Phase Details

### Phase 7: Visual Engine + Navigation
**Goal**: Users experience a cinematic, tactically-styled globe with switchable visual modes and can navigate to any city or landmark instantly
**Depends on**: Phase 6 (v1.0 complete)
**Requirements**: VIS-01, VIS-02, VIS-03, VIS-04, NAV-01, NAV-02, NAV-03
**Success Criteria** (what must be TRUE):
  1. User can click a preset button (Normal, NVG, CRT, FLIR, Noir) and the full globe scene instantly changes visual character — no page reload, no visible frame drop, preset survives layer toggle actions
  2. User can move Bloom, Sharpen, Gain, Scanlines, and Pixelation sliders and see the globe update in real time without switching presets
  3. User sees a persistent cinematic HUD displaying a classification banner, live MGRS coordinates that update as the camera moves, satellite telemetry readout, and a REC timestamp
  4. User can toggle Clean UI mode to hide all sidebar chrome, leaving only the globe and HUD visible for screenshots
  5. User can type a city name in the bottom quick-jump bar or press Q/W/E/R/T to fly the camera to a curated landmark with precise centering
**Plans**: 5 plans

Plans:
- [ ] 07-01-PLAN.md — Extend Zustand store with visual/nav slices and create Wave 0 test stubs
- [ ] 07-02-PLAN.md — PostProcessEngine singleton (5 GLSL presets) and PostProcessPanel UI
- [ ] 07-03-PLAN.md — CinematicHUD overlay with MGRS readout and Clean UI toggle
- [ ] 07-04-PLAN.md — Navigation data, viewerRegistry flyToLandmark, keyboard shortcuts, LandmarkNav
- [ ] 07-05-PLAN.md — App.tsx wiring and human verification of all 7 requirements

### Phase 8: New Data Pipelines — Military + Maritime
**Goal**: Users see military aircraft as distinct amber icons and ships as cyan icons, both toggleable independently, with click-to-inspect metadata
**Depends on**: Phase 7
**Requirements**: LAY-01, LAY-03
**Success Criteria** (what must be TRUE):
  1. User can enable a Military Flights toggle and see amber icons appear for military aircraft, visually distinct from commercial aircraft, refreshing from airplanes.live at a 300-second cadence
  2. User can click any military aircraft icon and see a metadata panel (callsign, ICAO24, type, altitude, speed, heading)
  3. User can enable a Maritime Traffic toggle and see ship icons populate from AIS data, with the layer recovering gracefully from backend WebSocket reconnections without freezing the globe
  4. User can click any ship icon and see a metadata panel (MMSI, vessel name, type, speed, heading, last update time)
**Plans**: 5 plans

Plans:
- [ ] 08-01-PLAN.md — Wave 0 test scaffolds: 4 backend + 2 frontend smoke tests (RED phase)
- [ ] 08-02-PLAN.md — Military aircraft backend: MilitaryAircraft model, Alembic migration, RQ ingest worker, /api/military/ routes
- [ ] 08-03-PLAN.md — Maritime ships backend: Ship model, Alembic migration, AIS async WebSocket worker, /api/ships/ routes, Docker Compose ais-worker service
- [ ] 08-04-PLAN.md — Frontend layer components: store extension, hooks, MilitaryAircraftLayer, ShipLayer, detail panels, click routing
- [ ] 08-05-PLAN.md — App.tsx wiring, LeftSidebar MIL/SHIP toggles, and human verification of all 4 requirements

### Phase 9: GPS Jamming + Street Traffic
**Goal**: Users see a GPS degradation heatmap derived from live ADS-B signal quality fields, and can view street-level traffic particle flow when zoomed into a city
**Depends on**: Phase 8
**Requirements**: LAY-02, LAY-04
**Success Criteria** (what must be TRUE):
  1. User enables the GPS Jamming layer and sees H3 hexagon cells color-coded by severity (green/yellow/red), each labeled "GPS degradation anomaly — inferred from aircraft telemetry, not geolocated"
  2. The jamming heatmap updates daily from NIC/NACp aggregation of ADS-B data and renders as ground polygons without degrading framerate
  3. User zooms below 500 km altitude over an urban area and sees animated dot particles flowing along OSM road network geometry, with density scaling to zoom level
  4. Particle simulation is viewport-scoped — particles only load for the visible area and do not appear when zoomed out to global view
**Plans**: TBD

### Phase 10: Snapshot Infrastructure
**Goal**: The system silently records position snapshots of all live entities at 60-second intervals into partitioned storage, creating the historical record that replay depends on
**Depends on**: Phase 8 (military and ships must be live before their snapshots are recorded)
**Requirements**: REP-01
**Success Criteria** (what must be TRUE):
  1. A running RQ task inserts position batches for aircraft, military flights, and ships into time-partitioned PostgreSQL tables every 60 seconds without blocking the live API
  2. Daily partitions are created automatically; partitions older than 7 days are dropped automatically without manual intervention
  3. A read-only replay API endpoint returns snapshot records for a given time range and layer type, returning correctly even when queried mid-recording
**Plans**: TBD

### Phase 11: Replay Engine
**Goal**: Users can switch out of live mode, scrub backward through time, and watch historical entity positions play back on the globe at configurable speeds with OSINT event markers on the timeline
**Depends on**: Phase 10 (minimum 24 hours of accumulated snapshot data required for meaningful playback)
**Requirements**: REP-02, REP-03, REP-04
**Success Criteria** (what must be TRUE):
  1. User clicks a PLAYBACK toggle in the top bar and the globe freezes live updates, entering historical playback mode; clicking LIVE restores live state
  2. User sees a custom timeline scrubber showing the available history window and can drag to any point, with the globe smoothly interpolating entity positions between 60-second snapshots
  3. User can select a playback speed (1m/s, 3m/s, 5m/s, 15m/s, 1h/s) and see entity motion scale accordingly — positions remain geographically plausible at all speeds
  4. User sees colored event markers on the timeline (Kinetic, Airspace Closure, Maritime, GPS Jamming, Internet Blackout) and can click a marker to jump the scrubber to that moment
**Plans**: TBD

### Phase 12: OSINT Event Correlation
**Goal**: Users can log OSINT events, filter the timeline and layers by category, and see which satellites were overhead during any event — turning the replay into a structured intelligence analysis tool
**Depends on**: Phase 11 (replay engine must be complete; satellite data in DB from v1.0)
**Requirements**: REP-05, REP-06
**Success Criteria** (what must be TRUE):
  1. User sees arc lines drawn from overhead satellites to an active area of interest during replay, based on real SGP4 overpass computation for the replayed timestamp
  2. User can open an OSINT event panel, enter an event (location, timestamp, category tag, source URL), and see it appear as a marker on the timeline
  3. User can select one or more category tag chips (KINETIC, AIRSPACE, MARITIME, SEISMIC, JAMMING) and the timeline markers and globe layers filter to show only matching events
  4. Overpass lines are suppressed for satellites with TLE age older than 7 days, and a visible warning is shown rather than silently showing inaccurate data
**Plans**: TBD

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Foundation | v1.0 | 3/3 | Complete | 2026-03-11 |
| 2. Satellite Layer | v1.0 | 4/4 | Complete | 2026-03-11 |
| 3. Aircraft Layer | v1.0 | 3/3 | Complete | 2026-03-11 |
| 4. Controls and Polish | v1.0 | 3/3 | Complete | 2026-03-11 |
| 5. Performance | v1.0 | 3/3 | Complete | 2026-03-11 |
| 6. Deploy Hardening | v1.0 | 1/1 | Complete | 2026-03-11 |
| 7. Visual Engine + Navigation | v2.0 | 5/5 | Complete | 2026-03-12 |
| 8. New Data Pipelines — Military + Maritime | v2.0 | 0/5 | Not started | — |
| 9. GPS Jamming + Street Traffic | v2.0 | 0/? | Not started | — |
| 10. Snapshot Infrastructure | v2.0 | 0/? | Not started | — |
| 11. Replay Engine | v2.0 | 0/? | Not started | — |
| 12. OSINT Event Correlation | v2.0 | 0/? | Not started | — |
