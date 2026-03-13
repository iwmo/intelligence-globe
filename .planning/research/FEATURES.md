# Feature Research

**Domain:** Data freshness metadata and stale-position handling in real-time geospatial tracking APIs
**Researched:** 2026-03-13
**Confidence:** HIGH (industry sources, official API docs, protocol standards verified)

---

## Context: What Already Exists

This is a subsequent milestone research file (v4.0). The following are already built and out of scope for this research:

- Aircraft layer: OpenSky polling (90s), PostgreSQL upsert, trail column, `/api/aircraft`
- Military layer: airplanes.live /v2/mil, 300s cadence, `/api/military`
- AIS ships: aisstream.io WebSocket, Redis TTL (600s), 30s PG flush, `/api/ships`
- GPS jamming: H3 hexagon aggregation from military NIC/NACp, daily cadence triggered on each military ingest, `/api/gps-jamming`
- Snapshot infrastructure: 60s time-partitioned PostgreSQL, 7-day retention
- `/api/aircraft/freshness`: already exists, returns `max(updated_at)` across all aircraft rows

Current gap: API layer returns `updated_at` (server write time) but nothing about the data's own internal age. No `is_active` lifecycle column, no `is_stale` derived field, no `position_age_seconds`, no `fetched_at` capturing the upstream source timestamp. List endpoints return all rows regardless of when the entity was last seen — dead aircraft appear as live.

---

## Industry Conventions: Staleness Thresholds

### Aircraft (ADS-B / OpenSky) — HIGH confidence

OpenSky's own staleness rule (verified from official docs):
- `time_position` is set to `null` when no position report was received in the **last 15 seconds** — OpenSky itself treats positions older than 15s as unreliable
- `last_contact` (last any transponder message) keeps the state vector alive for up to **300 seconds** after loss of contact — a row stays in the OpenSky response for up to 5 minutes after the aircraft stops transmitting
- OpenSky response-level `time` field: Unix epoch integer of when the snapshot was taken — distinct from per-aircraft timestamps

Downstream conventions for applications consuming OpenSky (MEDIUM confidence — community practice):
- < 60s since last contact: treat as live
- 60–300s: treat as stale; display with visual indicator
- > 300s: treat as expired; exclude from list endpoints

This project's poll interval is 90s. Any aircraft absent from two consecutive polls is absent for at least 180s and should be considered expired. The `updated_at` column already encodes this: aircraft not upserted in > 180s has not appeared in any recent OpenSky response.

### Military Aircraft (ADS-B via airplanes.live) — HIGH confidence

Poll interval: 300s. airplanes.live returns a full current snapshot of all tracked military aircraft. Absence from a response means the aircraft is off radar. Practical threshold: **not updated in 600s (two missed polls)** = expired. `updated_at` encodes this directly.

### Maritime (AIS) — HIGH confidence, ITU-R M.1371-5 standard

Mandatory AIS reporting intervals per vessel class and state:

| Vessel State | Class A | Class B-SO | Class B-CS |
|---|---|---|---|
| Underway < 14 kn | 10s | 30s | 30s |
| Underway 14-23 kn | 6s | 15s | 30s |
| Underway > 23 kn | 2s | 5s | 30s |
| Anchored / stopped | 3 min | 3 min | 3 min |

Practical staleness thresholds from production maritime trackers (MEDIUM confidence):
- DataHub/PredictWind OTA AIS: 3-minute TTL (180s); 2-minute fallback (120s) for freshness determination
- MarineTraffic platform: downsamples to 60s per MMSI; removes vessel from live map after 24 hours without update
- This project's Redis TTL: **600s (10 min)** — ships absent from aisstream.io for 10 min drop from Redis, meaning the PG row may persist but the Redis position is gone. The gap between Redis TTL (600s) and PG row persistence is the current staleness blind spot.

Practical rule for this project: ship rows with `updated_at` older than **600s** are stale; older than **3600s (1 hour)** should be considered inactive (`is_active = false`).

Satellite AIS note: vessels in remote ocean areas may have AIS gaps of hours to days — satellite relay has inherently different freshness profile than terrestrial AIS. Do not apply the same threshold to both.

### GPS Jamming Cells — HIGH confidence (derived layer, not live telemetry)

