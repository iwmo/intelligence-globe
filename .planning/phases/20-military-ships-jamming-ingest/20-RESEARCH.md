# Phase 20: Military, Ships, and Jamming Ingest - Research

**Researched:** 2026-03-13
**Domain:** Ingest worker freshness lifecycle — military aircraft tombstone, AIS ship deactivation sweep, GPS jamming active-only aggregation with metadata columns
**Confidence:** HIGH

## Summary

Phase 20 is a surgical extension of three existing ingest workers, directly parallel to what Phase 19 did for commercial aircraft. All freshness columns are already in the database (MIG-01, Phase 17) and already mapped on the SQLAlchemy models. The `stale_cutoff()` / `is_stale()` helpers and the `MILITARY_STALE_SECONDS` / `SHIP_STALE_SECONDS` / `GPS_JAMMING_STALE_SECONDS` settings are already implemented (Phases 17–18). Phase 20 is purely about wiring those columns into the three ingest write paths.

The three requirements split cleanly across three files: `backend/app/tasks/ingest_military.py` (MIL-01), `backend/app/workers/ingest_ais.py` (SHIP-01), and `backend/app/tasks/ingest_gps_jamming.py` (JAM-01). Each file has an existing test counterpart (`test_ingest_military.py`, `test_ingest_ais.py`, `test_gps_jamming.py`). No new test files are needed — new test cases extend the existing files.

The AIS worker presents the only architectural novelty relative to Phase 19: ships are deactivated via a deactivation sweep in `batch_flush_ships_to_pg()` (not in a separate task), because the AIS pipeline is a Redis-TTL → PostgreSQL bridge. The set of MMSIs that are still live in Redis at flush time defines the active set — anything absent from that flush's Redis scan gets `is_active=False`.

**Primary recommendation:** Three focused plans, one per requirement, matching the three distinct ingest files. MIL-01 and JAM-01 are closely coupled (jamming reads military), so plan JAM-01 after MIL-01 is complete.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| MIL-01 | `military_aircraft` model gains `fetched_at`, `last_seen_at`, `is_active`; ingest marks seen rows active and writes `fetched_at`/`last_seen_at` explicitly in `set_={}`; tombstone pass marks absent rows `is_active=False` after each 300s poll | All three columns already present on the `MilitaryAircraft` model (MIG-01). `ingest_military_aircraft()` in `tasks/ingest_military.py` manages its own session and commit — tombstone goes there. Pattern is identical to `ingest_aircraft.py` (Phase 19). |
| SHIP-01 | `ships` model gains `last_seen_at` (typed TIMESTAMPTZ parsed from `time_utc`) and `is_active`; `batch_flush_ships_to_pg` gains deactivation sweep marking ships not seen in current flush as `is_active=False`, bridging Redis TTL expiry to PostgreSQL | Both columns already on `Ship` model. `time_utc` from `parse_ais_message()` is currently stored in the string column `last_update` — `last_seen_at` must be parsed from this string. Deactivation sweep: collect seen MMSIs during the upsert loop, then UPDATE ships SET is_active=False WHERE mmsi NOT IN (seen_mmsis), same commit. Guard: skip sweep if seen_mmsis is empty. |
| JAM-01 | `ingest_gps_jamming.py` filters source military rows to `is_active=True` before aggregation; writes `aggregated_at`, `source_fetched_at`, `source_is_stale` to every cell in the batch | `GpsJammingCell` model already has all three columns. The SELECT in `ingest_gps_jamming()` just needs `.where(MilitaryAircraft.is_active == True)` added. `aggregated_at` = `datetime.now(UTC)` at aggregation start. `source_fetched_at` = `MAX(fetched_at)` across active military rows. `source_is_stale` = `is_stale(source_fetched_at, settings.MILITARY_STALE_SECONDS)`. |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| SQLAlchemy (asyncpg) | already in project | Async ORM upsert with `pg_insert().on_conflict_do_update()` | All existing ingest tasks use this pattern |
| PostgreSQL `pg_insert` | already in project | Upsert with explicit `set_={}` dict | Project-wide constraint: explicit set_ dict, not `onupdate` |
| `app.freshness` | Phase 18 | `stale_cutoff()`, `is_stale()` | Already implemented and tested — import directly |
| `app.config.settings` | Phase 18 | `MILITARY_STALE_SECONDS`, `GPS_JAMMING_STALE_SECONDS` | Already in Settings class |
| SQLAlchemy `update as sa_update` | already in project | Tombstone/deactivation sweep | Used in Phase 19 ingest_aircraft pattern |
| SQLAlchemy `func.max` | already in project | `MAX(fetched_at)` for `source_fetched_at` | Single aggregate query over active military rows |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `datetime.now(timezone.utc)` | stdlib | `last_seen_at`, `aggregated_at` values | Ingest timestamp at write time |
| `datetime.fromisoformat()` | stdlib | Parse `time_utc` string to TIMESTAMPTZ for `last_seen_at` | AIS `time_utc` comes as an ISO string from `parse_ais_message()` |
| `from datetime import datetime` | stdlib | Import style required | Project rule: `from datetime import datetime`, not `import datetime`, for `patch()` patchability in tests |

