# Stack Research

**Domain:** Data reliability and freshness — stale filtering, freshness metadata in API responses, richer OpenSky field ingestion, Alembic schema migrations, configurable thresholds
**Researched:** 2026-03-13
**Confidence:** HIGH (all findings verified against official docs or existing codebase patterns)

> **Scope note:** This file covers ONLY what is NEW or changes for v4.0 Data Reliability & Freshness.
> The base stack (CesiumJS 1.139, React 19, Vite 7, TypeScript 5.9, FastAPI >=0.115, SQLAlchemy 2.0,
> PostgreSQL + PostGIS, Redis, RQ, Docker Compose, Alembic >=1.14, pydantic-settings >=2.0) is validated
> and deployed. Do not re-research or reinstall the base stack.

---

## Recommended Stack

### New Libraries Required

**None.** Every v4.0 requirement is achievable with the existing dependency set. No `pip install` additions are needed. The version ranges already in `requirements.txt` are sufficient.

### Core Technologies — Integration Points That Change for v4.0

| Technology | Current Version | v4.0 Integration Change | Why This Matters |
|------------|----------------|-------------------------|-----------------|
| SQLAlchemy | >=2.0 (async) | Add `fetched_at`, `last_seen_at`, `is_active` columns to `Aircraft`, `MilitaryAircraft`, `Ship`, `GpsJammingCell` models | New columns use `mapped_column` with `server_default=func.now()` — the same pattern already used for `updated_at` throughout the codebase |
| Alembic | >=1.14 (current: 1.18.4) | One new migration file per table (`add_column` only — no table rewrites) | Adding nullable columns with `server_default` in PostgreSQL 11+ is lock-free; no table rewrite required |
| FastAPI | >=0.115 | Add Pydantic response schemas (`AircraftOut`, `ShipOut`, `MilitaryOut`) replacing raw dict returns | Raw dict returns currently in `routes_aircraft.py`, `routes_ships.py`, `routes_military.py`; typed schemas enable freshness fields with correct serialization |
| pydantic-settings | >=2.0 (current: 2.13.1) | Add stale threshold fields to `Settings` class in `app/config.py` | Already used for `database_url`, `redis_url` — extend the same class; env vars picked up automatically |
| pytest-asyncio | >=0.24 | Existing test infrastructure covers new stale filtering tests | No change to test tooling needed |

---

## Schema Migration Strategy

### Alembic: Safe `add_column` Pattern (HIGH confidence)

PostgreSQL 11+ handles `ADD COLUMN ... DEFAULT <non-volatile>` by storing the default in table metadata only — no table rewrite, no lock beyond the `ACCESS EXCLUSIVE` lock during `ALTER TABLE` itself (milliseconds on a small table). This is the correct pattern for all v4.0 columns.

**For nullable columns (recommended for all v4.0 additions):**
```python
def upgrade() -> None:
    op.add_column(
        "aircraft",
        sa.Column("time_position", sa.Integer(), nullable=True),
    )
    op.add_column(
        "aircraft",
        sa.Column("geo_altitude", sa.Float(), nullable=True),
    )
    op.add_column(
        "aircraft",
        sa.Column("vertical_rate", sa.Float(), nullable=True),
    )
    op.add_column(
        "aircraft",
        sa.Column("position_source", sa.Integer(), nullable=True),
    )
    op.add_column(
        "aircraft",
        sa.Column(
            "fetched_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=True,
        ),
    )
    op.add_column(
        "aircraft",
        sa.Column("is_active", sa.Boolean(), server_default=sa.text("true"), nullable=False),
    )
```

**Do NOT use `nullable=False` without `server_default`** on a table that already has rows — PostgreSQL will raise `NotNullViolation` for existing rows that have no value for the new column.

**For `is_active`:** Use `server_default=sa.text("true")` so all existing rows get `TRUE` — they are "active" until proven stale by the next ingest cycle. This is semantically correct and lock-free.

