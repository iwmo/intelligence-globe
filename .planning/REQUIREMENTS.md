# Requirements: OpenSignal Globe

**Defined:** 2026-03-11
**Core Value:** A unified, visually impressive intelligence picture — satellites orbiting, aircraft moving, anomalies surfacing — all rendered on one polished 3D globe that feels operational and modern.

## v2 Requirements

Requirements for the v2.0 WorldView Parity milestone.

### Visual Engine

- [ ] **VIS-01**: User can switch between visual style presets (Normal, NVG, CRT, FLIR, Noir) applied to the full globe scene
- [ ] **VIS-02**: User can adjust post-processing parameters via real-time sliders (Bloom intensity, Sharpen amount, Gain, Scanline spacing, Pixelation level)
- [ ] **VIS-03**: User sees a cinematic HUD overlay showing classification markings, MGRS coordinates, satellite ORB/PASS telemetry, GSD/ALT/SUN/EL readouts, and REC timestamp
- [ ] **VIS-04**: User can toggle Clean UI mode to hide all sidebar chrome for content creation and screenshots

### Navigation

- [ ] **NAV-01**: User can jump to a city (including Doha) via a quick-jump bar at the bottom of the globe
- [ ] **NAV-02**: User can fly to curated landmarks within a city with precise camera centering using OSM bounding box data
- [ ] **NAV-03**: User can cycle through landmarks via keyboard shortcuts (Q/W/E/R/T)

### Data Layers

- [ ] **LAY-01**: User sees military flights as distinct orange icons, toggleable separately from commercial flights, sourced from airplanes.live military endpoint
- [ ] **LAY-02**: User sees a GPS jamming heatmap as H3 hexagons derived from ADS-B NIC/NACp position accuracy fields, aggregated in PostGIS
- [ ] **LAY-03**: User sees maritime traffic (ship icons) from AIS data with click-to-inspect vessel metadata
- [ ] **LAY-04**: User sees street traffic as a particle simulation (moving dots on OSM road network), zoom-dependent density, viewport-scoped road fetch

### Replay Engine

- [ ] **REP-01**: System records position snapshots of all entities at 60s intervals in time-partitioned PostgreSQL tables
- [ ] **REP-02**: User can switch between LIVE and PLAYBACK modes via a toggle in the top bar
- [ ] **REP-03**: User can scrub through a historical timeline with configurable speed controls (1m/s, 3m/s, 5m/s, 15m/s, 1h/s)
- [ ] **REP-04**: User sees OSINT event markers on the timeline (Kinetic, Airspace Closure, Maritime, GPS Jamming, Internet Blackout, etc.)
- [ ] **REP-05**: User sees satellite overpass lines connecting overhead satellites to areas of interest during replay
- [ ] **REP-06**: User can filter displayed events and layers by category tag during replay

## v3 Requirements

Deferred to future release.

### Additional Layers

- **LAY-05**: Earthquake layer — USGS 24h GeoJSON feed, magnitude-scaled markers
- **LAY-06**: Weather radar overlay — NOAA NEXRAD WMS tiles on globe

## Out of Scope

| Feature | Reason |
|---------|--------|
| Real-time chat / collaboration | Single-user tool |
| Mobile app | Web-first; responsive web covers tablet |
| Precise jammer geolocation | OSINT inference only — labeled as such |
| Proprietary data sources | OSINT only |
| Multi-user auth | Personal homelab use |
| CZML-based replay | Wrong pattern for snapshot-driven dynamic data; drive viewer.clock directly |
| gpsjam.org API | No public API exists — NIC/NACp aggregation is the correct approach |

## Traceability

Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| VIS-01 | — | Pending |
| VIS-02 | — | Pending |
| VIS-03 | — | Pending |
| VIS-04 | — | Pending |
| NAV-01 | — | Pending |
| NAV-02 | — | Pending |
| NAV-03 | — | Pending |
| LAY-01 | — | Pending |
| LAY-02 | — | Pending |
| LAY-03 | — | Pending |
| LAY-04 | — | Pending |
| REP-01 | — | Pending |
| REP-02 | — | Pending |
| REP-03 | — | Pending |
| REP-04 | — | Pending |
| REP-05 | — | Pending |
| REP-06 | — | Pending |

**Coverage:**
- v2 requirements: 17 total
- Mapped to phases: 0
- Unmapped: 17 ⚠️

---
*Requirements defined: 2026-03-11*
*Last updated: 2026-03-11 after initial v2.0 definition*
