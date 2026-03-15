---
phase: 02-satellite-layer
plan: "02"
subsystem: backend-pipeline
tags: [rq, redis, httpx, celery-alternative, satellite, ingest, worker, docker-compose, postgresql, upsert]

requires:
  - phase: 02-satellite-layer/02-01
    provides: satellites table in PostgreSQL, Satellite ORM model, derive_constellation helper

provides:
  - RQ worker service in docker-compose that runs continuously
  - CelesTrak OMM ingest job fetching 14,000+ active satellites on startup
  - Self-re-enqueue pattern refreshing catalog every 2 hours
  - sync_fetch_and_upsert_satellites (RQ-safe sync wrapper)
  - async fetch_and_upsert_satellites (core async implementation)

affects:
  - 02-03 (frontend can now call GET /api/satellites/ and receive 14k+ real satellite records)
  - 03-aircraft-layer (same worker pattern can be reused for OpenSky ingest)

tech-stack:
  added:
    - httpx 0.28.1 (async HTTP client for CelesTrak fetch, moved from dev to production deps)
    - rq 2.7.0 (Redis Queue worker, replaces theoretical Celery usage)
  patterns:
    - Self-re-enqueue pattern: job re-enqueues itself with queue.enqueue_in(timedelta(hours=2), ...) as last step — avoids RQ Repeat(times=-1) version instability
    - RQ sync wrapper pattern: def sync_f() wraps asyncio.run(async_f()) — required because RQ cannot pickle async coroutines
    - Worker module as __main__: python -m app.worker starts worker and enqueues first job immediately

key-files:
  created:
    - backend/app/tasks/__init__.py
    - backend/app/tasks/ingest_satellites.py
    - backend/app/worker.py
  modified:
    - backend/requirements.txt
    - backend/requirements-dev.txt
    - docker-compose.yml

key-decisions:
  - "httpx moved from requirements-dev.txt to requirements.txt — needed at runtime by the ingest task inside the worker container"
  - "Self-re-enqueue pattern used over RQ Repeat(times=-1) — Repeat API behavior varies across RQ versions and was flagged as uncertain in research"
  - "Worker uses with_scheduler=True for future cron-based scheduling but repeat mechanism is self-re-enqueue"
  - "Upsert uses on_conflict_do_update(index_elements=['norad_cat_id']) — norad_cat_id is the natural deduplication key from CelesTrak"

patterns-established:
  - "RQ task pattern: async def task() contains logic; def sync_task() = asyncio.run(task()) + self-re-enqueue"
  - "Worker entry point: main() creates Queue, enqueues first job string-addressed, starts Worker([queue])"

requirements-completed: [SAT-01]

duration: 10min
completed: 2026-03-11
---

# Phase 2 Plan 2: Satellite Data Pipeline Summary

**RQ worker with self-re-enqueue pattern fetches 14,683 CelesTrak OMM satellites on startup and upserts into PostgreSQL every 2 hours via httpx async client**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-03-11T13:06:00Z
- **Completed:** 2026-03-11T13:17:00Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- Implemented `fetch_and_upsert_satellites` (async) — fetches CelesTrak GROUP=active OMM JSON, upserts all records using PostgreSQL `on_conflict_do_update` on `norad_cat_id`
- Implemented `sync_fetch_and_upsert_satellites` (sync RQ wrapper) — wraps asyncio.run() + self-re-enqueue every 2 hours
- Built `worker.py` as a module entry point that enqueues first ingest immediately on startup then runs RQ Worker
- Added `worker` service to docker-compose.yml using same backend image, depending on healthy postgres + redis
- Verified 14,683 satellites ingested; GET /api/satellites/ returns 14,683 records; freshness endpoint returns non-null timestamp; 10/10 pytest tests green

## Task Commits

Each task was committed atomically:

1. **Task 1: Satellite ingestion task and RQ worker** - `401a6fa` (feat)
2. **Task 2: Add worker service to docker-compose and trigger initial ingest** - `3a27f35` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `backend/app/tasks/__init__.py` — empty package init for tasks module
- `backend/app/tasks/ingest_satellites.py` — async fetch + upsert logic and sync RQ-safe wrapper with self-re-enqueue
- `backend/app/worker.py` — RQ Worker entry point; enqueues first ingest on startup
- `backend/requirements.txt` — added httpx>=0.27 and rq>=1.16
- `backend/requirements-dev.txt` — removed httpx (moved to production)
- `docker-compose.yml` — added worker service with postgres + redis healthcheck dependencies

## Decisions Made

- httpx moved to production requirements because the ingest task runs in the worker container at runtime, not just in tests
- Self-re-enqueue over `Repeat(times=-1)` — research flagged RQ Repeat API as version-unstable; self-re-enqueue is explicit and compatible across all RQ versions
- `with_scheduler=True` on Worker so the RQ scheduler process handles `enqueue_in` delay accurately

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None. CelesTrak fetch completed in ~20 seconds, upserted 14,683 records. All 10 pytest tests remained green after adding new files.

## User Setup Required

None — no external service configuration required. Worker uses the same backend image; docker compose up starts it automatically.

## Next Phase Readiness

- satellites table is populated with 14,683 real satellite records from CelesTrak
- GET /api/satellites/ returns full catalog
- GET /api/satellites/freshness confirms last ingest timestamp
- Worker will self-refresh every 2 hours automatically
- Ready for Plan 02-03: frontend satellite rendering (satellite.js propagation + CesiumJS primitives)

---
*Phase: 02-satellite-layer*
*Completed: 2026-03-11*
