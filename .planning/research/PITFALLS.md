# Pitfalls Research

**Domain:** Geospatial real-time tracking — adding freshness/staleness metadata to existing production layers (v4.0 Data Reliability & Freshness)
**Researched:** 2026-03-13
**Confidence:** HIGH (all findings grounded in direct codebase inspection + verified against official SQLAlchemy, OpenSky, ITU-R, and Alembic sources)

---

## Critical Pitfalls

### Pitfall 1: SQLAlchemy `onupdate` Is Silently Ignored by `on_conflict_do_update`

**What goes wrong:**
All four live models (`Aircraft`, `MilitaryAircraft`, `Ship`, `GpsJammingCell`) define `updated_at` with `onupdate=func.now()`. Every ingest worker uses `pg_insert(...).on_conflict_do_update(...)`. The `onupdate` callback is **never invoked** on the conflict-update path — only a bare INSERT triggers it. UPDATE via `on_conflict_do_update` uses only whatever appears in `set_={}`.

The aircraft and military ingest workers already work around this by explicitly including `"updated_at": func.now()` in their `set_` dict. The AIS worker's `batch_flush_ships_to_pg` does **not** include `updated_at` in its conflict update set, so `ships.updated_at` reflects only the first INSERT time — it never advances when a position refreshes. Any freshness check against `ships.updated_at` will be wrong from the moment the second AIS message arrives for a given MMSI.

When `last_seen_at` and `fetched_at` columns are added in this milestone, the same omission will silently corrupt freshness data if those columns are not included in every upsert `set_={}`.