**For `fetched_at` / `last_seen_at`:** Use `nullable=True` with no server_default — existing rows represent past ingests with unknown fetch timestamps; `NULL` is honest. The ingest worker populates it going forward.

### Migration File Isolation

Each table gets one migration file. Resist the temptation to batch all four tables into one migration — isolation makes partial rollback possible and reduces cognitive load during review.

| Migration File | Tables Touched | Columns Added |
|----------------|---------------|---------------|
| `add_aircraft_freshness_fields` | `aircraft` | `time_position`, `geo_altitude`, `vertical_rate`, `position_source`, `fetched_at`, `is_active` |
| `add_military_freshness_fields` | `military_aircraft` | `fetched_at`, `last_seen_at`, `is_active` |
| `add_ship_freshness_fields` | `ships` | `last_seen_at`, `is_active` |
| `add_gps_jamming_freshness_fields` | `gps_jamming_cells` | `aggregated_at`, `is_stale` |

---

## OpenSky State Vector Field Indices (HIGH confidence — official docs)

The current `ingest_aircraft.py` worker parses state vectors as a list (`sv: list[Any]`). Current mapping uses only indices 0–10. The v4.0 richer ingestion needs these additional indices:

| Index | Field Name | Python Type | Current Status |
|-------|-----------|-------------|---------------|
| 0 | `icao24` | `str` | Already ingested |
| 1 | `callsign` | `str \| None` | Already ingested |
| 2 | `origin_country` | `str \| None` | Already ingested |
| 3 | `time_position` | `int \| None` | **NEW — Unix timestamp of last position update** |
| 4 | `last_contact` | `int \| None` | Already ingested |
| 5 | `longitude` | `float \| None` | Already ingested |
| 6 | `latitude` | `float \| None` | Already ingested |
| 7 | `baro_altitude` | `float \| None` | Already ingested |
| 8 | `on_ground` | `bool` | Already ingested |
| 9 | `velocity` | `float \| None` | Already ingested |
| 10 | `true_track` | `float \| None` | Already ingested |
| 11 | `vertical_rate` | `float \| None` | **NEW — climb/descent rate m/s; positive=climb** |
| 12 | `sensors` | `list \| None` | Skip — receiver IDs, not needed |
| 13 | `geo_altitude` | `float \| None` | **NEW — geometric (GPS) altitude in meters** |
| 14 | `squawk` | `str \| None` | Skip for now |
| 15 | `spi` | `bool` | Skip — special purpose indicator |
| 16 | `position_source` | `int \| None` | **NEW — 0=ADS-B, 1=ASTERIX, 2=MLAT, 3=FLARM** |
| 17 | `category` | `int \| None` | Skip for now |

**Key distinction between `time_position` (index 3) and `last_contact` (index 4):**
- `time_position` is when the aircraft's position was last updated by the aircraft itself (ADS-B position message). Can be `None` if no position report received in this window.
- `last_contact` is when any message from this transponder was last received (may be a non-position message like altitude only). Always populated if the aircraft row exists.
- `time_position` is the more precise freshness indicator for stale detection. Use `last_contact` as the fallback when `time_position` is `None`.

**Safe access pattern (guards against short vectors from older OpenSky endpoints):**
```python
time_position: int | None = sv[3] if len(sv) > 3 else None
vertical_rate: float | None = sv[11] if len(sv) > 11 else None
geo_altitude: float | None = sv[13] if len(sv) > 13 else None
position_source: int | None = sv[16] if len(sv) > 16 else None
```

---

## Configurable Stale Thresholds

### Pattern: Extend `app/config.py` Settings (HIGH confidence)

`pydantic-settings` 2.x (current: 2.13.1) reads `int` and `float` fields from env vars with automatic type coercion. Add threshold fields to the existing `Settings` class:

