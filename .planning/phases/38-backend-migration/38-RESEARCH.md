# Phase 38: Backend Migration - Research

**Researched:** 2026-03-15
**Domain:** Python ingest workers, SQLAlchemy models, Alembic migrations, ADSB.lol re-API
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| INGEST-01 | System ingests commercial aircraft from ADSB.lol `?all_with_pos`, replacing OpenSky | New `ingest_adsbiol.py` replaces `tasks/ingest_aircraft.py`; ADSB.lol returns `ac[]` array like airplanes.live, not OpenSky state vectors |
| INGEST-02 | System ingests military aircraft from ADSB.lol `?all_with_pos&filter_mil`, replacing airplanes.live `/v2/mil` | Same worker, different query param; `filter_mil` flag tested live (25 aircraft); parse logic identical to commercial |
| INGEST-03 | `ADSBIO_BASE_URL` env var controls ingest endpoint; no API key or OAuth2 required | Add `adsbio_base_url` to `Settings` in `config.py`; remove `opensky_client_id` / `opensky_client_secret` |
| INGEST-04 | OpenSky OAuth2 token fetch, credit budget, and rate-limit retry logic removed | Three functions in `tasks/ingest_aircraft.py` to delete: `fetch_opensky_token`, credit constants, 429-retry logic |
| INGEST-05 | Viewport bbox uses ADSB.lol `?box=<lat_s>,<lat_n>,<lon_w>,<lon_e>` (VPC-08 replay suppression preserved) | Redis `globe:viewport_bbox` key exists; ordering differs from OpenSky (lamin/lomin/lamax/lomax vs lat_s/lat_n/lon_w/lon_e) |
| SCHEMA-01 | Altitude stored in feet natively; OpenSky metres-to-feet conversion removed | `aircraft.baro_altitude` currently stores OpenSky metres — needs Alembic migration + ingest change; military already feet |
| SCHEMA-02 | `emergency` VARCHAR field on both tables | New column; ADSB.lol field name is `emergency`; values: none/general/lifeguard/minfuel/nordo/unlawful/downed |
| SCHEMA-03 | `nav_modes` JSONB array field | New column; ADSB.lol field name is `nav_modes`; values from: autopilot/vnav/althold/approach/lnav/tcas |
| SCHEMA-04 | `ias`, `tas`, `mach` FLOAT fields | New columns; ADSB.lol field names match exactly: `ias`, `tas`, `mach` |
| SCHEMA-05 | `roll` FLOAT field (degrees; negative = left bank) | New column; ADSB.lol field name is `roll` |
| SCHEMA-06 | `registration` VARCHAR and `type_code` VARCHAR from ADSB.lol `r` and `t` fields | `aircraft` table lacks these; `military_aircraft` already has them as `registration` and `aircraft_type`; need to add to `aircraft` and unify naming |
</phase_requirements>

---

## Summary

Phase 38 is a pure backend replacement: two existing ingest workers (`tasks/ingest_aircraft.py` polling OpenSky, `tasks/ingest_military.py` polling airplanes.live) are replaced by a single new worker (`tasks/ingest_adsbiol.py`) polling ADSB.lol. The ADSB.lol re-API has been verified live — it returns an `ac[]` JSON array (same shape as airplanes.live) with richer telemetry fields. The key structural difference from OpenSky is that ADSB.lol data is dict-based (not positional state vectors), already in feet, and requires no authentication.

The schema work requires a hand-written Alembic migration adding six new columns (`emergency`, `nav_modes`, `ias`, `tas`, `mach`, `roll`) to both `aircraft` and `military_aircraft` tables, plus `registration` and `type_code` to `aircraft` (already present in `military_aircraft` under different column names). There is one critical altitude unit change: the `aircraft` table currently stores OpenSky metres — after migration, ingest will write ADSB.lol feet directly, with no conversion. Existing rows containing metres values will be stale-tombstoned within one poll cycle, so no backfill is needed.

