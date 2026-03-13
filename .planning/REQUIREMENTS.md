# Requirements: OpenSignal Globe

**Defined:** 2026-03-13
**Core Value:** A unified, visually impressive intelligence picture — satellites orbiting, aircraft moving, anomalies surfacing — all rendered on one polished 3D globe that feels operational and modern.

## v4.0 Requirements

Requirements for v4.0 Data Reliability & Freshness milestone.

### Schema & Configuration

- [x] **MIG-01**: Alembic hand-written migration adds `is_active`, `fetched_at`, `last_seen_at`, `time_position`, `geo_altitude`, `vertical_rate`, `position_source` to `aircraft`; `fetched_at`, `last_seen_at`, `is_active` to `military_aircraft`; `last_seen_at`, `is_active` to `ships`; `aggregated_at`, `source_fetched_at`, `source_is_stale` to `gps_jamming_cells` — all with safe `server_default`/nullable settings, hand-written only (no autogenerate)
- [x] **FRESH-01**: New `app/freshness.py` module provides `stale_cutoff(threshold_s) -> datetime` and `is_stale(ts, threshold_s) -> bool` reused by all routes
- [x] **FRESH-02**: `Settings` class gains `AIRCRAFT_STALE_SECONDS` (120), `MILITARY_STALE_SECONDS` (600), `SHIP_STALE_SECONDS` (900), `GPS_JAMMING_STALE_SECONDS` (600) with automatic env var coercion via pydantic-settings

### Commercial Aircraft (OpenSky)

- [x] **ACFT-01**: `ingest_aircraft.py` parses `sv[3]` → `time_position`, `sv[11]` → `vertical_rate`, `sv[13]` → `geo_altitude`, `sv[16]` → `position_source` with `len(sv) > N` guards; all written explicitly in upsert `set_={}` dict
- [x] **ACFT-02**: Aircraft ingest writes `fetched_at` (OpenSky response `time`), `last_seen_at` (ingest time), sets `is_active=True` for seen rows; tombstone pass marks absent rows `is_active=False` in same commit
- [x] **ACFT-03**: `/api/aircraft` filters to `is_active=True AND fetched_at >= stale_cutoff`; response includes `time_position`, `fetched_at`, `is_stale`, `position_age_seconds`; freshness falls back from `time_position` to `last_contact` when `time_position` is null; existing keys (`icao24`, `callsign`, `latitude`, `longitude`, `baro_altitude`, `velocity`, `true_track`, `trail`) preserved

### Military Aircraft (airplanes.live)

- [x] **MIL-01**: `military_aircraft` model gains `fetched_at`, `last_seen_at`, `is_active`; ingest marks seen rows active and writes `fetched_at`/`last_seen_at` explicitly in `set_={}`; tombstone pass marks absent rows `is_active=False` after each 300s poll
- [x] **MIL-02**: `/api/military` filters to `is_active=True AND fetched_at >= stale_cutoff`; response includes `fetched_at`, `is_stale`; existing keys (`hex`, `flight`, `aircraft_type`, `alt_baro`, `gs`, `track`, `lat`, `lon`, `squawk`) preserved

### Ships (aisstream.io)

- [x] **SHIP-01**: `ships` model gains `last_seen_at` (typed TIMESTAMPTZ parsed from `time_utc`) and `is_active`; `batch_flush_ships_to_pg` gains deactivation sweep marking ships not seen in current flush as `is_active=False`, bridging Redis TTL expiry to PostgreSQL
- [x] **SHIP-02**: `/api/ships` filters to `is_active=True AND last_seen_at >= stale_cutoff`; response includes `last_seen_at`, `fetched_at`, `is_stale`; existing keys preserved

### GPS Jamming

- [x] **JAM-01**: `ingest_gps_jamming.py` filters source military rows to `is_active=True` before aggregation; writes `aggregated_at`, `source_fetched_at`, `source_is_stale` to every cell in the batch
- [x] **JAM-02**: `/api/gps-jamming` response envelope includes `aggregated_at`, `source_fetched_at`, `source_is_stale`
- [x] **JAM-03**: When military source data is stale, cells are returned with `source_is_stale=true` (not an empty set); behavior documented in a code comment and covered by a dedicated test

### Tests

- [ ] **TEST-01**: Aircraft rows with stale `time_position` excluded from `/api/aircraft`; fallback from `time_position` to `last_contact` when `time_position` is null
- [ ] **TEST-02**: Aircraft `geo_altitude`, `vertical_rate`, `position_source` stored by ingest and returned in response
- [ ] **TEST-03**: Military stale rows excluded from `/api/military`
- [ ] **TEST-04**: Ships stale rows excluded from `/api/ships`
- [ ] **TEST-05**: GPS jamming response includes freshness metadata; `source_is_stale=true` when military data is stale
- [ ] **TEST-06**: `freshness.py` unit tests — stale cutoff boundary, `is_stale` true/false, clock mock behavior
- [ ] **TEST-07**: Existing happy-path contracts for `/api/aircraft`, `/api/military`, `/api/ships`, `/api/gps-jamming` still work after all changes

## Future Requirements

### v4.1 (Deferred)

- **VIS-01**: Frontend visual indicator for stale entities (grey-out, opacity reduction, or "STALE" badge) — deferred from v4.0; backend freshness flags will be available
- **FRESH-03**: `/api/military/freshness` and `/api/ships/freshness` dedicated freshness endpoints — parallel to existing `/api/aircraft/freshness`

### v5.0+ (Deferred)

- **AIS-SAT-01**: Satellite AIS staleness handling with separate `is_satellite_ais` flag and extended threshold — satellite relay has inherent multi-hour gaps
- **VIS-02**: `position_source` string label rendered in frontend detail panel ("ADS-B", "MLAT", "FLARM")
- **HIST-01**: Per-entity staleness history (how often stale in last 24h)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Switch providers | OpenSky/airplanes.live/aisstream.io/CelesTrak are correct choices — no switching this milestone |
| Rename existing response keys | Backward compatibility required — only additive fields allowed |
| Hard-delete stale rows | Breaks replay engine and detail endpoints — soft expiry only |
| Frontend stale visual indicators | Deferred to v4.1; backend flags ready but UI work is separate milestone |
| Earthquake layer (USGS) | Deferred from v3.0 — not in this milestone scope |
| Weather radar (NOAA) | Deferred from v3.0 — not in this milestone scope |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| MIG-01 | Phase 17 | Complete |
| FRESH-01 | Phase 18 | Complete |
| FRESH-02 | Phase 18 | Complete |
| ACFT-01 | Phase 19 | Complete |
| ACFT-02 | Phase 19 | Complete |
| ACFT-03 | Phase 19 | Complete |
| MIL-01 | Phase 20 | Complete |
| SHIP-01 | Phase 20 | Complete |
| JAM-01 | Phase 20 | Complete |
| MIL-02 | Phase 21 | Complete |
| SHIP-02 | Phase 21 | Complete |
| JAM-02 | Phase 21 | Complete |
| JAM-03 | Phase 21 | Complete |
| TEST-01 | Phase 22 | Pending |
| TEST-02 | Phase 22 | Pending |
| TEST-03 | Phase 22 | Pending |
| TEST-04 | Phase 22 | Pending |
| TEST-05 | Phase 22 | Pending |
| TEST-06 | Phase 22 | Pending |
| TEST-07 | Phase 22 | Pending |

**Coverage:**
- v4.0 requirements: 20 total
- Mapped to phases: 20
- Unmapped: 0 ✓

---
*Requirements defined: 2026-03-13*
*Last updated: 2026-03-13 — traceability updated after v4.0 roadmap creation*