```python
from pydantic_settings import BaseSettings
from pydantic import ConfigDict


class Settings(BaseSettings):
    model_config = ConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/opensignal"
    redis_url: str = "redis://localhost:6379/0"
    frontend_origin: str = "http://localhost:3000"
    version: str = "0.1.0"

    # Stale thresholds — seconds since last position update
    aircraft_stale_seconds: int = 120     # 2 minutes; OpenSky poll cadence is 60s
    military_stale_seconds: int = 360     # 6 minutes; airplanes.live cadence is 300s
    ship_stale_seconds: int = 180         # 3 minutes; consistent with Redis TTL
    gps_jamming_stale_seconds: int = 600  # 10 minutes; ingest cadence is 300s
```

**Why these defaults:** Each threshold is set to 2x the source poll cadence. One missed poll = still active. Two consecutive missed polls = stale. This prevents flapping from single transient API failures.

**Env var naming:** pydantic-settings maps `aircraft_stale_seconds` to env var `AIRCRAFT_STALE_SECONDS` automatically. Docker Compose `environment:` block accepts these directly.

**No nested config or `env_nested_delimiter` is needed** — flat integer fields are sufficient and simpler. Avoid over-engineering the config shape.

---

## FastAPI Response Schema Pattern

### Pydantic `BaseModel` for Freshness Metadata (HIGH confidence)

Current routes return raw `dict` literals. For v4.0, typed Pydantic schemas are needed to:
1. Guarantee freshness fields appear in every response (no missing-key bugs)
2. Serialize `datetime` as ISO 8601 automatically (FastAPI does this for `datetime` fields)
3. Enable `response_model=` declaration on route decorators for OpenAPI schema generation

**Recommended schema pattern (aircraft example):**
```python
from datetime import datetime
from pydantic import BaseModel, computed_field
from app.config import settings
import datetime as dt


class AircraftOut(BaseModel):
    model_config = {"from_attributes": True}

    icao24: str
    callsign: str | None
    origin_country: str | None
    latitude: float | None
    longitude: float | None
    baro_altitude: float | None
    geo_altitude: float | None
    vertical_rate: float | None
    position_source: int | None
    velocity: float | None
    true_track: float | None
    on_ground: bool
    last_contact: int | None
    time_position: int | None
    trail: list[dict]
    fetched_at: datetime | None
    is_active: bool
    updated_at: datetime | None
```

**`from_attributes = True`** (Pydantic v2 equivalent of `orm_mode = True`) allows FastAPI to construct the schema directly from SQLAlchemy ORM objects returned by `db.execute(select(Aircraft)...)`. This avoids manual dict construction in routes.

**`computed_field` for derived staleness (optional but useful for frontend):**
```python
from pydantic import computed_field
import datetime as dt

class AircraftOut(BaseModel):
    # ... fields above ...

    @computed_field
    @property
    def is_stale(self) -> bool:
        if self.fetched_at is None:
            return False  # unknown, assume active
        age = dt.datetime.now(dt.timezone.utc) - self.fetched_at
        return age.total_seconds() > settings.aircraft_stale_seconds
```

`computed_field` is included in serialization automatically in Pydantic v2. The frontend receives `is_stale: true/false` without needing to re-implement the threshold calculation in TypeScript.

**Where to place schema classes:** Create `app/schemas/` directory with one file per domain (`aircraft.py`, `military.py`, `ships.py`, `gps_jamming.py`). Do not put schemas in the model files — that couples DB layer to API layer.

---

## Stale Filtering in Route Queries

### SQLAlchemy `WHERE` Clause Pattern (HIGH confidence)

Stale filtering uses `func.now()` minus an `INTERVAL` expression — standard PostgreSQL SQL that SQLAlchemy passes through correctly:

```python
from sqlalchemy import select, func, text
from datetime import timedelta

async def list_aircraft(db: AsyncSession = Depends(get_db)):
    threshold = func.now() - text(f"INTERVAL '{settings.aircraft_stale_seconds} seconds'")
    result = await db.execute(
        select(Aircraft).where(
            Aircraft.latitude.is_not(None),
            Aircraft.longitude.is_not(None),
            Aircraft.is_active == True,
            Aircraft.fetched_at >= threshold,
        )
    )
```

