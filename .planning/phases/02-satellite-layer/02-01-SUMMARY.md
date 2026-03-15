---
phase: 02-satellite-layer
plan: "01"
subsystem: backend-data-layer
tags: [satellite, sqlalchemy, alembic, fastapi, tdd, postgresql, jsonb]
dependency_graph:
  requires:
    - 01-foundation/01-01 (FastAPI app + DB base)
    - 01-foundation/01-02 (Docker Compose + PostgreSQL running)
  provides:
    - satellites table in PostgreSQL (via Alembic migration)
    - GET /api/satellites/ — list all satellites
    - GET /api/satellites/freshness — TLE freshness timestamp
    - GET /api/satellites/{norad_cat_id} — satellite metadata with altitude/velocity
  affects:
    - 02-02 (ingestion worker writes to satellites table this plan created)
    - 02-03 (frontend reads from the list and detail endpoints)
tech_stack:
  added:
    - Alembic 1.18 (migration runner, async env.py with run_sync pattern)
    - sqlalchemy.dialects.postgresql.JSONB (raw OMM storage)
  patterns:
    - TDD: failing tests committed first, implementation committed after green
    - Vis-viva equation for altitude/velocity derivation from mean_motion
    - Alembic include_object filter to exclude PostGIS tiger tables from autogenerate
    - Dual GET decorator (@router.get("") + @router.get("/")) avoids FastAPI 307 redirect on trailing slash
key_files:
  created:
    - backend/tests/test_satellites.py
    - backend/app/models/satellite.py
    - backend/app/api/routes_satellites.py
    - backend/alembic.ini
    - backend/alembic/env.py
    - backend/alembic/versions/ac9bb4b6e929_add_satellites_table.py
  modified:
    - backend/app/main.py
decisions:
  - "Alembic env.py uses asyncio.run(run_migrations_online()) with async engine — avoids needing a separate sync DB URL"
  - "include_object filter in alembic/env.py excludes reflected PostGIS/tiger tables from future autogenerate noise"
  - "Dual GET decorator on list_satellites handles trailing-slash without redirect_slashes=False on the entire app"
  - "Migration file manually cleaned to satellites-only ops — autogenerate detected PostGIS tiger tables as noise"
metrics:
  duration: "3 minutes"
  completed_date: "2026-03-11"
  tasks_completed: 2
  files_created: 6
  files_modified: 1
---

# Phase 2 Plan 1: Satellite Data Layer Summary

Satellite SQLAlchemy model with JSONB raw OMM storage, clean Alembic migration, and three FastAPI endpoints (list, freshness, detail with vis-viva altitude/velocity derivation) — all test-driven with five green pytest tests.

## What Was Built

### Satellite ORM Model (`backend/app/models/satellite.py`)

SQLAlchemy model `Satellite` with all CelesTrak OMM fields:
- Primary key `id`, unique indexed `norad_cat_id`
- All SGP4 elements: `mean_motion`, `eccentricity`, `inclination`, `ra_of_asc_node`, `arg_of_pericenter`, `mean_anomaly`, `bstar`, `mean_motion_dot`, `mean_motion_ddot`
- `epoch` as ISO8601 string, `constellation` derived from `object_name` prefix
- `raw_omm` as PostgreSQL JSONB — preserves full CelesTrak record
- `updated_at` with `server_default=func.now()`
- `CONSTELLATION_MAP` dict and `derive_constellation()` helper

### Alembic Migration (`backend/alembic/`)

Initialized Alembic with async-native `env.py`:
- Uses `asyncio.run()` with `create_async_engine` and `connection.run_sync()`
- `include_object` filter excludes PostGIS/tiger tables from autogenerate
- Migration `ac9bb4b6e929_add_satellites_table` manually cleaned to satellites-only DDL
- Creates `satellites` table with all columns, primary key, unique constraint, and `ix_satellites_norad_cat_id` index

### API Routes (`backend/app/api/routes_satellites.py`)

Three endpoints mounted at `/api/satellites`:
1. `GET /api/satellites/` — returns `[{norad_cat_id, omm}]` list for all satellites
2. `GET /api/satellites/freshness` — returns `{last_updated}` from `MAX(updated_at)`
3. `GET /api/satellites/{norad_cat_id}` — returns full metadata: norad_cat_id, object_name, constellation, epoch, altitude_km, velocity_km_s (via vis-viva), inclination, eccentricity, tle_updated_at; 404 if not found

Freshness route is defined before `/{norad_cat_id}` so FastAPI matches literal "freshness" first.

### Test Scaffold (`backend/tests/test_satellites.py`)

Five async tests using `httpx.AsyncClient` with `ASGITransport`:
- `test_satellite_list_returns_200` — list endpoint returns 200 + list
- `test_satellite_table_exists` — DB table confirmed via raw SQL
- `test_satellite_detail_404_for_unknown` — 404 for NORAD ID 99999999
- `test_satellite_detail_returns_metadata` — seeds ISS row, validates all metadata fields
- `test_tle_freshness_returns_timestamp` — freshness endpoint returns `last_updated` key

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] FastAPI 307 redirect on trailing slash for list endpoint**
- **Found during:** Task 2 GREEN verification
- **Issue:** `GET /api/satellites/` returned 307 Temporary Redirect; FastAPI redirects trailing-slash requests when the defined route has no trailing slash. `redirect_slashes=False` on `APIRouter` alone does not prevent the app-level redirect behavior.
- **Fix:** Added dual decorator `@router.get("") + @router.get("/")` on `list_satellites` — both paths match without redirect
- **Files modified:** `backend/app/api/routes_satellites.py`
- **Commit:** db7475e

**2. [Rule 2 - Auto-fix] Alembic autogenerate noise from PostGIS tiger tables**
- **Found during:** Task 2 migration generation
- **Issue:** PostGIS extension populates many tiger geocoding tables; autogenerate incorrectly flagged them as "to be dropped". Migration file would have dropped PostGIS data.
- **Fix:** (a) Manually cleaned migration to satellites-only DDL; (b) Added `include_object` filter to `alembic/env.py` to suppress reflected-only tables in future runs
- **Files modified:** `backend/alembic/env.py`, `backend/alembic/versions/ac9bb4b6e929_add_satellites_table.py`
- **Commit:** db7475e

## Test Results

```
10 passed in 0.26s

backend/tests/test_db.py::test_postgres_reachable PASSED
backend/tests/test_db.py::test_postgis_extension_exists PASSED
backend/tests/test_health.py::test_health_returns_200 PASSED
backend/tests/test_health.py::test_health_has_version PASSED
backend/tests/test_health.py::test_health_status_ok PASSED
backend/tests/test_satellites.py::test_satellite_list_returns_200 PASSED
backend/tests/test_satellites.py::test_satellite_table_exists PASSED
backend/tests/test_satellites.py::test_satellite_detail_404_for_unknown PASSED
backend/tests/test_satellites.py::test_satellite_detail_returns_metadata PASSED
backend/tests/test_satellites.py::test_tle_freshness_returns_timestamp PASSED
```

## Commits

| Hash    | Message                                                              |
|---------|----------------------------------------------------------------------|
| b732094 | test(02-01): add failing test scaffold for satellite endpoints       |
| db7475e | feat(02-01): satellite model, Alembic migration, API routes, main.py wiring |
