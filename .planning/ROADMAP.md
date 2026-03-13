# Roadmap: OpenSignal Globe

## Milestones

- ✅ **v1.0 MVP** — Phases 1-6 (shipped 2026-03-11) — [Archive](milestones/v1.0-ROADMAP.md)
- ✅ **v2.0 WorldView Parity** — Phases 7-12 (shipped 2026-03-12) — [Archive](milestones/v2.0-ROADMAP.md)
- ✅ **v3.0 UI Refinement** — Phases 13-16 (shipped 2026-03-13) — [Archive](milestones/v3.0-ROADMAP.md)
- 🔄 **v4.0 Data Reliability & Freshness** — Phases 17-22 (in progress)

## Phases

<details>
<summary>✅ v1.0 MVP (Phases 1-6) — SHIPPED 2026-03-11</summary>

- [x] Phase 1: Foundation (3/3 plans) — completed 2026-03-11
- [x] Phase 2: Satellite Layer (4/4 plans) — completed 2026-03-11
- [x] Phase 3: Aircraft Layer (3/3 plans) — completed 2026-03-11
- [x] Phase 4: Controls and Polish (3/3 plans) — completed 2026-03-11
- [x] Phase 5: Performance (3/3 plans) — completed 2026-03-11
- [x] Phase 6: Deploy Hardening (1/1 plan) — completed 2026-03-11

</details>

<details>
<summary>✅ v2.0 WorldView Parity (Phases 7-12) — SHIPPED 2026-03-12</summary>

- [x] Phase 7: Visual Engine + Navigation (5/5 plans) — completed 2026-03-12
- [x] Phase 8: New Data Pipelines — Military + Maritime (6/6 plans) — completed 2026-03-12
- [x] Phase 9: GPS Jamming + Street Traffic (5/5 plans) — completed 2026-03-12
- [x] Phase 10: Snapshot Infrastructure (3/3 plans) — completed 2026-03-12
- [x] Phase 11: Replay Engine (4/4 plans) — completed 2026-03-12
- [x] Phase 12: OSINT Event Correlation (5/5 plans) — completed 2026-03-12

</details>

<details>
<summary>✅ v3.0 UI Refinement (Phases 13-16) — SHIPPED 2026-03-13</summary>

- [x] Phase 13: Collapsible Sidebar Layout (3/3 plans) — completed 2026-03-13
- [x] Phase 14: Entity Icons and Altitude Scaling (4/4 plans) — completed 2026-03-12
- [x] Phase 15: Camera Navigation Controls (3/3 plans) — completed 2026-03-13
- [x] Phase 16: Persistent Settings Panel (3/3 plans) — completed 2026-03-13

</details>

### v4.0 Data Reliability & Freshness

- [x] **Phase 17: Schema Migration** — Additive Alembic migration adds all freshness columns across four tables (completed 2026-03-13)
- [x] **Phase 18: Shared Freshness Helper** — `app/freshness.py` module and configurable stale thresholds in `Settings` (completed 2026-03-13)
- [x] **Phase 19: Aircraft Ingest + Route** — OpenSky ingest writes all new fields, tombstones absent aircraft, route filters stale rows (completed 2026-03-13)
- [x] **Phase 20: Military, Ships, and Jamming Ingest** — Ingest workers for all three remaining sources gain freshness lifecycle columns and tombstone passes (completed 2026-03-13)
- [x] **Phase 21: API Route Filtering** — Military, ships, and GPS jamming routes gain stale filtering and freshness response envelopes (completed 2026-03-13)
- [ ] **Phase 22: Tests** — Full test coverage for freshness behavior, stale filtering, route contracts, and ingest correctness

## Phase Details

### Phase 17: Schema Migration
**Goal**: All four PostgreSQL tables hold the freshness columns the rest of the milestone depends on
**Depends on**: Phase 16 (v3.0 complete)
**Requirements**: MIG-01
**Success Criteria** (what must be TRUE):
  1. Running `alembic upgrade head` on a fresh Docker Compose stack applies without error
  2. `aircraft` table has `time_position`, `geo_altitude`, `vertical_rate`, `position_source`, `fetched_at`, `last_seen_at`, `is_active` columns visible in `\d aircraft`
  3. `military_aircraft`, `ships`, and `gps_jamming_cells` tables each have their respective freshness columns visible in schema inspection
  4. All existing rows have `is_active = true` immediately after migration (no backfill UPDATE required)
  5. Migration file is hand-written with no autogenerate — `position_snapshots` partition child tables are not dropped