**Installation:** No new dependencies required for this phase.

## Architecture Patterns

### Recommended File Structure (no new files)
```
backend/app/tasks/
├── ingest_military.py   # MIL-01: add fetched_at/last_seen_at/is_active to set_={}, tombstone sweep
└── ingest_gps_jamming.py # JAM-01: filter is_active=True, write aggregated_at/source_fetched_at/source_is_stale

backend/app/workers/
└── ingest_ais.py        # SHIP-01: add last_seen_at/is_active to set_={}, deactivation sweep in batch_flush_ships_to_pg

backend/tests/
├── test_ingest_military.py  # add new test cases (file already exists)
├── test_ingest_ais.py       # add new test cases (file already exists)
└── test_gps_jamming.py      # add new test cases (file already exists)
```

### Pattern 1: Military Ingest Freshness (MIL-01)

The `airplanes.live /v2/mil` response does not contain a per-aircraft timestamp. `fetched_at` for military aircraft is the ingest wall-clock time (not a source timestamp like OpenSky's `time` field). Both `fetched_at` and `last_seen_at` are `datetime.now(UTC)` captured once at the start of `ingest_military_aircraft()`.

```python
# Source: project decision — parallel to ingest_aircraft.py (Phase 19)
from datetime import datetime, timezone

fetched_at = datetime.now(timezone.utc)   # wall-clock at poll start
last_seen_at = fetched_at                 # same value — no per-aircraft source timestamp

# In set_={} for each upserted row:
set_={
    "flight": record["flight"],
    # ... all existing fields ...
    "fetched_at": fetched_at,
    "last_seen_at": last_seen_at,
    "is_active": True,
    "updated_at": func.now(),
}
```

### Pattern 2: Military Tombstone Sweep (MIL-01)

Identical to the Phase 19 tombstone. Collected inside the same session/commit block as the upserts. Guarded against empty seen set.

```python
# Source: established project pattern (STATE.md decision, Phase 19 implementation)
from sqlalchemy import update as sa_update

seen_hexes = list({record["hex"] for record in valid_records})
if seen_hexes:
    tombstone_stmt = (
        sa_update(MilitaryAircraft)
        .where(MilitaryAircraft.hex.not_in(seen_hexes))
        .values(is_active=False)
    )
    await session.execute(tombstone_stmt)

await session.commit()  # single commit: upserts + tombstone
```

**Critical:** The current `ingest_military_aircraft()` calls `await session.commit()` after the upsert loop, before the session context exits. The tombstone must move inside that same `async with AsyncSessionLocal() as session:` block, before that commit.

### Pattern 3: AIS Deactivation Sweep (SHIP-01)

AIS ships do not have a polling-style snapshot: the Redis cache is a live sliding window. The deactivation sweep happens inside `batch_flush_ships_to_pg()`: the set of MMSIs returned by `redis_client.scan_iter("ship:*")` at flush time is the active set. Ships in PostgreSQL not present in that scan are marked inactive.

```python
# Source: project architectural decision in STATE.md:
# "is_active for AIS ships derived from Redis key presence (not nav_status-aware timestamp arithmetic)"

seen_mmsis = []

async for key in redis_client.scan_iter("ship:*"):
    data = await redis_client.hgetall(key)
    # ... parse row ...
    if row:
        rows.append(row)
        seen_mmsis.append(row["mmsi"])

# In the upsert block, add last_seen_at and is_active to set_={}:
stmt = stmt.on_conflict_do_update(
    index_elements=["mmsi"],
    set_={
        # ... existing fields ...
        "last_seen_at": datetime.now(timezone.utc),
        "is_active": True,
    },
)

# After the upsert chunk loop, before commit:
if seen_mmsis:
    tombstone_stmt = (
        sa_update(Ship)
        .where(Ship.mmsi.not_in(seen_mmsis))
        .values(is_active=False)
    )
    await session.execute(tombstone_stmt)

await session.commit()
```

### Pattern 4: AIS `last_seen_at` from `time_utc` String (SHIP-01)

The AIS `parse_ais_message()` returns `time_utc` as an ISO datetime string (from `meta.get("time_utc")`). The `Ship` model's `last_seen_at` column is `TIMESTAMPTZ`. The conversion must happen in `batch_flush_ships_to_pg()` when building each row dict.

```python
# time_utc from Redis (stored as a string value)
time_utc_raw = decoded.get("time_utc") or None

# Convert to datetime for last_seen_at
from datetime import datetime, timezone

def parse_time_utc(raw: str | None) -> datetime | None:
    if not raw:
        return None
    try:
        dt = datetime.fromisoformat(raw)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt
    except (ValueError, TypeError):
        return None

row["last_seen_at"] = parse_time_utc(time_utc_raw)
```

**Note:** The existing `Ship` model has a string column `last_update` which stores the raw `time_utc` string. `last_seen_at` is a separate TIMESTAMPTZ column. Both must be written — `last_update` preserves the existing behavior.

### Pattern 5: GPS Jamming Active-Only Filter (JAM-01)

A single `.where()` clause addition to the existing SELECT in `ingest_gps_jamming()`:

```python
# Source: JAM-01 requirement — filter to is_active=True
result = await session.execute(
    select(MilitaryAircraft).where(
        MilitaryAircraft.latitude.is_not(None),
        MilitaryAircraft.longitude.is_not(None),
        MilitaryAircraft.is_active == True,   # ← new: only active aircraft
    )
)
```

### Pattern 6: GPS Jamming Freshness Metadata (JAM-01)

Three values computed once per aggregation cycle, written to every cell in the batch:

```python
from datetime import datetime, timezone
from app.freshness import is_stale
from app.config import settings

# Capture before the session block
aggregated_at = datetime.now(timezone.utc)

# After the SELECT, derive source_fetched_at from the active military rows
# Use max(fetched_at) across all aircraft_rows (or None if no active rows)
source_fetched_at: datetime | None = None
for ac in aircraft_rows:
    if ac.fetched_at is not None:
        if source_fetched_at is None or ac.fetched_at > source_fetched_at:
            source_fetched_at = ac.fetched_at

source_is_stale = is_stale(source_fetched_at, settings.MILITARY_STALE_SECONDS)

# Write to every cell in set_={}:
set_={
    "bad_ratio": cell["bad_ratio"],
    "severity": cell["severity"],
    "aircraft_count": cell["aircraft_count"],
    "aggregated_at": aggregated_at,
    "source_fetched_at": source_fetched_at,
    "source_is_stale": source_is_stale,
}
```

**Alternative approach:** Use a DB-level `SELECT MAX(fetched_at) FROM military_aircraft WHERE is_active=True` in a separate query before the full SELECT. Either approach is valid — the Python-level max is simpler and avoids an extra round-trip given the rows are already loaded.

### Anti-Patterns to Avoid

- **Using `onupdate=func.now()` for freshness fields instead of explicit `set_={}`:** The `MilitaryAircraft.updated_at` already uses this (pre-existing), but `fetched_at` and `last_seen_at` must be explicit in `set_={}`. The existing `ingest_military_aircraft()` already writes `"updated_at": func.now()` in `set_={}` — this is correct and must be preserved alongside the new fields.
- **Tombstoning before the upsert loop:** The tombstone/deactivation sweep must come after all upserts, in the same session, before the single commit.
- **AIS deactivation sweep with empty seen_mmsis:** If Redis scan returns no ships (empty batch), skip the sweep — do not mark all ships inactive. The existing `if not rows: return 0` guard handles the return, but an inner `if seen_mmsis:` guard is still needed inside the session block for safety.
- **Treating the AIS deactivation sweep like a simple timestamp filter:** The architecture decision in STATE.md is explicit: "is_active for AIS ships derived from Redis key presence (not nav_status-aware timestamp arithmetic)". Do not use `last_seen_at` comparison for the sweep — use MMSI presence in the current Redis scan.
- **Writing `source_is_stale=False` when there are no active military rows:** If `aircraft_rows` is empty, `source_fetched_at` is `None`. `is_stale(None, threshold)` returns `True` — correct, the source is stale when there are no active rows. Do not special-case this.
- **Passing `seen_mmsis` / `seen_hexes` as a Python set directly to `not_in()`:** SQLAlchemy `not_in()` accepts a list or sequence. Convert to list first.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Stale cutoff calculation | Custom datetime arithmetic | `app.freshness.stale_cutoff()` | Already implemented, tested, clock-mockable |
| Is-stale boolean | Inline comparison | `app.freshness.is_stale()` | Handles None correctly — `None` → `True` |
| Stale threshold constants | Hardcoded integers | `settings.MILITARY_STALE_SECONDS`, `settings.GPS_JAMMING_STALE_SECONDS` | Env-overridable, tested |
| `source_fetched_at` max | Raw SQL MAX query | Python-level max over already-loaded rows | Avoids extra DB round-trip; rows already in memory |

**Key insight:** The freshness module (Phase 18) was built precisely so ingest workers and routes do not hand-roll datetime arithmetic. Import it — do not inline comparisons.

## Common Pitfalls

### Pitfall 1: Military `fetched_at` is Wall-Clock, Not Source Timestamp

**What goes wrong:** The airplanes.live `/v2/mil` API does not return a response-level timestamp (unlike OpenSky's `time` field). Setting `fetched_at` to a source timestamp from the response would fail because there is none.

**Why it happens:** Phase 19 research documented that OpenSky uses `data.get("time", 0)` for `fetched_at`. Applying the same pattern to airplanes.live finds no equivalent field.

**How to avoid:** Use `datetime.now(timezone.utc)` captured once at the top of `ingest_military_aircraft()` as both `fetched_at` and `last_seen_at`. This is a consistent wall-clock timestamp for the entire poll cycle.

**Warning signs:** If you see code trying to extract a timestamp from the airplanes.live response JSON at the top level, that field does not exist.

### Pitfall 2: Current `ingest_military_aircraft()` Commits Inside the Session Block

**What goes wrong:** The current implementation has `await session.commit()` after the upsert loop but before the tombstone sweep is added. If the tombstone is appended after the commit, it will run in a new implicit transaction with no session-level coordination.

**Why it happens:** Phase 19 code was the first to establish the "single commit after upserts + tombstone" pattern. The military ingest predates Phase 19 and does not follow it.

**How to avoid:** Move the tombstone sweep *before* the existing `await session.commit()` call, inside the `async with AsyncSessionLocal() as session:` block. Keep a single commit at the end of the block.

### Pitfall 3: AIS `last_seen_at` — String Parsing Edge Cases

**What goes wrong:** `time_utc` from aisstream.io messages comes through as a string stored in Redis. It may be timezone-naive ISO format, have timezone suffix, or be empty/None. Passing a naive datetime to a TIMESTAMPTZ column raises a database error.

**Why it happens:** Redis stores all values as strings; the original ingest stores `time_utc` as-is in the string `last_update` column. The new `last_seen_at` column requires proper TIMESTAMPTZ handling.

**How to avoid:** Parse with `datetime.fromisoformat()`, then attach UTC timezone if `tzinfo` is None. Wrap in try/except to handle malformed strings — fall back to `None` on parse error rather than crashing the flush.

**Warning signs:** `asyncpg.exceptions.InvalidDatetimePrecisionError` or similar at flush time.

### Pitfall 4: AIS Deactivation Sweep Chunk Boundary

**What goes wrong:** `batch_flush_ships_to_pg()` already chunks upserts at `CHUNK_SIZE = 3_000`. The deactivation sweep runs after all chunks complete. The `seen_mmsis` list must be accumulated across all chunks (not reset per chunk) to correctly identify the full active set.

**Why it happens:** If the deactivation sweep is added inside the chunk loop rather than after all chunks, each chunk would tombstone ships that appear in a subsequent chunk.

**How to avoid:** Collect `seen_mmsis` in the Redis scan phase (before chunking), not inside the chunk loop. The sweep runs once after all chunks are committed.

### Pitfall 5: JAM-01 — Empty Active Military Set

**What goes wrong:** If all military aircraft are tombstoned (feed is down), the `aircraft_rows` list is empty. The `aggregate_jamming_cells()` call produces zero cells. The `if not cells: return 0` guard skips the upsert, so `aggregated_at` / `source_fetched_at` / `source_is_stale` are never written.

**Why it happens:** The current `ingest_gps_jamming()` returns early when `cells` is empty. If GPS jamming cells already exist from a prior cycle, they keep their old metadata indefinitely.

**How to avoid:** JAM-01 does not require writing freshness metadata when there are no cells to write (that behavior is JAM-03, Phase 21: returning stale cells on feed-down). For Phase 20, the `if not cells: return 0` guard is acceptable. Document this behavior with a comment.

### Pitfall 6: `not_in()` with Large MMSI List

**What goes wrong:** PostgreSQL supports up to 32,767 bind parameters per query. If `seen_mmsis` contains thousands of entries (ships are global, potentially 10,000+), the NOT IN clause may exceed the limit.

**Why it happens:** The existing upsert chunk guard was added specifically for this reason (3,000 rows × 9 columns = 27,000 params). The same limit applies to NOT IN.

**How to avoid:** For Phase 20, the NOT IN approach is acceptable — the deactivation sweep is ships NOT in the current Redis scan, which typically numbers in the thousands rather than tens of thousands at a single flush interval. If needed later, a temp-table approach can replace it. Add a comment noting the bind-param limit.

## Code Examples

### MIL-01: Updated Upsert set_={} with Freshness Fields

```python
# Source: parallel to ingest_aircraft.py Phase 19 pattern
fetched_at = datetime.now(timezone.utc)
last_seen_at = fetched_at

# Inside upsert loop:
set_={
    "flight": record["flight"],
    "aircraft_type": record["aircraft_type"],
    "registration": record["registration"],
    "alt_baro": record["alt_baro"],
    "gs": record["gs"],
    "track": record["track"],
    "latitude": record["latitude"],
    "longitude": record["longitude"],
    "squawk": record["squawk"],
    "nic": record["nic"],
    "nac_p": record["nac_p"],
    "fetched_at": fetched_at,         # explicit — not onupdate
    "last_seen_at": last_seen_at,     # explicit — not onupdate
    "is_active": True,
    "updated_at": func.now(),
}
```

### MIL-01: Tombstone Sweep (inside same session, before commit)

```python
# Source: established pattern from ingest_aircraft.py (Phase 19)
from sqlalchemy import update as sa_update

seen_hexes = list({record["hex"] for record in valid_records})
if seen_hexes:
    await session.execute(
        sa_update(MilitaryAircraft)
        .where(MilitaryAircraft.hex.not_in(seen_hexes))
        .values(is_active=False)
    )
await session.commit()
```

### SHIP-01: Updated batch_flush_ships_to_pg with Deactivation Sweep

```python
# Source: parallel to military tombstone pattern; Redis-TTL bridge
seen_mmsis = []

async for key in redis_client.scan_iter("ship:*"):
    data = await redis_client.hgetall(key)
    if not data:
        continue
    decoded = { ... }  # existing decode logic
    row = {
        "mmsi": str(mmsi),
        # ... existing fields ...
        "last_seen_at": parse_time_utc(decoded.get("time_utc")),
    }
    rows.append(row)
    seen_mmsis.append(str(mmsi))

# Upsert chunks (existing chunking logic preserved):
async with session_factory() as session:
    for i in range(0, len(rows), CHUNK_SIZE):
        chunk = rows[i:i + CHUNK_SIZE]
        stmt = pg_insert(Ship).values(chunk)
        stmt = stmt.on_conflict_do_update(
            index_elements=["mmsi"],
            set_={
                # ... existing fields ...
                "last_seen_at": stmt.excluded.last_seen_at,
                "is_active": True,
            },
        )
        await session.execute(stmt)

    # Deactivation sweep — after all chunks, before commit
    if seen_mmsis:
        await session.execute(
            sa_update(Ship)
            .where(Ship.mmsi.not_in(seen_mmsis))
            .values(is_active=False)
        )
    await session.commit()
```

### JAM-01: Active-Only Filter + Freshness Metadata

```python
# Source: JAM-01 requirement
from datetime import datetime, timezone
from app.freshness import is_stale
from app.config import settings

aggregated_at = datetime.now(timezone.utc)

async with AsyncSessionLocal() as session:
    result = await session.execute(
        select(MilitaryAircraft).where(
            MilitaryAircraft.latitude.is_not(None),
            MilitaryAircraft.longitude.is_not(None),
            MilitaryAircraft.is_active == True,   # ← new filter
        )
    )
    aircraft_rows = result.scalars().all()

# Compute source_fetched_at (max across active rows)
source_fetched_at: datetime | None = None
for ac in aircraft_rows:
    if ac.fetched_at is not None:
        if source_fetched_at is None or ac.fetched_at > source_fetched_at:
            source_fetched_at = ac.fetched_at

source_is_stale = is_stale(source_fetched_at, settings.MILITARY_STALE_SECONDS)

# In upsert set_={} for every cell:
set_={
    "bad_ratio": cell["bad_ratio"],
    "severity": cell["severity"],
    "aircraft_count": cell["aircraft_count"],
    "aggregated_at": aggregated_at,
    "source_fetched_at": source_fetched_at,
    "source_is_stale": source_is_stale,
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Military ingest: no freshness lifecycle | Writes `fetched_at`, `last_seen_at`, tombstones absent rows | Phase 20 | Departed/inactive military aircraft removed from globe |
| AIS batch flush: no deactivation | Deactivation sweep on Redis-scan boundary | Phase 20 | Ships that left Redis TTL window removed from PostgreSQL active set |
| GPS jamming: aggregates all military rows | Aggregates only `is_active=True` rows | Phase 20 | Tombstoned aircraft do not inflate jamming cell counts |
| GPS jamming: no freshness metadata in cells | Writes `aggregated_at`, `source_fetched_at`, `source_is_stale` | Phase 20 | Route (Phase 21) can surface data staleness to frontend |

**Deprecated/outdated:**
- `"updated_at": func.now()` in military ingest `set_={}`: This was the only temporal field written before Phase 20. It is preserved but now supplemented by explicit `fetched_at` and `last_seen_at`.

## Open Questions

1. **airplanes.live response timestamp availability**
   - What we know: The `/v2/mil` JSON response contains an `"ac"` array of aircraft dicts. There is no documented top-level `"time"` field equivalent to OpenSky's.
   - What's unclear: Whether the API returns any per-request timestamp or ETag that could serve as a more accurate `fetched_at` than wall-clock ingest time.
   - Recommendation: Use `datetime.now(timezone.utc)` as `fetched_at`. The 300s poll interval is the freshness granularity; wall-clock accuracy is sufficient.

2. **AIS `time_utc` format consistency**
   - What we know: `parse_ais_message()` extracts `meta.get("time_utc")` and stores it as a string. The format depends on aisstream.io's wire format.
   - What's unclear: Whether `time_utc` is always ISO 8601, sometimes empty, or occasionally missing entirely.
   - Recommendation: Parse defensively with `datetime.fromisoformat()` in a try/except, fall back to `None` on failure. This matches the existing `last_update` string-storage approach.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | pytest + pytest-asyncio |
| Config file | `backend/pytest.ini` (existing) |
| Quick run command | `cd backend && python -m pytest tests/test_ingest_military.py tests/test_ingest_ais.py tests/test_gps_jamming.py -x -q` |
| Full suite command | `cd backend && python -m pytest -x -q` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| MIL-01 | `fetched_at` and `last_seen_at` written in `set_={}` for seen rows | unit | `pytest tests/test_ingest_military.py -x -q` | ✅ (add new test cases) |
| MIL-01 | `is_active=True` written in `set_={}` for seen rows | unit | `pytest tests/test_ingest_military.py -x -q` | ✅ (add new test cases) |
| MIL-01 | Tombstone: absent rows marked `is_active=False` after poll | unit | `pytest tests/test_ingest_military.py -x -q` | ✅ (add new test cases) |
| MIL-01 | Tombstone guard: empty `seen_hexes` skips sweep | unit | `pytest tests/test_ingest_military.py -x -q` | ✅ (add new test case) |
| SHIP-01 | `last_seen_at` written in `set_={}` for seen ships | unit | `pytest tests/test_ingest_ais.py -x -q` | ✅ (add new test cases) |
| SHIP-01 | `is_active=True` written in `set_={}` for seen ships | unit | `pytest tests/test_ingest_ais.py -x -q` | ✅ (add new test cases) |
| SHIP-01 | Deactivation sweep: absent ships marked `is_active=False` after flush | unit | `pytest tests/test_ingest_ais.py -x -q` | ✅ (add new test case) |
| SHIP-01 | Deactivation guard: empty `seen_mmsis` skips sweep | unit | `pytest tests/test_ingest_ais.py -x -q` | ✅ (add new test case) |
| JAM-01 | GPS jamming only uses `is_active=True` military rows | unit | `pytest tests/test_gps_jamming.py -x -q` | ✅ (add new test case) |
| JAM-01 | Every cell in upsert batch has `aggregated_at` set | unit | `pytest tests/test_gps_jamming.py -x -q` | ✅ (add new test case) |
| JAM-01 | `source_fetched_at` = max `fetched_at` across active military rows | unit | `pytest tests/test_gps_jamming.py -x -q` | ✅ (add new test case) |
| JAM-01 | `source_is_stale=True` when `source_fetched_at` is None or old | unit | `pytest tests/test_gps_jamming.py -x -q` | ✅ (add new test case) |

### Sampling Rate
- **Per task commit:** `cd backend && python -m pytest tests/test_ingest_military.py tests/test_ingest_ais.py tests/test_gps_jamming.py -x -q`
- **Per wave merge:** `cd backend && python -m pytest -x -q`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
None — existing test infrastructure covers all phase requirements. All new test cases extend existing test files.

## Sources

### Primary (HIGH confidence)
- `backend/app/tasks/ingest_military.py` — current military ingest; confirmed upsert structure, session/commit location, `set_={}` dict
- `backend/app/workers/ingest_ais.py` — current AIS batch flush; confirmed session factory pattern, chunk loop, current `set_={}` fields
- `backend/app/tasks/ingest_gps_jamming.py` — current GPS jamming aggregation; confirmed SELECT structure, upsert loop, `set_={}` fields
- `backend/app/models/military_aircraft.py` — confirms `fetched_at`, `last_seen_at`, `is_active` columns present (MIG-01)
- `backend/app/models/ship.py` — confirms `last_seen_at`, `is_active` columns present (MIG-01)
- `backend/app/models/gps_jamming.py` — confirms `aggregated_at`, `source_fetched_at`, `source_is_stale` columns present (MIG-01)
- `backend/app/freshness.py` — `stale_cutoff()` and `is_stale()` implementations
- `backend/app/config.py` — confirms `MILITARY_STALE_SECONDS=600`, `GPS_JAMMING_STALE_SECONDS=600`
- `backend/app/tasks/ingest_aircraft.py` — Phase 19 reference implementation: tombstone pattern, fetched_at/last_seen_at, explicit set_={}
- `.planning/REQUIREMENTS.md` — MIL-01, SHIP-01, JAM-01 exact requirement text
- `.planning/STATE.md` — architectural decisions: explicit set_{}, is_active via Redis-TTL, onupdate broken on upsert path
- `backend/tests/test_ingest_military.py` — existing tests; confirms test file exists, no DB needed
- `backend/tests/test_ingest_ais.py` — existing tests; confirms test file exists, no DB needed
- `backend/tests/test_gps_jamming.py` — existing tests; confirms test file exists, no DB needed
- `backend/tests/conftest.py` — NullPool DB patch pattern for integration tests

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already in project, zero new dependencies
- Architecture: HIGH — all patterns derived from direct inspection of files being modified and the Phase 19 reference implementation
- Pitfalls: HIGH — derived from direct code reading: commit location in military ingest, time_utc string handling in AIS, NOT IN large-list limit

**Research date:** 2026-03-13
**Valid until:** 2026-04-12 (stable domain — project patterns and SQLAlchemy behavior are stable)
