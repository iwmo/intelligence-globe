---
phase: 19-aircraft-ingest-route
verified: 2026-03-13T00:00:00Z
status: passed
score: 8/8 must-haves verified
re_verification: false
---

# Phase 19: Aircraft Ingest + Route Verification Report

**Phase Goal:** Commercial aircraft data is honest — stale positions are excluded from the API, and richer OpenSky fields are stored and returned
**Verified:** 2026-03-13
**Status:** passed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | After each ingest run, every upserted aircraft row has time_position, vertical_rate, geo_altitude, position_source written from the state vector | VERIFIED | `workers/ingest_aircraft.py` lines 85–88 parse sv[3]/sv[11]/sv[13]/sv[16] with `len(sv) > N` guards; all four fields appear in both `.values()` and `set_={}` at lines 123–126/144–147. `tasks/ingest_aircraft.py` lines 207–210 mirror identical parsing in the inline loop. |
| 2 | Every upserted aircraft row has fetched_at set to the OpenSky response time field and last_seen_at set to the ingest timestamp | VERIFIED | `tasks/ingest_aircraft.py` lines 166–167: `fetched_at = datetime.fromtimestamp(response_time, tz=timezone.utc)` and `last_seen_at = datetime.now(timezone.utc)`. Both written in `set_={}` (lines 262–263/149–150). |
| 3 | Every upserted aircraft row has is_active=True; aircraft absent from the snapshot have is_active=False after the same commit | VERIFIED | `is_active=True` in all upsert `set_={}` dicts. Tombstone sweep at lines 272–279 of `tasks/ingest_aircraft.py`: `sa_update(Aircraft).where(Aircraft.icao24.not_in(seen_icao24s)).values(is_active=False)`, guarded by `if seen_icao24s:`. Single `await session.commit()` at line 282 follows both operations. |
| 4 | Short state vectors (fewer than 17 elements) do not raise IndexError | VERIFIED | All field reads use `sv[N] if len(sv) > N else None` pattern. Test `test_upsert_aircraft_short_sv_no_index_error` passes with a 10-element vector and confirms all four new fields are None. |
| 5 | GET /api/aircraft returns only rows where is_active=True AND fetched_at >= stale_cutoff(AIRCRAFT_STALE_SECONDS) | VERIFIED | `routes_aircraft.py` lines 40–47: WHERE clause includes `Aircraft.is_active == True` and `Aircraft.fetched_at >= cutoff` where `cutoff = stale_cutoff(settings.AIRCRAFT_STALE_SECONDS)`. Tests `test_list_aircraft_excludes_stale` and `test_list_aircraft_excludes_inactive` both pass. |
| 6 | Each aircraft in the response includes time_position, fetched_at, is_stale, and position_age_seconds fields | VERIFIED | `routes_aircraft.py` lines 60–63 add all four fields. `fetched_at` serialized as ISO string; `is_stale` computed via `is_stale(r.fetched_at, settings.AIRCRAFT_STALE_SECONDS)`; `position_age_seconds` via `_position_age_seconds(r)`. Test `test_list_aircraft_freshness_fields` confirms all four present with correct types. |
| 7 | position_age_seconds uses time_position when set, falls back to last_contact when time_position is null | VERIFIED | `_position_age_seconds()` at lines 27–32 of `routes_aircraft.py`: `ref_ts = r.time_position if r.time_position is not None else r.last_contact`. Tests `test_list_aircraft_position_age_fallback` and `test_list_aircraft_position_age_null_when_both_null` both pass. |
| 8 | All pre-existing response keys (icao24, callsign, latitude, longitude, baro_altitude, velocity, true_track, trail) are still present and unchanged | VERIFIED | Lines 51–59 of `routes_aircraft.py` preserve all original keys in their original order. `test_list_aircraft_freshness_fields` asserts all eight pre-existing keys still present. `test_list_aircraft()` (pre-existing test) continues to pass. |

