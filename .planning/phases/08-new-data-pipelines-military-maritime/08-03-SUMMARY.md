---
phase: 08-new-data-pipelines-military-maritime
plan: "03"
subsystem: backend
tags: [ais, ships, maritime, websocket, redis, postgresql, alembic, fastapi]
dependency_graph:
  requires: ["08-01"]
  provides: ["LAY-03 backend — ships table + /api/ships/ endpoints + AIS worker"]
  affects: ["frontend ShipLayer polling /api/ships/"]
tech_stack:
  added: ["websockets>=12.0"]
  patterns:
    - "websockets.asyncio.client reconnect loop (async for websocket in connect(...))"
    - "redis.asyncio HSET with 600s TTL for ship position cache"
    - "pg_insert(Ship).on_conflict_do_update(index_elements=['mmsi']) batch upsert"
key_files:
  created:
    - backend/app/models/ship.py
    - backend/app/workers/ingest_ais.py
    - backend/app/api/routes_ships.py
    - backend/alembic/versions/d4e8f2a1b3c0_add_ships_table.py
  modified:
    - backend/alembic/env.py
    - backend/alembic/versions/d4e8f2a1b3c0_add_ships_table.py
    - backend/app/main.py
    - backend/requirements.txt
    - docker-compose.yml
decisions:
  - "MMSI stored as String PK in Ship model for safe JSON serialization; parse_ais_message() returns raw int (meta['MMSI']) to satisfy test_ingest_ais.py assertion (result['mmsi'] == 123456789)"
  - "routes_ships.py response uses lat/lon/heading keys (not latitude/longitude/true_heading) to match test_ships.py contract"
  - "Ships migration chain: down_revision set to a1b2c3d4e5f6 (military) not c5795b11a549 to resolve dual-head branch conflict created by Plan 02 migration"
  - "websockets import deferred inside run_ais_worker() body so ingest_ais module is importable in test environments without websockets installed"
metrics:
  duration: "~15 minutes"
  completed: "2026-03-12"
  tasks_completed: 2
  files_created: 4
  files_modified: 5
---

# Phase 08 Plan 03: Maritime AIS Backend Pipeline Summary

**One-liner:** Long-lived async WebSocket worker ingesting aisstream.io PositionReport messages into Redis cache with 30s PostgreSQL batch flush, Ship model, Alembic migration, and /api/ships/ REST endpoints.

## What Was Built

Complete maritime AIS data infrastructure for LAY-03:

- **Ship model** (`backend/app/models/ship.py`): SQLAlchemy ORM model with mmsi (String PK), vessel_name, latitude, longitude, sog, cog, true_heading, nav_status, last_update, updated_at
- **AIS ingest worker** (`backend/app/workers/ingest_ais.py`): Three exports — `parse_ais_message()` pure function, `batch_flush_ships_to_pg()` Redis-to-PG upsert, `run_ais_worker()` long-lived WebSocket entry point
- **Ships API** (`backend/app/api/routes_ships.py`): GET /api/ships/ (list with lat/lon filter) and GET /api/ships/{mmsi} (404 for unknown)
- **Alembic migration** (`d4e8f2a1b3c0_add_ships_table.py`): Creates ships table, chains after military migration
- **Docker Compose**: ais-worker service with AISSTREAM_API_KEY env var

## Task Summary

| Task | Name | Commit | Result |
|------|------|--------|--------|
| 1 | Ship model, migration, AIS ingest worker | d800dda | GREEN — 2 tests pass |
| 2 | Ships API routes, main.py, Docker Compose | cc4715f | GREEN — 2 tests pass |

## Verification

All 4 AIS/ship tests pass:
- `test_parse_position_report` — parse_ais_message() extracts correct fields
- `test_non_position_report_ignored` — returns None for non-PositionReport types
- `test_list_ships` — GET /api/ships/ returns 200 + list
- `test_ship_detail` — GET /api/ships/{mmsi} returns 404 for unknown

Full test suite: 23 passed, 2 skipped (no regressions).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Alembic dual-head migration conflict**
- **Found during:** Task 2 — `alembic upgrade head` failed with "Multiple head revisions"
- **Issue:** Plan 02 created `a1b2c3d4e5f6` (military migration) with `down_revision: c5795b11a549`. This plan initially created `d4e8f2a1b3c0` with the same `down_revision`, creating two competing heads.
- **Fix:** Updated `d4e8f2a1b3c0` `down_revision` from `c5795b11a549` to `a1b2c3d4e5f6` so ships migration chains after military migration in a linear sequence.
- **Files modified:** `backend/alembic/versions/d4e8f2a1b3c0_add_ships_table.py`
- **Commit:** cc4715f

**2. [Rule 1 - Bug] MMSI return type mismatch**
- **Found during:** Task 1 — test asserts `result["mmsi"] == 123456789` (int)
- **Issue:** Plan specified `str(meta["MMSI"])` but test_ingest_ais.py line 71 asserts integer equality
- **Fix:** `parse_ais_message()` returns `meta.get("MMSI")` (raw int from dict, not str-coerced). Ship model stores mmsi as String (conversion happens at DB write time in batch_flush_ships_to_pg).
- **Files modified:** `backend/app/workers/ingest_ais.py`

**3. [Rule 1 - Bug] Response key names**
- **Found during:** Task 2 — test_ships.py checks for `lat`, `lon`, `heading` keys
- **Issue:** Plan template showed `latitude`, `longitude`, `true_heading` in response dict
- **Fix:** routes_ships.py uses `lat`/`lon`/`heading` keys to match test contract
- **Files modified:** `backend/app/api/routes_ships.py`

## Self-Check: PASSED

All key files exist. Both task commits (d800dda, cc4715f) confirmed in git log.
