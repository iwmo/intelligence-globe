# Requirements: OpenSignal Globe

**Defined:** 2026-03-14
**Core Value:** A unified, visually impressive intelligence picture — satellites orbiting, aircraft moving, anomalies surfacing — all rendered on one polished 3D globe that feels operational and modern.

## v6.0 Requirements

Requirements for the Production Ready milestone. Each maps to roadmap phases starting at phase 27.

### Secrets & Hardening

- [x] **SEC-01**: `docker-compose.yml` contains no hardcoded credential fallback values — only bare `${VAR}` references, no `:-default` for secrets
- [x] **SEC-02**: `backend/.dockerignore` and `frontend/.dockerignore` exist and exclude `.env`, `*.env`, and any credential files from `COPY . .`
- [x] **SEC-03**: Root `.env.example` includes all required variables with placeholder values (`OPENSKY_CLIENT_ID`, `OPENSKY_CLIENT_SECRET`, `AISSTREAM_API_KEY`, `VITE_CESIUM_ION_TOKEN`)
- [x] **SEC-04**: Static API key middleware protects `POST /api/osint` (and any future write endpoints) — key configured via `API_KEY` env var, returns 401 if missing/invalid; `API_KEY` forwarded to backend container and `X-API-Key` header sent by UI

### Production Stack

- [x] **PROD-01**: `docker-compose.yml` frontend service uses the `production` build target (nginx static serving, not Vite dev server)
- [x] **PROD-02**: nginx config added that routes `/api/*` requests to the `backend` container (reverse proxy so frontend can call relative `/api/...` in production)
- [x] **PROD-03**: Single public entry point on port 80 via nginx — no exposed Vite port in production
- [x] **PROD-04**: Docker Compose healthchecks added for `backend`, `worker`, and `ais-worker` services

### CI/CD

- [x] **CI-01**: GitHub Actions workflow runs `pytest` on every push and PR
- [x] **CI-02**: GitHub Actions workflow runs `vitest run` and `tsc --noEmit` on every push and PR
- [x] **CI-03**: GitHub Actions workflow runs secret scanning (gitleaks) to block credentials from being merged
- [x] **CI-04**: GitHub Actions workflow verifies both Docker images build successfully (`docker build --target production`)

### Documentation

- [x] **DOC-01**: Root `README.md` covers project overview, prerequisites, setup (`cp .env.example .env`), running with Docker Compose, and API key configuration
- [x] **DOC-02**: `LICENSE` file added to the repository

## Future Requirements

### Observability

- **OBS-01**: Health endpoint verifies DB, Redis, and worker queue liveness (deferred — current `/health` sufficient for homelab)
- **OBS-02**: JSON structured logs with request IDs (deferred)
- **OBS-03**: Prometheus metrics endpoint (deferred)

### Additional Data Layers

- **LAY-05**: Earthquake layer — USGS 24h GeoJSON feed, magnitude-scaled markers
- **LAY-06**: Weather radar overlay — NOAA NEXRAD WMS tiles on globe

### Freshness

- **FRESH-03**: Dedicated `/api/military/freshness` and `/api/ships/freshness` endpoints parallel to `/api/aircraft/freshness`

### Replay UX

- **KYBD-01**: Keyboard shortcuts: Space for play/pause, L for LIVE/PLAYBACK toggle
- **LIVE-02**: Replay speed readout ("60×") beside timestamp in CinematicHUD
- **LIVE-03**: Replay window time-range labels at scrubber track ends

## Out of Scope

| Feature | Reason |
|---------|--------|
| Multi-user auth / JWT | Single-user homelab tool; static API key sufficient |
| Real-time chat or collaboration | Out of scope from v1.0 |
| Mobile app | Web-first; responsive web works on tablet |
| Sentry / OpenTelemetry | Overkill for homelab; deferred |
| Full rate limiting (slowapi) | Static API key already blocks unauthenticated writes |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| SEC-01 | Phase 27 | Complete |
| SEC-02 | Phase 27 | Complete |
| SEC-03 | Phase 27 | Complete |
| SEC-04 | Phase 32 | Complete |
| PROD-01 | Phase 29 | Complete |
| PROD-02 | Phase 29 | Complete |
| PROD-03 | Phase 29 | Complete |
| PROD-04 | Phase 29 | Complete |
| CI-01 | Phase 30 | Complete |
| CI-02 | Phase 30 | Complete |
| CI-03 | Phase 30 | Complete |
| CI-04 | Phase 30 | Complete |
| DOC-01 | Phase 31 | Complete |
| DOC-02 | Phase 31 | Complete |
| SEC-04 (gap closure) | Phase 32 | Pending |

**Coverage:**
- v6.0 requirements: 14 total
- Mapped to phases: 14
- Unmapped: 0 ✓

---
*Requirements defined: 2026-03-14*
*Last updated: 2026-03-14 — traceability confirmed during roadmap creation*
