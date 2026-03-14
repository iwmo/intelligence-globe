---
phase: 34-backend-foundation
plan: 01
subsystem: database
tags: [postgresql, alembic, sqlalchemy, gdelt, migration, tdd]

# Dependency graph
requires: []
provides:
  - gdelt_events PostgreSQL table with UNIQUE constraint on global_event_id
  - GdeltEvent SQLAlchemy ORM model exported from app.models.gdelt_event
  - alembic/env.py registered with gdelt_event model
  - 15 pytest xfail stubs covering GDELT-01 through GDELT-04 (Wave 0 scaffold)
affects:
  - 34-02 (ingest worker will populate gdelt_events)
  - 34-03 (API route reads from gdelt_events)
  - 35-frontend-layer (consumes gdelt-events API)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Hand-written SQL Alembic migration (never autogenerate) — project standard"
    - "VARCHAR(4) for CAMEO event_code — prevents silent integer coercion of '040' → 40"
    - "UNIQUE constraint from day one — prevents dedup downtime at volume"
    - "Wave 0 xfail stubs with strict=False — suite collects without errors, turns green incrementally"

key-files:
  created:
    - backend/alembic/versions/b2c3d4e5f6a1_add_gdelt_events_table.py
    - backend/app/models/gdelt_event.py
    - backend/tests/test_gdelt.py
  modified:
    - backend/alembic/env.py

key-decisions:
  - "Revision ID changed from a1b2c3d4e5f6 to b2c3d4e5f6a1 — the plan's target ID was already used by add_military_aircraft_table"
  - "down_revision set to a4f7c2e9b1d3 (actual DB head) not f1a2b3c4d5e6 (plan assumed outdated head)"
  - "4 DB tests pass immediately (table_schema, event_code_varchar4, unique_constraint, no_duplicate_rows) — migration is live, xfail(strict=False) allows xpassed"

patterns-established:
  - "GdeltEvent ORM follows gps_jamming.py BigInteger PK + UniqueConstraint in __table_args__ pattern"
  - "Wave 0 scaffold: all stubs xfail(strict=False) — pytest collects cleanly, future plans green them incrementally"

requirements-completed: [GDELT-01]

# Metrics
duration: 3min
completed: 2026-03-14
---

# Phase 34 Plan 01: Test Scaffold and Data Layer Summary

**PostgreSQL gdelt_events table with UNIQUE constraint on global_event_id, GdeltEvent ORM model, and 15 pytest xfail stubs as Wave 0 scaffold for GDELT-01 through GDELT-04**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-03-14T14:52:00Z
- **Completed:** 2026-03-14T14:55:55Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- gdelt_events table created in PostgreSQL with all 15 columns, UNIQUE constraint on global_event_id, and two indexes (occurred_at, lat/lon)
- GdeltEvent ORM model with String(4) event_code preserving CAMEO code '040' exactly
- alembic/env.py registered with new model; migration round-trip (upgrade + downgrade -1 + upgrade) clean
- 15 pytest stubs in RED state — 4 DB tests immediately xpassed after migration, 11 unit/API stubs remain xfail awaiting implementation

## Task Commits

1. **Task 1: Write test scaffold (Wave 0 — all 15 stubs)** - `81eaf79` (test)
2. **Task 2: Alembic migration + GdeltEvent ORM model + env.py registration** - `73a61da` (feat)

## Files Created/Modified

- `backend/tests/test_gdelt.py` — 15 xfail stubs covering parse helpers, DB integration, and API integration
- `backend/alembic/versions/b2c3d4e5f6a1_add_gdelt_events_table.py` — hand-written SQL migration for gdelt_events table
- `backend/app/models/gdelt_event.py` — GdeltEvent ORM model (BigInteger PK, String(4) event_code, UniqueConstraint)
- `backend/alembic/env.py` — added `import app.models.gdelt_event` after osint_event registration

## Decisions Made

- Revision ID changed from plan-specified `a1b2c3d4e5f6` to `b2c3d4e5f6a1` because the former was already used by the military aircraft migration — auto-fixed to avoid duplicate revision error
- `down_revision` set to `a4f7c2e9b1d3` (actual DB head) not `f1a2b3c4d5e6` (plan had stale reference) — auto-fixed to match real chain
- 4 DB tests pass immediately as xpassed (not failures) because xfail(strict=False) allows passing when migration is live

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Corrected duplicate revision ID a1b2c3d4e5f6**
- **Found during:** Task 2 (Alembic migration)
- **Issue:** Plan specified revision ID `a1b2c3d4e5f6` but that ID is already used by `add_military_aircraft_table.py`. Alembic raised "Revision a1b2c3d4e5f6 is present more than once" and refused to run with "Multiple head revisions" error.
- **Fix:** Changed revision ID to `b2c3d4e5f6a1`, renamed migration file accordingly, kept all SQL identical
- **Files modified:** `backend/alembic/versions/b2c3d4e5f6a1_add_gdelt_events_table.py`
- **Verification:** `alembic upgrade head` ran clean; downgrade -1 + re-upgrade also clean
- **Committed in:** `73a61da` (Task 2 commit)

**2. [Rule 1 - Bug] Corrected stale down_revision reference**
- **Found during:** Task 2 (Alembic migration — pre-flight check)
- **Issue:** Plan specified `down_revision = "f1a2b3c4d5e6"` but the actual DB head was `a4f7c2e9b1d3` (two migrations had been added since the plan was written: osint_events + freshness columns)
- **Fix:** Set `down_revision = "a4f7c2e9b1d3"` to match actual chain
- **Files modified:** `backend/alembic/versions/b2c3d4e5f6a1_add_gdelt_events_table.py`
- **Verification:** `alembic upgrade head` success with correct revision chain shown in log
- **Committed in:** `73a61da` (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (both Rule 1 - Bug)
**Impact on plan:** Both fixes necessary for migration to run at all. No scope creep — SQL schema, ORM model, and test stubs are exactly as specified in plan.

## Issues Encountered

None beyond the two auto-fixed revision ID issues above.

## User Setup Required

None — no external service configuration required. DB migration ran against existing PostgreSQL instance.

## Next Phase Readiness

- gdelt_events table live in PostgreSQL — ready for ingest worker (34-02)
- GdeltEvent ORM model importable from `app.models.gdelt_event` — ready for route (34-03)
- 11 remaining xfail stubs will turn green as 34-02 through 34-05 implement parse helpers and API routes
- No blockers

---
*Phase: 34-backend-foundation*
*Completed: 2026-03-14*
