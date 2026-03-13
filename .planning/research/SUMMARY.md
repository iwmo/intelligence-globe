# Project Research Summary

**Project:** Intelligence Globe v4.0 — Data Reliability & Freshness
**Domain:** Real-time geospatial tracking — freshness metadata, stale-position filtering, soft-expiry lifecycle
**Researched:** 2026-03-13
**Confidence:** HIGH

## Executive Summary

Intelligence Globe v4.0 is a data reliability milestone layered on top of a fully deployed geospatial tracking platform (CesiumJS 1.139, React 19, FastAPI, SQLAlchemy 2.0, PostgreSQL + PostGIS, Redis, RQ, Alembic). The current system ingests and displays live aircraft, military aircraft, AIS ships, and GPS jamming cells — but every list endpoint returns all rows regardless of age, with no distinction between a live entity and one that disappeared hours ago. Dead aircraft appear as live; moored ships and stale jamming cells persist indefinitely. The v4.0 goal is to add source-level freshness metadata, soft-expiry lifecycle columns, and stale filtering to all four data layers, without breaking the replay engine or introducing new dependencies.

The recommended approach is purely additive: no new libraries, no table rewrites, no hard deletes. A single Alembic migration adds freshness columns (`fetched_at`, `last_seen_at`, `time_position`, `is_active`, etc.) to four existing tables using lock-free `ADD COLUMN` with `server_default`. A shared `app/freshness.py` module centralises stale cutoff logic. Configurable thresholds per source (aircraft: 120s, military: 600s, ships: 900s) are declared in the existing `Settings` class. Ingest workers gain tombstone passes that mark absent entities `is_active = False` rather than deleting them. API routes gain a stale `WHERE` clause against the new columns, and all list responses gain freshness metadata in the envelope.

