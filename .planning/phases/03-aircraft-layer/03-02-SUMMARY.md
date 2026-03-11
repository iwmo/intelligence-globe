---
phase: 03-aircraft-layer
plan: 02
subsystem: api
tags: [aircraft, opensky, oauth2, bearer-token, httpx, rq, redis, postgresql, jsonb, asyncio]

# Dependency graph
requires:
  - phase: 03-aircraft-layer/03-01
    provides: Aircraft SQLAlchemy model, ingest helpers (upsert_aircraft, build_new_trail), aircraft API routes, test contracts

provides:
  - sync_ingest_aircraft() RQ task at backend/app/tasks/ingest_aircraft.py — OAuth2 token fetch + OpenSky state poll + batch upsert + self-re-enqueue every 90s
  - Worker startup enqueues aircraft ingest job alongside satellite ingest
  - Live aircraft data visible at /api/aircraft/ within 90 seconds of worker start

affects:
  - 03-03-frontend (consumes live aircraft data from /api/aircraft/)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - OpenSky OAuth2 client_credentials grant — Bearer token in Authorization header only (no Basic Auth, dead since March 18 2026)
    - Pre-fetch all existing trails in one SELECT before upsert loop to avoid N+1 queries
    - 429 rate-limit handling: log X-Rate-Limit-Retry-After-Seconds header, raise RuntimeError, self-re-enqueue still fires in finally block
    - sync wrapper try/except/finally ensures self-re-enqueue even on ingest failure — task loop never stops
    - Trail cap inline: existing[-19:] + [new_point] — no helper call needed in batch ingest

key-files:
  created:
    - backend/app/tasks/ingest_aircraft.py
  modified:
    - backend/app/worker.py

key-decisions:
  - "sync_ingest_aircraft finally block re-enqueues unconditionally — even if ingest fails (e.g. 429), the 90s loop continues"
  - "Pre-fetch trail_map with single SELECT before upsert loop — avoids N per-aircraft SELECTs at 10,000+ aircraft scale"
  - "fetch_opensky_token uses POST form data with data= (not json=) — OpenSky token endpoint expects application/x-www-form-urlencoded"
  - "Docker container rebuild required for worker code changes — restart alone uses stale image"

patterns-established:
  - "OAuth2 pattern: fetch_opensky_token() -> str (Bearer token) separate from fetch_aircraft_states(token) — testable in isolation"
  - "Rate-limit guard: check resp.status_code == 429 BEFORE raise_for_status() — httpx raises generic HTTPStatusError for 429 without rate-limit header logging"
  - "Self-re-enqueue in finally: ensures the 90s loop persists through job failures, no orphaned state"

requirements-completed: [AIR-01, AIR-02]

# Metrics
duration: 20min
completed: 2026-03-11
---

# Phase 03 Plan 02: OpenSky Aircraft Ingest RQ Task Summary

**OAuth2 Bearer-token OpenSky ingest RQ task with batch trail-capping upsert and 90-second self-re-enqueue loop — 10,448 live aircraft in PostgreSQL within 90s of worker start**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-03-11T14:33:00Z
- **Completed:** 2026-03-11T14:53:00Z
- **Tasks:** 2
- **Files modified:** 2 (1 created, 1 modified)

## Accomplishments

- sync_ingest_aircraft() RQ task created at backend/app/tasks/ingest_aircraft.py with full OAuth2 client_credentials token fetch, OpenSky /states/all poll, null-position filter, bulk trail upsert, and 90s self-re-enqueue
- Worker startup updated to enqueue aircraft ingest job immediately alongside satellite ingest
- Live verification: 10,448 aircraft returned by GET /api/aircraft/ within 90 seconds of worker start; /api/aircraft/freshness shows live timestamp
- All 15 backend tests remain green

## Task Commits

Each task was committed atomically:

1. **Task 1: OpenSky ingest task with OAuth2, trail logic, and self-re-enqueue** — `327e3f5` (feat)
2. **Task 2: Wire aircraft ingest into worker startup** — `3948c84` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `backend/app/tasks/ingest_aircraft.py` — Full ingest RQ task: fetch_opensky_token, fetch_aircraft_states, ingest_aircraft (async core), sync_ingest_aircraft (RQ wrapper with self-re-enqueue)
- `backend/app/worker.py` — Added aircraft ingest enqueue at startup with logging

## Decisions Made

- sync_ingest_aircraft uses try/except/finally so self-re-enqueue fires even when ingest fails (e.g. missing credentials, 429) — ensures the 90s loop never orphans
- Pre-fetches trail_map with a single SELECT before the upsert loop — avoids N+1 query pattern at scale (10,000+ aircraft)
- fetch_opensky_token sends POST with data= (form-encoded) not json= — OpenSky identity server requires application/x-www-form-urlencoded
- Docker container rebuild required after worker.py edit — docker compose restart uses the stale image, docker compose build + up -d applies new code

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Docker container rebuild required for code changes to take effect**
- **Found during:** Task 2 (verifying aircraft job in logs)
- **Issue:** docker compose restart only restarts the running container with the existing image — the updated worker.py on disk was not picked up. Worker was still running old code (no aircraft enqueue).
- **Fix:** Ran docker compose build worker then docker compose up -d worker to build and deploy the updated image.
- **Files modified:** None (infrastructure step only)
- **Verification:** docker compose exec worker python3 -c "from app.worker import main; import inspect; print(inspect.getsource(main))" confirmed updated code in container
- **Committed in:** 3948c84 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 3 — blocking: container rebuild required)
**Impact on plan:** Standard Docker workflow deviation, no code scope changes. New rule documented: always rebuild container after modifying Python source files in Docker-deployed services.

## Issues Encountered

- The plan noted "docker compose restart worker" as sufficient — this is incorrect for code changes when the container uses a built image (not volume mounts). The override file does not add a volume mount for the backend src. Rebuild is required.

## User Setup Required

None — OPENSKY_CLIENT_ID and OPENSKY_CLIENT_SECRET are already set in docker-compose.yml (credentials registered in Plan 01 pre-condition). Aircraft data is live immediately.

## Next Phase Readiness

- Aircraft table populated with 10,448+ live entries, updating every 90 seconds
- GET /api/aircraft/ returns real positions, GET /api/aircraft/freshness confirms recency
- GET /api/aircraft/{icao24} returns trail data with up to 20 positions per aircraft
- Frontend (Plan 03) can render CesiumJS aircraft layer using this live data immediately

---
*Phase: 03-aircraft-layer*
*Completed: 2026-03-11*
