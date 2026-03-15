---
phase: 38-backend-migration
plan: "03"
subsystem: api
tags: [adsb, ingest, redis, sqlalchemy, rq, httpx]

# Dependency graph
requires:
  - phase: 38-01
    provides: test scaffold for ingest_adsbiol.py (13 RED tests)
provides:
  - "Unified ADSB.lol ingest worker (ingest_adsbiol.py) replacing ingest_aircraft.py + ingest_military.py"
  - "parse_adsbiol_aircraft: pure parser with ground-altitude normalisation, no unit conversion"
  - "settings.adsbio_base_url field defaulting to https://re-api.adsb.lol"
  - "Viewport bbox coordinate remapping: Redis min_lat,min_lon,max_lat,max_lon -> ?box=lat_s,lat_n,lon_w,lon_e"
affects: [38-04, frontend-migration]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "module-level synchronous redis_client for viewport bbox (patchable in tests)"
    - "tombstone sweep guarded by box_param is None — no false-tombstoning during viewport queries"
    - "base_url read via os.getenv() inside function body (not module-level settings) for env-patch testability"
    - "self-re-enqueue in finally block ensures task loop survives exceptions"

key-files:
  created:
    - backend/app/tasks/ingest_adsbiol.py
  modified:
    - backend/app/config.py

key-decisions:
  - "Use os.getenv('ADSBIO_BASE_URL', ...) inside function body (not settings singleton) so test_base_url_configurable can patch os.environ and see the new value"
  - "module-level redis_client is synchronous Redis (not aioredis) to match test mock contract (patch target is redis_client, .get() is synchronous)"
  - "get_viewport_bbox() is synchronous (not async) because redis_client.get() is synchronous — tests mock it as MagicMock not AsyncMock"
  - "Tombstone sweep skipped when bbox active (box_param is not None) — partial viewport must not mark out-of-view aircraft inactive"
  - "GPS jamming re-aggregation triggered from sync_ingest_military only on successful ingest (ingest_succeeded flag pattern)"

patterns-established:
  - "ADSB.lol bbox remapping: Redis stores min_lat,min_lon,max_lat,max_lon; ADSB.lol expects box=lat_s,lat_n,lon_w,lon_e; remap is box={min_lat},{max_lat},{min_lon},{max_lon}"
  - "No OAuth2, no credit budget, no 429-retry — ADSB.lol is IP-based feeder access"

requirements-completed: [INGEST-01, INGEST-02, INGEST-03, INGEST-04, INGEST-05, SCHEMA-01, SCHEMA-02, SCHEMA-03, SCHEMA-04, SCHEMA-05, SCHEMA-06]

# Metrics
duration: 10min
completed: "2026-03-15"
---

# Phase 38 Plan 03: ADSB.lol Ingest Worker Summary

**Unified ADSB.lol ingest worker with synchronous Redis bbox lookup, tombstone-guard, and 15s self-re-enqueue, turning all 13 RED tests GREEN**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-03-15T09:00:00Z
- **Completed:** 2026-03-15T09:04:11Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Created `ingest_adsbiol.py` with 5 exported functions replacing OpenSky and airplanes.live workers
- All 13 tests in `test_ingest_adsbiol.py` now pass GREEN (were RED/ImportError in Plan 01)
- Added `adsbio_base_url` to Settings with correct pydantic-settings field

## Task Commits

Each task was committed atomically:

1. **Task 1: Update config.py to add adsbio_base_url** - `21ff100` (feat)
2. **Task 2: Create ingest_adsbiol.py — unified ADSB.lol worker** - `03e725f` (feat)

**Plan metadata:** (docs commit — see below)

## Files Created/Modified

- `backend/app/tasks/ingest_adsbiol.py` - Unified ADSB.lol ingest worker; replaces ingest_aircraft.py + ingest_military.py
- `backend/app/config.py` - Added adsbio_base_url field (default: https://re-api.adsb.lol)

## Decisions Made

- **Synchronous redis_client at module level:** Tests patch `app.tasks.ingest_adsbiol.redis_client` with a synchronous `MagicMock`. Using aioredis (async) would require AsyncMock and a different patch target. Kept synchronous to match the test contract established in Plan 01.
- **os.getenv() inside function body for base_url:** The `settings` singleton is created at module import time; patching `os.environ` afterward has no effect on it. Reading via `os.getenv()` inside the function body allows `test_base_url_configurable` to work correctly.
- **get_viewport_bbox() is synchronous:** Follows from the synchronous redis_client decision; no need for async here.
- **Tombstone guarded by box_param is None:** When a viewport bbox is active, only a subset of aircraft is returned. Tombstoning based on that subset would incorrectly mark out-of-viewport aircraft as inactive. Guard prevents this.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Design Clarification] Synchronous get_viewport_bbox() instead of async**
- **Found during:** Task 2 (creating ingest_adsbiol.py)
- **Issue:** Plan specified `get_viewport_bbox() -> str | None (async)` using aioredis, but test mock contract (`_make_mock_redis` returns a synchronous `MagicMock`) requires a synchronous implementation
- **Fix:** Made `get_viewport_bbox()` synchronous using module-level `redis_client = Redis.from_url(...)` (synchronous redis-py); this matches the patch target the tests use
- **Files modified:** backend/app/tasks/ingest_adsbiol.py
- **Verification:** All 13 tests pass; bbox tests correctly verify url format
- **Committed in:** 03e725f (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 design clarification to match test contract)
**Impact on plan:** Necessary correction — async aioredis approach would have failed 5+ bbox/redis tests. No scope creep.

## Issues Encountered

- Pre-existing `ModuleNotFoundError: No module named 'fastapi'` in test_aircraft.py — this is a known issue (fastapi must be installed in Docker, not local env). Out of scope for this plan. All ingest-specific tests pass.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `ingest_adsbiol.py` is complete and all 13 ADSB.lol ingest tests pass GREEN
- Plan 38-02 (schema migration) still needs to run to add registration, type_code, emergency, nav_modes, ias, tas, mach, roll columns to the database
- Plan 38-04 (wiring/cleanup) can wire ingest_adsbiol into main.py worker startup and retire old ingest files

---
*Phase: 38-backend-migration*
*Completed: 2026-03-15*
