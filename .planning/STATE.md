---
gsd_state_version: 1.0
milestone: v6.0
milestone_name: Production Ready
status: completed
stopped_at: 31-01 complete — v6.0 milestone complete
last_updated: "2026-03-14T08:57:06.408Z"
progress:
  total_phases: 5
  completed_phases: 5
  total_plans: 5
  completed_plans: 5
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-14)

**Core value:** A unified, visually impressive intelligence picture — satellites orbiting, aircraft moving, anomalies surfacing — all rendered on one polished 3D globe that feels operational and modern.
**Current focus:** v6.0 Production Ready — COMPLETE

## Current Position

Phase: 31 — Documentation (complete)
Plan: 01 of 01 — complete (all 3 tasks done, including human-verify approval)
Status: v6.0 milestone fully complete — README.md and LICENSE created and human-approved

```
v6.0 Progress: [████████████████████] 100% (5/5 phases complete)
Phase 27 █  Phase 28 █  Phase 29 █  Phase 30 █  Phase 31 █
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

## Accumulated Context

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

Last session: 2026-03-14T09:00:00Z
Stopped at: 31-01 complete — v6.0 milestone complete
Resume file: None
Next action: v6.0 is complete. Before public release: rotate credentials (git filter-repo), replace <Author Name> in LICENSE.