GPS jamming is aggregated from military aircraft NIC/NACp data, not a direct sensor feed. It runs after each military ingest (~300s) and on a daily schedule. "Staleness" for this layer means: how old is the source military data that produced these cells? The `updated_at` on each cell captures when the aggregation ran. The real freshness signal is `max(military_aircraft.updated_at)` at aggregation time. Cells do not expire individually; the entire layer is replaced atomically on each aggregation run.

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features that any honest real-time tracker must provide. Missing these means the globe silently shows dead data as if it were live.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Stale row filtering on list endpoints | List endpoints return all rows regardless of age — dead aircraft appear live. Every production tracker filters by recency. | LOW | `WHERE updated_at > now() - interval 'N seconds'` or `WHERE is_active = true`; thresholds differ per source (aircraft: 300s, military: 600s, ships: 600s) |
| `is_stale` boolean in list and detail responses | Users and frontend code need a computed signal, not raw timestamps — a boolean is unambiguous. AirLabs, OpenSky all use some form of staleness indicator. | LOW | Computed at serialization time from `updated_at` vs threshold; no schema change required if using `updated_at` approach |
| `position_age_seconds` in detail endpoints | Standard derived field — "this position is N seconds old." Used by virtually all aviation/maritime detail panels (FlightAware, MarineTraffic). | LOW | `int((now() - updated_at).total_seconds())`; detail endpoint only, not list payload (too verbose at scale) |
| `fetched_at` column on aircraft table | OpenSky provides a response-level `time` field (Unix epoch) telling when the snapshot was taken — this is semantically distinct from `updated_at` (our PostgreSQL write time). Without it, callers cannot distinguish "fresh data written slowly" from "old data written immediately." | LOW | New column; integer or DateTime; populated from OpenSky `response["time"]`; requires Alembic migration |
| `time_position` column on aircraft table | OpenSky `sv[3]`: when the position fix itself was recorded — may be older than `last_contact`. Null when no position received in last 15s. This is OpenSky's own freshness field and should be stored and surfaced. | LOW | New column; integer Unix seconds; from OpenSky sv[3]; requires Alembic migration |
| `is_active` soft-expiry flag on all entity tables | Enables "recently seen but now inactive" state without hard deletion. Required to keep replay and `/detail` endpoints functional while excluding stale entities from live list endpoints. | MEDIUM | Boolean column default true; ingest sets false when entity absent from response; requires Alembic migration per table |
| Alembic migrations for all schema changes | Without migrations, running containers diverge from new schema on deploy. This project uses Alembic already — all schema changes must go through it. | LOW (mechanical) | One migration per modified table; must be idempotent |

### Differentiators (Competitive Advantage)