The existing RQ self-re-enqueue pattern, tombstone sweep, trail capping, viewport-bbox Redis key, and VPC-08 replay suppression all carry forward unchanged. The test suite covers `parse_military_aircraft`, `upsert_aircraft`, and the tombstone sweep — the equivalent functions in the new worker need the same test coverage.

**Primary recommendation:** Replace both ingest files with `tasks/ingest_adsbiol.py` that calls ADSB.lol for commercial (`?all_with_pos`) and military (`?all_with_pos&filter_mil`) in separate async functions with a shared parser, commit a single Alembic migration for all new columns, and update `docker-compose.yml` to swap the two OpenSky env vars for `ADSBIO_BASE_URL`.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| httpx | already in requirements.txt | Async HTTP client for ADSB.lol polling | Already used by both ingest files |
| sqlalchemy (asyncpg) | already in requirements.txt | Async ORM + pg_insert upsert | Established project pattern |
| alembic | already in requirements.txt | Schema migration | Established project pattern; hand-written only |
| redis.asyncio | already in requirements.txt | Read viewport bbox from Redis | Established pattern (same key used by current aircraft ingest) |
| pydantic-settings | already in requirements.txt | `Settings` class for env vars | Used in `config.py` |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| rq | already in requirements.txt | Self-re-enqueue after each poll cycle | Same pattern as all existing tasks |
| pytest + pytest-asyncio | already in requirements-dev.txt | Unit tests for parse/upsert helpers | All new ingest helpers must have unit tests |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Single unified ingest file | Separate commercial + military files | Single file reduces duplication and matches project STATE.md architectural decision |
| Polling interval 15s (no credit cap) | 30s or 60s | 15s is feasible — ADSB.lol has no credit limit; STATE.md notes this explicitly |

**Installation:** No new dependencies required — all libraries are already in `requirements.txt`.

---

## Architecture Patterns

### Recommended Project Structure

```
backend/app/tasks/
├── ingest_adsbiol.py     # NEW: replaces ingest_aircraft.py + ingest_military.py
├── ingest_aircraft.py    # DELETE (or keep as tombstone stub)
├── ingest_military.py    # DELETE (or keep as tombstone stub)
├── ingest_gdelt.py       # unchanged
├── ingest_gps_jamming.py # unchanged
├── ingest_satellites.py  # unchanged
└── snapshot_positions.py # unchanged

backend/app/models/
├── aircraft.py           # ADD: emergency, nav_modes, ias, tas, mach, roll, registration, type_code
├── military_aircraft.py  # ADD: emergency, nav_modes, ias, tas, mach, roll
└── ...                   # unchanged

backend/alembic/versions/
└── <hash>_adsb_lol_schema.py  # NEW: single migration adding all new columns to both tables
```

### Pattern 1: ADSB.lol Dict-Based Parser (replaces OpenSky positional state vectors)

**What:** ADSB.lol returns `{"ac": [{...}, ...]}` where each aircraft is a dict. No positional index access — use `.get()` with defaults.

**When to use:** For all field extraction in the new ingest file.

**Example (verified against live API response documented in STATE.md):**
```python
# ADSB.lol aircraft dict — fields present when aircraft is airborne and equipped
def parse_adsbiol_aircraft(ac: dict) -> dict | None:
    """Parse one aircraft dict from ADSB.lol ?all_with_pos response.
    Returns None if lat or lon is missing.
    Normalises alt_baro='ground' to None (same as airplanes.live pattern).
    """
    if ac.get("lat") is None or ac.get("lon") is None:
        return None

    raw_alt = ac.get("alt_baro")
    alt_baro: float | None = None if raw_alt == "ground" else raw_alt

    return {
        "icao24": ac.get("hex"),
        "callsign": (ac.get("flight") or "").strip() or None,
        "latitude": ac.get("lat"),
        "longitude": ac.get("lon"),
        "baro_altitude": alt_baro,       # feet natively — no conversion
        "velocity": ac.get("gs"),        # ground speed knots
        "true_track": ac.get("track"),
        "vertical_rate": ac.get("baro_rate"),
        "registration": ac.get("r"),
        "type_code": ac.get("t"),
        "emergency": ac.get("emergency"),
        "nav_modes": ac.get("nav_modes"),  # list or None
        "ias": ac.get("ias"),
        "tas": ac.get("tas"),
        "mach": ac.get("mach"),
        "roll": ac.get("roll"),
    }
```

