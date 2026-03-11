# Roadmap: OpenSignal Globe

## Overview

Five phases deliver the full v1 intelligence platform in strict dependency order. Phase 1 lays the Docker stack and empty 3D globe. Phase 2 puts 5,000+ satellites on it using client-side orbit propagation. Phase 3 overlays live aircraft with smooth interpolation. Phase 4 wires the full control surface — search, filters, layer toggles, and cinematic polish — turning a prototype into an operational dashboard. Phase 5 validates the performance contract at full scene load. Every v1 requirement ships before Phase 5 closes.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Foundation** - Running Docker stack with an empty interactive 3D globe (completed 2026-03-11)
- [ ] **Phase 2: Satellite Layer** - 5,000+ live satellites with orbit paths and click-to-inspect
- [ ] **Phase 3: Aircraft Layer** - Real-time aircraft with smooth trails and click-to-inspect
- [ ] **Phase 4: Controls and Polish** - Search, filters, layer toggles, and cinematic UI
- [ ] **Phase 5: Performance** - Verified 60 FPS at full scene load with all layers active

## Phase Details

### Phase 1: Foundation
**Goal**: The full deployment stack is running and a polished empty globe is visible in the browser
**Depends on**: Nothing (first phase)
**Requirements**: GLOB-01, GLOB-02, INFRA-01, INFRA-02
**Success Criteria** (what must be TRUE):
  1. Running `docker compose up` from a clean checkout brings all services online without manual steps
  2. The browser shows a 3D interactive globe with terrain, atmosphere, day/night shading, and a star field
  3. The globe renders with a dark cinematic theme and glowing accents — no white or default CesiumJS chrome visible
  4. FastAPI health endpoint returns 200 and the frontend communicates with it successfully
**Plans**: 3 plans

Plans:
- [ ] 01-01-PLAN.md — Docker Compose stack + FastAPI backend + pytest scaffold
- [ ] 01-02-PLAN.md — Vite + CesiumJS frontend + cinematic globe + app shell
- [ ] 01-03-PLAN.md — Full-stack smoke test + human visual verification checkpoint

### Phase 2: Satellite Layer
**Goal**: Users can see 5,000+ real-time satellites on the globe, select one for details, and verify orbit path accuracy
**Depends on**: Phase 1
**Requirements**: SAT-01, SAT-02, INT-01
**Success Criteria** (what must be TRUE):
  1. 5,000+ satellite points are visible on the globe updating position in real time without frame rate collapse
  2. Clicking a satellite opens a metadata panel showing NORAD ID, altitude, velocity, TLE epoch, and constellation
  3. A selected satellite shows its orbit path polyline and ground track rendered on the globe
  4. A data freshness indicator for the satellite layer shows TLE age (validating TLE scheduler is running)
**Plans**: 4 plans

Plans:
- [ ] 02-01-PLAN.md — Test scaffold + Satellite model + Alembic migration + API endpoints (list, detail, freshness)
- [ ] 02-02-PLAN.md — CelesTrak ingestion task + RQ worker + docker-compose worker service
- [ ] 02-03-PLAN.md — satellite.js Web Worker + TanStack Query hook + Zustand store extension
- [ ] 02-04-PLAN.md — SatelliteLayer globe rendering + click-to-inspect + orbit path + visual verification

### Phase 3: Aircraft Layer
**Goal**: Users can see live aircraft positions with smooth movement trails and inspect any aircraft for details
**Depends on**: Phase 2
**Requirements**: AIR-01, AIR-02, INT-02
**Success Criteria** (what must be TRUE):
  1. Real-time aircraft positions appear on the globe updating from OpenSky Network with no authentication errors
  2. Each aircraft shows a trail polyline representing its recent movement history
  3. Aircraft positions move smoothly between poll intervals — no visible teleporting or jumping
  4. Clicking an aircraft opens a metadata panel showing callsign, ICAO24, altitude, speed, heading, and country
**Plans**: TBD

### Phase 4: Controls and Polish
**Goal**: Users can navigate the full dataset precisely — search for any object, filter by type or region, and toggle layers — in a fully polished cinematic interface
**Depends on**: Phase 3
**Requirements**: GLOB-03, SAT-03, SAT-04, AIR-03, AIR-04, INT-03, INT-04
**Success Criteria** (what must be TRUE):
  1. User can search by satellite name or NORAD ID and the globe flies to and highlights the result
  2. User can search by aircraft callsign or ICAO24 and the globe flies to and highlights the result
  3. User can filter satellites by constellation (Starlink, GPS, ISS, etc.) or altitude band and the scene updates
  4. User can filter aircraft by region (bounding box) or altitude range and the scene updates
  5. User can toggle each data layer on and off independently; a data freshness indicator shows last update time per active layer
  6. The UI is usable on desktop and tablet viewports with no overlapping or broken layout
**Plans**: TBD

### Phase 5: Performance
**Goal**: The platform sustains smooth operation at full production load — 5,000+ satellites and hundreds of aircraft simultaneously — meeting the performance contract required for real operational use
**Depends on**: Phase 4
**Requirements**: INFRA-03
**Success Criteria** (what must be TRUE):
  1. Frame rate holds at or near 60 FPS with the full satellite catalog and hundreds of aircraft active simultaneously
  2. Spatial queries (aircraft within bounding box, search by NORAD ID) return in under 100ms under full load
  3. All nine critical pitfall checks pass: Primitive API verified, viewer cleanup verified, ECI/ECEF coordinate validation confirmed against ISS ground track reference
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation | 3/3 | Complete   | 2026-03-11 |
| 2. Satellite Layer | 2/4 | In Progress|  |
| 3. Aircraft Layer | 0/TBD | Not started | - |
| 4. Controls and Polish | 0/TBD | Not started | - |
| 5. Performance | 0/TBD | Not started | - |