**Why it happens:**
SQLAlchemy documents this limitation explicitly: "Insert.on_conflict_do_update() does not take into account Python-side default UPDATE values or generation functions, such as those specified using Column.onupdate." Developers assume the column definition handles all update paths. It does not. (Source: [SQLAlchemy GitHub discussion #5903](https://github.com/sqlalchemy/sqlalchemy/discussions/5903))

**How to avoid:**
Every `on_conflict_do_update` `set_={}` dict that should advance a timestamp must include it explicitly: `"updated_at": func.now()`, `"last_seen_at": func.now()`, `"fetched_at": <value>`. Do not rely on `onupdate=` at the model level for upsert paths.

**Warning signs:**
- Query `SELECT mmsi, updated_at FROM ships ORDER BY updated_at LIMIT 10` after several hours of uptime. If timestamps are all clustered at boot time, the `onupdate` is not firing.
- Any new column added with `onupdate=func.now()` that is not also present in the ingest worker's `set_={}`.

**Phase to address:** MIG-01 (schema migrations) and ACFT-01/MIL-01/SHIP-01 (ingest changes) — audit every `set_={}` dict before writing freshness queries.

---

### Pitfall 2: Stale Threshold Too Aggressive Causes an Empty Globe

**What goes wrong:**
Adding `WHERE is_active = true` or `WHERE updated_at > NOW() - INTERVAL '5 minutes'` to list endpoints (`/api/aircraft`, `/api/military`, `/api/ships`) will return an empty list whenever:
- The ingest worker is temporarily stopped (Docker restart, rate-limit backoff)
- The RQ queue stalls (Redis restart, worker crash)
- The upstream source API is down (OpenSky 429, aisstream.io disconnect)

The globe renders zero entities with no error. There is no user-visible distinction between "nothing tracked" and "ingest feed is stale." The existing endpoints have zero staleness filtering — adding one without a fallback creates an availability regression that looks like a blank globe with no console error.

**Why it happens:**
Hard freshness filters applied at the DB query layer silently convert a data-availability problem into an empty API response. The frontend has no signal to distinguish empty-due-to-filter from empty-due-to-no-data.

**How to avoid:**
Use soft expiry: expose `is_active` and freshness metadata in the response payload, but do not filter `is_active = false` rows from the globe list. Let the frontend dim or badge stale entities rather than removing them. If hard filtering is required, include a response envelope:

```json
{
  "items": [...],
  "freshness": {
    "last_updated": "2026-03-13T12:00:00Z",
    "stale": false,
    "stale_count": 0
  }
}
```

This lets the frontend render "feed stale — showing last-known positions" rather than a blank globe.

**Warning signs:**
- Any filter of the form `WHERE updated_at > NOW() - INTERVAL X` applied directly to the list endpoint with no fallback
- No `last_updated` envelope in the API response
- Globe goes blank after Docker restart with no console error

**Phase to address:** ACFT-04 (stale filtering), MIL-03 (stale filtering), SHIP-03 (stale filtering) — design the API response envelope before writing the WHERE clause.

---

### Pitfall 3: `updated_at` (DB Write Time) Is Not Source Data Age

**What goes wrong:**
All four models stamp `updated_at` via PostgreSQL `now()` at write time. This measures when the row was written to the database — not when the underlying source data was observed. Using `updated_at` as a freshness proxy produces incorrect results:

- OpenSky state vectors include `time_position` (Unix epoch of last GPS fix, index 3 in state vector) and `last_contact` (epoch of last transponder ping). OpenSky documents: "OpenSky continues generating state vectors for 300 seconds after the last contact." A row flushed right now (`updated_at = now()`) may carry a position from 297 seconds ago (`time_position = now - 297`).
- The AIS worker stores `time_utc` from aisstream.io metadata as a raw string in `ships.last_update`. This is the vessel's transmitted timestamp, not the reception time. The PG flush runs every 30 seconds; `ships.updated_at` reflects the batch flush time, not when aisstream.io received the AIS message.

Filtering on `updated_at` for "position freshness" will mark a 5-minute-old position as fresh if the ingest worker happened to flush it 10 seconds ago.

**Why it happens:**
`updated_at` is the cheapest staleness proxy — it requires no schema change. Teams reach for it first without auditing what the ingest pipeline actually writes there.

**How to avoid:**
- Aircraft: store `time_position` (source GPS timestamp as INTEGER Unix epoch) and `fetched_at` (wall clock of HTTP fetch) as separate columns. Filter on `time_position` for positional freshness.
- Ships: store `last_seen_at` as a proper `TIMESTAMPTZ` parsed from `time_utc` string, not the raw string. Current schema has `last_update: str` — this cannot be used in `NOW() - last_seen_at` arithmetic without a CAST.
- Military: store `fetched_at` (wall clock of the airplanes.live HTTP fetch, set once per ingest cycle) and `last_seen_at` (set per aircraft each time it appears in the response).
- Reserve `updated_at` for ingest health monitoring only, not user-visible freshness.

**Warning signs:**
- Freshness query using only `updated_at` and ignoring `time_position`, `time_utc`, or source-provided timestamps
- `last_update` column stored as `String` type when arithmetic on it is needed

**Phase to address:** ACFT-01 (new ingest fields), SHIP-01 (last_seen_at as TIMESTAMPTZ), MIL-01 (fetched_at/last_seen_at).

---

### Pitfall 4: AIS Ships in Port Are Legitimately Stale — Same Threshold Breaks Port Traffic

**What goes wrong:**
Ships at anchor or moored report position updates far less frequently than underway vessels. Per ITU-R M.1371, Class A AIS transponders transmit position every **3 minutes or less** when anchored/moored, vs every 2–10 seconds when underway at speed. A stale threshold of "inactive after 10 minutes" will correctly prune departed vessels but will also incorrectly mark moored vessels as inactive during every normal reporting cycle.

Additionally, AIS coverage is not global. Ships in areas with poor terrestrial receiver coverage (open ocean, polar regions, certain coastal zones) may be transmitting correctly but aisstream.io may not relay messages for hours. A legitimate active vessel appears stale under any uniform ingest-side threshold.

The `nav_status` field (0=underway, 1=at anchor, 5=moored, etc.) is already present in the `Ship` model and populated via `parse_ais_message`. It provides ground truth for threshold differentiation.

**Why it happens:**
Freshness logic is designed around aircraft (which update every few seconds when airborne). Applying the same threshold to AIS data ignores protocol-defined update intervals and reception coverage gaps.

**How to avoid:**
Apply nav_status-aware stale thresholds. Suggested minimums:
- `nav_status` 0 (underway engines): stale after 30 minutes
- `nav_status` 1 (at anchor) or 5 (moored): stale after 4 hours, or never set `is_active = false`
- `nav_status` unknown/NULL: stale after 2 hours

Alternatively: derive `is_active` from Redis key presence only, not from DB timestamp. Redis TTL (600s) already models the protocol update interval correctly. If aisstream.io stops sending messages for a vessel, the key expires naturally.

**Warning signs:**
- Single stale threshold applied uniformly to all ships regardless of `nav_status`
- Ports in coverage-limited regions showing no ships
- `is_active` churn: ship flips active/inactive repeatedly within a 30-minute window
- No nav_status consideration in the FRESH-01 threshold config

**Phase to address:** SHIP-01 (is_active lifecycle), FRESH-01 (configurable thresholds per source).

---

### Pitfall 5: Alembic Migration Adds NOT NULL Column Without `server_default` — Fails on Live Table With Data

**What goes wrong:**
Adding `is_active BOOLEAN NOT NULL` to `aircraft`, `military_aircraft`, or `ships` without a `server_default` in the Alembic migration raises `IntegrityError: NOT NULL constraint violated` if the table has any rows. The Python-side `default=True` on the SQLAlchemy Column does not generate a DDL-level DEFAULT clause — Alembic does not automatically convert Python defaults to `server_default`.

The distinction:
- `op.add_column('aircraft', sa.Column('is_active', sa.Boolean(), nullable=False))` — fails on live data
- `op.add_column('aircraft', sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('true')))` — succeeds; PostgreSQL fills existing rows with `true` at DDL time with no table rewrite (non-volatile DEFAULT optimization in PostgreSQL 11+)

**Why it happens:**
Developers copy the SQLAlchemy model definition's `default=True` into the Alembic `add_column` call verbatim. Python `default=` is an ORM-level default evaluated at `session.add()` time. It is not a DDL DEFAULT clause. (Source: [squawkhq.com — adding NOT NULL fields](https://squawkhq.com/docs/adding-not-nullable-field))

**How to avoid:**
For `is_active` and any other NOT NULL boolean: use `nullable=True` initially (PostgreSQL fills NULLs, no table rewrite). Then backfill: `op.execute("UPDATE aircraft SET is_active = true WHERE is_active IS NULL")`. Then add the NOT NULL constraint in a follow-up step. This three-step pattern is safe on live tables of any size. Alternatively, use `server_default=sa.text('true')` in the single `add_column` call — also safe.

For nullable columns (`fetched_at`, `last_seen_at`, `time_position`): `nullable=True` with no `server_default` is correct — PostgreSQL uses NULL for existing rows, no table rewrite.

**Warning signs:**
- `op.add_column` with `nullable=False` and no `server_default`
- Migration tested only on empty test DB (passes) but fails on staging/production with rows
- Python `default=` used inside the Alembic migration column definition (not `server_default=`)

**Phase to address:** MIG-01 — review every `add_column` call before applying to any environment with data.

---

### Pitfall 6: GPS Jamming Cells Are Never Pruned — Ghost Cells Persist Indefinitely

**What goes wrong:**
The `ingest_gps_jamming` task reads all current `MilitaryAircraft` rows and upserts cells via `ON CONFLICT DO UPDATE`. It never deletes cells for H3 hexagons that no longer have any aircraft. A jamming event from yesterday persists as a red/yellow cell today because the upsert only updates rows present in the current pass — rows absent from the current pass are never touched.

With military polling every 300s and GPS jamming aggregating daily (86400s), a cell created during a single military exercise persists up to 24 hours after the last aircraft passed through, showing jamming where none currently exists. When freshness metadata is added (JAM-01 through JAM-03), cells must expose their age so the UI can dim or suppress outdated cells.

**Why it happens:**
Upsert-only patterns accumulate ghost data. The aggregation task models aircraft presence but not absence — it has no mechanism to signal "this cell is no longer active."

**How to avoid:**
Two options:
1. **Prune on aggregation**: After upsert, delete all `GpsJammingCell` rows whose `h3index` was not in the current aggregation pass. Simple and correct.
2. **Soft expiry via `aggregated_at`**: Add `aggregated_at TIMESTAMPTZ` to `GpsJammingCell`. The API endpoint filters `WHERE aggregated_at > NOW() - INTERVAL '26 hours'` (slightly longer than the 24h poll to avoid brief gaps). Frontend dims cells outside this window.

Option 2 aligns with the milestone's preference for soft expiry and does not require deleting data.

**Warning signs:**
- `SELECT COUNT(*) FROM gps_jamming_cells WHERE updated_at < NOW() - INTERVAL '25 hours'` returns non-zero after 48h uptime
- Red cells visible over regions with no current military aircraft
- No DELETE or `aggregated_at` column in the jamming ingest task

**Phase to address:** JAM-01 (freshness metadata on jamming cells), JAM-02 (staleness documentation/UI).

---

### Pitfall 7: Clock Skew Between Ingest Server and Source Timestamps Breaks Freshness Thresholds

**What goes wrong:**
Freshness calculations that compare `NOW()` (PostgreSQL server time) against source-provided Unix timestamps (`time_position`, `last_contact` from OpenSky, `time_utc` from aisstream.io) assume clock synchronization. In a homelab/VPS deployment — the target environment — this assumption can break:

- Docker Desktop for Mac: the Linux VM's clock can drift from the macOS host after sleep/wake cycles
- Small VPS instances: NTP may not be running or may be misconfigured
- PostgreSQL `now()` and Python `datetime.utcnow()` on the worker host may diverge

NTP typical accuracy is 5–100ms. Docker Desktop clock skew can reach several seconds after a laptop wake. A 30-second skew applied to a 5-minute staleness threshold makes a 5-minute old position appear as either 4.5 or 5.5 minutes old — enough to flip the staleness decision on borderline entries.

**Why it happens:**
Developers test on their local machine where clock skew is near zero. Threshold edge cases are invisible in local testing.

**How to avoid:**
- Add a 60–120 second grace period to all freshness thresholds: a "5-minute stale" threshold should actually be `NOW() - INTERVAL '6 minutes'`
- Store `fetched_at` (server-side wall clock at time of HTTP fetch) alongside source timestamps — compare `fetched_at - time_position` to get source data age independent of current server clock
- Do not use `NOW() - source_timestamp` in hot-path queries without a grace window; compute data age at ingest time and store as `data_age_seconds` if per-query arithmetic is expensive

**Warning signs:**
- All aircraft simultaneously marked stale in a single poll cycle (indicative of clock jump, not actual staleness)
- Freshness queries returning unexpected empty results after host sleep/wake
- `SELECT NOW()` in PostgreSQL diverging from the Python worker host clock by more than 5 seconds

**Phase to address:** FRESH-01 (shared freshness config and thresholds), TEST-01 (staleness behavior tests that mock clock offsets).

---

### Pitfall 8: Redis TTL and PostgreSQL `is_active` Drift Out of Sync

**What goes wrong:**
The AIS worker caches ships in Redis with a 600-second TTL. A ship that stops transmitting will have its Redis key expire at T+600s. But its PostgreSQL row persists indefinitely with no mechanism to set `is_active = false`.

When SHIP-01 adds `is_active` to the `ships` table, two sources of truth exist:
- Redis: key expires → ship is gone from cache (implicit, event-driven)
- PostgreSQL: row persists with `is_active = true` (explicit, must be set proactively)

Any API endpoint that reads from PostgreSQL directly will show the ship as active long after it has disappeared from Redis. The current `/api/ships` list endpoint reads from PostgreSQL only — it would never see the Redis expiry.

**Why it happens:**
Redis TTL expiry is implicit; PostgreSQL state is explicit. The two systems do not communicate — the application code must bridge them during each flush cycle.

**How to avoid:**
During `batch_flush_ships_to_pg`, collect the set of MMSIs currently visible in Redis. After upserting all active ships, run a deactivation sweep:

```sql
UPDATE ships
SET is_active = false
WHERE mmsi NOT IN (:active_mmsi_list)
AND is_active = true
```

This aligns PostgreSQL state with Redis reality at every flush cycle (every 30 seconds). For large NOT IN lists, use a temporary table or CTE join instead of a raw NOT IN list.

Alternatively: do not use `is_active` in PostgreSQL for ships at all — serve active ships directly from Redis keys, and use the PostgreSQL table only for historical display and detail panels.

**Warning signs:**
- `SELECT COUNT(*) FROM ships WHERE is_active = true` substantially exceeds `KEYS "ship:*"` count in Redis
- Ships visible on globe hours after their Redis TTL expired
- No deactivation sweep anywhere in `batch_flush_ships_to_pg`

**Phase to address:** SHIP-01 (is_active lifecycle), SHIP-03 (stale filtering consistent with Redis TTL).

---

### Pitfall 9: Alembic Autogenerate Produces Destructive Diff Against Partition Child Tables

**What goes wrong:**
The `position_snapshots` table is range-partitioned by day. Alembic's `autogenerate` has documented issues with PostgreSQL partitioned tables ([issue #539](https://github.com/sqlalchemy/alembic/issues/539)): it does not model parent/child partition relationships correctly and may generate migrations that:
- Re-create child partition tables that already exist
- Generate `drop_table` statements for existing child partitions
- Miss child table index propagation when `op.add_column` is run on the parent

The `env.py` `include_object` hook in this project excludes reflected tables with `compare_to is None`. Child partition tables are reflected with a `compare_to` pointing to the parent metadata, so they pass this filter. Running `alembic revision --autogenerate` could silently generate a DROP against `position_snapshots_2026_03_13` and every other existing partition.

This milestone adds columns only to `aircraft`, `military_aircraft`, `ships`, and `gps_jamming_cells` — none of which are partitioned. But the autogenerate risk exists for any developer who runs `alembic revision --autogenerate` to generate the migration.

**Why it happens:**
Developers use `--autogenerate` habitually. The implicit risk of partitioned table diffs is not visible until the generated migration is reviewed carefully.

**How to avoid:**
- Never use `alembic revision --autogenerate` for this project — always write migrations by hand
- Extend `include_object` in `env.py` to exclude tables whose names match the partition pattern (e.g., prefix `position_snapshots_`)
- Run `alembic upgrade --sql` to preview the SQL before applying any migration
- Add a comment to every migration file: `# Do not use --autogenerate; hand-written migration only`

**Warning signs:**
- Running `alembic revision --autogenerate` produces a migration with `drop_table('position_snapshots_...')` statements
- Any autogenerated migration that includes child partition table names

**Phase to address:** MIG-01 — enforce hand-written migrations; add `include_object` partition filter to `env.py` before running any migration for this milestone.

---

### Pitfall 10: `time_position` vs `last_contact` Confusion in Aircraft Freshness Logic

**What goes wrong:**
OpenSky state vectors expose two time fields that are commonly confused:
- `sv[3]` = `time_position`: Unix epoch of last GPS position fix. Can be `None` if no position report received within 15 seconds. This is the correct field for positional freshness.
- `sv[4]` = `last_contact`: Unix epoch of last received message (any type, including non-position). This can be recent even when the position is stale.

OpenSky generates state vectors for 300 seconds after the last contact. An aircraft can have a recent `last_contact` but a `time_position` that is 297 seconds old. Using `last_contact` to determine position freshness will mark stale positions as fresh.

The current `Aircraft` model stores `last_contact` (sv[4]) but not `time_position` (sv[3]). When ACFT-01 adds `time_position`, it must be mapped from the correct state vector index and stored as INTEGER (Unix epoch seconds), not as a Python `datetime` object.

**Why it happens:**
`last_contact` sounds more like "when we last saw this aircraft" and is confused with positional freshness. The OpenSky API docs are clear about the distinction but it is easy to miss.

**How to avoid:**
- Store both: `time_position` (sv[3]) for positional freshness filtering, `last_contact` (sv[4]) as a secondary signal
- Filter stale aircraft on `time_position`: `WHERE time_position IS NOT NULL AND NOW() - to_timestamp(time_position) < INTERVAL '10 minutes'`
- Document in the model: `# time_position is NULL when no GPS fix in last 15s; use for position freshness, not last_contact`

**Warning signs:**
- Freshness filter using `last_contact` instead of `time_position`
- `time_position` stored as `DateTime` instead of `Integer` (loses precision and requires timezone handling)
- State vector index off-by-one (sv[3] vs sv[4]) in the ingest worker

**Phase to address:** ACFT-01 (ingest new fields) and ACFT-04 (stale filtering).

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Use `updated_at` as the only freshness signal | No schema change needed | Measures DB write time, not source observation time; misleads position freshness queries | Never for user-visible freshness signals |
| Single stale threshold for all ship types | Simpler config | Moored/anchored vessels incorrectly marked stale; port traffic goes dark | Never — ITU-R M.1371 defines different update intervals by nav_status |
| Skip deactivation sweep in AIS flush | Simpler batch flush code | `is_active` and Redis TTL diverge within one fleet-scale cycle | Acceptable only before `is_active` column exists |
| Nullable `is_active` as final state | Avoids one migration step | Queries must handle NULL as well as FALSE; `WHERE is_active = true` silently excludes NULLs | Only as a transitional step; must be resolved to NOT NULL |
| Store source timestamp as raw string (`last_update: str`) | No parsing cost at ingest | Cannot do `NOW() - last_seen_at` arithmetic; requires CAST or application-side parsing | Never for any column that drives freshness arithmetic |
| Hard-delete stale rows instead of soft expiry | Table stays small | Replay engine loses history; detail panels return 404 on recently-stale entities | Only if storage is a hard constraint — it is not here |
| Use `last_contact` instead of `time_position` for aircraft freshness | Already in the model | Marks stale positions as fresh (OpenSky generates state vectors for 300s after last contact) | Never |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| OpenSky REST API | Using `sv[4]` (`last_contact`) as position freshness | Use `sv[3]` (`time_position`); it is NULL when no GPS fix in 15s and is the authoritative position timestamp |
| OpenSky REST API | Assuming state vector position is current when `last_contact` is recent | OpenSky generates state vectors for 300s after last contact; position may be 5 minutes old with a recent `last_contact` |
| aisstream.io WebSocket | Treating `time_utc` as server-receive time | `time_utc` is the vessel's transmitted timestamp; store both `time_utc` and `fetched_at` (worker wall clock) |
| airplanes.live /v2/mil | Assuming all returned aircraft are currently airborne | airplanes.live returns cached positions; `updated_at` is the RQ task's write time, not the source observation time |
| Redis TTL (AIS) | Letting Redis key expiry be the sole freshness signal, with no PG update | Redis expiry is not observable from PostgreSQL; bridge it into `is_active` during `batch_flush_ships_to_pg` |
| SQLAlchemy `on_conflict_do_update` | Relying on `onupdate=func.now()` in the Column definition | `onupdate` is never called by upsert paths; include `"updated_at": func.now()` explicitly in every `set_={}` dict |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| `WHERE updated_at > NOW() - INTERVAL X` with no index | Slow list endpoints as table grows | Add B-tree index on `updated_at`, or partial index `WHERE is_active = true` | ~10k aircraft rows (table grows by ingest count every 90s) |
| Full `ships` table scan for deactivation sweep | `UPDATE ... WHERE mmsi NOT IN (...)` slow with large NOT IN list | Use a CTE or temp table join instead of NOT IN | ~5k rows in the NOT IN list |
| GPS jamming aggregation reads all `MilitaryAircraft` with `SELECT *` | All columns fetched when only `lat`, `lon`, `nic`, `nac_p` are needed | Column-select query: `select(MilitaryAircraft.latitude, ...)` | Low risk at current scale; bad habit to continue |
| Recomputing data age (`NOW() - time_position`) per-row in the API handler | N function calls per request | Compute and cache `data_age_seconds` at ingest time | Low risk at current entity counts |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Globe goes blank when ingest pauses | User cannot distinguish "feed is down" from "nothing tracked" | Show last-known positions with a stale indicator; include `last_updated` in API envelope |
| Freshness badge on every entity at all times | Visual noise obscures the operational picture | Show freshness only when stale (e.g., `> 5 min` for aircraft, `> 30 min` for ships) |
| GPS jamming cells that never expire | Red hexagons persist hours after jamming event ends | Dim or suppress cells older than the last aggregation run; show "as of [timestamp]" in the layer panel |
| Binary `is_active` filter with no grace period | Moored ships disappear and reappear every few minutes | Use a grace period: mark `is_active = false` only after N consecutive missed cycles, not on the first miss |
| Raw Unix timestamps in API responses | Frontend must do epoch conversion and timezone handling | Expose ISO 8601 strings for all timestamps; include a pre-computed `data_age_seconds` integer |

---

## "Looks Done But Isn't" Checklist

- [ ] **is_active migration:** Column added with `server_default` or as `nullable=True` — verify existing rows get a value, not NULL, before applying NOT NULL constraint
- [ ] **Ship deactivation:** `batch_flush_ships_to_pg` marks unseen ships `is_active = false` — verify via Redis key expiry simulation, not just a unit test against the DB
- [ ] **onupdate in upsert:** Every `on_conflict_do_update` `set_={}` dict for freshness-relevant tables includes `updated_at`, `last_seen_at`, and `fetched_at` where applicable — grep for omissions
- [ ] **Source timestamp column type:** `time_position` stored as `Integer` (Unix epoch), not `String` or `DateTime` — verify column type in the migration file
- [ ] **GPS jamming cell expiry:** Cells absent from the latest aggregation pass are flagged stale or deleted — verify by inserting a test cell manually and confirming it ages out correctly
- [ ] **AIS nav_status-aware threshold:** Stale logic differentiates moored/anchored from underway — verify with a test fixture using `nav_status=5`
- [ ] **API response envelope:** List endpoints include freshness metadata (`last_updated`, `stale` flag) — verify with integration test
- [ ] **Configurable thresholds:** Stale intervals read from config/env at startup, not hardcoded — verify `FRESH-01` config loads before any ingest cycle begins
- [ ] **No autogenerate migration:** All migration files for this milestone are hand-written — verify no partition child table names appear in any migration

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| `onupdate` not firing in upserts | LOW | Add `"updated_at": func.now()` to `set_={}` in affected workers; redeploy; rows correct on next ingest cycle |
| Empty globe from over-aggressive stale filter | LOW | Remove or relax the WHERE clause; redeploy; no data loss |
| Wrong source timestamp field used for freshness | MEDIUM | Add correct column (`time_position`); backfill from source on next ingest; old rows have NULL source timestamp until refreshed |
| `is_active` and Redis TTL drifted apart | LOW | Add deactivation sweep to flush job; run `UPDATE ships SET is_active = false WHERE ...` once manually to resync |
| Stale GPS jamming cells never pruned | LOW | Add deletion or `aggregated_at` filter; run `DELETE FROM gps_jamming_cells WHERE updated_at < NOW() - INTERVAL '26 hours'` manually once |
| `last_contact` used instead of `time_position` | MEDIUM | Fix state vector index in ingest worker (sv[3] not sv[4]); add `time_position` column; backfill NULL for existing rows |
| Alembic autogenerate drops partition children | HIGH | Do NOT apply the migration; restore from backup or revert the migration file; rewrite by hand; extend `include_object` to exclude partitions |
| Ship `last_update` as string blocks arithmetic | MEDIUM | Add `last_seen_at TIMESTAMPTZ` column via migration; backfill by CAST from existing string column; deprecate old column |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| `onupdate` not triggered in upserts | MIG-01 / ACFT-01 / SHIP-01 | Query `updated_at` and `last_seen_at` after a known ingest cycle; confirm timestamps advance |
| Empty globe from stale filter | ACFT-04 / MIL-03 / SHIP-03 | Stop ingest worker for 10 min; confirm globe shows stale-badged entities, not blank |
| `updated_at` vs source timestamp confusion | ACFT-01 / SHIP-01 / MIL-01 | Confirm `time_position` / `last_seen_at` columns present and populated |
| AIS port ships falsely marked stale | SHIP-01 / FRESH-01 | Unit test with `nav_status=5` fixture; confirm threshold longer than underway |
| NOT NULL migration fails on live table | MIG-01 | Run migration against a DB populated with production-like data before applying |
| GPS jamming cells never pruned | JAM-01 | After 25 hours uptime, query for cells older than last aggregation; confirm zero or stale-flagged |
| Clock skew breaking freshness threshold | FRESH-01 / TEST-01 | Test that mocks 60s clock offset; confirm threshold grace window absorbs it |
| Redis TTL / PostgreSQL `is_active` drift | SHIP-01 | Expire a Redis key manually; confirm PG row marked `is_active = false` within one flush cycle (30s) |
| `last_contact` vs `time_position` confusion | ACFT-01 / ACFT-04 | Assert state vector index sv[3] in ingest worker; unit test `time_position` is populated |
| Alembic autogenerate drops partitions | MIG-01 | Run `alembic upgrade --sql` against staging; assert no `DROP TABLE position_snapshots_*` |

---

## Sources

- [SQLAlchemy GitHub discussion #5903 — upserts not honoring onupdate](https://github.com/sqlalchemy/sqlalchemy/discussions/5903) — HIGH confidence
- [OpenSky REST API docs — state vector fields, time_position vs last_contact](https://openskynetwork.github.io/opensky-api/rest.html) — HIGH confidence
- [Alembic issue #539 — partitioned table autogenerate support](https://github.com/sqlalchemy/alembic/issues/539) — HIGH confidence
- [squawkhq.com — adding NOT NULL fields to PostgreSQL tables](https://squawkhq.com/docs/adding-not-nullable-field) — HIGH confidence
- [DEV Community — Alembic NotNullViolation error patterns](https://dev.to/cuddi/that-dreaded-alembic-notnullviolation-error-and-how-to-survive-it-33a1) — MEDIUM confidence
- [ITU-R M.1371-5 — AIS Class A position update intervals by navigational status](https://www.itu.int/dms_pubrec/itu-r/rec/m/R-REC-M.1371-5-201402-I!!PDF-E.pdf) — HIGH confidence
- [NAVCEN — Class A AIS Position Report update schedule](https://www.navcen.uscg.gov/ais-class-a-reports) — HIGH confidence
- [Evil Martians — soft deletion with PostgreSQL](https://evilmartians.com/chronicles/soft-deletion-with-postgresql-but-with-logic-on-the-database) — MEDIUM confidence
- Direct codebase inspection: `backend/app/workers/ingest_ais.py`, `backend/app/tasks/ingest_military.py`, `backend/app/tasks/ingest_aircraft.py`, `backend/app/tasks/ingest_gps_jamming.py`, all model definitions, all API route handlers, `backend/alembic/env.py`, all existing Alembic migrations

---
*Pitfalls research for: freshness/staleness metadata on geospatial tracking layers (v4.0 Data Reliability & Freshness)*
*Researched: 2026-03-13*
