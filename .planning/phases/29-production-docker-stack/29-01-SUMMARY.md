---
phase: 29-production-docker-stack
plan: 01
subsystem: infra
tags: [docker, nginx, docker-compose, healthcheck, production]

# Dependency graph
requires:
  - phase: 27-secrets-cleanup
    provides: credential variables properly externalised in docker-compose.yml and .env.example

provides:
  - nginx reverse-proxy on port 80 serving compiled Vite bundle and proxying /api/ to backend container
  - frontend/nginx.conf with SPA fallback and proxy_pass to backend:8000
  - frontend/Dockerfile production stage that bakes VITE_CESIUM_ION_TOKEN ARG into the JS bundle
  - docker-compose.yml base config: target production, port 80, healthchecks on backend/worker/ais-worker, CORS origin fix
  - docker-compose.override.yml restoring backend port 8000 for local development

affects: [30-ci-pipeline, 31-documentation]

# Tech tracking
tech-stack:
  added: [nginx:alpine (production stage), Docker healthcheck (Python stdlib probe)]
  patterns: [single-entry-point compose stack, build-arg token injection, service_healthy depends_on condition]

key-files:
  created:
    - frontend/nginx.conf
  modified:
    - frontend/Dockerfile
    - docker-compose.yml
    - docker-compose.override.yml

key-decisions:
  - "nginx.conf co-located with Dockerfile in frontend/ — Docker build context is ./frontend so files at project root are invisible to COPY instructions"
  - "Python stdlib urllib probe for backend healthcheck — curl is not installed in python:3.12-slim images"
  - "Python redis ping probe for worker/ais-worker healthchecks — confirms worker can actually reach Redis"
  - "VITE_CESIUM_ION_TOKEN passed as build ARG not runtime env — Vite inlines env vars at bundle compile time; runtime env in nginx container has no effect"
  - "Frontend depends_on backend with condition: service_healthy — nginx starts only after backend passes health probe, preventing 502 on cold start"
  - "FRONTEND_ORIGIN default changed from http://localhost:3000 to http://localhost — port 3000 is no longer published in production"
  - "Backend port 8000 removed from base compose, added to override only — nginx is the sole public entry point in production"
  - "Stale Docker layer cache requires explicit docker compose build backend when backend image is outdated — documented for operators"

patterns-established:
  - "Production build target: docker-compose.yml uses target: production; docker-compose.override.yml restores dev targets — single file pair covers both modes"
  - "Healthcheck pattern for Python workers: CMD-SHELL with inline Python one-liner using stdlib/installed packages, no shell utilities assumed"

requirements-completed: [PROD-01, PROD-02, PROD-03, PROD-04]

# Metrics
duration: ~15min (tasks 1-2 automated; task 3 human smoke-test)
completed: 2026-03-14
---

# Phase 29 Plan 01: Production Docker Stack Summary

**nginx on port 80 serves Vite static bundle and proxies /api/ to backend, with Docker healthchecks on all three workers and VITE_CESIUM_ION_TOKEN injected at build time via ARG**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-03-14
- **Completed:** 2026-03-14
- **Tasks:** 3 (2 automated + 1 human-verify checkpoint)
- **Files modified:** 4

## Accomplishments

- Created `frontend/nginx.conf` with SPA fallback (`try_files`) and `/api/` reverse proxy to `backend:8000`
- Updated `frontend/Dockerfile` to inject `VITE_CESIUM_ION_TOKEN` as build ARG in the builder stage and copy nginx.conf in the production stage
- Updated `docker-compose.yml` to production target on port 80, added healthchecks for backend/worker/ais-worker, fixed CORS origin default, moved backend port to override
- Smoke-tested full stack: all six containers healthy, `http://localhost/` returned HTML, `http://localhost/api/health` returned `{"status":"ok","version":"0.1.0"}`

## Task Commits

Each task was committed atomically:

1. **Task 1: Create frontend/nginx.conf and update Dockerfile production stage** - `b2aa371` (feat)
2. **Task 2: Update docker-compose.yml — production frontend, port 80, healthchecks, CORS origin fix** - `784d77c` (feat)
3. **Task 3: Verify production stack end-to-end** - checkpoint approved by user (no code changes)

**Plan metadata:** (see final docs commit)

## Files Created/Modified

- `frontend/nginx.conf` — nginx reverse proxy config: `/api/` proxies to `http://backend:8000`, all other paths served via SPA fallback `try_files $uri $uri/ /index.html`
- `frontend/Dockerfile` — builder stage gains `ARG VITE_CESIUM_ION_TOKEN` + `ENV` before `RUN npm run build`; production stage adds `COPY nginx.conf /etc/nginx/conf.d/default.conf`
- `docker-compose.yml` — frontend: target production, port 80, build.args for token, depends_on with service_healthy; backend: no port 8000, CORS fix, Python healthcheck; worker/ais-worker: Redis ping healthcheck
- `docker-compose.override.yml` — backend gains `ports: ["8000:8000"]` for local development access

## Decisions Made

- nginx.conf must be in `frontend/` not project root — Docker build context is `./frontend` so files outside it cannot be COPYed
- Python stdlib `urllib.request.urlopen` used for backend healthcheck because `curl` is absent in `python:3.12-slim`
- `VITE_CESIUM_ION_TOKEN` must be a build ARG — Vite statically replaces `import.meta.env.*` at bundle compile time; passing it as a runtime env var to the nginx container has no effect
- `FRONTEND_ORIGIN` default updated from `http://localhost:3000` to `http://localhost` to fix CORS in production (port 3000 no longer published)

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

During smoke testing, the backend image had a stale Docker layer cache. `docker compose -f docker-compose.yml up -d` started successfully but the backend container used an outdated image. Resolution: run `docker compose build backend` explicitly before `up -d` whenever backend source has changed. This is a standard Docker Compose behaviour, not a bug in the configuration. Documented here for operators.

## User Setup Required

None — no new external service configuration required. VITE_CESIUM_ION_TOKEN and other credentials must already be set in `.env` (established in Phase 27).

## Next Phase Readiness

- Production Docker stack is complete and smoke-tested
- Phase 30 (CI Pipeline) can proceed — `docker compose build` target is stable
- Phase 31 (Documentation) can proceed once Phase 30 is complete

---
*Phase: 29-production-docker-stack*
*Completed: 2026-03-14*
