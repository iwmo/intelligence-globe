# Phase 10: Snapshot Infrastructure - Research

**Researched:** 2026-03-12
**Domain:** PostgreSQL range partitioning, RQ background task, FastAPI read-only replay API
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| REP-01 | System records position snapshots of all entities at 60s intervals in time-partitioned PostgreSQL tables | PostgreSQL declarative range partitioning by day; RQ self-re-enqueue pattern (established); partition-aware insert helper; application-level ensure_partition() before each batch insert |
</phase_requirements>

---

## Summary

Phase 10 creates the historical foundation that all replay phases (REP-02 through REP-06) depend on. The job is entirely backend: define three snapshot tables (aircraft, military, ships) partitioned by day, write one RQ task that reads the live tables every 60 seconds and batch-inserts positions into the snapshot tables, and expose a read-only `/api/replay/snapshots` endpoint so Phase 11 can query historical positions.

PostgreSQL 16 (the version in docker-compose.yml via `postgis/postgis:16-3.5`) supports native declarative range partitioning. The project does not include pg_partman or pg_cron, and adding them would require rebuilding the Docker image. The correct approach for this homelab setup is **application-level partition management**: a Python helper called before each batch insert creates today's partition if it doesn't already exist and drops partitions older than 7 days. This keeps everything in standard Python and Alembic with no new Docker dependencies.

The existing RQ self-re-enqueue pattern (used by every ingest task) transfers directly to the snapshot task. The snapshot task wakes up every 60 seconds, reads current positions from the three live tables, and batch-inserts into the appropriate daily partitions. The replay API endpoint is a simple `SELECT ... WHERE ts BETWEEN :start AND :end AND layer_type = :layer` query — partition pruning makes this fast even for large date ranges.

**Primary recommendation:** Application-level `ensure_partition(session, table_name, date)` helper called before every batch insert. No pg_partman. No pg_cron. Pure PostgreSQL DDL via `op.execute()` in Alembic and `text()` in SQLAlchemy async sessions.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| SQLAlchemy asyncio | >=2.0 (already installed) | Async DB access and raw `text()` DDL | Already the project ORM; `text()` handles partition CREATE/DROP |
| Alembic | >=1.14 (already installed) | Migration for parent tables only | `op.execute()` emits raw DDL; partitions NOT managed by Alembic autogenerate |
| asyncpg | >=0.30 (already installed) | PostgreSQL async driver | Already in use |
| rq | >=1.16 (already installed) | 60-second self-re-enqueue | Established pattern for all ingest tasks |
| redis | >=5.0 (already installed) | RQ broker | Already in use |
| FastAPI | >=0.115 (already installed) | Replay API endpoint | Already the API framework |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| datetime (stdlib) | n/a | Date arithmetic for partition names and bounds | Used in ensure_partition() to compute today's date suffix |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Application-level ensure_partition() | pg_partman + pg_cron | pg_partman requires installing the extension in the Docker image (not present in postgis/postgis:16-3.5 by default) and pg_cron requires shared_preload_libraries change — far too much infrastructure for a homelab |
| Application-level ensure_partition() | Trigger-based auto-create | PostgreSQL cannot CREATE TABLE inside a trigger on the same table (transaction locking conflict) — triggers fire mid-transaction |
| Three separate snapshot tables | One unified snapshots table with layer_type column | Unified table is correct for the replay API query pattern; avoids UNION queries |

**Installation:** No new packages needed — all dependencies are already in `requirements.txt`.

---

## Architecture Patterns

### Recommended Project Structure
```
backend/app/
├── tasks/
│   └── snapshot_positions.py   # RQ task: read live tables, insert snapshots, re-enqueue every 60s
├── models/
│   └── position_snapshot.py    # PositionSnapshot SQLAlchemy model (parent partitioned table)
├── api/
│   └── routes_replay.py        # GET /api/replay/snapshots?layer=aircraft&start=...&end=...
└── worker.py                   # Add snapshot task enqueue (existing file, small addition)
backend/alembic/versions/
└── f1a2b3c4d5e6_add_position_snapshots_table.py  # Creates parent + today's partition
backend/tests/
├── test_snapshot.py            # Unit: snapshot_from_aircraft(), snapshot_from_military(), snapshot_from_ship()
└── test_replay.py              # API: GET /api/replay/snapshots returns 200 with list
```

### Pattern 1: Single Partitioned Parent Table with Unified layer_type Column