Features beyond the baseline that make this platform more honest and informative than typical open-source trackers.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| `geo_altitude` on aircraft schema | OpenSky provides both barometric and GPS-derived geometric altitude. `geo_altitude` (sv[13]) is more accurate for terrain-relative height. Most open-source consumers ignore it. | LOW | Often null; store when present; expose in detail endpoint |
| `vertical_rate` on aircraft schema | Climb/descent rate in m/s (sv[11]). Positive = climbing, negative = descending. Valuable for detail panel ("climbing at 600 ft/min"). Widely available in OpenSky, widely ignored by simple consumers. | LOW | Often populated for airborne aircraft; store from sv[11] |
| `position_source` on aircraft schema | OpenSky sv[16]: 0 = ADS-B, 1 = ASTERIX, 2 = MLAT, 3 = FLARM. Tells the user how trustworthy the position fix is. MLAT positions are computed from arrival time differences and are less accurate than direct ADS-B. | LOW | Store as integer; expose as labeled string ("ADS-B", "MLAT", "FLARM") in API response |
| `last_seen_at` on military and ship tables | Separates when the source last reported this entity from when our batch flush wrote to PG. For AIS, `time_utc` from the aisstream.io message is the true last-seen timestamp; the 30s batch flush makes `updated_at` a coarse approximation. | LOW-MEDIUM | AIS: parse `time_utc` into a typed DateTime column; military: set to `now()` per ingest batch start time |
| Configurable stale thresholds per source in config.py | Aircraft at 90s poll, military at 300s poll, ships via continuous WebSocket — each source has a different natural cadence. Hardcoding a single threshold would be incorrect. A named constant per source in `config.py` is transparent and testable. | LOW | `STALE_THRESHOLD_AIRCRAFT_S = 300`, `STALE_THRESHOLD_MILITARY_S = 600`, `STALE_THRESHOLD_SHIP_S = 600`; no UI required |
| GPS jamming freshness envelope in response | GPS jamming cells are derived data. Expose `aggregated_at` (when the aggregation ran) and `source_data_age_seconds` (seconds since the military aircraft data that built these cells was last updated) in the response envelope. This makes the derived nature transparent. | LOW | `aggregated_at` = `max(cell.updated_at)` query; `source_data_age_seconds` = `now() - max(military_aircraft.updated_at)` at query time; no schema change |
| `/api/military/freshness` and `/api/ships/freshness` endpoints | Parallel to the existing `/api/aircraft/freshness`. Allows frontend to check per-layer data age without parsing the full list. | LOW | Same pattern as existing: `SELECT max(updated_at)` from respective table |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Hard-delete stale rows on ingest | Feels clean — why keep dead aircraft in the database? | Breaks replay engine: `position_snapshots` reference `icao24`/`mmsi` that must remain queryable. Also breaks `/api/aircraft/{icao24}` detail if entity disappears mid-session. Causes FK violations if foreign key constraints are added later. | Use `is_active = false` soft expiry. Never hard-delete live entity rows. |
| Per-request staleness threshold query parameter (`?stale_threshold=120`) | Seems flexible | Adds query complexity, breaks caching, hard to test all threshold combinations, no clear user need — threshold is an operational decision, not a per-request preference. | Single configurable threshold per source in `config.py`; no query parameter. |
| Aggregated cross-layer "data health" score | A single widget showing overall freshness | Misleading — military at 300s cadence and aircraft at 90s cadence have fundamentally different freshness profiles. A blended score hides per-layer state and gives false confidence. | Per-layer freshness endpoints. Frontend shows per-layer last-updated timestamp, not a blended score. |
| Backfilling `time_position` from trail history | "Fix" historical trail entries | Trail entries store `last_contact` (sv[4]) as `ts`, not `time_position` (sv[3]). Retroactive correction requires re-ingesting historical data that no longer exists. The two fields are semantically different. | Store `time_position` correctly going forward only. Document the distinction in code. |
| Real-time push notification when entity goes stale | "Alert me when a tracked aircraft drops off radar" | Requires WebSocket pub/sub channel, client subscription management, and server-side change detection. Disproportionate complexity for a single-user homelab tool. | Frontend polls `/api/aircraft` periodically. Absence of entity `icao24` from the list is the signal. |

---

## Feature Dependencies

```
is_active flag (aircraft table)
    └──requires──> Alembic migration: add is_active Boolean to aircraft
    └──requires──> ingest_aircraft.py: set is_active=false for rows not returned in latest fetch

is_active flag (military_aircraft table)
    └──requires──> Alembic migration: add is_active Boolean to military_aircraft
    └──requires──> ingest_military.py: set is_active=false for rows absent from /v2/mil response

is_active flag (ships table)
    └──requires──> Alembic migration: add is_active Boolean to ships
    └──requires──> ingest_ais.py: set is_active=false after Redis TTL expiry or explicit sweep

time_position + fetched_at + geo_altitude + vertical_rate + position_source (aircraft)
    └──requires──> Alembic migration: add 5 columns to aircraft table
    └──requires──> ingest_aircraft.py: extract sv[3], sv[11], sv[13], sv[16], response["time"]

last_seen_at (military_aircraft)
    └──requires──> Alembic migration: add last_seen_at DateTime to military_aircraft
    └──requires──> ingest_military.py: set last_seen_at = now() at fetch start time

last_seen_at (ships)
    └──requires──> Alembic migration: add last_seen_at DateTime to ships
    └──requires──> ingest_ais.py: parse time_utc into typed DateTime for last_seen_at

Stale row filtering in list endpoints
    └──depends on──> is_active column (preferred) OR updated_at threshold (fallback)
    └──depends on──> configurable stale thresholds in config.py

is_stale + position_age_seconds in responses
    └──no schema change required — computed from updated_at at serialization time
    └──depends on──> configurable stale thresholds in config.py (to define the is_stale boundary)

GPS jamming freshness envelope
    └──no schema change required
    └──requires──> routes_gps_jamming.py: compute and return aggregated_at, source_data_age_seconds

Tests
    └──requires──> all schema changes and route changes be in place
    └──requires──> controlled updated_at fixtures (use freezegun or direct datetime injection)
```

### Dependency Notes

