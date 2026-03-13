# Architecture Research

**Domain:** FastAPI + SQLAlchemy freshness metadata and stale filtering — v4.0 Data Reliability
**Researched:** 2026-03-13
**Confidence:** HIGH — based on direct codebase analysis of all existing models, routes, ingest tasks, and workers

> **Scope note:** This document covers ONLY the architectural changes required for v4.0. The base architecture
> (FastAPI, SQLAlchemy async, PostgreSQL + PostGIS, Redis, RQ, Alembic, Docker Compose) is shipped and validated.
> This research answers three focused questions: where does stale filtering logic live, how are thresholds
> configured, and how does the GPS jamming derived layer expose source freshness.

---

## Standard Architecture

### System Overview — v4.0 Freshness Layer Additions

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                           config.py (Settings)                                │
│  database_url  redis_url  frontend_origin  version                            │
│  + stale_threshold_aircraft_s      (NEW — env var, default 120)               │
│  + stale_threshold_military_s      (NEW — env var, default 600)               │
│  + stale_threshold_ships_s         (NEW — env var, default 900)               │
└──────────────────────┬───────────────────────────────────────────────────────┘
                       │ imported by
┌──────────────────────▼──────────────────────────────────────────────────────┐
│                   app/freshness.py  (NEW — shared helper module)              │
│                                                                               │
│  is_stale(timestamp, threshold_seconds) -> bool                               │
│  stale_cutoff(threshold_seconds) -> datetime                                  │
└────┬──────────────┬────────────────┬───────────────────────────────────────-─┘
     │              │                │
     │     imported by               │
┌────▼──────┐  ┌────▼──────┐  ┌─────▼──────┐
│routes_    │  │routes_    │  │routes_     │
│aircraft   │  │military   │  │ships       │
│.py        │  │.py        │  │.py         │
│           │  │           │  │            │
│stale      │  │stale      │  │stale       │
│WHERE      │  │WHERE      │  │WHERE       │
│clause     │  │clause     │  │clause      │
│in query   │  │in query   │  │in query    │
└───────────┘  └───────────┘  └────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│                         ingest tasks (MODIFIED)                               │
│                                                                               │
│  ingest_aircraft.py    — capture fetched_at (func.now()), time_position,      │
│                          geo_altitude, vertical_rate, position_source          │
│                                                                               │
│  ingest_military.py    — capture fetched_at (func.now()), set is_active=True  │
│                          run tombstone pass: is_active=False for stale rows    │
│                                                                               │
│  ingest_ais.py         — capture last_seen_at from Redis TTL touch,           │
│                          set is_active from TTL-alive status during flush      │
└──────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│                     ingest_gps_jamming.py (MODIFIED)                          │
│                                                                               │
│  reads: military_aircraft rows WHERE is_active = TRUE  (filters stale source) │
│  adds to response: source_fetched_at (max of military_aircraft.fetched_at)    │
│                    source_is_stale (bool — is source_fetched_at old?)          │
│                    aggregated_at (timestamp of this aggregation run)           │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Status for v4.0 |
|-----------|----------------|-----------------|
| `app/config.py` | All configurable settings via pydantic-settings, loaded from env vars | MODIFY — add stale threshold fields |
| `app/freshness.py` | Shared helpers: stale cutoff computation, is_stale boolean | NEW |
| `app/models/aircraft.py` | Aircraft ORM model | MODIFY — add fetched_at, time_position, geo_altitude, vertical_rate, position_source, is_active |
| `app/models/military_aircraft.py` | MilitaryAircraft ORM model | MODIFY — add fetched_at, last_seen_at, is_active |
| `app/models/ship.py` | Ship ORM model | MODIFY — add last_seen_at, is_active |
| `app/models/gps_jamming.py` | GpsJammingCell ORM model | MODIFY — add source_fetched_at, aggregated_at, source_is_stale |
| `app/tasks/ingest_aircraft.py` | OpenSky ingest — batch upsert every 90s | MODIFY — write new fields; mark stale rows as is_active=False |
| `app/tasks/ingest_military.py` | airplanes.live ingest — batch upsert every 300s | MODIFY — write fetched_at, is_active=True; tombstone stale rows |
| `app/workers/ingest_ais.py` | AIS WebSocket worker — flush every 30s | MODIFY — write last_seen_at, is_active during flush |
| `app/tasks/ingest_gps_jamming.py` | Aggregate military NIC/NACp into H3 cells | MODIFY — filter by is_active, write freshness metadata to cells |
| `app/api/routes_aircraft.py` | Aircraft API routes | MODIFY — add stale WHERE clause, expose is_active/fetched_at in response |
| `app/api/routes_military.py` | Military aircraft API routes | MODIFY — add stale WHERE clause, expose is_active/last_seen_at |
| `app/api/routes_ships.py` | Ships API routes | MODIFY — add stale WHERE clause, expose is_active/last_seen_at |
| `app/api/routes_gps_jamming.py` | GPS jamming API routes | MODIFY — expose source freshness fields in response |
| `alembic/versions/` | Schema migration files | NEW migration covering all four model changes |

