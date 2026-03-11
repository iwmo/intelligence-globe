# Milestones

## v1.0 MVP (Shipped: 2026-03-11)

**Phases completed:** 6 phases, 17 plans
**Lines of code:** ~4,400 TypeScript/Python

**Key accomplishments:**
- Full Docker Compose stack (PostgreSQL+PostGIS, Redis, FastAPI, Vite+React) deployable from clean checkout with automated Alembic migrations
- 5,000+ real-time satellites rendered on CesiumJS globe via satellite.js Web Worker SGP4 propagation at 1 Hz without frame-rate collapse
- Live aircraft tracking from OpenSky Network OAuth2 API with smooth lerp interpolation and trail polylines
- Unified search (satellite name/NORAD ID, aircraft callsign/ICAO24) with globe fly-to, plus constellation/altitude/region filter panels
- 60 FPS sustained at full scene load (BlendOption.OPAQUE, transferable Float64Array IPC, partial B-tree spatial index)
- Phase 6 gap closure: automated Alembic entrypoint, SearchBar null-worker guard, dead Zustand state removed

---

