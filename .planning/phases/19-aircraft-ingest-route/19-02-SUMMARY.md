---
phase: 19-aircraft-ingest-route
plan: "02"
subsystem: backend-api
tags: [aircraft, freshness, api, tdd]
dependency_graph:
  requires:
    - 19-01 (upsert_aircraft with fetched_at, is_active, time_position columns)
    - 18-01 (freshness.py with stale_cutoff, is_stale)
    - 17-01 (Alembic migration adding freshness columns to aircraft table)
  provides:
    - GET /api/aircraft with freshness filtering and four new metadata fields
  affects:
    - frontend AircraftLayer (receives time_position, fetched_at, is_stale, position_age_seconds)
tech_stack:
  added: []
  patterns:
    - TDD (RED then GREEN)
    - Freshness cutoff filtering on list endpoint
    - position_age_seconds with time_position/last_contact fallback
key_files:
  created: []
  modified:
    - backend/app/api/routes_aircraft.py
    - backend/tests/test_aircraft.py
decisions:
  - "is_stale computed per-row at response time using the same stale_cutoff() helper as the WHERE clause — no double-truth risk"
  - "fetched_at serialized as ISO 8601 string matching frontend convention"
  - "position_age_seconds returns None (not 0) when both time_position and last_contact are null — avoids false-zero misleading the frontend"
metrics:
  duration: "2m30s"
  completed_date: "2026-03-13"
  tasks_completed: 1
  files_modified: 2
---

# Phase 19 Plan 02: Aircraft Route Freshness Filter and Metadata Fields Summary

**One-liner:** `GET /api/aircraft` now filters stale and inactive rows via `is_active == True` and `fetched_at >= stale_cutoff(AIRCRAFT_STALE_SECONDS)`, and returns four new fields — `time_position`, `fetched_at`, `is_stale`, `position_age_seconds` — alongside all pre-existing response keys.

## What Was Built

Updated `list_aircraft()` in `backend/app/api/routes_aircraft.py` to:

1. Import `stale_cutoff` and `is_stale` from `app.freshness`, and `settings` from `app.config`
2. Add a module-level `_position_age_seconds(r)` helper that uses `time_position` first and falls back to `last_contact`
3. Replace the simple WHERE clause with a four-condition filter: `is_active == True`, latitude/longitude not null, `fetched_at >= cutoff`
4. Add four new keys to every response dict: `time_position`, `fetched_at` (ISO string), `is_stale` (bool), `position_age_seconds` (float or null)

Added five new integration tests in `backend/tests/test_aircraft.py` using direct DB inserts:
- `test_list_aircraft_excludes_stale` — stale rows (10 min old fetched_at) not returned
- `test_list_aircraft_excludes_inactive` — is_active=False rows not returned
- `test_list_aircraft_freshness_fields` — fresh active rows have all four new fields with correct types/values
- `test_list_aircraft_position_age_fallback` — time_position=None falls back to last_contact for position_age_seconds
- `test_list_aircraft_position_age_null_when_both_null` — both null yields position_age_seconds=null

## Deviations from Plan

None — plan executed exactly as written.

## Test Results

- `tests/test_aircraft.py`: 8 passed (3 pre-existing + 5 new)
- `tests/test_ingest_aircraft.py`: 10 passed (no regressions)
- Total: 18 passed

## Commits

| Hash | Message |
|------|---------|
| eb3caf5 | test(19-02): add failing tests for freshness filter and new response fields |
| 1551850 | feat(19-02): add freshness filter and new response fields to list_aircraft() |

## Self-Check: PASSED

- [x] routes_aircraft.py modified with freshness filter (FOUND)
- [x] test_aircraft.py has 5 new test functions (FOUND)
- [x] All 18 tests pass
- [x] Commits eb3caf5 and 1551850 verified in git log
