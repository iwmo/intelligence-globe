# Requirements: OpenSignal Globe

**Defined:** 2026-03-15
**Core Value:** A unified, visually impressive intelligence picture — satellites orbiting, aircraft moving, anomalies surfacing — all rendered on one polished 3D globe that feels operational and modern.

## v10.0 Requirements

Replace OpenSky Network + airplanes.live with ADSB.lol re-API as the single aircraft data source. Unlocks richer telemetry, no credit limits, and consolidates commercial + military ingest.

### Ingest

- [x] **INGEST-01**: System ingests commercial aircraft positions from ADSB.lol `?all_with_pos` endpoint, replacing OpenSky Network
- [x] **INGEST-02**: System ingests military aircraft from ADSB.lol `?all_with_pos&filter_mil`, replacing airplanes.live `/v2/mil`
- [x] **INGEST-03**: ADSB.lol base URL is configurable via `ADSBIO_BASE_URL` env var; no API key or OAuth2 flow required
- [x] **INGEST-04**: OpenSky OAuth2 token fetch, credit budget tracking, and rate-limit retry logic are removed from the codebase
- [x] **INGEST-05**: Viewport bounding box optimisation uses ADSB.lol `?box=<lat_s>,<lat_n>,<lon_w>,<lon_e>` parameter (retaining VPC-08 suppression in replay mode)

### Schema

- [x] **SCHEMA-01**: Aircraft altitude fields stored in feet natively (ADSB.lol native unit); OpenSky metres-to-feet conversion removed
- [x] **SCHEMA-02**: Aircraft record stores `emergency` VARCHAR field (values: none/general/lifeguard/minfuel/nordo/unlawful/downed)
- [x] **SCHEMA-03**: Aircraft record stores `nav_modes` JSONB array (values from: autopilot/vnav/althold/approach/lnav/tcas)
- [x] **SCHEMA-04**: Aircraft record stores `ias` (indicated airspeed kn), `tas` (true airspeed kn), `mach` (Mach number) FLOAT fields
- [x] **SCHEMA-05**: Aircraft record stores `roll` FLOAT field (degrees; negative = left bank)
- [x] **SCHEMA-06**: Aircraft record stores `registration` VARCHAR and `type_code` VARCHAR from ADSB.lol `r` and `t` fields

### UI

- [x] **UI-01**: Aircraft detail panel displays emergency status; shows a visible alert badge when value is not "none"
- [x] **UI-02**: Aircraft detail panel displays active nav modes as chips (autopilot, VNAV, LNAV, TCAS, etc.)
- [x] **UI-03**: Aircraft detail panel displays IAS, TAS, and Mach number when available
- [x] **UI-04**: Aircraft globe billboard icon applies a rotation (roll) transform using the `roll` field when available

## Future Requirements

### Deferred from Previous Milestones

- **FRESH-03**: Dedicated freshness endpoints `/api/military/freshness` and `/api/ships/freshness` (deferred from v4.0)
- **LAY-05**: Earthquake layer — USGS 24h GeoJSON feed, magnitude-scaled markers
- **LAY-06**: Weather radar overlay — NOAA NEXRAD WMS tiles on globe
- **KYBD-01**: Keyboard shortcuts: Space for play/pause, L for LIVE/PLAYBACK toggle (deferred from v5.0)
- **LIVE-02**: Replay speed readout ("60×") beside timestamp in CinematicHUD (deferred from v5.0)
- **LIVE-03**: Replay window time-range labels at scrubber track ends (deferred from v5.0)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Merging commercial + military into one DB table | Separate tables match separate globe layers; schema merge would require significant frontend refactor with no user benefit |
| ADSB.lol ship/vessel data | AIS layer already covered by aisstream.io WebSocket; adding a second source creates dedup complexity |
| Historical trace JSON from ADSB.lol | Already handled by existing snapshot infrastructure |
| Real-time chat or collaboration | Single-user tool |
| Mobile app | Web-first |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| INGEST-01 | Phase 38 | Complete |
| INGEST-02 | Phase 38 | Complete |
| INGEST-03 | Phase 38 | Complete |
| INGEST-04 | Phase 38 | Complete |
| INGEST-05 | Phase 38 | Complete |
| SCHEMA-01 | Phase 38 | Complete |
| SCHEMA-02 | Phase 38 | Complete |
| SCHEMA-03 | Phase 38 | Complete |
| SCHEMA-04 | Phase 38 | Complete |
| SCHEMA-05 | Phase 38 | Complete |
| SCHEMA-06 | Phase 38 | Complete |
| UI-01 | Phase 39 | Complete |
| UI-02 | Phase 39 | Complete |
| UI-03 | Phase 39 | Complete |
| UI-04 | Phase 39 | Complete |

**Coverage:**
- v10.0 requirements: 15 total
- Mapped to phases: 15
- Unmapped: 0 ✓

---
*Requirements defined: 2026-03-15*
*Last updated: 2026-03-15 after v10.0 roadmap creation*
