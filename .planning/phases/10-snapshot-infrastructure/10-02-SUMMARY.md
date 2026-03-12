---
phase: 10-snapshot-infrastructure
plan: "02"
subsystem: database
tags: [postgresql, partitioning, sqlalchemy, alembic, rq, snapshot, replay]

requires:
  - phase: 10-snapshot-infrastructure/10-01
    provides: "RED-phase test stubs for snapshot_from_* helpers and ensure_partition_name"
  - phase: 09-gps-jamming-street-traffic
    provides: "e1f2a3b4c5d6 migration (GPS jamming cells) — head revision for down_revision"

provides:
  - backend/app/models/position_snapshot.py (PositionSnapshot ORM model for replay SELECT queries)
  - backend/alembic/versions/f1a2b3c4d5e6_add_position_snapshots_table.py (partitioned table migration)
  - backend/app/tasks/snapshot_positions.py (pure helpers + ensure_partition + RQ task)

affects:
  - 10-03 (replay API uses position_snapshots table and PositionSnapshot model)
  - Phase 11 (replay frontend consumes snapshot data accumulated by this task)

tech-stack:
  added: []
  patterns:
    - "Two-session DDL+DML separation: ensure_partition() in Session 1 (DDL), batch INSERT in Session 2 (DML) — never mix in same transaction"
    - "BIGSERIAL + composite PK (id, ts) for PostgreSQL partitioned table ORM model"
    - "text() bulk INSERT bypasses ORM composite PK complexity for partitioned table writes"
    - "Pure snapshot helpers accept ORM instances OR plain dicts (isinstance(row, dict) branch) — testable without DB"
    - "RETENTION_DAYS=7: oldest partition dropped by ensure_partition() to prevent unbounded growth"

key-files:
  created:
    - backend/app/models/position_snapshot.py
    - backend/alembic/versions/f1a2b3c4d5e6_add_position_snapshots_table.py
    - backend/app/tasks/snapshot_positions.py
  modified: []

key-decisions:
  - "snapshot_from_* helpers accept both ORM instances and plain dicts via isinstance(row, dict) — unit tests pass plain dicts; snapshot_positions() passes ORM rows"
  - "text() INSERT used for batch write to position_snapshots — avoids ORM composite PK + BIGSERIAL interaction complexity in partitioned tables (per research open question #1)"
  - "ensure_partition() drops partition older than RETENTION_DAYS (7) as well as creating today's — single DDL session handles both CREATE and DROP"
  - "Migration creates today's initial partition at upgrade time so first snapshot task run succeeds without a pre-existing partition"

patterns-established:
  - "Two-session DDL+DML separation for partitioned table writes"
  - "Pure helpers with ORM/dict dual-mode for testability without DB"

requirements-completed: [REP-01]

duration: 2min
completed: 2026-03-12
---

# Phase 10 Plan 02: PositionSnapshot Model, Migration, and Snapshot Task Summary

**BIGSERIAL-partitioned position_snapshots table (PARTITION BY RANGE ts) with SQLAlchemy ORM model, Alembic migration creating today's initial partition, and a 60-second RQ snapshot task that batch-inserts positions from all three live entity tables.**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-12T12:20:17Z
- **Completed:** 2026-03-12T12:22:44Z
- **Tasks:** 2
- **Files created:** 3

## Accomplishments

- `PositionSnapshot` SQLAlchemy ORM model with composite PK `(id, ts)` required for PostgreSQL partitioned tables
- Alembic migration `f1a2b3c4d5e6` creates the `position_snapshots` PARTITION BY RANGE table, the `(ts, layer_type)` index, and today's initial daily partition in a single `upgrade()`
- `snapshot_positions()` async task: reads Aircraft, MilitaryAircraft, and Ship live tables (valid positions only), builds rows via pure helpers, batch-inserts using `text()` INSERT in a separate DML session
- `ensure_partition()` DDL-only session creates today's partition and drops the 7-day-old partition to bound storage growth
- All 4 snapshot unit tests GREEN; full suite clean (only pre-existing `test_military_detail` failure unrelated to this plan)

## Task Commits

Each task was committed atomically:

1. **Task 1: PositionSnapshot model and Alembic migration** - `4c20975` (feat)
2. **Task 2: Snapshot task — pure helpers, ensure_partition, RQ wrapper** - `09bf2a3` (feat)

## Files Created/Modified

- `backend/app/models/position_snapshot.py` — PositionSnapshot ORM model; composite PK `(id, ts)`; BigInteger id with autoincrement; DateTime(timezone=True) for ts
- `backend/alembic/versions/f1a2b3c4d5e6_add_position_snapshots_table.py` — Creates partitioned parent table, `(ts, layer_type)` index, and today's first daily partition; downgrade drops CASCADE
- `backend/app/tasks/snapshot_positions.py` — Pure helpers (`snapshot_from_aircraft`, `snapshot_from_military`, `snapshot_from_ship`, `ensure_partition_name`), `ensure_partition()` DDL helper, `snapshot_positions()` async core, `sync_snapshot_positions()` RQ wrapper with 60s self-re-enqueue

## Decisions Made

- `snapshot_from_*` helpers accept both ORM instances and plain dicts via `isinstance(row, dict)` guard — unit tests pass plain dicts while the production task passes ORM row objects
- `text()` bulk INSERT used instead of ORM insert — avoids composite PK + BIGSERIAL interaction complexity in PostgreSQL partitioned tables (research open question #1 resolution)
- `ensure_partition()` also drops the 7-day-old partition in the same DDL session — one session, two DDL statements, keeps storage bounded without a separate cleanup task
- Migration creates today's initial partition in `upgrade()` — the first snapshot task run would otherwise fail if no partition exists for the current day's `ts` values

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None — migration ran cleanly on first attempt; all 4 tests turned GREEN immediately.

## User Setup Required

None — no external service configuration required. The snapshot task will be registered in the RQ worker in Plan 10-03.

## Next Phase Readiness

- `position_snapshots` table is live and partitioned; today's partition exists
- `sync_snapshot_positions` function is ready to be registered in the RQ worker startup
- Plan 10-03 (replay API) can now implement `GET /api/replay/snapshots` against this table
- `test_replay.py` RED stubs (from Plan 10-01) will turn GREEN once Plan 10-03 implements the route

---
*Phase: 10-snapshot-infrastructure*
*Completed: 2026-03-12*