**What:** One `position_snapshots` table, range-partitioned by `ts` (TIMESTAMPTZ), with a `layer_type` TEXT column to discriminate entity type.

**When to use:** When the replay API must query across a time range for one or all layers. A single table with `WHERE ts BETWEEN :start AND :end AND layer_type = :layer` is simpler and faster than UNION queries across three tables. Partition pruning means PostgreSQL only scans the relevant daily partitions.

**Schema:**
```sql
-- Source: PostgreSQL 16 docs — CREATE TABLE ... PARTITION BY RANGE
CREATE TABLE position_snapshots (
    id          BIGSERIAL,
    ts          TIMESTAMPTZ NOT NULL,
    layer_type  TEXT        NOT NULL,   -- 'aircraft', 'military', 'ship'
    entity_id   TEXT        NOT NULL,   -- icao24, hex, mmsi
    latitude    DOUBLE PRECISION NOT NULL,
    longitude   DOUBLE PRECISION NOT NULL,
    altitude    DOUBLE PRECISION,       -- NULL for ships
    heading     DOUBLE PRECISION,
    speed       DOUBLE PRECISION,
    PRIMARY KEY (id, ts)               -- ts must be in PK for partitioned tables
) PARTITION BY RANGE (ts);
```

**Daily partition naming:** `position_snapshots_2026_03_12`

**Create daily partition SQL:**
```sql
-- Source: PostgreSQL docs — CREATE TABLE ... PARTITION OF
CREATE TABLE IF NOT EXISTS position_snapshots_2026_03_12
    PARTITION OF position_snapshots
    FOR VALUES FROM ('2026-03-12 00:00:00+00') TO ('2026-03-13 00:00:00+00');
```

**Drop old partition SQL:**
```sql
DROP TABLE IF EXISTS position_snapshots_2026_03_05;
```

### Pattern 2: Application-Level ensure_partition() Called Before Every Batch Insert

**What:** A Python async function that checks whether today's partition exists (using `pg_class` catalog query) and creates it if not. Also drops partitions older than 7 days. Called at the top of every snapshot task run.

**When to use:** Every time the 60-second snapshot task fires. At startup the partition won't exist; calling this first guarantees the INSERT never fails with "no partition of relation found for row."

**Example:**
```python
# Source: PostgreSQL pg_class catalog (verified via PostgreSQL docs)
from datetime import date, timedelta, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text

RETENTION_DAYS = 7

async def ensure_partition(session: AsyncSession, today: date) -> None:
    """Create today's partition if absent; drop partitions older than RETENTION_DAYS."""
    # Create today's partition
    tomorrow = today + timedelta(days=1)
    partition_name = f"position_snapshots_{today.strftime('%Y_%m_%d')}"
    await session.execute(text(f"""
        CREATE TABLE IF NOT EXISTS {partition_name}
        PARTITION OF position_snapshots
        FOR VALUES FROM ('{today.isoformat()} 00:00:00+00')
                     TO ('{tomorrow.isoformat()} 00:00:00+00')
    """))

    # Drop partitions older than RETENTION_DAYS
    cutoff = today - timedelta(days=RETENTION_DAYS)
    old_name = f"position_snapshots_{cutoff.strftime('%Y_%m_%d')}"
    await session.execute(text(f"DROP TABLE IF EXISTS {old_name}"))

    await session.commit()
```

