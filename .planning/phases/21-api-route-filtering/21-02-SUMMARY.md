---
phase: 21-api-route-filtering
plan: 02
subsystem: api
tags: [fastapi, sqlalchemy, freshness, military, ships, stale-filter]

# Dependency graph
requires:
  - phase: 21-01
    provides: failing MIL-02 and SHIP-02 tests in test_military.py and test_ships.py
  - phase: 20-military-ships-jamming-ingest
    provides: is_active, fetched_at, last_seen_at columns on MilitaryAircraft and Ship models
  - phase: 18
    provides: app.freshness module with stale_cutoff() and is_stale()
  - phase: 19
    provides: AIRCRAFT_STALE_SECONDS pattern in routes_aircraft.py
provides:
  - "MIL-02: GET /api/military/ filters by is_active=True AND fetched_at >= stale_cutoff(MILITARY_STALE_SECONDS)"
  - "MIL-02: Military list response includes fetched_at (ISO or null) and is_stale (bool) per row"
  - "SHIP-02: GET /api/ships/ filters by is_active=True AND last_seen_at >= stale_cutoff(SHIP_STALE_SECONDS)"
  - "SHIP-02: Ships list response includes last_seen_at, fetched_at (null), and is_stale per row"
affects: [frontend-military-layer, frontend-ships-layer, 21-03-gps-jamming]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Stale filter pattern: stale_cutoff() called inside handler body (never at module scope) to avoid frozen cutoff at server start"
    - "Ships return fetched_at: None (literal) because AIS is a stream — no polled fetch timestamp"
    - "per-row is_stale computed at response time via is_stale(r.last_seen_at, threshold) — no pre-computed column"

key-files:
  created: []
  modified:
    - backend/app/api/routes_military.py
    - backend/app/api/routes_ships.py

key-decisions:
  - "Ship fetched_at hardcoded to None in response — Ship model has no fetched_at column (AIS is streamed, not polled)"
  - "Military list filters by fetched_at >= cutoff; ships list filters by last_seen_at >= cutoff (model asymmetry from ingest architecture)"
  - "Detail endpoints /api/military/{hex} and /api/ships/{mmsi} left unchanged per STATE.md architectural decision (replay/detail panels need historical rows)"

patterns-established:
  - "Route freshness pattern: import stale_cutoff + is_stale + settings at top of file, call cutoff = stale_cutoff(threshold) inside handler, add fetched_at + is_stale to response dict"
  - "Response key naming: lat/lon (short) preserved for compact payloads; freshness fields use full names (fetched_at, last_seen_at, is_stale)"

requirements-completed: [MIL-02, SHIP-02]

# Metrics
duration: 8min
completed: 2026-03-13
---

# Phase 21 Plan 02: MIL-02 and SHIP-02 Route Freshness Filtering Summary

**Active+fresh filtering added to /api/military/ and /api/ships/ list endpoints with per-row fetched_at and is_stale metadata, turning RED tests from Plan 21-01 GREEN**

## Performance

- **Duration:** 8 min
- **Started:** 2026-03-13T12:45:00Z
- **Completed:** 2026-03-13T12:53:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Military list endpoint now filters by is_active=True AND fetched_at >= stale_cutoff(MILITARY_STALE_SECONDS=600s)
- Ships list endpoint now filters by is_active=True AND last_seen_at >= stale_cutoff(SHIP_STALE_SECONDS=900s)
- Both endpoints return new per-row freshness fields (fetched_at, is_stale for military; last_seen_at, fetched_at=None, is_stale for ships)
- All plan-required tests (test_military_response_includes_freshness_keys, test_military_list_shape_preserved, test_ships_response_includes_freshness_keys, test_ships_list_shape_preserved) pass GREEN

## Task Commits

Each task was committed atomically:

1. **Task 1: Implement MIL-02 — military route stale filter and freshness fields** - `ef5f4dd` (feat)
2. **Task 2: Implement SHIP-02 — ships route stale filter and freshness fields** - `c7a3c5c` (feat)

**Plan metadata:** (docs: complete plan)

## Files Created/Modified

- `backend/app/api/routes_military.py` - Added is_active + fetched_at >= cutoff WHERE conditions, added fetched_at and is_stale to response dict
- `backend/app/api/routes_ships.py` - Added is_active + last_seen_at >= cutoff WHERE conditions, added last_seen_at, fetched_at (None), is_stale to response dict

## Decisions Made

- Ship model has no fetched_at column (AIS is a WebSocket stream, not a polled HTTP endpoint) — returning literal `None` as documented in plan
- Military uses fetched_at for both filter and staleness calculation; ships use last_seen_at for both — model asymmetry is correct and intentional
- Detail endpoints left untouched per STATE.md decision: "Stale filtering on list endpoints only"

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

**Pre-existing: test_military_detail returns 200 instead of 404**
- Hex `ae1234` used in the test literally exists as live military data (C130J aircraft) in the DB
- This was a pre-existing test design issue: the test assumes the hardcoded hex is non-existent, but the DB has real data
- Documented in `deferred-items.md` — not caused by Phase 21 work, out of scope
- All plan-required tests pass GREEN; 66 total tests pass, 1 pre-existing failure

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Military and ships list endpoints are now consistent with the aircraft endpoint pattern (ACFT-03)
- Plan 21-03 can now update the GPS jamming route with JAM-02/JAM-03 envelope metadata
- Frontend layers can now rely on freshness metadata from all three data sources

---

*Phase: 21-api-route-filtering*
*Completed: 2026-03-13*
