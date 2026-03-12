---
phase: 10-snapshot-infrastructure
plan: "01"
subsystem: backend/tests
tags: [tdd, red-phase, snapshot, replay, testing]
dependency_graph:
  requires: []
  provides:
    - backend/tests/test_snapshot.py (RED stubs for snapshot pure helpers)
    - backend/tests/test_replay.py (RED stubs for replay API route)
  affects:
    - Plans 02 and 03 must satisfy these test contracts to reach GREEN
tech_stack:
  added: []
  patterns:
    - Deferred import pattern (import inside test body, not at module level)
    - AsyncClient/ASGITransport integration test pattern
key_files:
  created:
    - backend/tests/test_snapshot.py
    - backend/tests/test_replay.py
  modified: []
decisions:
  - "Deferred imports in snapshot unit tests: ModuleNotFoundError is the correct RED signal — file remains collectible without app.tasks.snapshot_positions"
  - "test_replay_invalid_layer incidentally passes (expects 404, gets 404 from no-route) — this is acceptable RED; implementation will still return 404 for the right reason (layer validation)"
  - "Used /opt/homebrew/bin/python3.11 (SQLAlchemy 2.0) instead of conda python (SQLAlchemy 1.4) for test execution — conda env has stale dependency"
metrics:
  duration: "3 minutes"
  completed_date: "2026-03-12"
  tasks_completed: 2
  files_created: 2
  files_modified: 0
---

# Phase 10 Plan 01: RED-Phase Test Stubs for Snapshot Infrastructure Summary

**One-liner:** TDD RED-phase stubs establishing the contract for snapshot pure helpers (`snapshot_from_*`, `ensure_partition_name`) and the `/api/replay/snapshots` endpoint via 7 failing tests.

## What Was Built

Two test files defining the contracts that Plans 02 and 03 must satisfy:

- **`backend/tests/test_snapshot.py`** — 4 unit tests for synchronous pure helper functions that will live in `app.tasks.snapshot_positions`. Uses deferred imports (inside function body) so `ModuleNotFoundError` is the RED failure signal, not a collection-time error.

- **`backend/tests/test_replay.py`** — 3 async integration tests for the `GET /api/replay/snapshots` endpoint using `AsyncClient(ASGITransport(app=app))` pattern. RED signal is 404 (route not yet mounted).

## Test Contracts Defined

### Snapshot Unit Tests (test_snapshot.py)

| Test | Contract |
|------|----------|
| `test_snapshot_from_aircraft` | Maps `{icao24, latitude, longitude, baro_altitude, velocity, true_track}` + ts → dict with `{ts, layer_type="aircraft", entity_id, latitude, longitude, altitude, heading, speed}` |
| `test_snapshot_from_military` | Maps `{hex, latitude, longitude, alt_baro, gs, track}` + ts → dict with `layer_type="military"` and same keys |
| `test_snapshot_from_ship` | Maps `{mmsi, latitude, longitude, sog, true_heading}` + ts → dict with `layer_type="ship"` and `altitude=None` |
| `test_ensure_partition_name` | `date(2026, 3, 12)` → `"position_snapshots_2026_03_12"` |

### Replay Integration Tests (test_replay.py)

| Test | Contract |
|------|----------|
| `test_replay_route_exists` | `GET /api/replay/snapshots?layer=all&start=...&end=...` → 200 with `{"snapshots": [...]}` |
| `test_replay_layer_filter` | `layer=aircraft` → 200 with `{"snapshots": [...], "count": N}` |
| `test_replay_invalid_layer` | `layer=unknown_xyz` → 404 (route validates layer against `{aircraft, military, ship, all}`) |

## Test Results (RED Phase)

```
test_snapshot.py: 4 FAILED (ModuleNotFoundError: No module named 'app.tasks.snapshot_positions')
test_replay.py: 2 FAILED (assert 404 == 200), 1 incidental pass
```

Full suite (excluding new tests): 1 pre-existing failure (`test_military_detail` — out of scope), 29 passed, 2 skipped.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] conda Python has SQLAlchemy 1.4 (missing `async_sessionmaker`)**
- **Found during:** Task 1 verification
- **Issue:** The default `python` in PATH is the conda environment with SQLAlchemy 1.4, which lacks `async_sessionmaker`. `conftest.py` requires SQLAlchemy 2.0+.
- **Fix:** Used `/opt/homebrew/bin/python3.11` (homebrew Python with SQLAlchemy 2.0.48) for test execution. Tests collect and fail correctly.
- **Files modified:** None (no code change — just used the correct Python interpreter)
- **Commit:** N/A (environment issue, not code change)

### Scope Note

`test_replay_invalid_layer` incidentally passes in RED phase: it expects a 404 response, and the missing route also returns 404. This is by design — the test still enforces the correct contract once the route exists (the route must return 404 for invalid layer values, not 422 or 200).

## Commits

| Hash | Task | Description |
|------|------|-------------|
| `fc96075` | Task 1 | test(10-01): add failing unit stubs for snapshot pure helpers |
| `6118b41` | Task 2 | test(10-01): add failing integration stubs for replay API route |

## Self-Check: PASSED
