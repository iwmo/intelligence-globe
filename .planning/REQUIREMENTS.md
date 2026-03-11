# Requirements: OpenSignal Globe

**Defined:** 2026-03-11
**Core Value:** A unified, visually impressive intelligence picture — satellites orbiting, aircraft moving, anomalies surfacing — all rendered on one polished 3D globe that feels operational and modern.

## v1 Requirements

Requirements for initial release. Maps to roadmap phases.

### Globe Foundation

- [x] **GLOB-01**: User sees a 3D interactive globe with terrain, atmosphere, day/night shading, and star field
- [x] **GLOB-02**: Globe renders with cinematic dark theme and glowing accents (mission control aesthetic)
- [ ] **GLOB-03**: User sees a data freshness indicator showing last update time per active layer

### Satellite Tracking

- [x] **SAT-01**: User sees 5,000+ real-time satellites rendered on the globe from CelesTrak TLE/GP data
- [ ] **SAT-02**: User sees orbit path polylines and ground tracks for selected satellites
- [ ] **SAT-03**: User can search satellites by name or NORAD ID and fly to result
- [ ] **SAT-04**: User can filter satellites by constellation (Starlink, GPS, ISS, etc.) or altitude band

### Aircraft Tracking

- [ ] **AIR-01**: User sees real-time aircraft positions on the globe from OpenSky Network API
- [ ] **AIR-02**: User sees trail polylines showing each aircraft's recent movement history
- [ ] **AIR-03**: User can search aircraft by callsign or ICAO24 and fly to result
- [ ] **AIR-04**: User can filter aircraft by region (bounding box) or altitude range

### Interaction

- [x] **INT-01**: User can click any satellite to inspect metadata (NORAD ID, altitude, velocity, TLE epoch, constellation)
- [ ] **INT-02**: User can click any aircraft to inspect metadata (callsign, ICAO24, altitude, speed, heading, country)
- [ ] **INT-03**: User can toggle each data layer on/off independently (satellites, aircraft)
- [ ] **INT-04**: UI is responsive and usable on desktop and tablet viewports

### Infrastructure

- [x] **INFRA-01**: Full stack deployable via Docker Compose on homelab/VPS
- [x] **INFRA-02**: FastAPI backend with PostgreSQL + PostGIS for spatial data storage
- [ ] **INFRA-03**: Globe renders smoothly with 5,000+ satellites and hundreds of aircraft simultaneously

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### GNSS Anomaly Detection

- **ANOM-01**: User sees GNSS anomaly clusters visualized on the globe as heatmaps or polygons
- **ANOM-02**: Anomaly layer is clearly labeled as "estimated / inference" (not precise geolocation)
- **ANOM-03**: User can click anomaly cluster to see contributing data points and confidence score

### Historical Replay

- **HIST-01**: User can replay historical satellite and aircraft positions via time slider
- **HIST-02**: Backend stores position snapshots with configurable retention window

### Ships Layer

- **SHIP-01**: User sees real-time ship positions from a clean public AIS source (if viable)

### Advanced Features

- **ADV-01**: User receives configurable alerts for region events or anomaly threshold crossings
- **ADV-02**: User can export current globe view as screenshot

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Real-time chat / collaboration | Single-user tool — social features add complexity without value |
| Mobile native app | Web-first; responsive web works on tablet |
| Precise jammer geolocation | Requires sensor triangulation we don't have — honest inference only |
| Multi-user authentication | Personal homelab use — no auth barrier for self-hosted |
| Proprietary data sources | OSINT only — no licensing cost or terms of service risk |
| Real-time video feeds | Bandwidth intensive, out of scope |
| Automated target tracking | Ethical concern — user selects manually only |
| Weather layer overlay | External API dependency, not core intelligence |
| AR sky finder | Mobile feature, web-first strategy |
| Built-in social network | Security liability, scope creep |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| GLOB-01 | Phase 1 | Complete |
| GLOB-02 | Phase 1 | Complete |
| GLOB-03 | Phase 4 | Pending |
| SAT-01 | Phase 2 | Complete |
| SAT-02 | Phase 2 | Pending |
| SAT-03 | Phase 4 | Pending |
| SAT-04 | Phase 4 | Pending |
| AIR-01 | Phase 3 | Pending |
| AIR-02 | Phase 3 | Pending |
| AIR-03 | Phase 4 | Pending |
| AIR-04 | Phase 4 | Pending |
| INT-01 | Phase 2 | Complete |
| INT-02 | Phase 3 | Pending |
| INT-03 | Phase 4 | Pending |
| INT-04 | Phase 4 | Pending |
| INFRA-01 | Phase 1 | Complete |
| INFRA-02 | Phase 1 | Complete |
| INFRA-03 | Phase 5 | Pending |

**Coverage:**
- v1 requirements: 17 total
- Mapped to phases: 17
- Unmapped: 0 ✓

---
*Requirements defined: 2026-03-11*
*Last updated: 2026-03-11 after initial definition*