The primary risk is not technical complexity — every pattern here is low-risk and well-documented — but implementation discipline. Three categories of mistake are easy to make and hard to detect: (1) relying on SQLAlchemy `onupdate` to fire on upsert paths (it does not), (2) conflating `last_contact` (OpenSky's 300s persistence window) with `time_position` (the actual GPS fix timestamp), and (3) applying a uniform stale threshold to AIS ships regardless of navigational status, which incorrectly marks moored vessels as inactive. All three are addressed by following the patterns in this research exactly.

---

## Key Findings

### Recommended Stack

No new packages are required. Every v4.0 capability is achievable with the existing stack: `sqlalchemy[asyncio] >=2.0`, `alembic >=1.14` (current: 1.18.4), `pydantic-settings >=2.0` (current: 2.13.1), `fastapi >=0.115`, and `pytest-asyncio >=0.24`. The only configuration change is adding four env vars (`AIRCRAFT_STALE_SECONDS`, `MILITARY_STALE_SECONDS`, `SHIP_STALE_SECONDS`, `GPS_JAMMING_STALE_SECONDS`) to `.env` and `docker-compose.yml`.

**Core technologies and their v4.0 integration points:**

- **SQLAlchemy 2.0 (async):** Add freshness columns to four models using `mapped_column` with `DateTime(timezone=True)` — same pattern as all existing `updated_at` columns. Use `is_active BOOLEAN NOT NULL server_default='true'` so existing rows are treated as active immediately post-migration without a backfill UPDATE.
- **Alembic 1.18.4:** Hand-written migration only — never `--autogenerate` (partitioned child tables of `position_snapshots` can be dropped by autogenerate). Single file covering all four tables. Lock-free: PostgreSQL 11+ handles nullable `ADD COLUMN` and `ADD COLUMN ... DEFAULT` for non-volatile defaults without a table rewrite.
- **pydantic-settings 2.13.1:** Extend the existing `Settings` class with four `int` threshold fields. Automatic env var coercion; no additional validators needed.
- **FastAPI >=0.115 + Pydantic v2:** Replace raw `dict` returns in routes with typed `BaseModel` schemas (`from_attributes = True`). Use `@computed_field` for `is_stale` derived at serialisation time — avoids storing it as a DB column and eliminates write amplification.

See `.planning/research/STACK.md` for migration code samples, OpenSky state vector index table, and alternatives considered.

### Expected Features

**Must have (table stakes — v4.0 scope):**

- Stale row filtering on all list endpoints (`/api/aircraft`, `/api/military`, `/api/ships`) — no filtering exists today; dead entities appear live
- `is_active` soft-expiry boolean on `aircraft`, `military_aircraft`, and `ships` tables — ingest workers tombstone absent entities rather than hard-deleting; hard deletes break the replay engine
- `is_stale` and `position_age_seconds` fields in every list and detail response — computed at serialisation from `fetched_at`/`last_seen_at` vs configurable threshold; no schema change required
- `fetched_at` column on `aircraft` — captures when the OpenSky HTTP snapshot was taken (semantically distinct from `updated_at`, which is the PostgreSQL write time)
- `time_position` column on `aircraft` (OpenSky sv[3]) — when the GPS position fix was recorded; can be NULL if no fix in last 15s; the correct field for positional freshness, not `last_contact` (sv[4])
- `geo_altitude`, `vertical_rate`, `position_source` columns on `aircraft` (sv[13], sv[11], sv[16]) — richer OpenSky ingestion, currently unused fields from the state vector
- `last_seen_at TIMESTAMPTZ` on `military_aircraft` and `ships` — typed datetime, not a raw string; enables `NOW() - last_seen_at` arithmetic in route queries
- GPS jamming freshness envelope: `aggregated_at`, `source_fetched_at`, `source_is_stale` in `/api/gps-jamming` response — derived layer must expose the age of its source data
- Configurable stale thresholds per source in `config.py` — aircraft at 2× poll cadence (120s), military at 2× cadence (600s), ships at 1.5× Redis TTL (900s)
- Alembic migration for all schema changes — hand-written, single file, applied atomically; `is_active` with `server_default='true'`

**Should have (differentiators — v4.1):**

- `/api/military/freshness` and `/api/ships/freshness` endpoints — parallel to the existing `/api/aircraft/freshness`
- Frontend visual indicator for stale entities (grey-out, opacity reduction, or "STALE" badge) — deferred from v4.0

**Defer to v5+:**

- Satellite AIS handling with longer staleness windows (satellite relay has inherent multi-hour gaps; needs a separate `is_satellite_ais` flag and different threshold)
- `position_source` string label rendered in the frontend detail panel ("ADS-B", "MLAT", "FLARM")
- Per-entity staleness history (how often has this aircraft been stale in the last 24h)
- Real-time push notification when an entity goes stale — disproportionate WebSocket complexity for a single-user homelab

See `.planning/research/FEATURES.md` for full dependency graph, MVP definition, and feature prioritisation matrix.

### Architecture Approach

The freshness layer follows the existing FastAPI + SQLAlchemy async pattern with three additions: a new shared `app/freshness.py` helper (pure functions, no DB dependency), four modified ORM models, and stale `WHERE` clauses in the three list routes. Stale filtering logic lives in the route query layer, not on the model, because thresholds are configuration (not data invariants) and list vs detail endpoints need different behaviour. The GPS jamming layer propagates source freshness metadata from `military_aircraft` at aggregation time, storing it denormalised on every cell row to avoid a JOIN in the route.

**Major components and their v4.0 changes:**

1. **`app/config.py`** — add `stale_threshold_aircraft_s=120`, `stale_threshold_military_s=600`, `stale_threshold_ships_s=900` int fields to the existing `Settings` class
2. **`app/freshness.py` (NEW)** — `stale_cutoff(threshold_seconds) -> datetime` and `is_stale(timestamp, threshold_seconds) -> bool`; imported by all three route files; trivially unit-testable in isolation
3. **ORM models** (`aircraft.py`, `military_aircraft.py`, `ship.py`, `gps_jamming.py`) — additive column additions only; no existing columns changed
4. **Ingest workers** (`ingest_aircraft.py`, `ingest_military.py`, `ingest_ais.py`, `ingest_gps_jamming.py`) — write new fields explicitly in every upsert `set_={}` dict; add tombstone bulk UPDATE after each poll cycle; GPS jamming filters source by `is_active = TRUE`
5. **API routes** (`routes_aircraft.py`, `routes_military.py`, `routes_ships.py`, `routes_gps_jamming.py`) — stale `WHERE` clause on list queries; freshness metadata in response envelope
6. **Alembic migration** — one hand-written file, all four tables; `is_active` with `server_default='true'`; all freshness timestamp columns nullable; indexes on `fetched_at`/`last_seen_at`

**Build order (hard dependencies):** Migration → Models → Shared helpers → Ingest workers → API routes → Tests.

See `.planning/research/ARCHITECTURE.md` for full data flow diagrams, integration inventory table, and anti-pattern catalogue.

### Critical Pitfalls

1. **SQLAlchemy `onupdate` is silently ignored by `on_conflict_do_update`** — Every new freshness column (`fetched_at`, `last_seen_at`, `updated_at`) must appear explicitly in every upsert `set_={}` dict. `onupdate=func.now()` on the model Column definition is never called on the conflict-update path. The AIS worker already has this bug for `ships.updated_at`. Audit every `set_={}` dict before writing any freshness query.

2. **Alembic `--autogenerate` can drop partition child tables** — `position_snapshots` is range-partitioned by day. Running `alembic revision --autogenerate` may generate `drop_table('position_snapshots_YYYY_MM_DD')` statements. All migrations must be hand-written. Run `alembic upgrade --sql` against a staging DB to preview before applying.

3. **`last_contact` (sv[4]) is not the same as `time_position` (sv[3])** — OpenSky generates state vectors for 300 seconds after the last transponder contact. A recent `last_contact` does not mean the GPS position is fresh — `time_position` can be 297 seconds old. Use `time_position` (sv[3]) for positional freshness; store `last_contact` as a secondary audit field only.

4. **Stale threshold too aggressive causes a blank globe** — Filtering `WHERE is_active = TRUE` without a response envelope silently converts a feed-down event into an empty API response. Include `last_updated` and `stale_count` in every list response so the frontend can render "feed stale — showing last-known positions" rather than a blank globe.

5. **AIS ships at anchor have legitimately slow update intervals** — ITU-R M.1371 mandates Class A AIS every 3 minutes when anchored/moored vs every 2–10 seconds underway. A uniform stale threshold incorrectly marks moored vessels as inactive. Use Redis key presence as the `is_active` signal for ships — Redis TTL (600s) already models the AIS reporting interval correctly and sidesteps nav_status complexity.

See `.planning/research/PITFALLS.md` for 10 detailed pitfalls with recovery strategies, warning signs, and phase-to-pitfall mapping.

---

## Implications for Roadmap

The hard dependency chain — schema before models, models before ingest, ingest before routes, everything before tests — maps cleanly to a six-phase build. All phases are backend-only for v4.0; frontend stale visual indicators are deferred to v4.1.

### Phase 1: Schema Migration (MIG-01)
**Rationale:** Every subsequent phase reads or writes new columns. This must be first. It is the only step that requires a direct database operation and has the highest deployment risk of all six phases.
**Delivers:** All four tables (`aircraft`, `military_aircraft`, `ships`, `gps_jamming_cells`) gain freshness columns. `is_active` defaults to `true` for all existing rows. Indexes on `fetched_at`/`last_seen_at` added in the same migration for query performance.
**Addresses:** Table stakes — `is_active`, `fetched_at`, `last_seen_at`, `time_position`, `geo_altitude`, `vertical_rate`, `position_source`, `aggregated_at`
**Avoids:** Pitfall 5 (NOT NULL without `server_default` fails on live tables — use `server_default=sa.text('true')` for `is_active`); Pitfall 9 (autogenerate drops partitions — hand-write, preview with `--sql`)

### Phase 2: Shared Freshness Helper + Config (FRESH-01, FRESH-02)
**Rationale:** Pure Python with no DB dependency — can be written in parallel with Phase 1. Routes and tests both import from here; it must exist before either.
**Delivers:** `app/freshness.py` with `stale_cutoff()` and `is_stale()`; `app/config.py` extended with three threshold fields; `test_freshness.py` unit tests written TDD-style before implementation.
**Uses:** pydantic-settings 2.x typed `int` fields with automatic env var coercion
**Avoids:** Hardcoded threshold magic numbers per route file; Pitfall 7 (clock skew — defaults at 2× poll cadence build in an inherent grace window)

### Phase 3: Aircraft Ingest + Model (ACFT-01, ACFT-02, ACFT-03)
**Rationale:** Aircraft is the highest-frequency source (90s poll) and has the most new fields (5 new columns). Establishing the complete aircraft pipeline first provides a validated template for the military and ship ingest workers.
**Delivers:** `Aircraft` model gains `fetched_at`, `time_position`, `geo_altitude`, `vertical_rate`, `position_source`, `is_active`. `ingest_aircraft.py` writes all new fields from sv[3/11/13/16] and response `time`; tombstone pass marks absent aircraft `is_active = False` in the same session/commit.
**Avoids:** Pitfall 1 (`onupdate` not firing — new fields explicit in `set_{}`); Pitfall 10 (sv[3] vs sv[4] confusion — `time_position` from sv[3], not `last_contact` from sv[4])

### Phase 4: Military + AIS + GPS Jamming Ingest (MIL-01/02/03, SHIP-01/02/03, JAM-01/02)
**Rationale:** Groups the remaining three ingest workers after the aircraft template is proven. GPS jamming depends on military `is_active` being correct before it can filter source data.
**Delivers:** Military model + ingest gains `fetched_at`, `last_seen_at`, `is_active` with tombstone pass. AIS worker gains `last_seen_at` (typed `TIMESTAMPTZ` from `time_utc`) and a deactivation sweep that bridges Redis TTL to PostgreSQL `is_active`. GPS jamming ingest filters source by `is_active = TRUE` and writes `source_fetched_at`, `source_is_stale`, `aggregated_at` to every cell.
**Avoids:** Pitfall 4 (AIS nav_status — derive `is_active` from Redis key presence, not timestamp arithmetic); Pitfall 6 (GPS jamming cells never pruned — `aggregated_at` enables soft expiry); Pitfall 8 (Redis TTL / PostgreSQL `is_active` drift — deactivation sweep in `batch_flush_ships_to_pg`)

### Phase 5: API Routes — Stale Filtering + Response Envelope (ACFT-04/05/06, MIL-04, SHIP-04, JAM-03)
**Rationale:** Routes are the public API surface. Changing them after ingest ensures real freshness data exists in the DB when integration tests run. This is where the user-visible data quality improvement appears.
**Delivers:** All three list endpoints gain stale `WHERE is_active = TRUE AND fetched_at >= cutoff` clauses using `freshness.stale_cutoff()`. Every list response gains `is_stale` and `position_age_seconds` per entity, and a top-level freshness envelope (`last_updated`, `stale_count`). GPS jamming route exposes `aggregated_at`, `source_fetched_at`, `source_is_stale`.
**Avoids:** Pitfall 2 (blank globe — response envelope provides feed-down signal); Pitfall 3 (`updated_at` vs source timestamp — routes filter on `fetched_at`/`last_seen_at`, not `updated_at`)

### Phase 6: Tests (TEST-01 through TEST-07)
**Rationale:** Integration tests validate the full pipeline end-to-end. The `freshness.py` unit tests are written in Phase 2 (TDD RED); integration tests for ingest and route behaviour are written here after implementation exists.
**Delivers:** Extended route tests asserting stale filtering and freshness envelope; ingest tests verifying tombstone behaviour and correct sv index mapping; GPS jamming test asserting `source_is_stale` flag propagation; `test_freshness.py` unit tests confirming clock mock behaviour.
**Avoids:** All pitfalls — tests are the verification layer for every pitfall's listed warning signs

### Phase Ordering Rationale

- Schema-first ordering is non-negotiable: without the columns in PostgreSQL, every other step fails at runtime with `AttributeError` (missing model fields) or `ProgrammingError` (unknown column in upsert).
- Phase 2 (shared helper) has no DB dependency and could technically run in parallel with Phase 1, but is placed second so routes and tests always find it present.
- Phase 3 (aircraft) before Phase 4 (military/ships/jamming) because aircraft validates the complete ingest pattern at the highest frequency before it is applied to the other workers. GPS jamming is grouped with Phase 4 because it consumes military `is_active`, which requires military ingest to be updated first.
- Routes (Phase 5) after all ingest (Phases 3–4) so real freshness data exists in the DB when integration tests run against the route endpoints.
- Tests are last in execution order but `freshness.py` unit tests are written TDD-style in Phase 2, before the implementation exists.

### Research Flags

Phases with well-documented patterns (skip pre-phase research):
- **Phase 1 (Migration):** Standard Alembic `add_column` with `server_default`. Documented in official Alembic and PostgreSQL docs. Only risk is the autogenerate/partition trap — mitigated by hand-writing migrations.
- **Phase 2 (Shared helper):** Pure Python utility functions. No research needed.
- **Phase 5 (Routes):** Standard FastAPI `WHERE` clause modification. Pattern established.
- **Phase 6 (Tests):** Standard pytest-asyncio. Existing test suite provides conventions.

Phases that need targeted validation during execution:
- **Phase 3 (Aircraft ingest):** `position_source` (sv[16]) is only in the extended state vector returned when authenticated with OpenSky. Verify presence in live data before writing assertions against it. Default to `None` if absent, not `0`.
- **Phase 4 (AIS ships):** The nav_status-aware vs Redis-TTL-only threshold decision should be confirmed before writing `is_active` lifecycle code. Research recommends Redis-TTL-only for v4.0 simplicity; validate this handles the moored-ship scenario acceptably in a test fixture.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All findings verified against official docs (Alembic, SQLAlchemy, pydantic-settings, FastAPI, PostgreSQL). No new packages needed — reduces uncertainty to near zero. |
| Features | HIGH | Industry conventions verified: OpenSky official docs (sv field indices, 15s/300s rules), ITU-R M.1371-5 (AIS update intervals by nav_status), MarineTraffic staleness behaviour, existing codebase gaps confirmed by direct inspection. |
| Architecture | HIGH | Based on direct codebase analysis of all models, routes, ingest tasks, and workers. Patterns are additive and follow existing conventions. Build order is derived from actual file dependency graph. |
| Pitfalls | HIGH | All 10 pitfalls grounded in official source citations (SQLAlchemy GitHub #5903, Alembic GitHub #539, squawkhq.com NOT NULL analysis, ITU-R M.1371-5) or direct inspection of the specific existing defects in the codebase. |

**Overall confidence:** HIGH

### Gaps to Address

- **`position_source` (sv[16]) availability:** This field is documented as present only in the extended state vector returned when authenticated with OpenSky. The codebase currently uses the free/unauthenticated endpoint. Verify presence of sv[16] in live data before finalising `ingest_aircraft.py` — if absent, store NULL and document the condition.
- **AIS nav_status threshold strategy:** Two valid approaches — differentiated thresholds by nav_status, or Redis-TTL-only derivation. Research recommends Redis-TTL for v4.0 simplicity. Confirm before SHIP-01 is written, as it affects the ingest worker and route query.
- **Existing `ships.last_update` string column:** The current schema stores `time_utc` as a raw `String`. The new `last_seen_at TIMESTAMPTZ` column is added alongside it; do NOT drop `last_update` during v4.0 (deprecation is a later concern). Ensure route stale filter uses `last_seen_at`, not `last_update`.
- **Clock grace period in default thresholds:** The recommended defaults (120s for 90s poll, 600s for 300s poll) embed a 1.3–2× multiplier as a grace window. If the homelab host has measurable clock skew (Docker Desktop on Mac is susceptible after sleep/wake), increase defaults by an additional 60s.

---

## Sources

### Primary (HIGH confidence)

- [OpenSky REST API documentation](https://openskynetwork.github.io/opensky-api/rest.html) — state vector field indices 0–17, `time_position` vs `last_contact` semantics, 15s position staleness rule, 300s state vector retention, response-level `time` field
- [Alembic Operation Reference](https://alembic.sqlalchemy.org/en/latest/ops.html) — `add_column`, `server_default`, `nullable` parameter behaviour
- [SQLAlchemy 2.0 Column Defaults](https://docs.sqlalchemy.org/en/20/core/defaults.html) — `server_default=func.now()`, `onupdate` semantics, upsert path limitations
- [pydantic-settings 2.13.1](https://pypi.org/project/pydantic-settings/) — `BaseSettings` typed int/float env var loading
- [Pydantic v2 `computed_field`](https://docs.pydantic.dev/latest/concepts/models/) — `@computed_field` included in serialisation automatically
- [PostgreSQL ALTER TABLE documentation](https://www.postgresql.org/docs/current/sql-altertable.html) — lock-free ADD COLUMN with non-volatile DEFAULT on PostgreSQL 11+
- [ITU-R M.1371-5](https://www.itu.int/dms_pubrec/itu-r/rec/m/R-REC-M.1371-5-201402-I!!PDF-E.pdf) — AIS Class A position update intervals by navigational status
- [NAVCEN — Class A AIS Position Reports](https://www.navcen.uscg.gov/ais-class-a-reports) — update schedule by nav_status
- [squawkhq.com — adding NOT NULL fields](https://squawkhq.com/docs/adding-not-nullable-field) — lock implications of NOT NULL ADD COLUMN without server_default
- Direct codebase analysis — all backend Python files (authoritative)

### Secondary (MEDIUM confidence)

- [SQLAlchemy GitHub discussion #5903](https://github.com/sqlalchemy/sqlalchemy/discussions/5903) — `on_conflict_do_update` does not honour `onupdate`
- [Alembic GitHub issue #539](https://github.com/sqlalchemy/alembic/issues/539) — partitioned table autogenerate support limitations
- [MarineTraffic vessel update frequency](https://support.marinetraffic.com/en/articles/9552905-how-often-do-the-positions-of-the-vessels-get-updated-on-marinetraffic) — 60s downsampling, 24h removal threshold, satellite AIS gap behaviour
- [PredictWind DataHub AIS staleness](https://help.predictwind.com/en/articles/11578331-over-the-horizon-ais-why-do-i-see-a-datahub-call-sign-for-targets-which-should-be-vhf-over-the-air-on-my-chartplotter) — 3-minute TTL for OTA AIS; 2-minute fallback
- [AirLabs Flight Tracker API](https://airlabs.co/docs/flights) — `updated` Unix timestamp as sole freshness field in a production aviation API

### Tertiary (LOW confidence)

- [DEV Community — Alembic NotNullViolation error patterns](https://dev.to/cuddi/that-dreaded-alembic-notnullviolation-error-and-how-to-survive-it-33a1) — corroborates squawkhq.com findings on NOT NULL migration failures
- [Evil Martians — soft deletion with PostgreSQL](https://evilmartians.com/chronicles/soft-deletion-with-postgresql-but-with-logic-on-the-database) — soft-expiry pattern rationale

---
*Research completed: 2026-03-13*
*Ready for roadmap: yes*