---

## Recommended Project Structure

```
backend/app/
├── config.py               # MODIFY — add 3 stale threshold fields
├── freshness.py            # NEW — shared stale cutoff + is_stale helpers
├── models/
│   ├── aircraft.py         # MODIFY — add fetched_at, time_position, geo_altitude,
│   │                       #           vertical_rate, position_source, is_active
│   ├── military_aircraft.py# MODIFY — add fetched_at, last_seen_at, is_active
│   ├── ship.py             # MODIFY — add last_seen_at, is_active
│   └── gps_jamming.py      # MODIFY — add source_fetched_at, aggregated_at, source_is_stale
├── api/
│   ├── routes_aircraft.py  # MODIFY — stale WHERE clause in list_aircraft query
│   ├── routes_military.py  # MODIFY — stale WHERE clause in list_military_aircraft
│   ├── routes_ships.py     # MODIFY — stale WHERE clause in list_ships
│   └── routes_gps_jamming.py # MODIFY — expose source_fetched_at, aggregated_at, source_is_stale
├── tasks/
│   ├── ingest_aircraft.py  # MODIFY — capture new OpenSky fields + is_active lifecycle
│   ├── ingest_military.py  # MODIFY — write fetched_at + tombstone stale rows
│   └── ingest_gps_jamming.py # MODIFY — filter source by is_active + write freshness metadata
└── workers/
    └── ingest_ais.py       # MODIFY — write last_seen_at + is_active during flush

backend/alembic/versions/
└── <hash>_add_freshness_fields.py  # NEW — single migration covering all four tables
```

### Structure Rationale

- **`freshness.py` as shared helper:** Stale threshold logic must not be duplicated across three route files. A shared module also makes it trivially testable in isolation. It takes threshold values (in seconds) as parameters — it does not read settings directly. This makes each caller explicit about which threshold applies.
- **Stale filtering in route query layer, not model:** See Pattern 1 below for full rationale.
- **Single Alembic migration for all four tables:** All changes are in one milestone. A single migration is atomically applied or rolled back, avoiding partial states where some tables have freshness fields and others do not.

---

## Architectural Patterns

### Pattern 1: Stale Filtering in the Route Query, Not the Model

**What:** The stale threshold comparison (`WHERE updated_at > NOW() - INTERVAL '...'` or equivalently `WHERE fetched_at >= :cutoff`) lives in the route's SQLAlchemy `select()` statement, not in a model class method or a SQLAlchemy event.

**When to use:** Always, for this codebase. This is the correct placement for three reasons:

1. **Threshold is configuration, not data invariant.** The stale threshold for aircraft (default 120s) differs from ships (default 900s). A model method cannot know its caller's threshold — it would need to accept a parameter, making it indistinguishable from a standalone function.
2. **List vs detail endpoints need different behavior.** The list endpoint (`GET /api/aircraft/`) filters stale entities. The detail endpoint (`GET /api/aircraft/{icao24}`) should return any entity with its freshness metadata exposed — callers need to know *why* something is stale. Embedding filtering in the model would make detail endpoints awkward.
3. **Async SQLAlchemy ORM models are not the right place for query logic.** `@classmethod` query methods on `Base` subclasses work but are difficult to compose with other filters. The existing codebase pattern (direct `select()` in route handlers) is consistent; maintaining that consistency reduces cognitive overhead.

**Trade-off:** Route handlers accumulate more lines. Mitigated by the shared `freshness.py` helper that computes the cutoff datetime.

**Correct implementation:**
```python
# app/freshness.py
from datetime import datetime, timezone, timedelta

def stale_cutoff(threshold_seconds: int) -> datetime:
    """Return the datetime before which rows are considered stale."""
    return datetime.now(timezone.utc) - timedelta(seconds=threshold_seconds)

def is_stale(timestamp: datetime | None, threshold_seconds: int) -> bool:
    """True if timestamp is None or older than threshold_seconds ago."""
    if timestamp is None:
        return True
    return timestamp < stale_cutoff(threshold_seconds)
```