- **is_active vs updated_at filtering:** Both approaches work. `is_active` is cleaner as an API contract (the route filter is `WHERE is_active = true`, independent of threshold), but requires the ingest to actively maintain the flag. `updated_at` threshold filtering requires no ingest change but couples threshold logic into route WHERE clauses. Recommended: `is_active` column — it is the industry standard (soft-expiry) pattern and decouples the "is this entity live" question from the "how long ago was it seen" question.
- **fetched_at vs updated_at distinction:** `fetched_at` = OpenSky response `time` field (when OpenSky snapshotted the data). `updated_at` = PostgreSQL write time. For aircraft at 90s polling, the difference is typically 1–5s. Small but semantically important: `fetched_at` answers "when did OpenSky see this aircraft?", `updated_at` answers "when did we process it?". Only aircraft gets `fetched_at`; airplanes.live and aisstream.io do not expose an equivalent source-level response timestamp.
- **GPS jamming source_data_age_seconds:** This requires a JOIN or subquery at request time: `SELECT now() - max(updated_at) FROM military_aircraft`. A separate query per `/api/gps-jamming` request; O(1) cost, no schema change needed.
- **Ship last_seen_at type:** The current `last_update` column on ships is a String (storing `time_utc` as raw string). The new `last_seen_at` should be `DateTime(timezone=True)` for correct comparison arithmetic. The migration adds the new typed column; `last_update` can remain for backwards compatibility during transition.

---

## MVP Definition

### Launch With (v4.0 — this milestone)

All items below are required for the "data reliability" milestone to be substantive rather than cosmetic.

- [ ] Alembic migration: add `time_position`, `geo_altitude`, `vertical_rate`, `position_source`, `fetched_at`, `is_active` to `aircraft` table
- [ ] Alembic migration: add `last_seen_at`, `is_active` to `military_aircraft` table
- [ ] Alembic migration: add `last_seen_at`, `is_active` to `ships` table
- [ ] `ingest_aircraft.py`: extract and store sv[3] (time_position), sv[11] (vertical_rate), sv[13] (geo_altitude), sv[16] (position_source), response["time"] (fetched_at)
- [ ] `ingest_military.py`: set `last_seen_at = now()` at batch start; identify rows absent from current response and set `is_active = false`
- [ ] `ingest_ais.py`: propagate `time_utc` as typed `last_seen_at`; mechanism to mark `is_active = false` after Redis TTL expiry
- [ ] `/api/aircraft` list: filter `WHERE is_active = true`; add `is_stale` and `position_age_seconds` to each item
- [ ] `/api/military` list: filter stale rows; add `is_stale` and `position_age_seconds`
- [ ] `/api/ships` list: filter stale rows; add `is_stale` and `position_age_seconds`
- [ ] `/api/gps-jamming`: add `aggregated_at` and `source_data_age_seconds` to response envelope
- [ ] Configurable stale thresholds per source in `config.py` (not magic numbers in routes)
- [ ] Tests: stale row excluded from list, fresh row included, `is_stale` correct, `position_age_seconds` within expected range, new OpenSky fields stored correctly

### Add After Validation (v4.x)

- [ ] `/api/military/freshness` endpoint — parallel to existing `/api/aircraft/freshness`
- [ ] `/api/ships/freshness` endpoint
- [ ] Frontend visual indicator for stale entities (grey-out, opacity reduction, or "STALE" badge in detail panel) — deferred; not in v4.0

### Future Consideration (v5+)

- [ ] Satellite AIS handling with longer staleness windows (satellite relay has hours-long gaps by design; a separate `is_satellite_ais` flag would allow different threshold application)
- [ ] `position_source` string label rendered in frontend detail panel ("ADS-B", "MLAT", "FLARM")
- [ ] Per-entity staleness history (how often has this aircraft been stale in the last 24h)

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Stale row filtering on list endpoints | HIGH | LOW | P1 |
| `is_stale` + `position_age_seconds` in responses | HIGH | LOW | P1 |
| Aircraft: `time_position`, `fetched_at` columns | HIGH | LOW | P1 |
| Aircraft: `vertical_rate`, `geo_altitude` columns | MEDIUM | LOW | P1 |
| Aircraft: `position_source` column | MEDIUM | LOW | P1 |
| `is_active` lifecycle flag (all tables) | HIGH | MEDIUM | P1 |
| Military `last_seen_at` | MEDIUM | LOW | P1 |
| Ship `last_seen_at` (typed DateTime) | MEDIUM | LOW | P1 |
| GPS jamming freshness envelope | MEDIUM | LOW | P1 |
| Configurable thresholds in config.py | MEDIUM | LOW | P1 |
| Alembic migrations for all changes | HIGH (correctness) | LOW (mechanical) | P1 |
| Tests covering all stale/freshness behavior | HIGH (regression safety) | MEDIUM | P1 |
| `/api/military/freshness` endpoint | LOW | LOW | P2 |
| `/api/ships/freshness` endpoint | LOW | LOW | P2 |
| Frontend stale visual indicator | MEDIUM | MEDIUM | P2 |

