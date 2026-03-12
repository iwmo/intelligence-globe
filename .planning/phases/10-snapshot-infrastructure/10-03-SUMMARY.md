---
phase: 10-snapshot-infrastructure
plan: "03"
subsystem: api
tags: [fastapi, sqlalchemy, rq, replay, snapshot, partitioning]

requires:
  - phase: 10-snapshot-infrastructure/10-02
    provides: "PositionSnapshot ORM model and sync_snapshot_positions RQ task"
  - phase: 10-snapshot-infrastructure/10-01
    provides: "RED-phase test stubs for replay integration tests"

provides:
  - backend/app/api/routes_replay.py (GET /api/replay/snapshots endpoint)
  - backend/app/main.py (replay_router mounted at /api/replay)
  - backend/app/worker.py (sync_snapshot_positions enqueued at startup)

affects:
  - Phase 11 (replay frontend calls GET /api/replay/snapshots to load historical data)

tech-stack:
  added: []
  patterns:
    - "Replay route uses /snapshots sub-path under /api/replay prefix — @router.get('/snapshots') not empty string"
    - "String-based RQ enqueue for snapshot task: app.tasks.snapshot_positions.sync_snapshot_positions"
    - "layer param validated against VALID_LAYERS set; 404 with detail message on unknown layer"

key-files:
  created:
    - backend/app/api/routes_replay.py
  modified:
    - backend/app/main.py
    - backend/app/worker.py

key-decisions:
  - "@router.get('/snapshots') used (not empty string '') — plan note was incorrect; empty string maps to /api/replay not /api/replay/snapshots"
  - "String-based RQ enqueue for sync_snapshot_positions — consistent with all other task registrations in worker.py"
  - "VALID_LAYERS set includes 'all' to allow cross-layer queries; 'all' bypasses layer_type filter in WHERE clause"

patterns-established:
  - "Replay route sub-path pattern: use named path under prefix (not empty string) when URL needs /api/prefix/action"

requirements-completed: [REP-01]

duration: 3min
completed: 2026-03-12
---

# Phase 10 Plan 03: Replay API Endpoint and Worker Registration Summary

**FastAPI GET /api/replay/snapshots endpoint querying the partitioned position_snapshots table, with sync_snapshot_positions enqueued at RQ worker startup to begin recording immediately.**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-12T12:24:42Z
- **Completed:** 2026-03-12T12:27:50Z
- **Tasks:** 2
- **Files created/modified:** 3

## Accomplishments

- `GET /api/replay/snapshots` endpoint with `layer`, `start`, `end`, and `limit` params; returns `{"snapshots": [...], "count": N}`
- Layer validation against `VALID_LAYERS = {"aircraft", "military", "ship", "all"}` — unknown layer returns 404 with detail message
- Replay router mounted at `/api/replay` in `main.py`; route path `/snapshots` resolves to `/api/replay/snapshots`
- `sync_snapshot_positions` enqueued at worker startup with string-based pattern consistent with all other RQ tasks
- All 7 Phase 10 tests GREEN: 4 snapshot unit tests + 3 replay integration tests

## Task Commits

Each task was committed atomically:

1. **Task 1: Replay API route — GET /api/replay/snapshots** - `1279977` (feat)
2. **Task 1: Route path fix — /snapshots not empty string** - `1390fbd` (fix)
3. **Task 2: Wire replay router in main.py and snapshot task in worker.py** - `95e5fbd` (feat)

## Files Created/Modified

- `backend/app/api/routes_replay.py` — Replay API router; `VALID_LAYERS` set; `get_snapshots()` with layer/ts filtering; 404 on unknown layer
- `backend/app/main.py` — Added `from app.api.routes_replay import router as replay_router` and `app.include_router(replay_router, prefix="/api/replay")`
- `backend/app/worker.py` — Added `queue.enqueue("app.tasks.snapshot_positions.sync_snapshot_positions")` after GPS jamming enqueue; updated docstring

## Decisions Made

- `@router.get("/snapshots")` used instead of `@router.get("")` — the plan's note was incorrect: an empty string path under the `/api/replay` prefix maps to `/api/replay` not `/api/replay/snapshots`. Using `/snapshots` correctly maps to `/api/replay/snapshots` matching the test contract.
- String-based RQ enqueue maintained for consistency — all worker registrations use the `"module.path.function"` string pattern.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed route path: /snapshots not empty string**
- **Found during:** Task 1 verification (test_replay_route_exists returned 404)
- **Issue:** Plan's note said use `@router.get("")` but empty string maps to `/api/replay` (the prefix itself), not `/api/replay/snapshots` as required by the test
- **Fix:** Changed decorator to `@router.get("/snapshots")`
- **Files modified:** `backend/app/api/routes_replay.py`
- **Verification:** All 3 replay tests returned 200/404 as expected; `/api/replay/snapshots` confirmed in route listing
- **Committed in:** `1390fbd` (fix commit)

---

**Total deviations:** 1 auto-fixed (1 bug — incorrect route path in plan note)
**Impact on plan:** Required fix for tests to pass. Plan note was incorrect; correct path matches test contract.

## Issues Encountered

The plan's note stated `@router.get("")` (empty string) for the route decorator. This maps the route to `/api/replay` (just the prefix), not `/api/replay/snapshots`. The test contract requires `/api/replay/snapshots`. Fixed by using `@router.get("/snapshots")`.

## User Setup Required

None — no external service configuration required. The snapshot recording loop starts automatically when the RQ worker boots.

## Next Phase Readiness

- `GET /api/replay/snapshots` endpoint is live and queryable
- `sync_snapshot_positions` starts recording at worker boot; Phase 11 needs 24-48 hours of data to be meaningfully testable
- Phase 11 replay engine can call `GET /api/replay/snapshots?layer=all&start=...&end=...` to retrieve historical positions for playback
- REP-01 requirement fully satisfied

---
*Phase: 10-snapshot-infrastructure*
*Completed: 2026-03-12*