**Alternative using Python `timedelta`:**
```python
from datetime import datetime, timezone, timedelta

cutoff = datetime.now(timezone.utc) - timedelta(seconds=settings.aircraft_stale_seconds)
# ... .where(Aircraft.fetched_at >= cutoff)
```

The Python-side `timedelta` approach is simpler and avoids SQLAlchemy `text()` calls. Use it. Both produce equivalent SQL; the Python approach is easier to unit-test (mock `datetime.now`).

**Index consideration:** `fetched_at` should have an index if the aircraft table grows large. For the homelab use case (typically <5,000 rows), a partial index is unnecessary — PostgreSQL will use a sequential scan efficiently. If row count grows beyond 50,000, add `CREATE INDEX CONCURRENTLY ix_aircraft_fetched_at ON aircraft (fetched_at)` in a non-blocking migration.

---

## `is_active` Lifecycle Pattern

### Soft Expiry via Ingest Workers (HIGH confidence)

`is_active` is set to `False` by the ingest worker when a row has not appeared in the most recent API response, rather than deleting the row. This preserves history for replay and avoids foreign key complications.

**Pattern:**

```python
# At end of ingest cycle, after all upserts:
# Mark rows not seen in this cycle as inactive
cutoff = datetime.now(timezone.utc) - timedelta(seconds=settings.aircraft_stale_seconds)
await db.execute(
    update(Aircraft)
    .where(Aircraft.fetched_at < cutoff)
    .values(is_active=False)
)
await db.commit()
```

This pattern already has precedent in the codebase's AIS worker (Redis TTL acts as the expiry mechanism for ships). The `is_active` column formalizes this for SQL-backed tables.

**Do not use hard deletes** in the ingest worker. Deleting rows that are "not in this API response" would break replay — the snapshot table references entity IDs that must remain in the primary table for JOIN queries during playback.

---

## GPS Jamming Freshness Pattern

### Aggregation Timestamp vs. Updated_at (HIGH confidence)

The existing `GpsJammingCell` has `updated_at` (when the row was last written to DB). v4.0 adds:

- `aggregated_at`: When the jamming aggregation was computed from military ADS-B data. Distinct from `updated_at` because the row may be re-read without re-aggregation.
- `is_stale` (boolean): Computed at query time or stored as a column. Storing as a column is simpler but requires a worker to update it. Computing at query time via Pydantic `computed_field` is cleaner — no extra worker job.

**Recommended approach:** Add `aggregated_at` as a nullable `DateTime(timezone=True)` column. Expose `is_stale` as a Pydantic `computed_field` in the response schema (not a DB column). This avoids the write-amplification of updating `is_stale` on every read.

---

## Installation

No new packages are required.

```bash
# No additions to requirements.txt or requirements-dev.txt
# All features use existing: alembic, sqlalchemy[asyncio], pydantic-settings, fastapi, pytest-asyncio
```

The only configuration change is adding stale threshold env vars to `.env` and `docker-compose.yml`:

```bash
# .env (add these lines)
AIRCRAFT_STALE_SECONDS=120
MILITARY_STALE_SECONDS=360
SHIP_STALE_SECONDS=180
GPS_JAMMING_STALE_SECONDS=600
```

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| Nullable `fetched_at` column (NULL = unknown) | Backfill `fetched_at` from `updated_at` in migration | Use backfill only if existing stale detection must work immediately post-migration without waiting for next ingest cycle. For this project, the next ingest cycle runs within 60–300s of deploy — backfill is unnecessary complexity. |
| Python-side `timedelta` for stale cutoff | SQL `func.now() - INTERVAL` expression | Use SQL interval if filtering must happen inside a subquery or CTE. For simple `WHERE` clauses, Python `timedelta` is simpler and unit-testable. |
| `computed_field` in Pydantic for `is_stale` | `is_stale` as a DB column, updated by worker | Use DB column only if stale status must be queryable in SQL (e.g., alerting queries that bypass FastAPI). For this project, all access is through FastAPI — computed field is sufficient. |
| One migration file per table | One migration for all four tables | Batch only if the tables have foreign key dependencies that require ordering. These tables are independent — separate files reduce rollback blast radius. |
| Extend existing `Settings` class | Separate `FreshnessConfig` class | Use a separate class only if freshness settings are consumed by a different process than the main app (e.g., a standalone monitoring daemon). For this project, both the API routes and ingest workers use the same `settings` singleton. |
| `from_attributes = True` Pydantic v2 | `model.from_orm()` Pydantic v1 pattern | `from_orm()` is removed in Pydantic v2. `from_attributes = True` in `model_config` is the v2 replacement. The project uses FastAPI >=0.115 which bundles Pydantic v2. |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| **`nullable=False` column without `server_default` in Alembic migration** | PostgreSQL raises `NotNullViolation` for existing rows on `ALTER TABLE ADD COLUMN NOT NULL` with no default. This breaks migration on a non-empty table. | `nullable=True` OR `nullable=False` with `server_default=sa.text("true")` (for booleans) |
| **`op.execute("UPDATE ...")` inside migration transaction** | Takes a full table lock for the duration of the UPDATE. On a production table with thousands of rows, this blocks reads and writes. | `server_default` on `add_column` — PostgreSQL handles it in metadata without a row scan |
| **Hard deletes in ingest workers for "not seen" aircraft** | Breaks replay — snapshot table JOIN queries expect entity rows to remain for historical playback. | Set `is_active = False` on rows past the stale threshold (soft expiry) |
| **New library for stale thresholds (e.g., `dynaconf`, `python-decouple`)** | The existing `pydantic-settings` already provides typed env var loading with defaults. Adding another config library creates redundancy and increases cognitive overhead. | Extend `app/config.py` `Settings` class with new `int` fields |
| **Storing `is_stale` as a DB column** | Requires a worker to update it on a schedule (write amplification). Goes stale itself if the worker falls behind. | Compute `is_stale` at response time via Pydantic `computed_field` using `fetched_at` and the configurable threshold |
| **Response schemas in model files (`app/models/aircraft.py`)** | Couples the DB layer to the API layer — model changes require schema changes in the same file. Alembic autogenerate also becomes confused when `Base` subclasses contain non-column definitions. | Create `app/schemas/` directory; one schema file per domain |
| **`datetime` without `timezone=True` in SQLAlchemy column** | `DateTime(timezone=False)` stores naive datetimes. Stale threshold comparisons against `datetime.now(timezone.utc)` fail with `TypeError: can't compare offset-naive and offset-aware datetimes`. | `DateTime(timezone=True)` — already used for all existing timestamp columns in the codebase |

---

## Stack Patterns by Variant

**If a data source has no `fetched_at` equivalent (e.g., GPS jamming is aggregated, not fetched per-row):**
- Use `aggregated_at` as the freshness timestamp column name
- Set it in the ingest task with `datetime.now(timezone.utc)` at the start of each aggregation run
- All cells written in one run share the same `aggregated_at` — if the run fails mid-way, partial staleness is detectable

**If OpenSky returns a state vector shorter than 17 elements:**
- Guard every new field access: `sv[3] if len(sv) > 3 else None`
- OpenSky occasionally returns truncated vectors for aircraft in transition — this is documented behavior, not a bug

**If `fetched_at` is `NULL` for a row (pre-migration historical data):**
- Treat as "not stale" — do not exclude rows with `NULL` fetched_at from list endpoints
- SQL: `Aircraft.fetched_at >= cutoff OR Aircraft.fetched_at IS NULL`
- This ensures the first ingest cycle after migration does not make all existing rows disappear