### Pattern 2: Viewport Bbox — Parameter Format Change

**What:** OpenSky used `?lamin=&lomin=&lamax=&lomax=`. ADSB.lol uses `?box=<lat_s>,<lat_n>,<lon_w>,<lon_e>`.

**Current Redis key value format:** `"lamin,lomin,lamax,lomax"` (written by `routes_viewport.py` as `min_lat,min_lon,max_lat,max_lon`).

**Mapping required:**
```python
# Redis stores: "min_lat,min_lon,max_lat,max_lon"
# ADSB.lol box=: lat_s,lat_n,lon_w,lon_e
# min_lat = lat_s (south), max_lat = lat_n (north)
# min_lon = lon_w (west),  max_lon = lon_e (east)
# So: box={min_lat},{max_lat},{min_lon},{max_lon}
raw = await redis_client.get("globe:viewport_bbox")
min_lat, min_lon, max_lat, max_lon = raw.decode().split(",")
box_param = f"?box={min_lat},{max_lat},{min_lon},{max_lon}"
```

**VPC-08 preservation:** Apply box only in live mode. The worker has no mode awareness — it reads `effectiveBbox` from Redis. The existing pattern is: Redis key absent in replay mode (frontend does not push bbox updates during replay). This is unchanged.

### Pattern 3: Self-Re-Enqueue (unchanged from existing workers)

```python
def sync_ingest_adsbiol_commercial() -> None:
    try:
        asyncio.run(ingest_commercial_aircraft())
    except Exception as exc:
        logger.exception("Commercial aircraft ingest failed: %s", exc)
        raise
    finally:
        from redis import Redis
        from rq import Queue
        conn = Redis.from_url(os.getenv("REDIS_URL", "redis://redis:6379/0"))
        q = Queue(connection=conn)
        q.enqueue_in(timedelta(seconds=POLL_INTERVAL_SECONDS), sync_ingest_adsbiol_commercial)
```

### Pattern 4: Hand-Written Alembic Migration

**CRITICAL project rule (from STATE.md):** Hand-written migrations only — never autogenerate. The `position_snapshots` table is range-partitioned and autogenerate will corrupt it.

```python
# alembic/versions/<hash>_adsb_lol_schema.py
def upgrade() -> None:
    # aircraft table — new telemetry fields
    op.add_column('aircraft', sa.Column('emergency', sa.String(), nullable=True))
    op.add_column('aircraft', sa.Column('nav_modes', postgresql.JSONB(astext_type=sa.Text()), nullable=True))
    op.add_column('aircraft', sa.Column('ias', sa.Float(), nullable=True))
    op.add_column('aircraft', sa.Column('tas', sa.Float(), nullable=True))
    op.add_column('aircraft', sa.Column('mach', sa.Float(), nullable=True))
    op.add_column('aircraft', sa.Column('roll', sa.Float(), nullable=True))
    op.add_column('aircraft', sa.Column('registration', sa.String(), nullable=True))
    op.add_column('aircraft', sa.Column('type_code', sa.String(), nullable=True))

    # military_aircraft table — same telemetry fields
    op.add_column('military_aircraft', sa.Column('emergency', sa.String(), nullable=True))
    op.add_column('military_aircraft', sa.Column('nav_modes', postgresql.JSONB(astext_type=sa.Text()), nullable=True))
    op.add_column('military_aircraft', sa.Column('ias', sa.Float(), nullable=True))
    op.add_column('military_aircraft', sa.Column('tas', sa.Float(), nullable=True))
    op.add_column('military_aircraft', sa.Column('mach', sa.Float(), nullable=True))
    op.add_column('military_aircraft', sa.Column('roll', sa.Float(), nullable=True))
```

