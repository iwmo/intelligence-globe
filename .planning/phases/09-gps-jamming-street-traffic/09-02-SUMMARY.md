---
phase: 09-gps-jamming-street-traffic
plan: "02"
subsystem: api
tags: [gps-jamming, h3, sqlalchemy, fastapi, zustand, alembic, military-aircraft]

# Dependency graph
requires:
  - phase: 09-01
    provides: test_gps_jamming.py RED scaffold with 7 failing tests
  - phase: 08-new-data-pipelines-military-maritime
    provides: MilitaryAircraft model, ingest_military task, routes_military pattern

provides:
  - GpsJammingCell SQLAlchemy model (gps_jamming_cells table)
  - aggregate_jamming_cells() pure function with H3 res-5 grouping and bad_ratio formula
  - ingest_gps_jamming() async DB read + upsert
  - sync_aggregate_gps_jamming() RQ wrapper with daily re-enqueue
  - GET /api/gps-jamming endpoint returning { cells: GpsJammingCell[] }
  - Alembic migration e1f2a3b4c5d6 adding nic/nac_p to military_aircraft + gps_jamming_cells table
  - Zustand store layers extended with gpsJamming: false + streetTraffic: false defaults

affects:
  - 09-03 (GpsJammingLayer frontend component consumes /api/gps-jamming and gpsJamming layer key)
  - 09-04 (StreetTrafficLayer consumes streetTraffic layer key from store)
  - 09-05 (LayerControlPanel toggles for gpsJamming and streetTraffic)

# Tech tracking
tech-stack:
  added: [h3>=4.4.2]
  patterns:
    - H3 resolution-5 cell aggregation for geographic jamming heatmap
    - bad_ratio = max(0.0, (bad_count - 1) / total_count) formula from gpsjam.org
    - Pure aggregation function (aggregate_jamming_cells) testable without DB
    - RQ task self-re-enqueue pattern (daily 86400s interval)

key-files:
  created:
    - backend/app/models/gps_jamming.py
    - backend/app/tasks/ingest_gps_jamming.py
    - backend/app/api/routes_gps_jamming.py
    - backend/alembic/versions/e1f2a3b4c5d6_add_nic_nacp_and_gps_jamming_cells.py
  modified:
    - backend/app/models/military_aircraft.py
    - backend/app/tasks/ingest_military.py
    - backend/app/main.py
    - backend/alembic/env.py
    - backend/requirements.txt
    - frontend/src/store/useAppStore.ts

key-decisions:
  - "is_bad uses OR logic: (nic < 7) OR (nac_p < 8) — either metric degraded means bad signal"
  - "Both nic=None AND nac_p=None together → treated as GOOD (no degradation data, not a signal of jamming)"
  - "bad_ratio formula subtracts 1 from bad count to reduce false positives from single-aircraft noise"
  - "Severity thresholds: red >= 0.3, yellow >= 0.1, green < 0.1 (from gpsjam.org methodology)"
  - "gpsJamming and streetTraffic layer keys default false — user opt-in prevents globe clutter on first load"
  - "Store setLayerVisible() already handles new layer keys via keyof AppState['layers'] — no extra setter needed"

patterns-established:
  - "GPS jamming aggregation: pure aggregate_jamming_cells() function + async ingest_gps_jamming() DB wrapper pattern"
  - "Alembic migration chain: each migration's down_revision = previous migration's revision ID"

requirements-completed: [LAY-02]

# Metrics
duration: 15min
completed: 2026-03-12
---

# Phase 09 Plan 02: GPS Jamming Backend Summary

**H3 resolution-5 GPS jamming aggregation pipeline: NIC/NACp fields persisted to military_aircraft, gps_jamming_cells table with daily RQ aggregation task, and GET /api/gps-jamming endpoint returning severity-classified cells**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-03-12T10:07:46Z
- **Completed:** 2026-03-12T10:22:00Z
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments

- Extended MilitaryAircraft model with nic and nac_p nullable Integer fields and Alembic migration applied to live DB
- Implemented aggregate_jamming_cells() pure function using H3 res-5 grouping with gpsjam.org bad_ratio formula
- Built complete GPS jamming pipeline: daily RQ task reads military aircraft, aggregates to H3 cells, upserts to gps_jamming_cells
- Exposed GET /api/gps-jamming returning { cells: [...] } with severity green/yellow/red
- Extended Zustand store layers with gpsJamming: false and streetTraffic: false for Plans 03 and 04 to consume without conflicts
- All 7 test_gps_jamming.py tests GREEN

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend MilitaryAircraft model, Alembic migration, ingest update, gps_jamming backend** - `85ad241` (feat)
2. **Task 2: GPS Jamming API route, main.py registration, store extension** - `d8ffc02` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `backend/app/models/gps_jamming.py` - GpsJammingCell SQLAlchemy model for gps_jamming_cells table
- `backend/app/tasks/ingest_gps_jamming.py` - aggregate_jamming_cells() + ingest_gps_jamming() + sync_aggregate_gps_jamming() RQ task
- `backend/app/api/routes_gps_jamming.py` - GET /api/gps-jamming FastAPI route
- `backend/alembic/versions/e1f2a3b4c5d6_add_nic_nacp_and_gps_jamming_cells.py` - Migration: nic/nac_p columns + gps_jamming_cells table
- `backend/app/models/military_aircraft.py` - Added nic and nac_p Integer columns
- `backend/app/tasks/ingest_military.py` - parse_military_aircraft() returns nic/nac_p; upsert includes them
- `backend/app/main.py` - Registered gps_jamming_router at /api/gps-jamming
- `backend/alembic/env.py` - Added gps_jamming model import for autogenerate support
- `backend/requirements.txt` - Added h3>=4.4.2
- `frontend/src/store/useAppStore.ts` - Layers type and default extended with gpsJamming: false, streetTraffic: false

## Decisions Made

- Used OR logic for is_bad classification: either nic < 7 OR nac_p < 8 triggers bad — one degraded metric is sufficient evidence of GPS interference
- Both nic=None AND nac_p=None treated as GOOD (missing data ≠ jamming signal; per gpsjam.org methodology)
- bad_ratio formula subtracts 1 from bad count: max(0.0, (bad-1)/total) — reduces false positives from isolated single-aircraft anomalies
- Severity thresholds match gpsjam.org: red >= 0.3, yellow >= 0.1, green < 0.1
- gpsJamming and streetTraffic layer keys default false — user opt-in, same pattern as militaryAircraft and ships

## Deviations from Plan

None — plan executed exactly as written.

Note: h3 library was not yet installed in the Homebrew Python 3.11 environment used for tests. Installed it with pip before running tests (Rule 3 — blocking dependency). This is a local dev environment setup step, not a code deviation.

## Issues Encountered

- **pre-existing failure:** test_military_detail returns 200 instead of 404 for unknown hex — confirmed pre-existing via git stash. Logged to deferred-items.md. Not caused by Plan 02 changes.
- **Python environment:** System anaconda Python has SQLAlchemy 1.4.x (too old); tests use Homebrew Python 3.11 with SQLAlchemy 2.0.48. Consistent with how prior plans ran tests.

## Next Phase Readiness

- /api/gps-jamming is live and returns 200 with { cells: [] } (empty until first ingest run)
- Zustand store has gpsJamming and streetTraffic keys ready for Plan 03 (GpsJammingLayer) and Plan 04 (StreetTrafficLayer)
- Plan 03 can begin immediately — no blockers

---
*Phase: 09-gps-jamming-street-traffic*
*Completed: 2026-03-12*