```python
# app/api/routes_aircraft.py  (modified list endpoint)
from app.freshness import stale_cutoff
from app.config import settings

@router.get("")
async def list_aircraft(db: AsyncSession = Depends(get_db)):
    cutoff = stale_cutoff(settings.stale_threshold_aircraft_s)
    result = await db.execute(
        select(Aircraft).where(
            Aircraft.latitude.is_not(None),
            Aircraft.longitude.is_not(None),
            Aircraft.is_active == True,
            Aircraft.fetched_at >= cutoff,
        )
    )
    ...
```

**Anti-pattern to avoid:**
```python
# DO NOT put this on the model:
class Aircraft(Base):
    @classmethod
    async def get_active(cls, session, threshold_s: int):
        ...  # This is a query method masquerading as a model method
```

---

### Pattern 2: Configurable Thresholds via pydantic-settings (Not os.getenv)

**What:** All stale thresholds are declared as fields in the existing `Settings` class in `config.py`. They are read from environment variables via pydantic-settings, with defaults that are safe for the intended poll cadence.

**When to use:** Always. The `Settings` class already exists and handles the pydantic-settings + `.env` file pattern. Adding fields here is zero friction and keeps configuration in one place.

**Recommended defaults:**
- Aircraft: `stale_threshold_aircraft_s = 120` — OpenSky polls every 90s; 120s allows one missed poll
- Military: `stale_threshold_military_s = 600` — airplanes.live polls every 300s; 600s allows one missed poll
- Ships: `stale_threshold_ships_s = 900` — Redis TTL is 600s; 900s allows for flush lag

```python
# app/config.py (modified)
class Settings(BaseSettings):
    model_config = ConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/opensignal"
    redis_url: str = "redis://localhost:6379/0"
    frontend_origin: str = "http://localhost:3000"
    version: str = "0.1.0"

    # Stale filtering thresholds (seconds)
    stale_threshold_aircraft_s: int = 120
    stale_threshold_military_s: int = 600
    stale_threshold_ships_s: int = 900
```

**Why not `os.getenv()` in the route handler:**

The tasks (`ingest_aircraft.py`, `ingest_military.py`) currently use `os.getenv("REDIS_URL")` directly inside the RQ sync wrapper. This is a known inconsistency in the codebase: tasks run in a separate RQ worker process where the FastAPI `Settings` object is not initialized. For ingest tasks, `os.getenv` is pragmatic. For API routes (which run in the FastAPI process), `settings` is already imported — use it.

The thresholds only need to be read in routes (not in tasks), so declaring them in `Settings` is appropriate. Ingest tasks do not need to know the stale threshold — they write timestamps and `is_active` flags; the route layer decides what is "stale enough to filter."

---

### Pattern 3: is_active Lifecycle — Tombstone on Next Poll

**What:** `is_active` is a boolean column on `military_aircraft`, `ships`, and `aircraft`. It is set to `True` when a row is created or updated with a fresh position. It is set to `False` (tombstoned) by the *same ingest task* that wrote it, on a subsequent poll, once the row's timestamp is old enough.

**When to use:** For any entity that disappears between polls rather than sending a "gone" signal. Both airplanes.live and aisstream.io are snapshot-only sources — they send positions of entities currently transmitting, not tombstone messages for entities that stopped.

**The tombstone pattern:**
```
Poll N:   entity A present → is_active=True, fetched_at=now()
Poll N+1: entity A absent  → tombstone pass: set is_active=False WHERE fetched_at < (now() - interval)
          entity A present  → is_active stays True (updated normally)
```

**Implementation location:** The tombstone pass runs at the end of `ingest_military_aircraft()` and `ingest_aircraft()`, after the upsert loop, within the same database session and commit. It uses a bulk UPDATE:

```python
# At the end of the ingest function, within the same AsyncSessionLocal session:
from sqlalchemy import update as sa_update

tombstone_cutoff = datetime.now(timezone.utc) - timedelta(seconds=STALE_SECONDS_FOR_TOMBSTONE)
await session.execute(
    sa_update(MilitaryAircraft)
    .where(MilitaryAircraft.fetched_at < tombstone_cutoff)
    .values(is_active=False)
)
await session.commit()
```

**For ships:** The AIS worker does not run on a fixed interval that makes tombstoning clean. Ships use Redis TTL (600s) as the source of truth for "is this ship still reporting." `is_active` for ships should be set to `False` during `batch_flush_ships_to_pg` for any ship whose Redis key has expired (not found in the Redis scan). Since `batch_flush_ships_to_pg` only processes ships currently in Redis, any ship *absent* from Redis is not flushed — it stays in PostgreSQL with whatever `updated_at` it last had. The stale cutoff in the route query (`WHERE last_seen_at >= cutoff`) handles this case without a separate tombstone pass.

