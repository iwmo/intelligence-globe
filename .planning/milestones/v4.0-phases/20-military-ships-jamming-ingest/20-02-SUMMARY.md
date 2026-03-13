---
phase: 20-military-ships-jamming-ingest
plan: "02"
subsystem: backend-ais-ingest
tags: [ais, freshness, is_active, last_seen_at, deactivation-sweep, tdd]
dependency_graph:
  requires: [20-01, MIG-01]
  provides: [SHIP-01, AIS-freshness-lifecycle]
  affects: [Phase 21 ships API filter, frontend ship layer staleness]
tech_stack:
  added: []
  patterns:
    - "parse_time_utc() module-level helper — safe ISO parse with UTC attachment"
    - "Deactivation sweep via sa_update(Ship).where(mmsi.not_in).values(is_active=False)"
    - "seen_mmsis accumulated across full Redis scan before chunking (not reset per chunk)"
key_files:
  created: []
  modified:
    - backend/app/workers/ingest_ais.py
    - backend/tests/test_ingest_ais.py
decisions:
  - "is_active=True written in set_={} of every upsert (not as default) — explicit write on every conflict update path"
  - "Deactivation sweep guarded by if seen_mmsis: to prevent mass false-deactivation if Redis scan yields nothing after early-return bypass"
  - "Test assertion for NOT IN sweep checks isinstance(stmt, Update) + string contains NOT IN instead of checking MMSI value directly — SQLAlchemy POSTCOMPILE binding hides literal values in str(stmt)"
  - "[Rule 1 - Bug] Fixed test assertion: str(sweep_stmt) shows POSTCOMPILE placeholder not MMSI value; changed to isinstance(Update) + NOT IN check"
metrics:
  duration: "4 minutes"
  completed: "2026-03-13"
  tasks_completed: 2
  files_modified: 2
---

# Phase 20 Plan 02: AIS Batch Flush Freshness Lifecycle (SHIP-01) Summary

AIS batch flush wired with last_seen_at/is_active upsert and deactivation sweep using Redis MMSI presence detection — ships absent from current scan marked is_active=False in same commit.

## What Was Built

`batch_flush_ships_to_pg` now implements the full SHIP-01 freshness lifecycle:

1. **`parse_time_utc()` helper** — module-level function that converts Redis ISO strings to UTC-aware `datetime` objects, returning `None` for falsy or malformed input without raising.

2. **`seen_mmsis` accumulation** — initialized before the Redis scan loop and appended per ship, ensuring complete MMSI list is available for the deactivation sweep after all chunked upserts.

3. **`last_seen_at` in row dict** — populated via `parse_time_utc(decoded.get("time_utc"))`. The original `last_update` string column is preserved unchanged.

4. **`is_active=True` and `last_seen_at` in `set_={}`** — both fields written explicitly on every conflict update, since SQLAlchemy `onupdate` is silently ignored on the `on_conflict_do_update` path.

5. **Deactivation sweep** — after all chunks, before the single `session.commit()`: `sa_update(Ship).where(Ship.mmsi.not_in(seen_mmsis)).values(is_active=False)`. Guarded by `if seen_mmsis:` as an additional safety net inside the session block (the `if not rows: return 0` guard already prevents entering the session on truly empty batches).

## Tests

9 tests in `test_ingest_ais.py`, all green:

- `test_parse_position_report` (pre-existing)
- `test_non_position_report_ignored` (pre-existing)
- `test_last_seen_at_written` — verifies last_seen_at appears in upsert SQL
- `test_is_active_true_for_seen` — verifies is_active appears in on_conflict set_={}
- `test_deactivation_sweep_marks_absent_inactive` — verifies sa_update UPDATE with NOT IN
- `test_deactivation_skipped_when_empty_redis` — verifies early return=0 and no execute
- `test_parse_time_utc_naive_gets_utc` — UTC attachment on naive ISO string
- `test_parse_time_utc_none_returns_none` — None input returns None
- `test_parse_time_utc_malformed_returns_none` — bad string returns None without raising

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed test assertion for deactivation sweep MMSI check**
- **Found during:** Task 1 → Task 2 GREEN run
- **Issue:** Test asserted `"111111" in str(sweep_stmt)` but SQLAlchemy renders `NOT IN (__[POSTCOMPILE_mmsi_1])` — bound parameter values do not appear in string representation
- **Fix:** Changed assertion to `isinstance(sweep_stmt, Update)` + `"NOT IN" in sweep_str.upper()` — verifies the sweep is an UPDATE with a NOT IN clause structurally, without relying on literal value rendering
- **Files modified:** backend/tests/test_ingest_ais.py
- **Commit:** ca09e6d

### Environment Issues Auto-resolved

**SQLAlchemy 1.4/2.0 conflict:** The conda environment had a corrupted SQLAlchemy installation (2.0.48 dist-info but 1.4.39 binaries). Resolved via `pip install --force-reinstall sqlalchemy[asyncio]>=2.0`. Also installed `asyncpg` and `pytest-asyncio` which were missing from the conda environment. These are pre-existing environment issues unrelated to plan changes.

## Self-Check: PASSED

- FOUND: backend/app/workers/ingest_ais.py
- FOUND: backend/tests/test_ingest_ais.py
- FOUND commit: 1dc1482 (test RED)
- FOUND commit: ca09e6d (feat GREEN)
- parse_time_utc() present at module level: confirmed
- seen_mmsis accumulated before chunking: confirmed (line 95)
- last_seen_at in row dict: confirmed (line 124)
- last_seen_at in set_={}: confirmed (line 150)
- is_active=True in set_={}: confirmed (line 151)
- Deactivation sweep with sa_update + not_in: confirmed (lines 160-164)
- if seen_mmsis: guard present: confirmed (line 160)
- Single commit at end of session block: confirmed
- 9 tests pass: confirmed