**Plans**: 1 plan
Plans:
- [ ] 17-01-PLAN.md — Hand-written Alembic migration + 4 model updates + test scaffold

### Phase 18: Shared Freshness Helper
**Goal**: A reusable, testable freshness module exists and all stale thresholds are configurable via environment variables
**Depends on**: Phase 17
**Requirements**: FRESH-01, FRESH-02
**Success Criteria** (what must be TRUE):
  1. `from app.freshness import stale_cutoff, is_stale` imports without error from any route or worker file
  2. `stale_cutoff(120)` returns a timezone-aware datetime exactly 120 seconds before `datetime.now(UTC)`
  3. Setting `AIRCRAFT_STALE_SECONDS=300` in the environment changes the aircraft threshold without a code change
  4. `Settings` class exposes `AIRCRAFT_STALE_SECONDS`, `MILITARY_STALE_SECONDS`, `SHIP_STALE_SECONDS`, `GPS_JAMMING_STALE_SECONDS` with correct defaults (120, 600, 900, 600)
**Plans**: 1 plan
Plans:
- [ ] 18-01-PLAN.md — freshness.py module + Settings extension + unit tests (TDD)

### Phase 19: Aircraft Ingest + Route
**Goal**: Commercial aircraft data is honest — stale positions are excluded from the API, and richer OpenSky fields are stored and returned
**Depends on**: Phase 18
**Requirements**: ACFT-01, ACFT-02, ACFT-03
**Success Criteria** (what must be TRUE):
  1. After an ingest run, each aircraft row has `fetched_at` set to the OpenSky response `time` value and `last_seen_at` set to the ingest timestamp
  2. Aircraft rows absent from the latest OpenSky snapshot have `is_active = false` in the database after that ingest cycle
  3. `GET /api/aircraft` returns no rows with `fetched_at` older than `AIRCRAFT_STALE_SECONDS`
  4. Each aircraft in the response includes `time_position`, `fetched_at`, `is_stale`, and `position_age_seconds` fields
  5. Existing response keys (`icao24`, `callsign`, `latitude`, `longitude`, `baro_altitude`, `velocity`, `true_track`, `trail`) are all still present and unchanged
**Plans**: 2 plans
Plans:
- [ ] 19-01-PLAN.md — Ingest pipeline: new field parsing, fetched_at/last_seen_at, tombstone sweep (ACFT-01, ACFT-02)
- [ ] 19-02-PLAN.md — Route freshness filter and new response fields (ACFT-03)

### Phase 20: Military, Ships, and Jamming Ingest
**Goal**: Military aircraft, ships, and GPS jamming cells all track lifecycle state — active entities write freshness timestamps, absent entities are tombstoned
**Depends on**: Phase 19
**Requirements**: MIL-01, SHIP-01, JAM-01
**Success Criteria** (what must be TRUE):
  1. After each 300s military poll cycle, aircraft absent from the response have `is_active = false` in `military_aircraft`
  2. After each AIS batch flush, ships not present in the current flush have `is_active = false` in `ships` — bridging Redis TTL expiry to PostgreSQL
  3. GPS jamming ingest only aggregates rows where `military_aircraft.is_active = true`
  4. Every GPS jamming cell row written includes `aggregated_at`, `source_fetched_at`, and `source_is_stale` values from the current aggregation cycle
**Plans**: 3 plans
Plans:
- [ ] 20-01-PLAN.md — Military ingest: fetched_at/last_seen_at/is_active upsert + tombstone sweep (MIL-01)
- [ ] 20-02-PLAN.md — AIS batch flush: last_seen_at/is_active upsert + deactivation sweep + parse_time_utc helper (SHIP-01)
- [ ] 20-03-PLAN.md — GPS jamming: is_active filter + aggregated_at/source_fetched_at/source_is_stale metadata (JAM-01)

### Phase 21: API Route Filtering
**Goal**: All four list endpoints only return fresh, active entities — and every response tells the caller exactly how fresh the data is
**Depends on**: Phase 20
**Requirements**: MIL-02, SHIP-02, JAM-02, JAM-03
**Success Criteria** (what must be TRUE):
  1. `GET /api/military` returns no rows where `is_active = false` or `fetched_at` is older than `MILITARY_STALE_SECONDS`
  2. `GET /api/ships` returns no rows where `is_active = false` or `last_seen_at` is older than `SHIP_STALE_SECONDS`
  3. `GET /api/gps-jamming` response envelope includes `aggregated_at`, `source_fetched_at`, and `source_is_stale` at the top level
  4. When military source data is stale, `GET /api/gps-jamming` returns cells with `source_is_stale = true` rather than an empty set
  5. Existing response keys for all three endpoints are preserved — no previously-returned field is removed or renamed