**Priority key:**
- P1: Must have for v4.0 — defines the data reliability tier
- P2: Ship in v4.1 once core behavior is validated
- P3: Future milestone

---

## Reference System Comparison

| Feature | OpenSky (source API) | MarineTraffic (maritime reference) | AirLabs (aviation reference) | This Project (v4.0 target) |
|---------|----------------------|-------------------------------------|-----------------------------|---------------------------|
| Position timestamp | `time_position` (Unix int, null if > 15s stale) | Not exposed | `updated` (Unix timestamp) | Store `time_position`; expose `position_age_seconds` derived |
| Staleness signal | `time_position = null` when > 15s; state vector retained 300s | Remove from live map after 24h silence | No explicit stale flag; caller computes from `updated` | Explicit `is_stale` boolean in all list responses |
| Source type | `position_source` (0=ADS-B, 1=ASTERIX, 2=MLAT, 3=FLARM) | Not exposed | Not exposed | Store and expose `position_source` as labeled string |
| Soft expiry | Not applicable (OpenSky only returns currently tracked) | 24h hard remove | Not applicable | `is_active` boolean; soft expiry; no hard delete |
| Fetch timestamp | Response-level `time` field (Unix epoch of snapshot) | Not exposed | Not exposed | `fetched_at` column on aircraft; `aggregated_at` for GPS jamming |
| Configurable threshold | Hardcoded (15s position, 300s state vector) | Not applicable | Not applicable | Per-source in `config.py` |

---

## Sources

- [OpenSky Network REST API documentation](https://openskynetwork.github.io/opensky-api/rest.html) — `time_position`, `last_contact`, `geo_altitude`, `vertical_rate`, `position_source` field definitions; 15s position staleness rule; 300s state vector retention; response-level `time` field
- [AIS Reporting Rates reference](https://arundaleais.github.io/docs/ais/ais_reporting_rates.html) — Class A (2-10s underway, 3min anchored), Class B-SO (5-30s underway, 3min stopped)
- [USCG Navigation Center — Class A AIS Position Reports](https://www.navcen.uscg.gov/ais-class-a-reports) — ITU-R M.1371-5 reporting interval mandates
- [MarineTraffic vessel update frequency article](https://support.marinetraffic.com/en/articles/9552905-how-often-do-the-positions-of-the-vessels-get-updated-on-marinetraffic) — 60s platform downsampling, 24h removal threshold, satellite AIS gap behavior (minutes to hours)
- [PredictWind DataHub AIS staleness docs](https://help.predictwind.com/en/articles/11578331-over-the-horizon-ais-why-do-i-see-a-datahub-call-sign-for-targets-which-should-be-vhf-over-the-air-on-my-chartplotter) — 3-minute TTL for OTA AIS; 2-minute fallback (180s / 120s industry conventions)
- [AirLabs Flight Tracker API docs](https://airlabs.co/docs/flights) — `updated` Unix timestamp as sole freshness field; no explicit `is_stale` in commercial aviation APIs
- Existing codebase review: `ingest_aircraft.py` (sv indices, 90s poll, trail logic), `ingest_military.py` (300s poll, no last_seen_at), `ingest_ais.py` (600s Redis TTL, 30s flush, time_utc as string), `routes_aircraft.py` (no stale filter, no position_age_seconds), `routes_ships.py` (no stale filter), `routes_military.py` (no stale filter), `routes_gps_jamming.py` (no freshness envelope), `config.py` (no stale threshold settings), `models/aircraft.py`, `models/military_aircraft.py`, `models/ship.py`

---

*Feature research for: Data freshness metadata and stale-position handling — OpenSignal Globe v4.0*
*Researched: 2026-03-13*
