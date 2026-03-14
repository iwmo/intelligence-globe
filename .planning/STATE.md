---
gsd_state_version: 1.0
milestone: v6.0
milestone_name: Production Ready
status: completed
stopped_at: Completed 29-01-PLAN.md
last_updated: "2026-03-14T08:16:27.129Z"
last_activity: 2026-03-14 — Phase 28 Plan 01 executed (API key auth on OSINT write endpoint)
progress:
  total_phases: 5
  completed_phases: 3
  total_plans: 3
  completed_plans: 3
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-14)

**Core value:** A unified, visually impressive intelligence picture — satellites orbiting, aircraft moving, anomalies surfacing — all rendered on one polished 3D globe that feels operational and modern.
**Current focus:** v6.0 Production Ready — Phase 30 next

## Current Position

Phase: 29 — Production Docker Stack (complete)
Plan: 01 of 01 complete
Status: Phase 29 complete, ready for Phase 30
Last activity: 2026-03-14 — Phase 29 Plan 01 executed (production nginx Docker stack smoke-tested)

```
v6.0 Progress: [██████░░░░░░░░░░░░░░] 60% (3/5 phases)
Phase 27 █  Phase 28 █  Phase 29 █  Phase 30 ░  Phase 31 ░
```

## Performance Metrics

| Metric | v6.0 Target | Current |
|--------|-------------|---------|
| Requirements covered | 14/14 | 14/14 (roadmap) |
| Phases planned | 5 | 5 |
| Plans complete | TBD | 0 |
| Phase 27-secrets-cleanup P01 | 2 | 3 tasks | 4 files |
| Phase 28-api-key-auth P01 | 3min | 2 tasks | 4 files |
| Phase 29-production-docker-stack P01 | 15 | 3 tasks | 4 files |

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

### Preserved from v5.0

- `useAppStore.getState()` inside rAF/postUpdate callbacks required — selectors captured at render time go stale
- Hand-written Alembic migrations only — never autogenerate (position_snapshots is range-partitioned)
- `useSettingsStore` separate from `useAppStore` — prevents transient runtime values persisting
- Detail endpoints unaffected by stale filtering — replay engine needs historical rows
- `stale_cutoff()` called inside handler body (not module scope)

### Pending Todos

None.

### Blockers/Concerns

None blocking roadmap. Credential rotation (see above) is a user action item, not a code task.

## Session Continuity

Last session: 2026-03-14T08:16:27.126Z
Stopped at: Completed 29-01-PLAN.md
Resume file: None
Next action: `/gsd:plan-phase 30` or `/gsd:execute-phase 30`