**Distinction between `fetched_at` and `last_seen_at`:**
- `fetched_at`: timestamp set by the ingest task when it wrote the row. Tracks when the backend last successfully polled the source.
- `last_seen_at`: for ships, the timestamp from the AIS source itself (`time_utc` field from aisstream.io). Tracks when the vessel was last observed by the source, independent of backend polling lag.
- For aircraft, OpenSky's `last_contact` (Unix epoch integer) maps to `last_seen_at`. `fetched_at` is the time the backend ran the ingest.

---

### Pattern 4: GPS Jamming Source Freshness — Propagate, Don't Recompute

**What:** `gps_jamming_cells` is a derived table. Its freshness depends entirely on the freshness of `military_aircraft`. The route response must expose two things: when the aggregation was computed (`aggregated_at`) and whether the underlying source was stale when the aggregation ran (`source_is_stale`, `source_fetched_at`).

**How it works:**

At aggregation time in `ingest_gps_jamming.py`, after loading military aircraft rows:

```python
# After fetching military aircraft rows:
source_fetched_at = max(
    (ac.fetched_at for ac in aircraft_rows if ac.fetched_at is not None),
    default=None,
)
source_is_stale = source_fetched_at is None or (
    source_fetched_at < datetime.now(timezone.utc) - timedelta(seconds=MILITARY_STALE_THRESHOLD)
)
aggregated_at = datetime.now(timezone.utc)
```

These three values are written to **all cells in the batch** during the upsert. The `gps_jamming_cells` table gains columns: `source_fetched_at TIMESTAMPTZ`, `source_is_stale BOOLEAN`, `aggregated_at TIMESTAMPTZ`.

The route returns these fields in the response envelope:

```json
{
  "aggregated_at": "2026-03-13T10:00:00Z",
  "source_fetched_at": "2026-03-13T09:55:00Z",
  "source_is_stale": false,
  "cells": [
    { "h3index": "...", "bad_ratio": 0.6, "severity": "red", "aircraft_count": 5, "updated_at": "..." }
  ]
}
```

**Why store these on every cell row rather than in a separate metadata table:**

The existing `gps_jamming_cells` table is the natural place. A separate `gps_jamming_metadata` table would require a JOIN or a separate API call. Since all cells from one aggregation run share the same `source_fetched_at` and `aggregated_at`, storing it redundantly on each row is the least-friction approach. The values are identical across all rows in a batch — not logically different data, just denormalized for query simplicity. At the scale of this application (hundreds of H3 cells, not millions), the storage overhead is negligible.

**The route computes the response-level freshness fields from the first cell:**

```python
# In routes_gps_jamming.py
if cells:
    first = cells[0]
    aggregated_at = first.aggregated_at
    source_fetched_at = first.source_fetched_at
    source_is_stale = first.source_is_stale
else:
    aggregated_at = source_fetched_at = None
    source_is_stale = True  # no data = stale
```

---

## Data Flow

### Aircraft Freshness Flow

```
OpenSky API (every 90s)
    ↓
ingest_aircraft() — async function
    ↓ (for each state vector)
pg_insert(Aircraft).values(
    fetched_at=func.now(),
    time_position=sv[3],         # Unix timestamp of last position fix
    geo_altitude=sv[13],         # geometric altitude (metres)
    vertical_rate=sv[11],        # m/s climb/descent
    position_source=sv[16],      # 0=ADS-B 1=ASTERIX 2=MLAT 3=FLARM
    is_active=True,
    ...
).on_conflict_do_update(...)
    ↓ (tombstone pass at end of ingest)
UPDATE aircraft SET is_active=False
  WHERE fetched_at < NOW() - INTERVAL '90 seconds'
    ↓
GET /api/aircraft/ (route query)
    SELECT ... WHERE latitude IS NOT NULL
                AND longitude IS NOT NULL
                AND is_active = TRUE
                AND fetched_at >= NOW() - INTERVAL '120 seconds'
    ↓
Response includes: fetched_at, is_active, time_position, geo_altitude,
                   vertical_rate, position_source per entity
```

### Military Freshness Flow