**If ship `last_seen_at` needs to align with Redis TTL:**
- Redis AIS position cache expires after N seconds (the existing worker sets a TTL)
- Set `ship_stale_seconds` in `Settings` to match that TTL value
- Both mechanisms then agree on what "stale" means — no contradictory state between cache and DB

---

## Version Compatibility

| Package | Current Version | Relevant Feature | Notes |
|---------|----------------|-----------------|-------|
| `alembic` | >=1.14 (1.18.4 current) | `op.add_column` with `server_default` | Stable since 1.0. `compare_type=True` in `env.py` (already set) ensures autogenerate detects type changes. |
| `sqlalchemy[asyncio]` | >=2.0 | `mapped_column`, `Mapped[T]`, `DateTime(timezone=True)` | `server_default=func.now()` with `onupdate=func.now()` — current pattern throughout codebase. `func.now()` renders as `NOW()` in PostgreSQL. |
| `pydantic-settings` | >=2.0 (2.13.1 current) | `BaseSettings` int/float fields read from env vars | Type coercion is automatic. No validator decorator needed for simple int/float thresholds. |
| `fastapi` | >=0.115 | `response_model=AircraftOut` on route decorators | FastAPI uses Pydantic v2 in >=0.100. `computed_field` and `from_attributes=True` are Pydantic v2 features — fully compatible. |
| `pydantic` (bundled with fastapi) | >=2.0 | `computed_field`, `model_config = {"from_attributes": True}` | `orm_mode` (v1) → `from_attributes` (v2). Do not use `orm_mode` — it is removed in v2. |
| `pytest-asyncio` | >=0.24 | Async test fixtures for stale filtering tests | `asyncio_mode = "auto"` in `pytest.ini` or `pyproject.toml` (existing project config) is required for `async def test_...` functions to run without explicit `@pytest.mark.asyncio`. |

---

## Sources

- [OpenSky REST API — State Vectors documentation](https://openskynetwork.github.io/opensky-api/rest.html) — All 18 state vector field indices confirmed (HIGH confidence — official docs)
- [Alembic Operation Reference — `add_column`](https://alembic.sqlalchemy.org/en/latest/ops.html) — `server_default`, `nullable` parameter behavior confirmed (HIGH confidence — official docs)
- [SQLAlchemy 2.0 Column INSERT/UPDATE Defaults](https://docs.sqlalchemy.org/en/20/core/defaults.html) — `server_default=func.now()` render behavior confirmed (HIGH confidence — official docs)
- [pydantic-settings PyPI 2.13.1](https://pypi.org/project/pydantic-settings/) — Latest version, `BaseSettings` typed int/float env var loading confirmed (HIGH confidence — official PyPI)
- [Pydantic v2 `computed_field`](https://docs.pydantic.dev/latest/concepts/models/) — `@computed_field` included in serialization automatically (HIGH confidence — official docs)
- [Alembic `compare_type=True` in env.py](https://alembic.sqlalchemy.org/en/latest/autogenerate.html) — Required for autogenerate to detect column type changes (HIGH confidence — official docs)
- [PostgreSQL 11+ lock-free ADD COLUMN with DEFAULT](https://www.postgresql.org/docs/current/sql-altertable.html) — Non-volatile default stored in metadata, no table rewrite (HIGH confidence — official PostgreSQL docs)
- [Alembic GitHub discussion #1730 — `server_default` vs `default` for migrations](https://github.com/sqlalchemy/alembic/discussions/1730) — Confirms `server_default` is the correct approach for existing-row safety (MEDIUM confidence — official repo discussion)
- [Squawk linter — adding-not-nullable-field pattern](https://squawkhq.com/docs/adding-not-nullable-field) — Lock implications of `NOT NULL ADD COLUMN` confirmed (MEDIUM confidence — established migration linter docs)

---

*Stack research for: Intelligence Globe v4.0 Data Reliability & Freshness — no new dependencies, all features use existing SQLAlchemy/Alembic/pydantic-settings/FastAPI*
*Researched: 2026-03-13*
