---
phase: 32-api-key-wiring
plan: 02
subsystem: infra
tags: [docker, vite, api-key, build-args]

# Dependency graph
requires:
  - phase: 32-api-key-wiring-01
    provides: "docker-compose.yml wires VITE_API_KEY as build arg to the frontend service"
provides:
  - "frontend/Dockerfile builder stage declares ARG VITE_API_KEY and exports it as ENV so Vite can inline the value at bundle compile time"
affects: [production-docker-stack, sec-04]

# Tech tracking
tech-stack:
  added: []
  patterns: ["Docker ARG + ENV pair in builder stage for Vite build-time variable injection"]

key-files:
  created: []
  modified:
    - frontend/Dockerfile

key-decisions:
  - "ARG VITE_API_KEY placed immediately after ARG VITE_CESIUM_ION_TOKEN, mirroring the established pattern — keeps all build-time token declarations grouped before COPY"

patterns-established:
  - "Pattern: each VITE_* build-time variable requires both ARG <name> and ENV <name>=$<name> in the builder stage; ARG alone is insufficient for Vite inlining"

requirements-completed: [SEC-04]

# Metrics
duration: 2min
completed: 2026-03-14
---

# Phase 32 Plan 02: API Key Wiring — Dockerfile Gap Closure Summary

**`ARG VITE_API_KEY` + `ENV VITE_API_KEY=$VITE_API_KEY` added to the frontend Dockerfile builder stage, completing the unbroken VITE_API_KEY wiring chain from .env through docker-compose build args through Vite bundle into the X-API-Key request header**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-03-14T09:35:00Z
- **Completed:** 2026-03-14T09:37:00Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments

- Inserted `ARG VITE_API_KEY` and `ENV VITE_API_KEY=$VITE_API_KEY` in the `builder` stage of `frontend/Dockerfile`, mirroring the existing `VITE_CESIUM_ION_TOKEN` pattern
- SEC-04 wiring chain is now complete: `.env` -> `docker-compose.yml build.args` -> `Dockerfile ARG` -> `ENV` -> Vite bundle -> `X-API-Key` header -> 201 in production

## Task Commits

Each task was committed atomically:

1. **Task 1: Add VITE_API_KEY ARG and ENV to Dockerfile builder stage** - `3f149eb` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `frontend/Dockerfile` — Two lines added to builder stage: `ARG VITE_API_KEY` (line 14) and `ENV VITE_API_KEY=$VITE_API_KEY` (line 15)

## Decisions Made

None — followed plan as specified. The fix mirrors the existing `VITE_CESIUM_ION_TOKEN` pattern exactly.

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required. The fix is purely a Dockerfile change; no env changes needed.

## Next Phase Readiness

- SEC-04 is fully closed. The complete VITE_API_KEY wiring chain is verified.
- v6.0 is complete. No further code tasks remain.
- Before public release: rotate OpenSky and AISStream credentials (git filter-repo), replace `<Author Name>` in LICENSE.

---
*Phase: 32-api-key-wiring*
*Completed: 2026-03-14*
