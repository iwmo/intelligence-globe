---
phase: 32-api-key-wiring
plan: 01
subsystem: auth
tags: [api-key, docker-compose, vite, environment-vars, fetch-headers]

# Dependency graph
requires:
  - phase: 28-api-key-auth
    provides: backend middleware (deps.py) and route protection (routes_osint.py) that enforce X-API-Key
  - phase: 29-production-docker-stack
    provides: docker-compose.yml build ARG pattern (VITE_CESIUM_ION_TOKEN) that VITE_API_KEY mirrors
provides:
  - API_KEY forwarded to backend container via docker-compose.yml :? syntax
  - VITE_API_KEY passed as frontend build ARG in docker-compose.yml
  - X-API-Key header on every OsintEventPanel POST /api/osint-events fetch call
  - .env.example documents VITE_API_KEY with must-match comment
  - README.md API Keys table documents VITE_API_KEY and correct key count
affects: [any phase adding new protected write endpoints, any phase touching OsintEventPanel]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "VITE_* secrets must be build ARGs in docker-compose.yml — runtime env vars on nginx container have no effect"
    - "Credential env vars use :? fail-loud syntax, never :- soft defaults"
    - "Frontend fetch headers for authenticated endpoints include X-API-Key: import.meta.env.VITE_API_KEY"

key-files:
  created: []
  modified:
    - docker-compose.yml
    - frontend/src/components/OsintEventPanel.tsx
    - .env.example
    - README.md

key-decisions:
  - "VITE_API_KEY must match API_KEY (same secret value) — documented in .env.example comment"
  - "VITE_API_KEY added as build ARG only (not runtime env on nginx service) — mirrors Phase 29 VITE_CESIUM_ION_TOKEN pattern"
  - "API_KEY added to backend service environment only, not worker or ais-worker — those have no HTTP endpoints"

patterns-established:
  - "Build-time secrets pattern: add to docker-compose.yml frontend build.args with :? syntax, reference as import.meta.env.VITE_* in component"
  - "Runtime secrets pattern: add to docker-compose.yml backend environment with :? syntax"

requirements-completed: [SEC-04]

# Metrics
duration: ~15min
completed: 2026-03-14
---

# Phase 32 Plan 01: API Key Wiring Summary

**End-to-end API key wiring closed: API_KEY forwarded to backend container, VITE_API_KEY baked into frontend bundle, X-API-Key header added to OsintEventPanel fetch, both documented in .env.example and README**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-03-14T09:10:00Z
- **Completed:** 2026-03-14T09:29:31Z
- **Tasks:** 3 (2 auto + 1 human-verify)
- **Files modified:** 4

## Accomplishments
- docker-compose.yml backend environment block now forwards API_KEY with :? fail-loud syntax
- docker-compose.yml frontend build.args block now passes VITE_API_KEY as compile-time build ARG
- OsintEventPanel.tsx POST fetch now sends X-API-Key header from import.meta.env.VITE_API_KEY
- .env.example documents VITE_API_KEY adjacent to API_KEY with a comment requiring they match
- README.md API Keys table updated with VITE_API_KEY row and accurate key count
- Human smoke test confirmed: no-key returns 401, correct key returns 201, UI POST shows 201 in devtools

## Task Commits

Each task was committed atomically:

1. **Task 1: Wire API_KEY to backend and VITE_API_KEY to frontend build** - `bd0f675` (feat)
2. **Task 2: Add X-API-Key header to OsintEventPanel and update docs** - `0d652ce` (feat)
3. **Task 3: Human verify — docker compose end-to-end smoke test** - human approved, no code commit

## Files Created/Modified
- `docker-compose.yml` - Added API_KEY to backend environment block, VITE_API_KEY to frontend build.args
- `frontend/src/components/OsintEventPanel.tsx` - Added X-API-Key header to POST fetch call
- `.env.example` - Added VITE_API_KEY entry with must-match comment
- `README.md` - Added VITE_API_KEY row to API Keys table, updated key count

## Decisions Made
- VITE_API_KEY added as build ARG (not runtime env) on the frontend service — Vite inlines VITE_* vars at bundle compile time; runtime env in nginx container has no effect. Mirrors Phase 29 VITE_CESIUM_ION_TOKEN pattern.
- API_KEY added only to backend service environment — worker and ais-worker have no HTTP endpoints and don't need it
- :? fail-loud syntax used for both (not :- soft defaults) — per Phase 27 project decision

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None — no new external services. Users must ensure `.env` contains both `API_KEY` and `VITE_API_KEY` set to the same secret string (documented in `.env.example`).

## Next Phase Readiness

- SEC-04 fully satisfied — OSINT event submission authenticated end-to-end in production docker compose stack
- v6.0 gap closure complete — MISSING-01, MISSING-02, BROKEN-01, BROKEN-02 from milestone audit all resolved

---
*Phase: 32-api-key-wiring*
*Completed: 2026-03-14*
