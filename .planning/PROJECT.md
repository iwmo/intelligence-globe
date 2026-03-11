# OpenSignal Globe

## What This Is

A browser-based 3D geospatial intelligence platform that visualizes satellites, aircraft, ships, GPS jamming, earthquakes, and OSINT events on an interactive globe using only open-source tools and public data sources. Built for homelab/VPS deployment with Docker, featuring a cinematic dark-themed UI with switchable visual style presets (NVG, CRT, FLIR) and full historical event replay. v2.0 delivers full WorldView-class situational awareness: multi-layer OSINT fusion, visual style engine, and 4D timeline playback.

## Current Milestone: v2.0 WorldView Parity

**Goal:** Elevate Intelligence Globe from a live-tracking tool to a full OSINT situational awareness platform — matching and exceeding WorldView with visual style presets, new data layers (military flights, GPS jamming, ships, earthquakes, weather), and a 4D timeline replay engine.

**Target features:**
- Visual style presets: NVG (night vision), CRT (scanlines), FLIR (thermal), Noir, Normal
- Post-processing controls: Bloom, Sharpen, Gain, Scanlines, Pixelation sliders
- Cinematic HUD overlay: fake classification markings, MGRS/lat-lon readout, satellite telemetry
- Military flights layer (ADSB Exchange)
- GPS Jamming heatmap (gpsjam.org / ADSB-derived)
- Maritime traffic layer (AIS)
- Earthquake layer (USGS 24h GeoJSON)
- Weather radar overlay (NOAA NEXRAD)
- Street traffic particle simulation (OpenStreetMap road network)
- Landmark / city preset navigation with keyboard shortcuts
- 4D historical replay: timeline scrubber, speed controls, event markers
- OSINT event correlation: satellite overpass lines, event filter tags

## Core Value

A unified, visually impressive intelligence picture — satellites orbiting, aircraft moving, anomalies surfacing — all rendered on one polished 3D globe that feels operational and modern.

## Requirements

### Validated

- ✓ 3D CesiumJS globe with terrain, atmosphere, day/night shading, stars — v1.0
- ✓ Satellite tracking with orbit paths and ground tracks from CelesTrak TLEs — v1.0
- ✓ Aircraft tracking with trails from OpenSky Network API — v1.0
- ✓ Layer toggles for each data type — v1.0
- ✓ Click-to-inspect metadata panels (satellites and aircraft) — v1.0
- ✓ Search by satellite name, NORAD ID, callsign, ICAO24 — v1.0
- ✓ Region/altitude/constellation filtering — v1.0
- ✓ Dark cinematic theme with glowing accents — v1.0
- ✓ Docker Compose deployment stack (automated migrations) — v1.0
- ✓ FastAPI backend with PostgreSQL + PostGIS — v1.0
- ✓ 60 FPS at full scene load (5,000+ satellites + aircraft) — v1.0

### Active

- [ ] Visual style presets: NVG, CRT, FLIR, Noir (VIS-01 to 04)
- [ ] Post-processing controls: Bloom, Sharpen, Gain, Scanlines, Pixelation (VIS-05)
- [ ] Cinematic HUD overlay with classification markings and telemetry (VIS-06)
- [ ] Military flights layer via ADSB Exchange (LAY-01)
- [ ] GPS Jamming heatmap via gpsjam.org (LAY-02)
- [ ] Maritime traffic via AIS (LAY-03)
- [ ] Earthquake layer via USGS 24h feed (LAY-04)
- [ ] Weather radar overlay via NOAA NEXRAD (LAY-05)
- [ ] Street traffic particle simulation via OSM (LAY-06)
- [ ] Landmark/city preset navigation with keyboard shortcuts (NAV-01)
- [ ] 4D historical replay with timeline scrubber and speed controls (REP-01 to 04)
- [ ] OSINT event correlation: satellite overpass lines, event filter tags (REP-05, 06)

### Out of Scope

- Real-time chat or collaboration — single-user tool
- Mobile app — web-first; responsive web works on tablet
- Precise jammer geolocation — honest anomaly inference only
- Proprietary data sources — OSINT only
- Multi-user auth — personal homelab use
- Real-time video feeds — bandwidth intensive
- Automated target tracking — user selects manually only

## Context

**Shipped v1.0:** 2026-03-11
**Stack:** CesiumJS + React + TypeScript + Vite (frontend), FastAPI + PostgreSQL + PostGIS + Redis + RQ (backend), Docker Compose
**Codebase:** ~4,400 LOC TypeScript/Python across 17 plans

**v1.0 learnings:**
- CesiumJS Primitive API (not Entity API) is mandatory at 5,000+ objects — Entity API collapses
- satellite.js Web Worker with transferable Float64Array (zero-copy IPC) is the correct pattern for real-time orbit propagation
- OpenSky deprecated Basic Auth March 2026 — OAuth2 client_credentials is the only path
- Self-re-enqueue over RQ Repeat — Repeat API is version-unstable
- BlendOption.OPAQUE on PointPrimitiveCollection is a significant GPU fill-cost win at scale

## Constraints

- **Data**: OSINT only — no proprietary or classified sources
- **Deployment**: Must run on homelab/VPS with Docker
- **Honesty**: Anomaly layers must be labeled as inference, not precise geolocation
- **Performance**: UI must handle 5,000+ satellites and thousands of aircraft
- **Stack**: CesiumJS, React, TypeScript, FastAPI, PostgreSQL, PostGIS, Redis

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| CesiumJS over alternatives | Industry standard for 3D globe, excellent satellite/aircraft support | ✓ Good — smooth at scale |
| Frontend orbit propagation (satellite.js Web Worker) | Main-thread propagation causes UI jank at scale | ✓ Good — transferable Float64Array zero-copy IPC |
| PostgreSQL + PostGIS | Spatial queries, time-series data, mature ecosystem | ✓ Good — partial B-tree index effective |
| Docker Compose | Easy homelab deployment, reproducible | ✓ Good — automated with Alembic entrypoint |
| Anomaly Engine in v2 | Foundation (satellites + aircraft) first | ✓ Good — clean separation |
| Time Replay in v2 | Need snapshot infrastructure first | ✓ Good — deferred correctly |
| CelesTrak OMM/JSON (not legacy TLE text) | Avoids July 2026 5-digit catalog cutover | ✓ Good — json2satrec works |
| OpenSky OAuth2 (not Basic Auth) | Basic Auth deprecated March 18, 2026 | ✓ Good — correct choice |
| RQ over Celery | Simpler, sufficient for self-hosted use | ✓ Good — self-re-enqueue reliable |
| Primitive API (not Entity API) | Entity API collapses at 5,000+ objects | ✓ Good — critical decision |

---
*Last updated: 2026-03-11 after v2.0 milestone start*
