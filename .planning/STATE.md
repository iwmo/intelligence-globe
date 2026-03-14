---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: completed
stopped_at: "Completed 33-04-PLAN.md — hook wiring: viewportBbox in queryKey and fetch URL for aircraft/ships/military (VPC-04 through VPC-08)"
last_updated: "2026-03-14T13:07:31.264Z"
progress:
  total_phases: 1
  completed_phases: 1
  total_plans: 4
  completed_plans: 4
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-14 after v6.0 milestone)

**Core value:** A unified, visually impressive intelligence picture — satellites orbiting, aircraft moving, anomalies surfacing — all rendered on one polished 3D globe that feels operational and modern.
**Current focus:** Planning next milestone — v6.0 Production Ready is SHIPPED

## Current Position

Phase: 32 — API Key Wiring (complete)
Plan: 01 of 01 — complete (all 3 tasks done, including human-verify approval)
Status: v6.0 gap closure complete — SEC-04 satisfied, OSINT event submission authenticated end-to-end

```
v6.0 Progress: [████████████████████] 100% (6/6 phases complete)
Phase 27 █  Phase 28 █  Phase 29 █  Phase 30 █  Phase 31 █  Phase 32 █
```

## Performance Metrics

| Metric | v6.0 Target | Current |
|--------|-------------|---------|
| Requirements covered | 14/14 | 14/14 (roadmap) |
| Phases planned | 5 | 5 |
| Plans complete | TBD | 5 |
| Phase 27-secrets-cleanup P01 | 2 | 3 tasks | 4 files |
| Phase 28-api-key-auth P01 | 3min | 2 tasks | 4 files |
| Phase 29-production-docker-stack P01 | 15 | 3 tasks | 4 files |
| Phase 30-ci-pipeline P01 | 1 | 2 tasks | 2 files |
| Phase 31-documentation P01 | ~5min | 3 tasks | 2 files |
| Phase 32-api-key-wiring P01 | ~15min | 3 tasks | 4 files |
| Phase 32-api-key-wiring P02 | 2 | 1 tasks | 1 files |
| Phase 33-viewport-culling P01 | 12 | 2 tasks | 6 files |
| Phase 33-viewport-culling P02 | 2 | 2 tasks | 3 files |
| Phase 33-viewport-culling P03 | 2 | 2 tasks | 3 files |
| Phase 33-viewport-culling P04 | 5 | 3 tasks | 3 files |

## Accumulated Context

### Roadmap Evolution

- Phase 33 added: Viewport Culling — Load Layers by Visible Globe Region

### Key Decisions (v6.0)