```
airplanes.live (every 300s)
    ↓
ingest_military_aircraft() — async function
    ↓ (upsert all current aircraft)
pg_insert(MilitaryAircraft).values(
    fetched_at=func.now(),
    last_seen_at=func.now(),   # source has no separate "seen_at" timestamp
    is_active=True,
    ...
).on_conflict_do_update(...)
    ↓ (tombstone pass)
UPDATE military_aircraft SET is_active=False
  WHERE fetched_at < NOW() - INTERVAL '300 seconds'
    ↓
ingest_gps_jamming() triggered (enqueued after successful military ingest)
    ↓
SELECT military_aircraft WHERE is_active = TRUE (filters stale source)
    ↓
aggregate_jamming_cells() — pure function, unchanged
    ↓
Write cells with source_fetched_at, source_is_stale, aggregated_at
    ↓
GET /api/military/ (route query)
    SELECT ... WHERE latitude IS NOT NULL
                AND longitude IS NOT NULL
                AND is_active = TRUE
                AND fetched_at >= NOW() - INTERVAL '600 seconds'
```

### Ship Freshness Flow

```
aisstream.io WebSocket (continuous)
    ↓
parse_ais_message() — pure function, captures time_utc
    ↓
Redis hset("ship:{mmsi}", ...) with TTL 600s
    ↓ (every 30s)
batch_flush_ships_to_pg() — scans Redis ship:* keys
    ↓ (only ships in Redis are flushed — absent ships not touched in PG)
pg_insert(Ship).values(
    last_seen_at=parsed["time_utc"],  # source observation time
    is_active=True,                   # presence in Redis = active
    ...
).on_conflict_do_update(...)
    ↓
GET /api/ships/ (route query)
    SELECT ... WHERE latitude IS NOT NULL
                AND longitude IS NOT NULL
                AND last_seen_at >= NOW() - INTERVAL '900 seconds'
    (is_active not used as primary filter — last_seen_at cutoff is equivalent
     given ships not in Redis are never flushed with is_active=True)
```

### GPS Jamming Source Freshness Flow

```
military_aircraft table (updated by ingest_military.py)
    ↓
ingest_gps_jamming() reads:
    SELECT military_aircraft WHERE is_active = TRUE
    → source_fetched_at = max(fetched_at) of loaded rows
    → source_is_stale = source_fetched_at < NOW() - THRESHOLD
    → aggregated_at = NOW()
    ↓
gps_jamming_cells upserted WITH:
    source_fetched_at, source_is_stale, aggregated_at on every cell
    ↓
GET /api/gps-jamming/
    Returns { aggregated_at, source_fetched_at, source_is_stale, cells: [...] }
    (top-level freshness fields extracted from cells[0] if cells exist)
```

---

## Integration Points

### New vs Modified — Explicit Inventory

| File | Change Type | What Changes |
|------|-------------|--------------|
| `app/config.py` | MODIFY | Add 3 stale threshold int fields with defaults |
| `app/freshness.py` | NEW | `stale_cutoff()`, `is_stale()` helper functions |
| `app/models/aircraft.py` | MODIFY | Add: `fetched_at TIMESTAMPTZ`, `time_position INT`, `geo_altitude FLOAT`, `vertical_rate FLOAT`, `position_source INT`, `is_active BOOL DEFAULT TRUE` |
| `app/models/military_aircraft.py` | MODIFY | Add: `fetched_at TIMESTAMPTZ`, `last_seen_at TIMESTAMPTZ`, `is_active BOOL DEFAULT TRUE` |
| `app/models/ship.py` | MODIFY | Add: `last_seen_at TIMESTAMPTZ`, `is_active BOOL DEFAULT TRUE` |
| `app/models/gps_jamming.py` | MODIFY | Add: `source_fetched_at TIMESTAMPTZ`, `source_is_stale BOOL`, `aggregated_at TIMESTAMPTZ` |
| `app/tasks/ingest_aircraft.py` | MODIFY | Write new fields in upsert; add tombstone UPDATE at end |
| `app/tasks/ingest_military.py` | MODIFY | Write `fetched_at`, `last_seen_at`, `is_active=True`; add tombstone UPDATE at end |
| `app/workers/ingest_ais.py` | MODIFY | Write `last_seen_at`, `is_active=True` in batch flush |
| `app/tasks/ingest_gps_jamming.py` | MODIFY | Filter source by `is_active`; write freshness metadata to cells |
| `app/api/routes_aircraft.py` | MODIFY | Add stale WHERE clause to list endpoint; add freshness fields to response |
| `app/api/routes_military.py` | MODIFY | Add stale WHERE clause to list endpoint; add freshness fields to response |
| `app/api/routes_ships.py` | MODIFY | Add stale WHERE clause to list endpoint; add freshness fields to response |
| `app/api/routes_gps_jamming.py` | MODIFY | Expose `aggregated_at`, `source_fetched_at`, `source_is_stale` in response envelope |
| `alembic/versions/<hash>_add_freshness_fields.py` | NEW | Single migration adding all new columns |
| `backend/tests/test_aircraft.py` | MODIFY | Extend for freshness fields in response, stale filtering behavior |
| `backend/tests/test_military.py` | MODIFY | Extend for is_active filter, stale behavior |
| `backend/tests/test_ships.py` | MODIFY | Extend for last_seen_at filter, stale behavior |
| `backend/tests/test_gps_jamming.py` | MODIFY | Extend for source freshness fields in response |
| `backend/tests/test_ingest_aircraft.py` | MODIFY | Extend for new OpenSky fields, tombstone behavior |
| `backend/tests/test_ingest_military.py` | MODIFY | Extend for tombstone behavior |
| `backend/tests/test_freshness.py` | NEW | Unit tests for `stale_cutoff()` and `is_stale()` helpers |

