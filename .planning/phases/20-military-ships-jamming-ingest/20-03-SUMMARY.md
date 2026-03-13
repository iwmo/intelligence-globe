---
phase: 20-military-ships-jamming-ingest
plan: "03"
subsystem: gps-jamming-ingest
tags: [tdd, gps-jamming, freshness, military, is_active]
dependency_graph:
  requires: [20-01]
  provides: [JAM-01-freshness-metadata]
  affects: [gps_jamming_cells, ingest_gps_jamming]
tech_stack:
  added: []
  patterns:
    - Python-level max() for source_fetched_at avoids extra DB round-trip
    - is_stale(None, ...) returns True — correct sentinel for empty active set
    - aggregated_at captured once at function start — shared across all cells in one run
key_files:
  created: []
  modified:
    - backend/app/tasks/ingest_gps_jamming.py
    - backend/tests/test_gps_jamming.py
decisions:
  - JAM-01 active filter added as third positional .where() argument (same clause, not chained)
  - source_fetched_at computed via Python-level max over already-loaded aircraft_rows (no extra DB query)
  - test assertions use dict(stmt._post_values_clause.update_values_to_set) since SQLAlchemy returns list of tuples
metrics:
  duration: 3m
  completed: 2026-03-13
  tasks_completed: 2
  files_modified: 2
---

# Phase 20 Plan 03: GPS Jamming Active-Only Filter and Freshness Metadata Summary

**One-liner:** Added `is_active=True` filter to GPS jamming SELECT and writes `aggregated_at`, `source_fetched_at`, `source_is_stale` to every upserted cell via Python-level max with no extra DB round-trip.

## What Was Built

The GPS jamming aggregation task (`ingest_gps_jamming`) now:

1. Filters the `MilitaryAircraft` SELECT to only include `is_active=True` rows — tombstoned aircraft no longer inflate GPS jamming cell counts.
2. Captures `aggregated_at = datetime.now(timezone.utc)` at function start and writes it to every upserted cell.
3. Computes `source_fetched_at` as the Python-level `max(ac.fetched_at)` across all active rows (no extra DB query).
4. Derives `source_is_stale = is_stale(source_fetched_at, settings.MILITARY_STALE_SECONDS)` using the existing pure `is_stale()` function.
5. Writes all three freshness fields (`aggregated_at`, `source_fetched_at`, `source_is_stale`) in the `set_={}` dict of every `on_conflict_do_update` upsert.
6. Preserves the existing `if not cells: return 0` early-return guard with a JAM-03 deferral comment.

Five new tests were added (total: 12 in test_gps_jamming.py, all green). Full three-file suite (27 tests) all pass.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add JAM-01 test cases (RED) | 993932d | backend/tests/test_gps_jamming.py |
| 2 | Implement JAM-01 active filter + freshness metadata (GREEN) | c2e1071 | backend/app/tasks/ingest_gps_jamming.py, backend/tests/test_gps_jamming.py |

## Decisions Made

- **Python-level max for source_fetched_at:** Aircraft rows are already loaded into memory from the SELECT; computing max in Python avoids a second DB round-trip (e.g., `SELECT MAX(fetched_at)`).
- **is_stale(None, ...) = True:** When no active rows exist, `source_fetched_at` is `None`, and `is_stale(None, ...)` correctly returns `True` — consistent with the feed-down sentinel pattern established in Phase 19.
- **aggregated_at captured once:** One timestamp shared across all cells in a single aggregation run ensures cells are consistently timestamped even if the loop takes multiple milliseconds.
- **Test introspection via dict(stmt._post_values_clause.update_values_to_set):** SQLAlchemy's `OnConflictDoUpdate.update_values_to_set` is a list of `(key, value)` tuples; converting to dict enables key-based assertions.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] SQLAlchemy set_ introspection uses list of tuples, not dict**
- **Found during:** Task 1 RED verification
- **Issue:** Plan specified `set_dict = stmt.post_criterias[0].update_values_to_set` which does not exist; the correct attribute is `stmt._post_values_clause.update_values_to_set`, and it returns a list of `(key, value)` tuples requiring `dict()` conversion.
- **Fix:** Updated all three `set_dict` extraction lines to `dict(stmt._post_values_clause.update_values_to_set)`.
- **Files modified:** backend/tests/test_gps_jamming.py
- **Commit:** included in 993932d (RED commit) and c2e1071 (GREEN commit)

## Self-Check: PASSED

- FOUND: backend/app/tasks/ingest_gps_jamming.py
- FOUND: backend/tests/test_gps_jamming.py
- FOUND: .planning/phases/20-military-ships-jamming-ingest/20-03-SUMMARY.md
- FOUND commit: 993932d (test RED)
- FOUND commit: c2e1071 (feat GREEN)
- is_active == True filter present in SELECT WHERE clause (line 155)
- aggregated_at, source_fetched_at, source_is_stale all written in set_={} (lines 203-205)
- 12/12 tests in test_gps_jamming.py pass
- 27/27 tests across three-file suite pass