- Static API key (not JWT/session auth) — homelab tool, single user, simple shared secret sufficient
- Full production nginx stack integrated into main docker-compose.yml (not a separate compose file) — single source of truth, build targets differentiate dev vs prod
- All 4 CI checks: pytest, vitest+tsc, gitleaks secret scanning, docker build — covers correctness + security
- Observability deferred — current /health endpoint sufficient for homelab use
- Phase 27 runs before Phase 28 so API_KEY is guaranteed present in .env.example before middleware uses it
- Phase 31 depends on 29+30 so README can accurately describe the CI and Docker stack
- (27-01) Credential variables use :?message syntax in docker-compose.yml — fail loud when .env absent, expose variable name not value
- (27-01) .dockerignore co-located with Dockerfile in service directories (not project root) for correct Docker build context filtering
- (28-01) verify_api_key uses Optional[str] = Header(default=None) so absent X-API-Key header yields 401 not FastAPI's 422
- (28-01) monkeypatch.setattr on module-level settings singleton (not setenv) — settings is instantiated at import time
- (29-01) nginx.conf co-located with Dockerfile in frontend/ — Docker build context is ./frontend; project-root files are invisible to COPY instructions
- (29-01) VITE_CESIUM_ION_TOKEN passed as build ARG not runtime env — Vite inlines env vars at bundle compile time; runtime env in nginx container has no effect
- (29-01) Python stdlib urllib probe for backend healthcheck (curl absent in python:3.12-slim); Redis ping probe for worker/ais-worker healthchecks
- (29-01) Backend port 8000 removed from base compose, added to override only — nginx port 80 is the sole public entry point in production; FRONTEND_ORIGIN default updated to http://localhost
- (30-01) Commit-SHA allowlisting in .gitleaks.toml (not path/regex) — narrowest scope, unblocks CI without silencing future detections
- (30-01) DATABASE_URL uses postgresql+asyncpg:// prefix — asyncpg driver requirement for SQLAlchemy async engine
- (30-01) Postgres service hostname is localhost (not 'postgres') — pytest job runs on runner, not in a container
- (30-01) fetch-depth:0 mandatory on secret-scan job — gitleaks must scan full history, not just HEAD
- (30-01) alembic upgrade head runs before pytest — tests query real tables, schema must exist first
- (31-01) <Author Name> placeholder left in LICENSE for user to fill — real name must not be auto-invented
- (31-01) README sole user-facing URL is http://localhost; POSTGRES_PASSWORD changeme described as functional not a warning
- (32-01) VITE_API_KEY added as docker-compose frontend build ARG (not runtime env on nginx) — Vite inlines VITE_* vars at bundle compile time; runtime env on nginx has no effect
- (32-01) API_KEY forwarded to backend service only, not worker or ais-worker — those services have no HTTP endpoints
- (32-01) VITE_API_KEY must equal API_KEY (same secret value) — documented in .env.example with explicit must-match comment
- (33-02) Removed mount-initialisation call from useViewportBbox — TDD test expects exactly 1 call after moveEnd; mount call violated VPC-01 (called 2 times)
- (33-02) ViewportBbox interface defined in useAppStore.ts not useViewportBbox.ts — hook imports store; defining type in hook would create circular import
- (33-03) All four bbox params required for filter to activate — partial bbox silently ignored to prevent edge cases with half-specified ranges
- (33-03) BETWEEN used on existing B-tree indexed lat/lon columns — no new indexes needed, idx_aircraft_latlon_not_null covers the hot path
- (33-03) IDL crossing handled client-side — backend BETWEEN is a no-op for min_lon > max_lon; frontend prevents that case before calling
- (33-04) effectiveBbox = replayMode === 'live' ? viewportBbox : null — bbox always suppressed in playback mode (VPC-08); replay must load historical data across arbitrary space/time
- (33-04) queryKey includes effectiveBbox object — React Query deep-compares objects and triggers refetch on new camera bounds without manual invalidation

### Phase Dependency Map

```
Phase 27 (Secrets)
  └─► Phase 28 (API Key Auth)
  └─► Phase 29 (Production Docker)
  └─► Phase 30 (CI Pipeline)
         └─► Phase 31 (Documentation)
```

### CRITICAL: Credential Rotation Required Before Public Release

User must revoke and rotate the following before making the repo public — real keys are in git history via old docker-compose.yml hardcoded fallbacks:
- OpenSky OAuth2 client secret
- AISStream API key

Phase 27 (SEC-01) removes the fallbacks from the compose file but does NOT purge git history. User action required: `git filter-repo` or GitHub repo reset.

Also: replace `<Author Name>` in LICENSE with real name before public release.

### Preserved from v5.0

- `useAppStore.getState()` inside rAF/postUpdate callbacks required — selectors captured at render time go stale
- Hand-written Alembic migrations only — never autogenerate (position_snapshots is range-partitioned)
- `useSettingsStore` separate from `useAppStore` — prevents transient runtime values persisting
- Detail endpoints unaffected by stale filtering — replay engine needs historical rows
- `stale_cutoff()` called inside handler body (not module scope)

### Pending Todos

None.

### Blockers/Concerns

None blocking roadmap. Credential rotation (see above) is a user action item, not a code task. Author name in LICENSE must be filled before public release.

## Session Continuity

Last session: 2026-03-14T13:07:31.261Z
Stopped at: Completed 33-04-PLAN.md — hook wiring: viewportBbox in queryKey and fetch URL for aircraft/ships/military (VPC-04 through VPC-08)
Resume file: None
Next action: v6.0 is complete. Before public release: rotate credentials (git filter-repo), replace <Author Name> in LICENSE.