**Plans**: 3 plans
Plans:
- [ ] 21-01-PLAN.md — Failing tests for MIL-02, SHIP-02, JAM-02, JAM-03 (TDD Wave 0)
- [ ] 21-02-PLAN.md — Military and ships routes: active+freshness filter + response fields (MIL-02, SHIP-02)
- [ ] 21-03-PLAN.md — GPS jamming route: freshness envelope metadata (JAM-02, JAM-03)

### Phase 22: Tests
**Goal**: Every freshness and stale-filtering behavior introduced in this milestone is verified by an automated test
**Depends on**: Phase 21
**Requirements**: TEST-01, TEST-02, TEST-03, TEST-04, TEST-05, TEST-06, TEST-07
**Success Criteria** (what must be TRUE):
  1. Running `pytest` passes 100% — all new tests green, all pre-existing happy-path contracts still pass
  2. A test confirms that aircraft rows with stale `time_position` are excluded from `/api/aircraft`, with fallback to `last_contact` when `time_position` is null
  3. A test confirms `geo_altitude`, `vertical_rate`, and `position_source` are stored by ingest and returned in the aircraft response
  4. Tests confirm stale row exclusion independently for `/api/military` and `/api/ships`
  5. A test asserts `source_is_stale = true` appears in the GPS jamming response when source military data is stale
  6. Unit tests for `freshness.py` cover the stale cutoff boundary, `is_stale` true/false transition, and clock mock behavior
**Plans**: 3 plans
Plans:
- [ ] 22-01-PLAN.md — Military and ships stale/inactive exclusion tests (TEST-03, TEST-04)
- [ ] 22-02-PLAN.md — Aircraft geo_altitude route addition + test; GPS jamming source_is_stale DB test (TEST-02, TEST-05)
- [ ] 22-03-PLAN.md — Full suite verification: TEST-01, TEST-06, TEST-07 regression gate + human checkpoint

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Foundation | v1.0 | 3/3 | Complete | 2026-03-11 |
| 2. Satellite Layer | v1.0 | 4/4 | Complete | 2026-03-11 |
| 3. Aircraft Layer | v1.0 | 3/3 | Complete | 2026-03-11 |
| 4. Controls and Polish | v1.0 | 3/3 | Complete | 2026-03-11 |
| 5. Performance | v1.0 | 3/3 | Complete | 2026-03-11 |
| 6. Deploy Hardening | v1.0 | 1/1 | Complete | 2026-03-11 |
| 7. Visual Engine + Navigation | v2.0 | 5/5 | Complete | 2026-03-12 |
| 8. Military + Maritime Pipelines | v2.0 | 6/6 | Complete | 2026-03-12 |
| 9. GPS Jamming + Street Traffic | v2.0 | 5/5 | Complete | 2026-03-12 |
| 10. Snapshot Infrastructure | v2.0 | 3/3 | Complete | 2026-03-12 |
| 11. Replay Engine | v2.0 | 4/4 | Complete | 2026-03-12 |
| 12. OSINT Event Correlation | v2.0 | 5/5 | Complete | 2026-03-12 |
| 13. Collapsible Sidebar Layout | v3.0 | 3/3 | Complete | 2026-03-13 |
| 14. Entity Icons and Altitude Scaling | v3.0 | 4/4 | Complete | 2026-03-12 |
| 15. Camera Navigation Controls | v3.0 | 3/3 | Complete | 2026-03-13 |
| 16. Persistent Settings Panel | v3.0 | 3/3 | Complete | 2026-03-13 |
| 17. Schema Migration | v4.0 | 1/1 | Complete | 2026-03-13 |
| 18. Shared Freshness Helper | v4.0 | 1/1 | Complete | 2026-03-13 |
| 19. Aircraft Ingest + Route | v4.0 | 2/2 | Complete | 2026-03-13 |
| 20. Military, Ships, and Jamming Ingest | v4.0 | 3/3 | Complete | 2026-03-13 |
| 21. API Route Filtering | v4.0 | 3/3 | Complete | 2026-03-13 |
| 22. Tests | v4.0 | 0/3 | Not started | - |