### Ingest Task ↔ Model Field Mapping

| OpenSky State Vector Index | OpenSky Field | Model Column | Notes |
|----------------------------|---------------|--------------|-------|
| sv[3] | `time_position` (Unix int) | `Aircraft.time_position` | Time of last ADS-B position fix; None = position from network |
| sv[7] | `baro_altitude` (m) | `Aircraft.baro_altitude` | Already exists |
| sv[13] | `geo_altitude` (m) | `Aircraft.geo_altitude` | Geometric altitude from GNSS |
| sv[11] | `vertical_rate` (m/s) | `Aircraft.vertical_rate` | +ve = climbing |
| sv[16] | `position_source` (int) | `Aircraft.position_source` | 0=ADS-B, 1=ASTERIX, 2=MLAT, 3=FLARM |
| (implicit) | poll timestamp | `Aircraft.fetched_at` | Set via `func.now()` in upsert |

> NOTE: OpenSky state vector index 16 (`position_source`) is only present in the
> extended state vector format returned when authenticated. Verify presence in live
> data during ACFT-01. If absent for some records, default to `None` not `0`.

### Route Response Field Additions

| Endpoint | New Fields Added to Each Entity |
|----------|---------------------------------|
| `GET /api/aircraft/` (list) | `fetched_at`, `is_active`, `time_position`, `geo_altitude`, `vertical_rate`, `position_source` |
| `GET /api/aircraft/{icao24}` (detail) | Same — detail already returns full record |
| `GET /api/military/` (list) | `fetched_at`, `last_seen_at`, `is_active` |
| `GET /api/military/{hex}` (detail) | Same |
| `GET /api/ships/` (list) | `last_seen_at`, `is_active` |
| `GET /api/ships/{mmsi}` (detail) | Same |
| `GET /api/gps-jamming/` | Top-level: `aggregated_at`, `source_fetched_at`, `source_is_stale` |

### Alembic Migration Structure

All schema changes go in a single migration file. Column additions with nullable defaults do not require table rewrites in PostgreSQL — they apply immediately even on large tables.

```python
# Key columns to add — all nullable to avoid constraint violations on existing rows:

# aircraft table
op.add_column('aircraft', sa.Column('fetched_at', sa.DateTime(timezone=True), nullable=True))
op.add_column('aircraft', sa.Column('time_position', sa.Integer(), nullable=True))
op.add_column('aircraft', sa.Column('geo_altitude', sa.Float(), nullable=True))
op.add_column('aircraft', sa.Column('vertical_rate', sa.Float(), nullable=True))
op.add_column('aircraft', sa.Column('position_source', sa.Integer(), nullable=True))
op.add_column('aircraft', sa.Column('is_active', sa.Boolean(), server_default='true', nullable=False))

# military_aircraft table
op.add_column('military_aircraft', sa.Column('fetched_at', sa.DateTime(timezone=True), nullable=True))
op.add_column('military_aircraft', sa.Column('last_seen_at', sa.DateTime(timezone=True), nullable=True))
op.add_column('military_aircraft', sa.Column('is_active', sa.Boolean(), server_default='true', nullable=False))

# ships table
op.add_column('ships', sa.Column('last_seen_at', sa.DateTime(timezone=True), nullable=True))
op.add_column('ships', sa.Column('is_active', sa.Boolean(), server_default='true', nullable=False))

# gps_jamming_cells table
op.add_column('gps_jamming_cells', sa.Column('source_fetched_at', sa.DateTime(timezone=True), nullable=True))
op.add_column('gps_jamming_cells', sa.Column('source_is_stale', sa.Boolean(), nullable=True))
op.add_column('gps_jamming_cells', sa.Column('aggregated_at', sa.DateTime(timezone=True), nullable=True))
```

