# OpenSignal Globe

## What This Is

A browser-based 3D geospatial intelligence platform that visualizes satellites, aircraft, and GNSS anomalies on an interactive globe using only open-source tools and public OSINT data sources. Built for homelab/VPS deployment with Docker, featuring a cinematic dark-themed UI inspired by aerospace mission control.

## Core Value

A unified, visually impressive intelligence picture — satellites orbiting, aircraft moving, anomalies surfacing — all rendered on one polished 3D globe that feels operational and modern.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] 3D CesiumJS globe with terrain, atmosphere, day/night shading, stars
- [ ] Satellite tracking with orbit paths and ground tracks from CelesTrak TLEs
- [ ] Aircraft tracking with trails from OpenSky Network API
- [ ] Layer toggles for each data type
- [ ] Click-to-inspect metadata panels
- [ ] Search by satellite name, NORAD ID, callsign, ICAO24
- [ ] Region/altitude/constellation filtering
- [ ] Dark cinematic theme with glowing accents
- [ ] Docker Compose deployment stack
- [ ] FastAPI backend with PostgreSQL + PostGIS
- [ ] Ships layer (if clean public source available)

### Out of Scope

- Real-time chat or collaboration — single-user tool
- Mobile app — web-first
- Precise jammer geolocation — only honest anomaly inference
- Proprietary data sources — OSINT only
- Multi-user auth — personal use

## Context

**Technical environment:**
- CesiumJS for 3D globe rendering
- React + TypeScript + Vite frontend
- FastAPI + PostgreSQL + PostGIS + Redis backend
- Docker Compose for deployment
- satellite.js for orbit propagation in browser

**Data sources:**
- CelesTrak for satellite TLE/GP data
- OpenSky Network for aircraft state vectors
- Optional: public AIS sources for ships
- Optional: user-owned SDR sensors for RF events

**Reference spec:**
Full technical spec exists in `INTELLIGENCE GLOBE.md` with detailed API design, data models, UI/UX guidelines, and implementation notes.

## Constraints

- **Data**: OSINT only — no proprietary or classified sources
- **Deployment**: Must run on homelab/VPS with Docker
- **Honesty**: Anomaly layers must be labeled as inference, not precise geolocation
- **Performance**: UI must handle 5,000+ satellites and thousands of aircraft
- **Stack**: CesiumJS, React, TypeScript, FastAPI, PostgreSQL, PostGIS, Redis

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| CesiumJS over alternatives | Industry standard for 3D globe, excellent satellite/aircraft support | — Pending |
| Frontend orbit propagation | satellite.js in browser for smooth real-time motion | — Pending |
| PostgreSQL + PostGIS | Spatial queries, time-series data, mature ecosystem | — Pending |
| Docker Compose | Easy homelab deployment, reproducible | — Pending |
| Anomaly Engine in v2 | Foundation (satellites + aircraft) first | — Pending |
| Time Replay in v2 | Need snapshot infrastructure first | — Pending |

---
*Last updated: 2026-03-11 after initialization*