### Anti-Patterns to Avoid

- **Do NOT run `alembic revision --autogenerate`:** Will corrupt the range-partitioned `position_snapshots` table. Hand-write every migration.
- **Do NOT access ADSB.lol fields by positional index:** Response is a dict, not a list. OpenSky's `sv[5]`-style indexing does not apply.
- **Do NOT add metres-to-feet conversion:** ADSB.lol altitude is already feet. Adding a conversion would double-convert and produce wrong values.
- **Do NOT send `?box=` in replay mode:** VPC-08 requires bbox suppression during replay. The existing Redis TTL mechanism handles this passively (no key = no bbox param).
- **Do NOT keep `OPENSKY_CLIENT_ID` / `OPENSKY_CLIENT_SECRET` as required env vars in `docker-compose.yml`:** Remove the `:?` required syntax to avoid startup failure when the vars are absent.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| HTTP requests to ADSB.lol | Custom urllib wrapper | httpx.AsyncClient (already in codebase) | Timeout, error handling, async |
| JSONB array storage for nav_modes | Custom serialisation | `postgresql.JSONB` column (same as `trail`) | Already proven pattern in this codebase |
| Scheduled polling | asyncio.sleep loop | RQ self-re-enqueue pattern (same as existing workers) | Survives worker restart; proven in 5 existing tasks |
| Bbox param construction | Custom URL builder | f-string with Redis key values (established pattern) | Already done in `ingest_aircraft.py` |

---

## Common Pitfalls

### Pitfall 1: Bbox Parameter Coordinate Order Mismatch

**What goes wrong:** ADSB.lol `?box=` expects `lat_s,lat_n,lon_w,lon_e` but the Redis key stores `min_lat,min_lon,max_lat,max_lon` (written by `routes_viewport.py`). If you naively pass the stored value straight to `?box=`, the parameter order is wrong and results will be silently incorrect or empty.

**Why it happens:** OpenSky and ADSB.lol use different bbox parameter conventions. The Redis storage format was designed for OpenSky's `lamin/lomin/lamax/lomax` order.

**How to avoid:** Always re-map: `box={min_lat},{max_lat},{min_lon},{max_lon}` where min_lat=lat_s, max_lat=lat_n, min_lon=lon_w, max_lon=lon_e.

**Warning signs:** Ingest returns far fewer aircraft than expected, or zero aircraft, when viewport is set.

### Pitfall 2: Altitude Unit Confusion on Existing Aircraft Rows

**What goes wrong:** After migration, new ingest writes feet. Old rows from OpenSky ingest contain metres. A frontend displaying altitude will show mixed units for the brief period between migration and the first poll tombstoning all old rows.

**Why it happens:** OpenSky altitude was in metres; ADSB.lol is in feet. The `baro_altitude` column is not renamed.

**How to avoid:** Document that existing rows are stale and will be tombstoned within one poll cycle (~15s). No data backfill is needed or correct. The frontend should not attempt to show altitude of tombstoned (`is_active=False`) rows.

**Warning signs:** Altitude values of ~1/3 the expected value in the DB immediately after migration (metres instead of feet).

### Pitfall 3: `nav_modes` Field Absent vs. Empty Array

**What goes wrong:** ADSB.lol omits `nav_modes` entirely when no modes are active. Storing `None` vs. `[]` inconsistently causes frontend checks like `nav_modes.length` to throw.

**Why it happens:** ADSB.lol omits fields rather than providing null/empty values when data is unavailable.

**How to avoid:** In the parser, use `ac.get("nav_modes")` which returns `None` when absent. Store `None` in the DB (JSONB nullable). Frontend must treat both `None` and `[]` as "no active modes."