Indexes to add in the same migration for query performance:
```python
op.create_index('ix_aircraft_fetched_at', 'aircraft', ['fetched_at'])
op.create_index('ix_military_aircraft_fetched_at', 'military_aircraft', ['fetched_at'])
op.create_index('ix_ships_last_seen_at', 'ships', ['last_seen_at'])
```

---

## Build Order

The build order is dictated by hard dependencies: Alembic migration must run before any code that writes or reads new columns; models must be updated before ingest code; ingest code must be updated before API routes can expose the new fields; tests should be written before implementation (TDD RED) and verified GREEN after.

### Step 1 — Schema: Alembic Migration (MIG-01)

**Files:** One new migration in `alembic/versions/`
**Dependency:** None. Must be first.
**Why first:** All subsequent steps read or write new columns. Without the migration applied, every other step fails at runtime.
**Risk:** LOW. Column additions to existing tables in PostgreSQL are `ALTER TABLE ... ADD COLUMN` — near-instant operations, no table lock on modern PostgreSQL. `is_active BOOLEAN NOT NULL DEFAULT TRUE` backfills existing rows as active, which is correct.

### Step 2 — Models: Add New ORM Fields (ACFT-01, MIL-01, SHIP-01, JAM-01)

**Files:** `aircraft.py`, `military_aircraft.py`, `ship.py`, `gps_jamming.py`
**Dependency:** Step 1 (migration applied).
**Why second:** Ingest tasks and route handlers import model classes directly. If model fields are missing, SQLAlchemy will raise `AttributeError` at task or request time.
**Risk:** LOW. Additive changes only. Existing columns and `Mapped` types are unchanged.

### Step 3 — Shared Helper: freshness.py + config.py (FRESH-01, FRESH-02)

**Files:** `app/freshness.py` (new), `app/config.py` (modified)
**Dependency:** None (pure utility, no DB dependency).
**Why third:** Routes (Step 5) and tests (Step 6) import from these. Must exist before both.
**Risk:** NONE. New file + additive config fields.

### Step 4 — Ingest: Write New Fields (ACFT-02/03, MIL-02/03, SHIP-02/03, JAM-02)

**Files:** `ingest_aircraft.py`, `ingest_military.py`, `ingest_ais.py`, `ingest_gps_jamming.py`
**Dependency:** Steps 1 and 2 (schema + model).
**Why fourth:** Ingest tasks run in the RQ worker process. They must write new fields so the API routes have data to return. The tombstone logic is part of this step.
**Risk:** MEDIUM. Touching the core ingest loop. The existing test coverage for each ingest task provides a regression safety net. GPS jamming must also be updated here to filter by `is_active` and write freshness metadata.

### Step 5 — API Routes: Stale Filtering + Freshness Fields (ACFT-04/05/06, MIL-04, SHIP-04, JAM-03)

**Files:** `routes_aircraft.py`, `routes_military.py`, `routes_ships.py`, `routes_gps_jamming.py`
**Dependency:** Steps 2 and 3 (models + freshness helper).
**Why fifth:** Routes are the public API surface. Changing them after ingest ensures there is real data to validate against in integration tests.
**Risk:** MEDIUM. Changes query WHERE clauses on list endpoints — alters what is returned. Existing tests that assert specific entity counts will need updating.

### Step 6 — Tests: All Freshness Behavior (TEST-01 through TEST-07)

**Files:** Modified test files for aircraft/military/ships/gps-jamming; new `test_freshness.py`
**Dependency:** Steps 1–5 (everything must be wired before integration tests pass).
**Why last:** Per the codebase's established TDD discipline, tests are ideally written before implementation (RED phase). For this milestone, write unit tests for `freshness.py` (Step 3) in TDD style. Write ingest and route integration tests after the implementation exists to validate behavior.
**Risk:** LOW. Test code does not affect production behavior.

**Practical TDD order within this milestone:**
1. Write `test_freshness.py` unit tests (Steps 3) — can be written before implementation
2. Write route tests asserting freshness fields in responses (Step 5 contract)
3. Implement Step 3–5 to make tests pass
4. Write tombstone/lifecycle tests as integration tests that set up DB state directly

---

## Anti-Patterns

### Anti-Pattern 1: Stale Cutoff Duplicated in Each Route Handler

**What people do:** Copy `datetime.now(timezone.utc) - timedelta(seconds=120)` into each of the three route files.
**Why it's wrong:** Three copies of the same logic with different magic numbers. When the threshold changes (environment variable), only one file gets updated. Bug in threshold calculation is multiplied by three.
**Do this instead:** Use `freshness.stale_cutoff(settings.stale_threshold_aircraft_s)` — one call per route, one implementation in `freshness.py`.

