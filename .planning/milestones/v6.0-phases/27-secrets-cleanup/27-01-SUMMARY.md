---
phase: 27-secrets-cleanup
plan: 01
subsystem: infra
tags: [docker, secrets, security, env, dockerignore]

# Dependency graph
requires: []
provides:
  - docker-compose.yml with mandatory-error syntax for all credential variables
  - backend/.dockerignore excluding .env from build context
  - frontend/.dockerignore excluding .env from build context
  - .env.example with all 5 credential variables and descriptive placeholders
affects:
  - 28-api-key-auth
  - 29-production-docker
  - 30-ci-pipeline

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "${VAR:?message} mandatory-error syntax in docker-compose.yml for credential variables"
    - ".dockerignore co-located with Dockerfile for build context filtering"

key-files:
  created:
    - backend/.dockerignore
    - frontend/.dockerignore
  modified:
    - docker-compose.yml
    - .env.example

key-decisions:
  - "Use :?message syntax (not :- fallback) for all credentials — docker compose config fails loudly if .env is absent"
  - "POSTGRES_DB, POSTGRES_USER, FRONTEND_ORIGIN, VERSION keep :- defaults — non-secret infrastructure values"
  - "Healthcheck line left unchanged — pg_isready uses POSTGRES_USER and POSTGRES_DB (non-secrets), not POSTGRES_PASSWORD"
  - ".dockerignore files placed in service directories (backend/, frontend/), not project root — Docker uses build context directory"

patterns-established:
  - "SEC pattern: credential variables always use :?message syntax in compose files — fail fast, fail loud"
  - "SEC pattern: .dockerignore co-located with Dockerfile prevents accidental secret inclusion in image layers"
  - "Onboarding pattern: .env.example lists every variable with 'your-*' placeholder values and source URLs"

requirements-completed: [SEC-01, SEC-02, SEC-03]

# Metrics
duration: 2min
completed: 2026-03-14
---

# Phase 27 Plan 01: Secrets Cleanup Summary

**Removed all hardcoded credential fallbacks from docker-compose.yml using :?error syntax, added .dockerignore files to both service build contexts, and expanded .env.example with all 5 credential variables and descriptive placeholders**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-14T07:04:47Z
- **Completed:** 2026-03-14T07:06:14Z
- **Tasks:** 3
- **Files modified:** 4

## Accomplishments

- All 5 credential variables (OPENSKY_CLIENT_ID, OPENSKY_CLIENT_SECRET, AISSTREAM_API_KEY, POSTGRES_PASSWORD, VITE_CESIUM_ION_TOKEN) now use ${VAR:?message} mandatory-error syntax — `docker compose config` fails loudly with variable name when .env is absent
- backend/.dockerignore and frontend/.dockerignore created co-located with Dockerfiles, excluding .env and all variant patterns from build context
- .env.example expanded from 7 to 19 lines, adding OPENSKY_CLIENT_ID, OPENSKY_CLIENT_SECRET, AISSTREAM_API_KEY, API_KEY, and fixing VITE_CESIUM_ION_TOKEN from empty to descriptive placeholder

## Task Commits

Each task was committed atomically:

1. **Task 1: Strip credential fallbacks from docker-compose.yml** - `0b2755f` (chore)
2. **Task 2: Create .dockerignore files for backend and frontend** - `f08eefd` (chore)
3. **Task 3: Expand .env.example with all required credential variables** - `b12579b` (chore)

## Files Created/Modified

- `docker-compose.yml` - Replaced 10 credential :- fallbacks with :?message mandatory-error syntax across 5 services
- `backend/.dockerignore` - New: excludes .env variants and Python build artifacts from Docker build context
- `frontend/.dockerignore` - New: excludes .env variants and frontend build artifacts from Docker build context
- `.env.example` - Expanded with OPENSKY_CLIENT_ID, OPENSKY_CLIENT_SECRET, AISSTREAM_API_KEY, API_KEY; fixed VITE_CESIUM_ION_TOKEN from empty to descriptive placeholder

## Decisions Made

- :?message syntax chosen over just :? to provide operator-friendly error messages naming the variable and where to set it
- POSTGRES_DB, POSTGRES_USER, FRONTEND_ORIGIN, VERSION kept with :- defaults as they are non-credential infrastructure values
- Healthcheck line left unchanged — it uses only POSTGRES_USER and POSTGRES_DB (non-secrets)
- .dockerignore files placed in service directories (backend/, frontend/), not project root — Docker resolves .dockerignore relative to the build context directory

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

**Credential rotation required before making repo public.** Real credentials are in git history via old docker-compose.yml hardcoded fallbacks. User must:

1. Revoke and rotate OpenSky OAuth2 client secret at https://opensky-network.org/
2. Revoke and rotate AISStream API key at https://aisstream.io/
3. Optionally purge git history with `git filter-repo` or reset the GitHub repository

This is a user action item — Phase 27 removes the living source of the leak but does not purge history.

## Next Phase Readiness

- Phase 28 (API Key Auth) can proceed — API_KEY is now present in .env.example with placeholder
- Phase 29 (Production Docker) can proceed — .dockerignore files in place, compose file hardened
- Phase 30 (CI Pipeline) can proceed — gitleaks secret scanning will now have clean compose file to scan

---
*Phase: 27-secrets-cleanup*
*Completed: 2026-03-14*