### Pitfall 4: `emergency` Field Default Value

**What goes wrong:** ADSB.lol sends `"emergency": "none"` for normal aircraft (not Python `None`). A check of `if record.emergency` would incorrectly treat `"none"` as falsy behaviour in string context.

**Why it happens:** `"none"` is a string literal, not null. Python `if "none"` evaluates to True.

**How to avoid:** Store the raw string value. Frontend/display logic must compare `!== "none"` not truthiness.

### Pitfall 5: Missing `ADSBIO_BASE_URL` in `docker-compose.yml` Worker Service

**What goes wrong:** Adding the env var to `Settings` but forgetting to add it to `docker-compose.yml` worker service means the default URL is used and the var cannot be changed without a code edit — violating INGEST-03.

**Why it happens:** The worker and backend services have separate environment blocks.

**How to avoid:** Add `ADSBIO_BASE_URL: ${ADSBIO_BASE_URL:-https://re-api.adsb.lol}` to both `backend` and `worker` service environment blocks in `docker-compose.yml`.

### Pitfall 6: Existing Test Files Reference OpenSky-Specific Functions

**What goes wrong:** `test_ingest_aircraft.py` and `test_ingest_military.py` import `fetch_opensky_token`, `fetch_aircraft_states` (OpenSky), and assert `OPENSKY_CLIENT_ID` env var presence. These tests will fail or become misleading after the migration.

**Why it happens:** Tests are tightly coupled to implementation details of the workers being replaced.

**How to avoid:** Write a new `test_ingest_adsbiol.py` covering the new parser and upsert logic. Retire the OpenSky-specific test assertions. The existing `test_ingest_military.py` tests for `parse_military_aircraft` and tombstone logic remain valid patterns to replicate.

---

## Code Examples

### ADSB.lol Live Response Structure (verified, from STATE.md)

```json
{
  "ac": [
    {
      "hex": "a1b2c3",
      "flight": "UAL123 ",
      "lat": 37.621,
      "lon": -122.379,
      "alt_baro": 35000,
      "gs": 480,
      "track": 270.0,
      "baro_rate": -64,
      "r": "N12345",
      "t": "B738",
      "emergency": "none",
      "nav_modes": ["autopilot", "althold"],
      "ias": 280,
      "tas": 460,
      "mach": 0.78,
      "roll": 0.0,
      "seen": 0.1
    }
  ],
  "total": 4717,
  "now": 1710000000.0
}
```

### Config.py Addition

```python
# Source: existing config.py pattern
class Settings(BaseSettings):
    # ... existing fields ...
    adsbio_base_url: str = "https://re-api.adsb.lol"
    # REMOVED: opensky_client_id, opensky_client_secret
```

### Worker Enqueue Change in worker.py

```python
# Replace two separate enqueue calls:
# queue.enqueue("app.tasks.ingest_aircraft.sync_ingest_aircraft")
# queue.enqueue("app.tasks.ingest_military.sync_ingest_military")

# With two calls to the unified ingest:
queue.enqueue("app.tasks.ingest_adsbiol.sync_ingest_commercial")
queue.enqueue("app.tasks.ingest_adsbiol.sync_ingest_military")
```

### docker-compose.yml Change

