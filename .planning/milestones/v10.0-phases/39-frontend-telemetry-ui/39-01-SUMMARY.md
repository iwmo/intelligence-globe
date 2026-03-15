---
phase: 39-frontend-telemetry-ui
plan: "01"
subsystem: frontend-ui + backend-api
tags: [aircraft, telemetry, emergency, nav-modes, airspeed, adsb]
dependency_graph:
  requires: [38-03, 38-04]
  provides: [UI-01, UI-02, UI-03]
  affects: [AircraftDetailPanel, routes_aircraft]
tech_stack:
  added: []
  patterns: [conditional-rendering, data-testid, vitest-mock-tanstack-query]
key_files:
  created:
    - frontend/src/components/__tests__/AircraftDetailPanel.test.tsx
  modified:
    - backend/app/api/routes_aircraft.py
    - frontend/src/components/AircraftDetailPanel.tsx
key_decisions:
  - Used data-testid attributes for emergency-badge, nav-modes-section, ias-row, tas-row, mach-row — precise test targeting without relying on text content
  - nav_modes and ias/tas/mach rows placed after the existing divider alongside altitude/speed/heading
  - Emergency badge placed immediately after the Flight callsign header row
  - Pre-existing SatelliteLayer.cleanup.test.tsx failures (2 tests) confirmed pre-existing via git stash — out of scope, not caused by this plan
metrics:
  duration_seconds: 142
  completed_date: "2026-03-15"
  tasks_completed: 2
  files_changed: 3
---

# Phase 39 Plan 01: Aircraft Telemetry UI Summary

Wire ADSB.lol telemetry fields (emergency, nav_modes, ias, tas, mach) through the detail API endpoint and into the AircraftDetailPanel with conditional rendering and 13 passing Vitest tests.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Extend /api/aircraft/{icao24} to return telemetry fields | 74f539e | backend/app/api/routes_aircraft.py |
| 2 | Update AircraftDetailPanel with telemetry UI + tests | 6f92c3a | frontend/src/components/AircraftDetailPanel.tsx, frontend/src/components/__tests__/AircraftDetailPanel.test.tsx |

## What Was Built

**Backend (Task 1):** Extended the `get_aircraft` handler to include `emergency`, `nav_modes`, `ias`, `tas`, `mach`, `registration`, and `type_code` in the GET `/api/aircraft/{icao24}` response dict. Fields passed through as-is from the Phase 38 model columns (no serialization needed — plain dict return pattern).

**Frontend (Task 2):**
- Extended `AircraftDetail` TypeScript interface with 7 new fields
- Emergency badge (dark red background, red border, pink text) rendered only when `emergency` is non-null and not `"none"` — absent from DOM otherwise
- Nav modes section with amber chips rendered only when `nav_modes` is a non-empty array — absent from DOM when null or `[]`
- IAS, TAS, Mach rows each rendered only when their value is non-null — absent from DOM when null
- 13 Vitest tests covering all UI-01/02/03 behaviours — all pass

## Verification

- Python AST parse: syntax OK
- `npx vitest run AircraftDetailPanel.test.tsx`: 13/13 tests pass
- Full vitest suite: 283/285 tests pass (2 pre-existing SatelliteLayer.cleanup failures confirmed unrelated)

## Deviations from Plan

### Auto-fixed Issues

None — plan executed exactly as written.

### Notes

The `SatelliteLayer.cleanup.test.tsx` suite had 2 pre-existing failures before this plan's changes (confirmed by git stash verification). These are out of scope and logged to deferred items.

## Self-Check: PASSED

- `backend/app/api/routes_aircraft.py` — modified, committed 74f539e
- `frontend/src/components/AircraftDetailPanel.tsx` — modified, committed 6f92c3a
- `frontend/src/components/__tests__/AircraftDetailPanel.test.tsx` — created, committed 6f92c3a
- git log confirms both commits exist on master
