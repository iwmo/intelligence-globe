---
phase: 38-backend-migration
plan: "02"
subsystem: database
tags: [alembic, migration, sqlalchemy, adsb-lol, schema]
dependency_graph:
  requires: [38-01]
  provides: [ADSB.lol telemetry schema, updated Aircraft model, updated MilitaryAircraft model]
  affects: [backend/app/models/aircraft.py, backend/app/models/military_aircraft.py, backend/alembic/versions/]
tech_stack:
  added: []
  patterns: [hand-written alembic migration, mapped_column SQLAlchemy 2.0, JSONB dialect column]
key_files:
  created:
    - backend/alembic/versions/g3h4i5j6k7l8_adsb_lol_schema.py
  modified:
    - backend/app/models/aircraft.py
    - backend/app/models/military_aircraft.py
decisions:
  - "Hand-written migration only — never autogenerate (position_snapshots is range-partitioned)"
  - "MilitaryAircraft registration and aircraft_type left unchanged — already exist in original schema"
  - "nav_modes stored as JSONB (list of mode strings) matching ADSB.lol field shape"
metrics:
  duration: "~10 minutes"
  completed: "2026-03-15"
  tasks_completed: 2
  tasks_total: 2
  files_created: 1
  files_modified: 2
---

# Phase 38 Plan 02: Schema Migration Summary

**One-liner:** Hand-written Alembic migration g3h4i5j6k7l8 adds 8 ADSB.lol telemetry columns to aircraft and 6 to military_aircraft, with SQLAlchemy models updated to match.

## What Was Built

A hand-written Alembic migration (`g3h4i5j6k7l8_adsb_lol_schema.py`) that chains from `b2c3d4e5f6a1` (GDELT events table) and adds the ADSB.lol-specific telemetry fields the Plan 03 ingest worker will write. Both SQLAlchemy models were updated to declare the new columns so ORM upserts work without raw SQL.

## Tasks Completed

| Task | Name | Commit | Files |
| ---- | ---- | ------ | ----- |
| 1 | Hand-write Alembic migration for ADSB.lol telemetry columns | 2befa7b | backend/alembic/versions/g3h4i5j6k7l8_adsb_lol_schema.py |
| 2 | Update SQLAlchemy models for both tables | 7b15feb | backend/app/models/aircraft.py, backend/app/models/military_aircraft.py |

## Artifacts

### backend/alembic/versions/g3h4i5j6k7l8_adsb_lol_schema.py

- `revision = 'g3h4i5j6k7l8'`, `down_revision = 'b2c3d4e5f6a1'`
- `upgrade()` adds to `aircraft`: emergency (String), nav_modes (JSONB), ias (Float), tas (Float), mach (Float), roll (Float), registration (String), type_code (String) — all nullable
- `upgrade()` adds to `military_aircraft`: emergency (String), nav_modes (JSONB), ias (Float), tas (Float), mach (Float), roll (Float) — all nullable
- `downgrade()` drops all added columns in reverse order
- Docstring documents the hand-written rationale (position_snapshots range-partitioned constraint)

### backend/app/models/aircraft.py

- Added 8 new `mapped_column` declarations after the `trail` column
- Updated docstring from "OpenSky state-vector data" to "ADSB.lol aircraft data"
- JSONB import was already present (used for trail)

### backend/app/models/military_aircraft.py

- Added `JSONB` to dialect import (was missing)
- Added 6 new `mapped_column` declarations after `nac_p`
- Existing `registration` and `aircraft_type` columns left completely unchanged
- Updated docstring from "airplanes.live" to "ADSB.lol"

## Decisions Made

1. **Hand-written migration only** — never autogenerate because position_snapshots is range-partitioned and autogenerate would corrupt it. This is an established project invariant.

2. **MilitaryAircraft registration and aircraft_type unchanged** — both columns already exist in the original schema. Plan 02 adds only the 6 new telemetry fields; touching existing columns would break the current military ingest.

3. **nav_modes as JSONB** — ADSB.lol returns nav_modes as a list of strings (e.g., `["althold","tcas"]`). JSONB is the correct type; uses `postgresql.JSONB(astext_type=sa.Text())` matching the existing trail column pattern.

## Verification Results

```
tests/test_migration_freshness.py: 5 passed
tests/test_db.py: 2 passed (7 total across both)

Aircraft cols include: emergency, nav_modes, ias, tas, mach, roll, registration, type_code
MilitaryAircraft cols include: emergency, nav_modes, ias, tas, mach, roll
MilitaryAircraft retains: aircraft_type, registration (unchanged)
Migration chain: revision=g3h4i5j6k7l8, down_revision=b2c3d4e5f6a1 — OK
```

## Deviations from Plan

None — plan executed exactly as written.

## Next Step

Execute plan 38-03: implement `ingest_adsbiol.py` worker that upserts to the newly-migrated schema.

## Self-Check: PASSED

- `backend/alembic/versions/g3h4i5j6k7l8_adsb_lol_schema.py` — FOUND
- `backend/app/models/aircraft.py` — FOUND (updated)
- `backend/app/models/military_aircraft.py` — FOUND (updated)
- Commit 2befa7b — FOUND
- Commit 7b15feb — FOUND