```yaml
# Remove from backend and worker services:
# OPENSKY_CLIENT_ID: ${OPENSKY_CLIENT_ID:?Set OPENSKY_CLIENT_ID in .env}
# OPENSKY_CLIENT_SECRET: ${OPENSKY_CLIENT_SECRET:?Set OPENSKY_CLIENT_SECRET in .env}

# Add to backend and worker services:
ADSBIO_BASE_URL: ${ADSBIO_BASE_URL:-https://re-api.adsb.lol}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| OpenSky positional state vectors (`sv[5]`, `sv[6]`) | ADSB.lol dict-based `ac.get("lat")` | Phase 38 | Parser becomes simpler; no positional index fragility |
| OAuth2 token fetch every ~60min | No auth (IP-based feeder access) | Phase 38 | ~40 lines of token fetch + refresh logic deleted |
| 90s poll interval (4,000 credit/day cap) | 15s poll interval (no credit cap) | Phase 38 | 6x fresher positions |
| Separate sources: OpenSky (commercial) + airplanes.live (military) | Single source: ADSB.lol (both) | Phase 38 | One base URL to configure, one parser pattern |
| Altitude in metres (OpenSky, commercial only) | Altitude in feet natively | Phase 38 | No conversion; `aircraft` and `military_aircraft` now both store feet |

**Deprecated/outdated:**
- `fetch_opensky_token()`: Removed entirely — no OAuth2 in ADSB.lol.
- `OPENSKY_TOKEN_URL`, `OPENSKY_STATES_URL` constants: Deleted with `ingest_aircraft.py`.
- OpenSky `429` rate-limit handling: Deleted — ADSB.lol has no rate limit for feeders.
- `OPENSKY_CLIENT_ID`, `OPENSKY_CLIENT_SECRET` env vars: Removed from `docker-compose.yml` and `Settings`.

---

## Open Questions

1. **Existing military_aircraft column naming: `aircraft_type` vs `type_code`**
   - What we know: `military_aircraft` has `aircraft_type` (from ADSB.lol `t` field). SCHEMA-06 uses the name `type_code`.
   - What's unclear: Should the commercial `aircraft` table column be `type_code` (matching SCHEMA-06 spec) or `aircraft_type` (matching existing military pattern)?
   - Recommendation: Use `type_code` on `aircraft` table per SCHEMA-06 wording. The `military_aircraft` table already has `aircraft_type` — leave it unchanged to avoid a breaking rename migration. The two tables need not be symmetric on this column name.

2. **Tombstone sweep scope for the commercial ingest after migration**
   - What we know: The current commercial ingest does a tombstone sweep across the entire `aircraft` table (any icao24 not in the current response set is marked inactive). With ADSB.lol viewport bbox applied, the response is a subset — a global tombstone sweep would incorrectly mark aircraft outside the viewport as inactive.
   - What's unclear: Whether the tombstone sweep should be skipped when using bbox mode, or limited to aircraft last seen within the bbox.
   - Recommendation: Skip the tombstone sweep entirely when `?box=` is active (same as the implicit behaviour today — OpenSky bbox mode did not do per-call tombstoning either). Only perform tombstone when fetching the global feed (no bbox). Alternatively: preserve existing behaviour and only tombstone when valid count > threshold (e.g. >1000 aircraft, indicating a global response).

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | pytest + pytest-asyncio |
| Config file | `backend/pytest.ini` |
| Quick run command | `cd backend && python -m pytest tests/test_ingest_adsbiol.py -x -q` |
| Full suite command | `cd backend && python -m pytest -x -q` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| INGEST-01 | `parse_adsbiol_aircraft` returns None for null lat/lon | unit | `pytest tests/test_ingest_adsbiol.py::test_null_position_filtered -x` | ❌ Wave 0 |
| INGEST-01 | `parse_adsbiol_aircraft` extracts all commercial fields from dict | unit | `pytest tests/test_ingest_adsbiol.py::test_parse_commercial_aircraft -x` | ❌ Wave 0 |
| INGEST-02 | Military and commercial use same parser; `filter_mil` param present in URL | unit | `pytest tests/test_ingest_adsbiol.py::test_military_url_has_filter_mil -x` | ❌ Wave 0 |
| INGEST-03 | `ADSBIO_BASE_URL` env var changes the request URL | unit | `pytest tests/test_ingest_adsbiol.py::test_base_url_configurable -x` | ❌ Wave 0 |
| INGEST-04 | No reference to `OPENSKY_CLIENT_ID` or `fetch_opensky_token` in codebase | unit (grep) | `pytest tests/test_ingest_adsbiol.py::test_no_opensky_references -x` | ❌ Wave 0 |
| INGEST-05 | Bbox query uses `?box=lat_s,lat_n,lon_w,lon_e` format | unit | `pytest tests/test_ingest_adsbiol.py::test_bbox_param_format -x` | ❌ Wave 0 |
| INGEST-05 | Bbox param absent when Redis key missing (replay mode) | unit | `pytest tests/test_ingest_adsbiol.py::test_no_bbox_when_redis_empty -x` | ❌ Wave 0 |
| SCHEMA-01 | `alt_baro='ground'` normalised to None; numeric values stored as-is (feet) | unit | `pytest tests/test_ingest_adsbiol.py::test_ground_altitude_normalised -x` | ❌ Wave 0 |
| SCHEMA-02 | `emergency` field stored verbatim including `"none"` string | unit | `pytest tests/test_ingest_adsbiol.py::test_emergency_field_stored -x` | ❌ Wave 0 |
| SCHEMA-03 | `nav_modes` stored as list (JSONB); None when absent | unit | `pytest tests/test_ingest_adsbiol.py::test_nav_modes_field -x` | ❌ Wave 0 |
| SCHEMA-04 | `ias`, `tas`, `mach` extracted from dict; None when absent | unit | `pytest tests/test_ingest_adsbiol.py::test_speed_fields -x` | ❌ Wave 0 |
| SCHEMA-05 | `roll` extracted; None when absent | unit | `pytest tests/test_ingest_adsbiol.py::test_roll_field -x` | ❌ Wave 0 |
| SCHEMA-06 | `registration` and `type_code` extracted from `r` and `t` fields | unit | `pytest tests/test_ingest_adsbiol.py::test_registration_type_fields -x` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `cd backend && python -m pytest tests/test_ingest_adsbiol.py -x -q`
- **Per wave merge:** `cd backend && python -m pytest -x -q`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `tests/test_ingest_adsbiol.py` — covers all INGEST-* and SCHEMA-* requirements above (pure unit tests, no DB needed)
- [ ] Existing `tests/test_ingest_aircraft.py` — references `OPENSKY_CLIENT_ID` env var; must be updated or retired when `ingest_aircraft.py` is deleted

*(Shared fixtures in `tests/conftest.py` already exist and cover NullPool DB engine — no changes needed)*

---

## Sources

### Primary (HIGH confidence)

- **STATE.md** — ADSB.lol API verified live: base URL, endpoints, field names, live response counts, units confirmed
- **REQUIREMENTS.md** — All requirement IDs, field names, and success criteria
- **backend/app/tasks/ingest_aircraft.py** — Full OpenSky ingest implementation being replaced
- **backend/app/tasks/ingest_military.py** — Full airplanes.live ingest implementation being replaced
- **backend/app/models/aircraft.py** — Current Aircraft model columns
- **backend/app/models/military_aircraft.py** — Current MilitaryAircraft model columns
- **backend/alembic/versions/a4f7c2e9b1d3_add_freshness_columns.py** — Established migration pattern
- **backend/app/config.py** — Current Settings fields
- **backend/app/worker.py** — Current task enqueue pattern
- **docker-compose.yml** — Current env var configuration
- **backend/tests/test_ingest_military.py** — Test patterns to replicate for new worker

### Secondary (MEDIUM confidence)

- **backend/app/api/routes_viewport.py** — Confirms Redis key name and storage format for bbox
- **backend/app/api/routes_aircraft.py** — Confirms API response shape (no changes needed in Phase 38)

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already in project; no new dependencies
- Architecture: HIGH — patterns directly observed in existing codebase
- Pitfalls: HIGH — derived from direct code inspection of the files being replaced
- ADSB.lol API fields: HIGH — verified live per STATE.md; field names confirmed against REQUIREMENTS.md

**Research date:** 2026-03-15
**Valid until:** 2026-04-15 (ADSB.lol re-API is a stable hosted endpoint; field names unlikely to change)
