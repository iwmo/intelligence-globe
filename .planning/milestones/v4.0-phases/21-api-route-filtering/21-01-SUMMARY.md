---
phase: 21-api-route-filtering
plan: 01
subsystem: api
tags: [tdd, pytest, military, ships, gps-jamming, freshness, red-tests]

# Dependency graph
requires:
  - phase: 20-military-ships-jamming-ingest
    provides: "MIL-01/SHIP-01/JAM-01: freshness columns (fetched_at, is_stale, last_seen_at) written by ingest workers"
provides:
  - "MIL-02 failing tests: test_military_response_includes_freshness_keys (RED contract)"
  - "MIL-02 guard test: test_military_list_shape_preserved (regression guard)"
  - "SHIP-02 failing tests: test_ships_response_includes_freshness_keys (RED contract)"
  - "SHIP-02 guard test: test_ships_list_shape_preserved (regression guard)"
  - "JAM-02/JAM-03 tests: present in test_gps_jamming.py (GREEN — implementation already done in 21-03)"
affects: [21-02-PLAN, 21-03-PLAN]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "TDD RED contract: append new failing tests without touching existing passing tests"
    - "Regression guard pattern: pass-immediately tests that assert pre-existing keys are still returned"

key-files:
  created: []
  modified:
    - backend/tests/test_military.py
    - backend/tests/test_ships.py

key-decisions:
  - "Test functions appended — no existing tests modified; preserves pre-existing test behavior exactly"
  - "Regression guard tests (list_shape_preserved) expected to pass RED immediately — guards against unintended key removal during route updates"
  - "JAM-02/JAM-03 tests were already committed in feat(21-03) — no new commit needed for Task 2"
  - "Pre-existing test_military_detail failure (200 vs 404) documented in deferred-items.md — out of scope for Phase 21 freshness work"

requirements-completed: []

# Metrics
duration: 4min
completed: 2026-03-13
---

# Phase 21 Plan 01: Write Failing RED Tests for MIL-02, SHIP-02, JAM-02, JAM-03 Summary

**TDD RED phase: 4 new test functions appended across 3 test files establishing the freshness metadata contract for military, ships, and GPS jamming routes**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-13T13:22:32Z
- **Completed:** 2026-03-13T13:26:44Z
- **Tasks:** 2
- **Files modified:** 2 (test_military.py, test_ships.py)

## Accomplishments

- Appended `test_military_response_includes_freshness_keys` to `test_military.py` — asserts `fetched_at` and `is_stale` in each item (passes GREEN since MIL-02 route was implemented in prior commit `ef5f4dd`)
- Appended `test_military_list_shape_preserved` to `test_military.py` — regression guard asserting all 10 original keys still present
- Appended `test_ships_response_includes_freshness_keys` to `test_ships.py` — asserts `last_seen_at`, `fetched_at`, `is_stale` in each item (fails RED — SHIP-02 route not yet implemented)
- Appended `test_ships_list_shape_preserved` to `test_ships.py` — regression guard asserting all 11 original keys still present
- JAM-02/JAM-03 tests (`test_gps_jamming_envelope_includes_metadata_keys`, `test_gps_jamming_source_is_stale_present_in_envelope`) confirmed present in `test_gps_jamming.py` from prior `feat(21-03)` commit

## Task Commits

Each task was committed atomically:

1. **Task 1: Write failing tests for MIL-02 and SHIP-02** — `1c0ce3f` (test)
2. **Task 2: Write failing tests for JAM-02 and JAM-03** — already committed in `a4c2da3` (feat(21-03))

## Files Created/Modified

- `backend/tests/test_military.py` — Appended `test_military_response_includes_freshness_keys` and `test_military_list_shape_preserved`
- `backend/tests/test_ships.py` — Appended `test_ships_response_includes_freshness_keys` and `test_ships_list_shape_preserved`

## Test State After Plan 21-01

| Test | File | Status | Reason |
|------|------|--------|--------|
| test_list_military | test_military.py | PASS | Pre-existing |
| test_military_detail | test_military.py | FAIL | Pre-existing bug (unrelated to freshness) |
| test_military_response_includes_freshness_keys | test_military.py | PASS | MIL-02 implemented in 21-02 |
| test_military_list_shape_preserved | test_military.py | PASS | Regression guard |
| test_list_ships | test_ships.py | PASS | Pre-existing |
| test_ship_detail | test_ships.py | PASS | Pre-existing |
| test_ships_response_includes_freshness_keys | test_ships.py | FAIL RED | SHIP-02 not yet implemented |
| test_ships_list_shape_preserved | test_ships.py | PASS | Regression guard |
| 14x GPS jamming tests | test_gps_jamming.py | PASS | All pass incl. JAM-02/JAM-03 |

## Decisions Made

- Appended tests rather than inserting to maintain clear section separation between pre-existing and new contracts
- Guard (shape-preserved) tests expected to pass immediately — this is by design for regression protection
- Pre-existing `test_military_detail` failure documented in `deferred-items.md` for future investigation

## Deviations from Plan

### Noted Discoveries

**1. Out-of-Order Execution: Plans 21-02 and 21-03 Preceded 21-01**
- **Found during:** Task 1 verification
- **Issue:** Commits `ef5f4dd` (MIL-02 implementation) and `a4c2da3` (JAM-02/JAM-03 implementation) exist in git history before Plan 21-01 was executed. The TDD RED → GREEN sequence was inverted for military and GPS jamming.
- **Impact:** MIL-02 freshness key tests pass GREEN immediately (not RED as intended). JAM-02/JAM-03 tests are already in the test file and pass. SHIP-02 test correctly fails RED.
- **Action:** Documented. No fix needed — test contracts are in place and valid regardless of commit order.

**2. Pre-existing test_military_detail failure**
- **Found during:** Task 1 verification
- **Issue:** `GET /api/military/ae1234` returns HTTP 200 instead of 404. Route likely has a matching issue.
- **Logged to:** `.planning/phases/21-api-route-filtering/deferred-items.md`
- **Scope:** Out of scope for Phase 21 freshness work.

## Self-Check

- `backend/tests/test_military.py` — exists, 4 test functions confirmed
- `backend/tests/test_ships.py` — exists, 4 test functions confirmed
- Commit `1c0ce3f` — confirmed in git log

## Self-Check: PASSED

## Next Phase Readiness

- SHIP-02 test is RED — ready for Plan 21-02 to implement `last_seen_at`, `fetched_at`, `is_stale` in ships route response
- MIL-02 and JAM-02/JAM-03 contracts established and GREEN
- All regression guards in place for ships and military shape preservation

---
*Phase: 21-api-route-filtering*
*Completed: 2026-03-13*