**Note:** `CREATE TABLE IF NOT EXISTS ... PARTITION OF` is valid PostgreSQL 16 syntax. Verified against official PostgreSQL docs (https://www.postgresql.org/docs/current/ddl-partitioning.html).

### Pattern 3: Snapshot Task Self-Re-Enqueue (Established Pattern)

**What:** Same `sync_*` → `asyncio.run(async_*)` → `finally: q.enqueue_in(timedelta(seconds=60), sync_snapshot_positions)` pattern used by all existing ingest tasks.

**When to use:** This is the only RQ scheduling approach used in the project (avoids RQ Repeat version instability).

**Example:**
```python
# Source: existing ingest_military.py pattern (established in Phase 8)
SNAPSHOT_INTERVAL_SECONDS = 60

def sync_snapshot_positions() -> None:
    try:
        asyncio.run(snapshot_positions())
    except Exception as exc:
        logger.exception("Snapshot task failed: %s", exc)
        raise
    finally:
        from redis import Redis
        from rq import Queue
        conn = Redis.from_url(os.getenv("REDIS_URL", "redis://redis:6379/0"))
        q = Queue(connection=conn)
        q.enqueue_in(timedelta(seconds=SNAPSHOT_INTERVAL_SECONDS), sync_snapshot_positions)
```

### Pattern 4: Alembic Migration for Parent Table Only

**What:** The Alembic migration creates the parent `position_snapshots` table with `PARTITION BY RANGE (ts)`. It also creates today's first partition so the system is immediately usable after migration. Future partitions are managed by `ensure_partition()` at runtime.

**Critical:** Alembic autogenerate does NOT handle partitioned tables correctly (it will try to recreate partitions on every autogenerate run). The migration must be manual (`op.execute()`) and the `env.py` `include_object` filter already excludes reflected tables not in metadata — this means child partition tables (which are reflected, not in `Base.metadata`) will be ignored by autogenerate. No action required, but do NOT define child partition models.

**Example Alembic migration:**
```python
def upgrade() -> None:
    # Create parent partitioned table
    op.execute("""
        CREATE TABLE position_snapshots (
            id          BIGSERIAL,
            ts          TIMESTAMPTZ NOT NULL,
            layer_type  TEXT        NOT NULL,
            entity_id   TEXT        NOT NULL,
            latitude    DOUBLE PRECISION NOT NULL,
            longitude   DOUBLE PRECISION NOT NULL,
            altitude    DOUBLE PRECISION,
            heading     DOUBLE PRECISION,
            speed       DOUBLE PRECISION,
            PRIMARY KEY (id, ts)
        ) PARTITION BY RANGE (ts)
    """)
    # Create index on ts and layer_type for replay queries
    op.execute("CREATE INDEX ON position_snapshots (ts, layer_type)")
    # Create today's initial partition so first snapshot task doesn't fail
    # (ensure_partition() handles future days at runtime)
    import datetime
    today = datetime.date.today()
    tomorrow = today + datetime.timedelta(days=1)
    op.execute(f"""
        CREATE TABLE IF NOT EXISTS position_snapshots_{today.strftime('%Y_%m_%d')}
        PARTITION OF position_snapshots
        FOR VALUES FROM ('{today.isoformat()} 00:00:00+00')
                     TO ('{tomorrow.isoformat()} 00:00:00+00')
    """)
```

### Pattern 5: Replay API Query

**What:** FastAPI GET endpoint that accepts `layer` (aircraft|military|ship|all), `start` (ISO datetime), `end` (ISO datetime) and returns a list of snapshot records. PostgreSQL partition pruning handles performance — only the relevant daily partitions are scanned.

**Example:**
```python
@router.get("")
async def get_snapshots(
    layer: str,
    start: datetime,
    end: datetime,
    db: AsyncSession = Depends(get_db),
):
    stmt = select(PositionSnapshot).where(
        PositionSnapshot.ts >= start,
        PositionSnapshot.ts <= end,
    )
    if layer != "all":
        stmt = stmt.where(PositionSnapshot.layer_type == layer)
    result = await db.execute(stmt)
    rows = result.scalars().all()
    return [{"ts": r.ts.isoformat(), "layer_type": r.layer_type,
             "entity_id": r.entity_id, "latitude": r.latitude,
             "longitude": r.longitude, "altitude": r.altitude,
             "heading": r.heading, "speed": r.speed} for r in rows]
```

### Anti-Patterns to Avoid

- **Defining child partition SQLAlchemy models:** Do not create `PositionSnapshotDay` or any per-day ORM model. Alembic autogenerate will conflict. The parent `PositionSnapshot` model is the only ORM model; inserts go to the parent and PostgreSQL routes them to the correct partition automatically.
- **Using Alembic autogenerate for partition DDL:** Run `alembic revision --autogenerate` and it will try to manage partition child tables. Only use `alembic revision` (manual) for this migration.
- **Inserting directly to a child partition table:** Always insert into the parent `position_snapshots`. PostgreSQL routes to the correct partition transparently.
- **Mixing sync and async DB calls inside the RQ task:** The snapshot task uses `asyncio.run()` like all other tasks — do not use sync SQLAlchemy inside the async function body.
- **Calling ensure_partition() inside a transaction that also INSERTs:** CREATE TABLE (DDL) cannot be mixed with DML in the same transaction in many cases. Commit the ensure_partition() session before opening the INSERT session.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Partition existence check | Custom `pg_class` query with complex joins | `CREATE TABLE IF NOT EXISTS ... PARTITION OF` | PostgreSQL `IF NOT EXISTS` handles idempotency natively |
| Data expiry | Custom DELETE query across millions of rows | `DROP TABLE IF EXISTS position_snapshots_YYYY_MM_DD` | DROP TABLE is O(1) regardless of row count; DELETE is O(n) and leaves bloat |
| Time-based scheduling | Custom sleep loop or cron container | RQ `enqueue_in(timedelta(seconds=60), ...)` | Established project pattern; already works for all ingest tasks |
| Partition routing | Manual INSERT to child table by name | INSERT into parent `position_snapshots` | PostgreSQL routes automatically based on `ts` value |

**Key insight:** Partition management in PostgreSQL is a DDL operation. DROP TABLE is orders of magnitude faster than DELETE for time-series cleanup — this is the entire point of partitioning.

---

## Common Pitfalls

### Pitfall 1: PRIMARY KEY Must Include Partition Key

**What goes wrong:** `PRIMARY KEY (id)` fails with "PRIMARY KEY constraint must be a superset of partition key" if `ts` (the partition key) is not included in the primary key.

**Why it happens:** PostgreSQL enforces that unique constraints (including PKs) on a partitioned table include the partition key so the constraint can be enforced within each partition independently.

**How to avoid:** Always define `PRIMARY KEY (id, ts)` — not `PRIMARY KEY (id)` alone.

**Warning signs:** Migration fails immediately with `ERROR: unique constraint on partitioned table must include all partitioning columns`.

### Pitfall 2: No Partition for the Current Day on Startup

**What goes wrong:** The first snapshot task run at startup fails with `ERROR: no partition of relation "position_snapshots" found for row` if today's partition doesn't exist yet.

**Why it happens:** A range-partitioned table with no matching partition raises an error on INSERT (unlike a DEFAULT partition). The Alembic migration creates today's partition, but if the migration ran yesterday (or the system restarts at midnight), the next day has no partition.

**How to avoid:** `ensure_partition()` called at the top of every snapshot task run (before the INSERT batch). The `IF NOT EXISTS` guard makes it idempotent.

**Warning signs:** RQ job fails on the first run after midnight.

### Pitfall 3: DDL Inside a Transaction with DML

**What goes wrong:** `CREATE TABLE` inside the same transaction as `INSERT` may cause unexpected behavior or fail outright if the session is already in a DML transaction.

**Why it happens:** PostgreSQL runs DDL transactionally, but `CREATE TABLE IF NOT EXISTS ... PARTITION OF` acquires an ACCESS EXCLUSIVE lock on the parent table that conflicts with concurrent reads/writes until the transaction commits.

**How to avoid:** Run `ensure_partition()` in its own session and commit before opening the INSERT session. The two-session pattern (`async with AsyncSessionLocal() as session: ... await session.commit()` then `async with AsyncSessionLocal() as session: ...`) is already established in the project (see `ingest_gps_jamming.py`).

### Pitfall 4: Alembic Autogenerate Detects Child Partition Tables

**What goes wrong:** Running `alembic revision --autogenerate` after Phase 10 is deployed generates a migration that tries to CREATE child partition tables (e.g., `position_snapshots_2026_03_12`) because they appear in the reflected schema.

**Why it happens:** Alembic compares DB schema against `Base.metadata`. Child partitions exist in DB but not in metadata, so autogenerate thinks they need to be created.

**How to avoid:** The existing `include_object` filter in `env.py` already handles this: `if type_ == "table" and reflected and compare_to is None: return False`. Child partition tables are reflected (they exist in DB) but not in `compare_to` (not in metadata) — so they are excluded. No action required beyond verifying this filter is in place.

### Pitfall 5: Snapshot Volume at 60s Interval

**What goes wrong:** At 60-second intervals with ~10,000 aircraft + 500 military + 500 ships per snapshot, the table grows at ~11,000 rows/minute = ~15M rows/day. After 7 days that's ~105M rows across 7 partitions before the oldest is dropped.

**Why it happens:** This is expected and by design (STATE.md explicitly documents it: "Snapshot table range-partitioned by day from day one — Retrofitting a live unpartitioned table at scale requires downtime; 100M+ rows within two weeks at 60s intervals").

**How to avoid:** The 7-day retention via DROP TABLE ensures storage stays bounded. Index on `(ts, layer_type)` created in the migration ensures replay queries are fast.

**Warning signs:** Disk usage growing unboundedly. Check that `ensure_partition()` is actually dropping old partitions (verify the old partition table name matches the drop target).

### Pitfall 6: Replay API Mid-Recording Query

**What goes wrong:** A client queries the replay API for the last 10 minutes while the snapshot task is actively inserting. The response may miss the most recent 60 seconds.

**Why it happens:** The snapshot task commits every 60 seconds. A query between commits returns data up to the last commit, not the in-flight batch.

**How to avoid:** This is acceptable behavior by design — the replay API is explicitly described as "returning correctly even when queried mid-recording," which means it returns whatever has been committed so far. Document this in the API response (e.g., add a `recorded_through` field with the timestamp of the last snapshot batch). The planner should add a `last_snapshot_at` metadata field to the API response.

---

## Code Examples

### Verified partition DDL (PostgreSQL 16)

```sql
-- Source: https://www.postgresql.org/docs/current/ddl-partitioning.html
CREATE TABLE position_snapshots (
    id          BIGSERIAL,
    ts          TIMESTAMPTZ NOT NULL,
    layer_type  TEXT        NOT NULL,
    entity_id   TEXT        NOT NULL,
    latitude    DOUBLE PRECISION NOT NULL,
    longitude   DOUBLE PRECISION NOT NULL,
    altitude    DOUBLE PRECISION,
    heading     DOUBLE PRECISION,
    speed       DOUBLE PRECISION,
    PRIMARY KEY (id, ts)
) PARTITION BY RANGE (ts);

-- Daily child partition (inclusive lower, exclusive upper)
CREATE TABLE IF NOT EXISTS position_snapshots_2026_03_12
    PARTITION OF position_snapshots
    FOR VALUES FROM ('2026-03-12 00:00:00+00')
                 TO ('2026-03-13 00:00:00+00');

-- Drop old partition (O(1), regardless of row count)
DROP TABLE IF EXISTS position_snapshots_2026_03_05;

-- Replay query — partition pruning makes this fast
SELECT * FROM position_snapshots
WHERE ts BETWEEN '2026-03-12 10:00:00+00' AND '2026-03-12 11:00:00+00'
  AND layer_type = 'aircraft'
ORDER BY ts;
```

### Snapshot task core function

```python
# Derived from ingest_military.py pattern (established Phase 8)
import asyncio
import logging
import os
from datetime import date, datetime, timedelta, timezone

from sqlalchemy import text, select

from app.db import AsyncSessionLocal
from app.models.aircraft import Aircraft
from app.models.military_aircraft import MilitaryAircraft
from app.models.ship import Ship

logger = logging.getLogger(__name__)
SNAPSHOT_INTERVAL_SECONDS = 60
RETENTION_DAYS = 7


async def ensure_partition(today: date) -> None:
    """Create today's partition; drop partition from RETENTION_DAYS+1 ago."""
    tomorrow = today + timedelta(days=1)
    partition_name = f"position_snapshots_{today.strftime('%Y_%m_%d')}"
    old_date = today - timedelta(days=RETENTION_DAYS)
    old_name = f"position_snapshots_{old_date.strftime('%Y_%m_%d')}"
    async with AsyncSessionLocal() as session:
        await session.execute(text(
            f"CREATE TABLE IF NOT EXISTS {partition_name} "
            f"PARTITION OF position_snapshots "
            f"FOR VALUES FROM ('{today.isoformat()} 00:00:00+00') "
            f"TO ('{tomorrow.isoformat()} 00:00:00+00')"
        ))
        await session.execute(text(f"DROP TABLE IF EXISTS {old_name}"))
        await session.commit()


async def snapshot_positions() -> int:
    today = datetime.now(timezone.utc).date()
    await ensure_partition(today)
    ts = datetime.now(timezone.utc)
    rows = []
    # Read aircraft
    async with AsyncSessionLocal() as session:
        result = await session.execute(
            select(Aircraft).where(
                Aircraft.latitude.is_not(None),
                Aircraft.longitude.is_not(None),
            )
        )
        for ac in result.scalars().all():
            rows.append({
                "ts": ts,
                "layer_type": "aircraft",
                "entity_id": ac.icao24,
                "latitude": ac.latitude,
                "longitude": ac.longitude,
                "altitude": ac.baro_altitude,
                "heading": ac.true_track,
                "speed": ac.velocity,
            })
    # ... similar for MilitaryAircraft and Ship ...
    # Batch insert
    async with AsyncSessionLocal() as session:
        if rows:
            await session.execute(
                text("INSERT INTO position_snapshots "
                     "(ts, layer_type, entity_id, latitude, longitude, altitude, heading, speed) "
                     "VALUES (:ts, :layer_type, :entity_id, :latitude, :longitude, "
                     ":altitude, :heading, :speed)"),
                rows,
            )
            await session.commit()
    return len(rows)
```

### Replay API endpoint

```python
# routes_replay.py — FastAPI pattern consistent with existing routes
from datetime import datetime
from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.db import get_db
from app.models.position_snapshot import PositionSnapshot

router = APIRouter()

@router.get("")
async def get_snapshots(
    layer: str = Query("all"),
    start: datetime = Query(...),
    end: datetime = Query(...),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(PositionSnapshot).where(
        PositionSnapshot.ts >= start,
        PositionSnapshot.ts <= end,
    )
    if layer != "all":
        stmt = stmt.where(PositionSnapshot.layer_type == layer)
    stmt = stmt.order_by(PositionSnapshot.ts)
    result = await db.execute(stmt)
    rows = result.scalars().all()
    return {
        "snapshots": [
            {
                "ts": r.ts.isoformat(),
                "layer_type": r.layer_type,
                "entity_id": r.entity_id,
                "latitude": r.latitude,
                "longitude": r.longitude,
                "altitude": r.altitude,
                "heading": r.heading,
                "speed": r.speed,
            }
            for r in rows
        ],
        "count": len(rows),
    }
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Trigger-based partitioning (PostgreSQL <10) | Declarative PARTITION BY RANGE | PostgreSQL 10 (2017) | DDL syntax is clean and native; triggers no longer needed |
| pg_partman for all partition lifecycle | Application-level DDL for simple cases | pg_partman 5.0 (2023) dropped trigger-based | For simple daily retention use cases, application-level DDL is sufficient and avoids extension dependency |
| Separate partition tables per entity type | Single unified table with layer_type discriminator | Design decision | Simplifies replay API to a single SELECT; UNION queries across tables are slower and harder to index |

**Deprecated/outdated:**
- Trigger-based inheritance partitioning: Removed in pg_partman 5.0. PostgreSQL declarative partitioning is the only supported approach.
- `PARTITION BY LIST` for entity types: Wrong pattern here. The partition key must be `ts` (time) to enable efficient range queries and time-based retention.

---

## Open Questions

1. **SQLAlchemy ORM model for the parent partitioned table**
   - What we know: SQLAlchemy 2.x can define a model against a partitioned parent table; inserts go to the parent and PostgreSQL routes to the child.
   - What's unclear: Whether `BIGSERIAL` in a composite PK `(id, ts)` auto-increments correctly across partitions in SQLAlchemy mapped inserts.
   - Recommendation: Use `text()` for batch inserts (no ORM insert needed for snapshots); the `PositionSnapshot` model is only needed for SELECT in the replay API. This sidesteps any ORM/BIGSERIAL/partition interaction complexity. Use `BIGSERIAL` for the id but insert via raw SQL that omits `id` (let the sequence generate it). Plan should specify testing this in Wave 0.

2. **Partition creation on midnight boundary**
   - What we know: `ensure_partition()` is called before every batch insert. At 00:00:01 UTC, today's partition for the new day won't exist.
   - What's unclear: Whether `ensure_partition()` is fast enough to not add meaningful latency to the 60-second interval. CREATE TABLE IF NOT EXISTS is near-instantaneous when the partition exists.
   - Recommendation: Acceptable. The 60-second interval is a best-effort schedule, not a hard real-time requirement.

3. **Replay API response size for large time ranges**
   - What we know: At 11,000 entities × 60-second intervals, one hour of data = 660,000 rows. The Phase 11 frontend will likely request 5-60 minutes at a time.
   - What's unclear: Whether pagination is needed in Phase 10 or can be deferred to Phase 11.
   - Recommendation: Add an optional `limit` query parameter (default 10,000) in Phase 10 to prevent accidental large responses. Phase 11 can tune this based on actual UI needs.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | pytest 8.x + pytest-asyncio 0.24 |
| Config file | `/backend/pytest.ini` (`asyncio_mode = auto`) |
| Quick run command | `cd backend && python -m pytest tests/test_snapshot.py tests/test_replay.py -x -q` |
| Full suite command | `cd backend && python -m pytest -x -q` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| REP-01 | `snapshot_from_aircraft(row)` returns dict with correct keys | unit | `pytest tests/test_snapshot.py::test_snapshot_from_aircraft -x` | Wave 0 |
| REP-01 | `snapshot_from_military(row)` returns dict with correct keys | unit | `pytest tests/test_snapshot.py::test_snapshot_from_military -x` | Wave 0 |
| REP-01 | `snapshot_from_ship(row)` returns dict with correct keys | unit | `pytest tests/test_snapshot.py::test_snapshot_from_ship -x` | Wave 0 |
| REP-01 | `ensure_partition()` generates correct partition name and DDL strings | unit | `pytest tests/test_snapshot.py::test_ensure_partition_name -x` | Wave 0 |
| REP-01 | GET /api/replay/snapshots returns 200 with `snapshots` list | integration | `pytest tests/test_replay.py::test_replay_route_exists -x` | Wave 0 |
| REP-01 | GET /api/replay/snapshots with `layer=aircraft` returns 200 | integration | `pytest tests/test_replay.py::test_replay_layer_filter -x` | Wave 0 |
| REP-01 | GET /api/replay/snapshots returns 404 for unknown layer | integration | `pytest tests/test_replay.py::test_replay_invalid_layer -x` | Wave 0 |

### Sampling Rate
- **Per task commit:** `cd backend && python -m pytest tests/test_snapshot.py tests/test_replay.py -x -q`
- **Per wave merge:** `cd backend && python -m pytest -x -q`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/test_snapshot.py` — unit tests for pure helpers: `snapshot_from_aircraft`, `snapshot_from_military`, `snapshot_from_ship`, partition name generation
- [ ] `tests/test_replay.py` — API contract test: deferred import pattern (GET /api/replay/snapshots returns 200, layer filter works, route exists before implementation)

*(Framework install not needed — pytest and pytest-asyncio already in `requirements-dev.txt`)*

---

## Sources

### Primary (HIGH confidence)
- [PostgreSQL 16 Partitioning Docs](https://www.postgresql.org/docs/current/ddl-partitioning.html) — DDL syntax for PARTITION BY RANGE, CREATE TABLE IF NOT EXISTS PARTITION OF, FOR VALUES FROM/TO, DROP TABLE IF EXISTS
- Existing project code: `backend/app/tasks/ingest_military.py`, `ingest_gps_jamming.py`, `ingest_aircraft.py` — established RQ self-re-enqueue pattern, AsyncSessionLocal, asyncpg, batch upsert approach
- Existing project code: `backend/alembic/versions/a1b2c3d4e5f6_add_military_aircraft_table.py` — Alembic `op.execute()` pattern for raw DDL
- Existing project code: `backend/alembic/env.py` — `include_object` filter already handles reflected-only tables

### Secondary (MEDIUM confidence)
- [Alembic issue #539 — PostgreSQL partitioned table support](https://github.com/sqlalchemy/alembic/issues/539) — confirms autogenerate does NOT handle partitioned tables correctly; manual migrations required
- [SQLAlchemy discussion #10202 — partition table based on date](https://github.com/sqlalchemy/sqlalchemy/discussions/10202) — confirms application-level DDL via `text()` is the standard approach; no ORM partition magic available
- [Supabase blog — Dynamic Table Partitioning](https://supabase.com/blog/postgres-dynamic-table-partitioning) — two-phase partition management pattern (create-then-attach); the simpler `CREATE TABLE IF NOT EXISTS PARTITION OF` covers the homelab use case

### Tertiary (LOW confidence)
- WebSearch results on pg_partman availability in postgis/postgis:16-3.5 Docker image — not definitively confirmed; treated as unavailable for safety

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already installed; no new dependencies
- Architecture: HIGH — DDL syntax verified against PostgreSQL 16 official docs; patterns derived from existing project code
- Pitfalls: HIGH — PK constraint, partition routing, autogenerate behavior all verified against official documentation
- Partition management approach: HIGH — `CREATE TABLE IF NOT EXISTS PARTITION OF` verified as valid PostgreSQL 16 syntax

**Research date:** 2026-03-12
**Valid until:** 2026-04-12 (PostgreSQL 16 partitioning API is stable; no planned changes)
