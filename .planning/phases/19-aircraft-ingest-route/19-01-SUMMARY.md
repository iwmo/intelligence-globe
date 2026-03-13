---
phase: 19-aircraft-ingest-route
plan: "01"
subsystem: backend/ingest
tags: [aircraft, ingest, freshness, tombstone, opensky]
dependency_graph:
  requires: [17-01, 18-01]
  provides: [ACFT-01, ACFT-02]
  affects: [aircraft table, ingest pipeline]
tech_stack:
  added: []
  patterns:
    - length-guarded state vector parsing (len(sv) > N before indexing)
    - caller-owned session commit (worker helper no longer commits)
    - tombstone sweep via sa_update with not_in() guard
    - tuple return from fetch function (states, response_time)
key_files:
  created: []
  modified:
    - backend/app/workers/ingest_aircraft.py
    - backend/app/tasks/ingest_aircraft.py
    - backend/tests/test_ingest_aircraft.py
decisions:
  - "upsert_aircraft no longer calls db.commit() — session is managed by the task caller only"
  - "Tombstone sweep guarded by empty seen_icao24s check to prevent mass false-tombstone on feed-down"
  - "len(sv) > N guards used instead of try/except to keep parsing readable and explicit"
  - "fetched_at from response_time int; last_seen_at = datetime.now(UTC) at ingest time"
metrics:
  duration: "4m"
  completed_date: "2026-03-13"
  tasks: 2
  files_changed: 3
---

# Phase 19 Plan 01: Aircraft Ingest — New Fields, Freshness Timestamps, Tombstone Summary

Aircraft ingest pipeline extended to parse all new OpenSky state-vector fields (sv[3], sv[11], sv[13], sv[16]), write `fetched_at`/`last_seen_at` freshness timestamps, set `is_active=True` on every upsert, and tombstone absent aircraft with `is_active=False` in the same commit — wiring the Phase 17 schema columns into the write path.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Extend upsert_aircraft() with new fields, remove internal commit | 2fbd126 | backend/app/workers/ingest_aircraft.py, backend/tests/test_ingest_aircraft.py |
| 2 | Update ingest task — tuple return, tombstone sweep, single commit | dc6b9bf | backend/app/tasks/ingest_aircraft.py, backend/tests/test_ingest_aircraft.py |

## What Was Built

### Task 1: upsert_aircraft() — workers/ingest_aircraft.py

- Signature changed to `upsert_aircraft(db, sv, fetched_at, last_seen_at)`
- Length-guarded parsing added for `time_position` (sv[3]), `vertical_rate` (sv[11]), `geo_altitude` (sv[13]), `position_source` (sv[16])
- All four new fields plus `fetched_at`, `last_seen_at`, `is_active=True` added to both `.values()` and `set_={}` in the pg_insert statement
- Removed `await db.commit()` — the caller (ingest task) is now the single commit owner

### Task 2: ingest_aircraft task — tasks/ingest_aircraft.py

- `fetch_aircraft_states` now returns `(states: list, response_time: int)` 2-tuple
- `ingest_aircraft` unpacks the tuple, converts `response_time` to `fetched_at` datetime via `datetime.fromtimestamp(response_time, tz=timezone.utc)`, captures `last_seen_at = datetime.now(UTC)`
- The inline ingest loop now parses and writes all new fields consistently with the worker helper
- Tombstone sweep added after the upsert loop: `sa_update(Aircraft).where(Aircraft.icao24.not_in(seen_icao24s)).values(is_active=False)`, guarded by `if seen_icao24s:` to prevent mass false-tombstone on empty feed
- Removed `updated_at=func.now()` from `set_={}` (replaced by explicit freshness fields)
- Single `await session.commit()` after both upsert loop and tombstone sweep

## Test Coverage

10 tests pass (0 failures):
- `test_null_position_filtered` — null longitude skipped, execute not called
- `test_trail_capped_at_20` — trail capping at 20 entries
- `test_upsert_aircraft_new_fields_in_set` — time_position/vertical_rate/geo_altitude/position_source/fetched_at/last_seen_at/is_active all present in set_={}
- `test_upsert_aircraft_short_sv_no_index_error` — 10-element sv produces no IndexError, new fields are None
- `test_upsert_aircraft_commit_not_called` — commit not called inside upsert_aircraft
- `test_fetch_aircraft_states_returns_tuple` — returns (list, int) 2-tuple
- `test_fetch_aircraft_states_empty_returns_zero_time` — empty states returns ([], 0)
- `test_ingest_aircraft_tombstone_sweep` — execute called with tombstone stmt, commit called once
- `test_ingest_aircraft_tombstone_skipped_when_no_valid_states` — returns 0, no session entered
- `test_ingest_aircraft_fetched_at_passed_correctly` — commit called exactly once

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] pytest conftest used anaconda Python (SQLAlchemy 1.4)**

- **Found during:** Task 1 RED phase
- **Issue:** `python -m pytest` used the anaconda Python environment (SQLAlchemy 1.4.39) which does not have `async_sessionmaker`. The homebrew Python 3.11 at `/opt/homebrew/bin/pytest` has SQLAlchemy 2.0.48.
- **Fix:** Used `/opt/homebrew/bin/pytest` for all test runs (already configured correctly in the system PATH as `pytest`). Smoke-check imports validated with the homebrew Python as well.
- **Files modified:** None — discovery only, no file change needed.
- **Note:** The `python -m pytest` invocation in the plan's `<automated>` tag uses a different interpreter than `/opt/homebrew/bin/pytest`. All test runs in this plan used the correct interpreter.

**2. [Rule 1 - Bug] Test introspection used wrong attribute pattern for SQLAlchemy 2.x**

- **Found during:** Task 1 GREEN phase (first run)
- **Issue:** Initial test used `{col.key: val for col, val in conflict_clause.update_values_to_set}` but the tuple items are `(str, val)` not `(Column, val)` in SQLAlchemy 2.x.
- **Fix:** Changed to `dict(conflict_clause.update_values_to_set)` — keys are already strings.
- **Files modified:** backend/tests/test_ingest_aircraft.py

## Self-Check

### Files Exist
- backend/app/workers/ingest_aircraft.py — FOUND
- backend/app/tasks/ingest_aircraft.py — FOUND
- backend/tests/test_ingest_aircraft.py — FOUND

### Commits Exist
- 2fbd126 — feat(19-01): extend upsert_aircraft with new fields, remove internal commit — FOUND
- dc6b9bf — feat(19-01): update ingest task with tuple return, tombstone sweep, single commit — FOUND

## Self-Check: PASSED