### Anti-Pattern 2: Threshold Hardcoded as Module-Level Constant in Route File

**What people do:** `STALE_THRESHOLD = 120` at the top of `routes_aircraft.py`.
**Why it's wrong:** Cannot be overridden without redeploying code. In a homelab context with varying data quality, being able to adjust via `.env` is essential (e.g., if OpenSky is degraded and only polling every 3 minutes, the threshold needs to be 360s, not 120s).
**Do this instead:** Declare in `Settings` class with a sensible default. The threshold becomes an env var with a safe default that works without any configuration.

### Anti-Pattern 3: Filtering Stale Entities in the Frontend Instead of the API

**What people do:** Return all entities from the API and let the frontend filter by `updated_at > (Date.now() - threshold)`.
**Why it's wrong:** The frontend must carry threshold knowledge. Multiple clients would need synchronized thresholds. Stale entities waste network bandwidth and React render cycles.
**Do this instead:** Filter at the database query layer. The API returns only live entities. The API's freshness metadata endpoint tells the frontend when data was last updated.

### Anti-Pattern 4: Setting is_active=False in the API Route Layer

**What people do:** On `GET /api/military/`, load all rows, then filter in Python by comparing timestamps, and set `is_active=False` for stale rows as a side effect of a GET request.
**Why it's wrong:** GET requests must not have write side effects (HTTP idempotency contract). A GET request being responsible for state mutation is a correctness bug.
**Do this instead:** Tombstone writes happen only in the ingest task, which runs on a background schedule. The GET route is pure read.

### Anti-Pattern 5: Separate GPS Jamming Freshness Table

**What people do:** Create a `gps_jamming_metadata` table with one row for `(aggregated_at, source_fetched_at, source_is_stale)` and JOIN it in the route.
**Why it's wrong:** Extra schema complexity, JOIN required in every query, migration complexity, no meaningful benefit at the scale of hundreds of cells.
**Do this instead:** Store freshness metadata as columns on every `gps_jamming_cells` row. All cells from one batch share identical values. Extract for the response from `cells[0]`.

### Anti-Pattern 6: Using updated_at as the Stale Filter Column for Aircraft

**What people do:** Filter by `Aircraft.updated_at >= cutoff` since `updated_at` already exists.
**Why it's wrong:** `updated_at` is set by `server_default=func.now()` and `onupdate=func.now()` at the database level. It reflects when the row was last written, not when the source data was fetched. If ingest fails silently (API returns success but empty states), `updated_at` is not refreshed and the stale filter correctly fires. But the intent is clearer with a dedicated `fetched_at` column that the ingest code explicitly sets on every successful poll.
**Do this instead:** Use `fetched_at` for stale filtering. `updated_at` is retained for general-purpose audit purposes but is not the primary freshness indicator.

---

## Scaling Considerations

| Concern | At Current Scale | Notes |
|---------|-----------------|-------|
| Tombstone pass performance | Trivial — UPDATE on ~few thousand rows | A partial index on `(fetched_at) WHERE is_active = TRUE` makes the WHERE clause fast |
| Stale cutoff query overhead | Trivial — index on fetched_at/last_seen_at | Add index in migration (see Step 1) |
| GPS jamming cell count | Hundreds of H3 cells | Storing freshness on every cell row is 3 extra columns × hundreds of rows = trivial |
| AIS flush lag | Ships may appear stale between flushes | 30s flush interval means up to 30s lag between Redis update and PG visibility; threshold of 900s absorbs this |

---

## Sources

- Direct codebase analysis: all backend Python files (HIGH confidence — authoritative)
- FastAPI dependency injection patterns — official docs (HIGH confidence)
- SQLAlchemy `on_conflict_do_update` with bulk UPDATE tombstone — established PostgreSQL upsert pattern
- pydantic-settings `BaseSettings` field declaration — official docs (HIGH confidence)
- OpenSky Network REST API — state vector format documentation (HIGH confidence)
  - State vector field 3 = `time_position`, field 11 = `vertical_rate`, field 13 = `geo_altitude`, field 16 = `position_source`
- PostgreSQL `ALTER TABLE ADD COLUMN` performance on existing tables — near-instant for nullable columns or columns with server_default (HIGH confidence)
- HTTP idempotency: GET requests must not have write side effects (RFC 7231 §4.2.2, HIGH confidence)

---

*Architecture research for: Intelligence Globe v4.0 Data Reliability and Freshness — FastAPI + SQLAlchemy stale filtering integration*
*Researched: 2026-03-13*