**Score:** 8/8 truths verified

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `backend/app/workers/ingest_aircraft.py` | upsert_aircraft() with new fields in set_={} and no commit inside | VERIFIED | Signature: `upsert_aircraft(db, sv, fetched_at, last_seen_at)`. All 7 new fields in set_={}. No `db.commit()` call — comment at line 155 confirms this explicitly. |
| `backend/app/tasks/ingest_aircraft.py` | fetch_aircraft_states() returns (states, response_time) tuple; ingest_aircraft() owns single commit including tombstone sweep | VERIFIED | `fetch_aircraft_states` returns `tuple[list, int]` (line 74 type annotation, line 114 return). `ingest_aircraft()` has single `await session.commit()` at line 282 after tombstone sweep. |
| `backend/tests/test_ingest_aircraft.py` | Unit tests for new field parsing, length guards, fetched_at/last_seen_at, tombstone sweep | VERIFIED | 10 tests covering: new fields in set_{}, short sv IndexError guard, commit-not-called, tuple return, empty tuple return, tombstone sweep, tombstone skipped on empty feed, fetched_at conversion. All pass. |
| `backend/app/api/routes_aircraft.py` | list_aircraft() with freshness WHERE clause and four new response fields | VERIFIED | Freshness filter at lines 39–47. Four new fields at lines 60–63. `_position_age_seconds` helper at lines 27–32. Imports: `stale_cutoff`, `is_stale`, `settings`. |
| `backend/tests/test_aircraft.py` | Integration tests for freshness filter, new response fields, and backward compat | VERIFIED | 5 new tests (excludes_stale, excludes_inactive, freshness_fields, position_age_fallback, position_age_null_when_both_null) plus 3 pre-existing tests. All 8 pass. |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `tasks/ingest_aircraft.py` | `workers/ingest_aircraft.py` | `upsert_aircraft(session, sv, fetched_at, last_seen_at)` — session managed only in task | NOT WIRED (by design) | The task has its own inline upsert loop — a known architectural decision documented in Plan 01 Task 2, noted as "two-loop situation". The worker `upsert_aircraft()` is unit-tested independently. The task loop is the runtime path. Not a gap — explicitly designed this way. |
| `tasks/ingest_aircraft.py` | `models/aircraft.py` | `sa_update(Aircraft).where(Aircraft.icao24.not_in(seen_list)).values(is_active=False)` | VERIFIED | Line 275 of `tasks/ingest_aircraft.py`: `sa_update(Aircraft).where(Aircraft.icao24.not_in(seen_icao24s)).values(is_active=False)` — exact pattern present. |
| `routes_aircraft.py` | `freshness.py` | `from app.freshness import stale_cutoff, is_stale` | VERIFIED | Line 18 of `routes_aircraft.py`: `from app.freshness import stale_cutoff, is_stale`. Both used at lines 39 and 62. |
| `routes_aircraft.py` | `config.py` | `from app.config import settings; settings.AIRCRAFT_STALE_SECONDS` | VERIFIED | Line 19: `from app.config import settings`. Used at lines 39, 62, 63. `freshness.py` implements `stale_cutoff` and `is_stale` correctly. |

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| ACFT-01 | 19-01-PLAN.md | `ingest_aircraft.py` parses sv[3]→time_position, sv[11]→vertical_rate, sv[13]→geo_altitude, sv[16]→position_source with len(sv) > N guards; all written in upsert set_{} dict | SATISFIED | `workers/ingest_aircraft.py` lines 85–88, set_={} lines 144–147. `tasks/ingest_aircraft.py` lines 207–210, set_={} lines 259–262. Tests: `test_upsert_aircraft_new_fields_in_set`, `test_upsert_aircraft_short_sv_no_index_error`. |
| ACFT-02 | 19-01-PLAN.md | Aircraft ingest writes fetched_at (OpenSky response time), last_seen_at (ingest time), sets is_active=True for seen rows; tombstone pass marks absent rows is_active=False in same commit | SATISFIED | `tasks/ingest_aircraft.py` lines 166–167 (datetime conversion), 243/264 (is_active=True in set_), 272–279 (tombstone sweep), 282 (single commit). Tests: `test_ingest_aircraft_tombstone_sweep`, `test_ingest_aircraft_fetched_at_passed_correctly`. |
| ACFT-03 | 19-02-PLAN.md | /api/aircraft filters to is_active=True AND fetched_at >= stale_cutoff; response includes time_position, fetched_at, is_stale, position_age_seconds; freshness falls back from time_position to last_contact when null; existing keys preserved | SATISFIED | `routes_aircraft.py` lines 39–66. Tests: all 5 new tests in `test_aircraft.py` plus `test_list_aircraft()` backward compat. |

**Orphaned requirements check:** REQUIREMENTS.md maps ACFT-01, ACFT-02, ACFT-03 all to Phase 19. All three are claimed in plans and all three are satisfied. No orphaned requirements.

---

## Anti-Patterns Found

None. Scan of all five phase files produced zero matches for: TODO, FIXME, XXX, HACK, PLACEHOLDER, stub returns (`return null`, `return {}`, `return []`).

---

## Commit Verification

All four commits documented in SUMMARY files confirmed present in git log:

| Commit | Message |
|--------|---------|
| `2fbd126` | feat(19-01): extend upsert_aircraft with new fields, remove internal commit |
| `dc6b9bf` | feat(19-01): update ingest task with tuple return, tombstone sweep, single commit |
| `eb3caf5` | test(19-02): add failing tests for freshness filter and new response fields |
| `1551850` | feat(19-02): add freshness filter and new response fields to list_aircraft() |

---

## Test Suite Results

```
backend/tests/test_ingest_aircraft.py  10 passed
backend/tests/test_aircraft.py          8 passed
Total: 18 passed in 2.47s
```

---

## Human Verification Required

### 1. Live OpenSky position_source field population

**Test:** Start the stack with valid OpenSky credentials, trigger an ingest cycle, and call `GET /api/aircraft`. Inspect the `position_source` field on several rows.
**Expected:** Most rows have `position_source` set to an integer (0=ADS-B, 1=ASTERIX, 2=MLAT, 3=FLARM). Some rows may have `null` if the unauthenticated tier does not populate sv[16].
**Why human:** The OpenSky unauthenticated tier may not return sv[16]. Whether `null` is acceptable is a product decision, not a code defect. Documented in VALIDATION.md as "Manual-Only Verification".

---

## Summary

Phase 19 goal is fully achieved. The three requirements (ACFT-01, ACFT-02, ACFT-03) are all satisfied by substantive, wired implementations with passing test coverage.

- **Ingest side (19-01):** `upsert_aircraft()` in the worker accepts the new signature, parses all four new OpenSky fields with proper length guards, and writes them along with `fetched_at`, `last_seen_at`, and `is_active=True` into `set_={}`. The task's inline loop mirrors this identically. The tombstone sweep correctly sets `is_active=False` for absent aircraft in the same commit that processes upserts.

- **Route side (19-02):** `list_aircraft()` now filters to `is_active=True AND fetched_at >= stale_cutoff`, ensuring stale and tombstoned rows never reach the frontend. All four freshness metadata fields are returned, the `position_age_seconds` fallback from `time_position` to `last_contact` is correct, and all eight pre-existing response keys remain unchanged.

One item requires human verification: whether `position_source` is populated by the live OpenSky tier in production — this is a data availability question, not a code defect.

---

_Verified: 2026-03-13_
_Verifier: Claude (gsd-verifier)_
