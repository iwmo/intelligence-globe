# Phase 19: Aircraft Ingest + Route - Research

**Researched:** 2026-03-13
**Domain:** OpenSky Network state-vector ingest, PostgreSQL upsert, FastAPI route freshness filtering
**Confidence:** HIGH

## Summary

Phase 19 is a surgical extension of two existing files — `backend/app/tasks/ingest_aircraft.py` and `backend/app/api/routes_aircraft.py` — plus the worker helper at `backend/app/workers/ingest_aircraft.py`. The schema columns (`time_position`, `geo_altitude`, `vertical_rate`, `position_source`, `fetched_at`, `last_seen_at`, `is_active`) are already present in the database (MIG-01, Phase 17) and already mapped on the `Aircraft` SQLAlchemy model. The freshness helpers (`stale_cutoff`, `is_stale`) are already implemented and tested (Phase 18). Phase 19 is purely about wiring those columns into the ingest write path and the route read path.

The three requirements break cleanly into two tasks: (1) update the ingest to parse new state-vector fields and add the tombstone sweep, and (2) update the route to filter stale/inactive rows and emit the new response fields. Both tasks have existing test files (`test_ingest_aircraft.py`, `test_aircraft.py`) that will need new test cases rather than new test files.

**Primary recommendation:** Two focused tasks — ACFT-01+ACFT-02 together in the ingest (they touch the same function), ACFT-03 in the route. Keep them separate because the ingest and route have different failure modes and test surfaces.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| ACFT-01 | `ingest_aircraft.py` parses `sv[3]` → `time_position`, `sv[11]` → `vertical_rate`, `sv[13]` → `geo_altitude`, `sv[16]` → `position_source` with `len(sv) > N` guards; all written explicitly in upsert `set_={}` dict | OpenSky state-vector layout confirmed; `Aircraft` model already has all four columns; `upsert_aircraft` in `workers/ingest_aircraft.py` is the right place to modify |
| ACFT-02 | Aircraft ingest writes `fetched_at` (OpenSky response `time`), `last_seen_at` (ingest time), sets `is_active=True` for seen rows; tombstone pass marks absent rows `is_active=False` in same commit | Tombstone pattern: collect seen icao24 set during upsert loop, then `UPDATE aircraft SET is_active=False WHERE icao24 NOT IN (seen_set)` using SQLAlchemy `update()` with `where()` before `commit()` |
| ACFT-03 | `/api/aircraft` filters to `is_active=True AND fetched_at >= stale_cutoff`; response includes `time_position`, `fetched_at`, `is_stale`, `position_age_seconds`; freshness falls back from `time_position` to `last_contact` when `time_position` is null; existing keys preserved | `app.freshness.stale_cutoff` and `app.config.settings.AIRCRAFT_STALE_SECONDS` already importable; `position_age_seconds` requires `datetime.now(utc) - fetched_at_as_datetime` arithmetic |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| SQLAlchemy (asyncpg) | already in project | Async ORM upsert with `pg_insert().on_conflict_do_update()` | All existing ingest tasks use this pattern |
| PostgreSQL `pg_insert` | already in project | Upsert with `set_={}` dict | Project-wide constraint: explicit set_ dict, not `onupdate` |
| FastAPI | already in project | Route handler | All routes use FastAPI + `AsyncSession` via `Depends(get_db)` |
| `app.freshness` | Phase 18 | `stale_cutoff()`, `is_stale()` | Already implemented and tested — use directly |
| `app.config.settings` | Phase 18 | `AIRCRAFT_STALE_SECONDS` | Already in Settings class |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `datetime.now(timezone.utc)` | stdlib | Compute `last_seen_at` and `position_age_seconds` | Ingest timestamp and response age calculation |
| SQLAlchemy `update()` | already in project | Tombstone sweep (`is_active=False`) | After upsert loop completes |
| `from datetime import datetime` | stdlib | Import style required | Project rule: `from datetime import datetime` not `import datetime`, for patch() patchability |

**Installation:** No new dependencies required.

## Architecture Patterns

### OpenSky State Vector Field Layout (17 elements, indices 0-16)

This is the authoritative field mapping, confirmed by the existing ingest code and the REQUIREMENTS.md:

```
sv[0]  = icao24          (str)
sv[1]  = callsign        (str|None)
sv[2]  = origin_country  (str|None)
sv[3]  = time_position   (int|None) ← NEW: Unix timestamp of last position fix
sv[4]  = last_contact    (int|None) — already used
sv[5]  = longitude       (float|None)
sv[6]  = latitude        (float|None)
sv[7]  = baro_altitude   (float|None)
sv[8]  = on_ground       (bool|None)
sv[9]  = velocity        (float|None)
sv[10] = true_track      (float|None)
sv[11] = vertical_rate   (float|None) ← NEW
sv[12] = sensors         (list|None)  — not used
sv[13] = geo_altitude    (float|None) ← NEW
sv[14] = squawk          (str|None)   — not used
sv[15] = spi             (bool)       — not used
sv[16] = position_source (int|None)   ← NEW: 0=ADS-B, 1=ASTERIX, 2=MLAT, 3=FLARM
```

### Pattern 1: Length-Guarded Field Access

The OpenSky API does not guarantee all 17 elements are present in every state vector. The requirement explicitly mandates `len(sv) > N` guards:

```python
# Source: REQUIREMENTS.md ACFT-01 + existing ingest pattern
time_position: int | None = sv[3] if len(sv) > 3 else None
vertical_rate: float | None = sv[11] if len(sv) > 11 else None
geo_altitude: float | None = sv[13] if len(sv) > 13 else None
position_source: int | None = sv[16] if len(sv) > 16 else None
```

### Pattern 2: Explicit set_={} with Freshness Fields

The project-wide constraint (from STATE.md) is that `onupdate` is silently ignored on the `on_conflict_do_update` path. All freshness fields must appear explicitly in `set_={}`:

```python
# Source: project decision in STATE.md
set_=dict(
    callsign=callsign,
    # ... existing fields ...
    time_position=time_position,
    vertical_rate=vertical_rate,
    geo_altitude=geo_altitude,
    position_source=position_source,
    fetched_at=fetched_at,          # OpenSky response `time` field, as datetime
    last_seen_at=last_seen_at,       # datetime.now(timezone.utc) at ingest time
    is_active=True,
    trail=new_trail,
),
```

### Pattern 3: Tombstone Sweep (same commit)

The tombstone sweep must happen in the same `async with AsyncSessionLocal()` block as the upserts, committed together. This is the pattern from the requirement: "in same commit".

```python
from sqlalchemy import update as sa_update

# After the upsert loop:
seen_icao24s = {sv[0] for sv in valid_states}

if seen_icao24s:
    tombstone_stmt = (
        sa_update(Aircraft)
        .where(Aircraft.icao24.not_in(seen_icao24s))
        .values(is_active=False)
    )
    await session.execute(tombstone_stmt)

await session.commit()
```

**Critical detail:** `seen_icao24s` must be the set of icao24 values from `valid_states` (position-filtered), not `raw_states`. Aircraft without a position are skipped from the upsert and should also not prevent tombstoning.

### Pattern 4: fetched_at from OpenSky Response `time` Field

The OpenSky `/states/all` response JSON contains a top-level `time` integer (Unix timestamp). This is the `fetched_at` value, not `datetime.now()`. The current `fetch_aircraft_states()` helper discards this field — it needs to return it.

```python
# In fetch_aircraft_states():
data = resp.json()
response_time: int = data.get("time", 0)
states: list = data.get("states") or []
return states, response_time

# Convert to datetime for DB storage:
from datetime import datetime, timezone
fetched_at = datetime.fromtimestamp(response_time, tz=timezone.utc)
```

### Pattern 5: Route Filter with Freshness

```python
# Source: ACFT-03 requirement + app.freshness module
from app.freshness import stale_cutoff, is_stale
from app.config import settings

cutoff = stale_cutoff(settings.AIRCRAFT_STALE_SECONDS)

result = await db.execute(
    select(Aircraft).where(
        Aircraft.is_active == True,
        Aircraft.latitude.is_not(None),
        Aircraft.longitude.is_not(None),
        Aircraft.fetched_at >= cutoff,
    )
)
```

### Pattern 6: Response Freshness Fields

The `position_age_seconds` field uses `time_position` with fallback to `last_contact`, and `is_stale` uses `fetched_at`:

```python
# Source: ACFT-03 requirement
import time as time_module

def compute_position_age(r) -> float | None:
    """Use time_position if available, fall back to last_contact."""
    ref_ts = r.time_position if r.time_position is not None else r.last_contact
    if ref_ts is None:
        return None
    return time_module.time() - ref_ts

{
    # existing keys (unchanged):
    "icao24": r.icao24,
    "callsign": r.callsign,
    "latitude": r.latitude,
    "longitude": r.longitude,
    "baro_altitude": r.baro_altitude,
    "velocity": r.velocity,
    "true_track": r.true_track,
    "trail": r.trail,
    # new keys:
    "time_position": r.time_position,
    "fetched_at": r.fetched_at.isoformat() if r.fetched_at else None,
    "is_stale": is_stale(r.fetched_at, settings.AIRCRAFT_STALE_SECONDS),
    "position_age_seconds": compute_position_age(r),
}
```

### Anti-Patterns to Avoid

- **Using `updated_at` for freshness filtering instead of `fetched_at`:** `updated_at` uses SQLAlchemy `onupdate` which is broken on the upsert path. Use `fetched_at` which is written explicitly.
- **Using `last_contact` as primary freshness signal:** OpenSky persists state vectors 300s after last contact. `time_position` is the correct field for position freshness.
- **Tombstoning before the upsert loop completes:** The tombstone sweep must come after all upserts in the same session, otherwise rows being upserted could be immediately tombstoned.
- **Committing per-row in the upsert loop:** The current `workers/ingest_aircraft.py` has `await db.commit()` inside `upsert_aircraft()` itself. For the tombstone pattern to work, all upserts and the tombstone must be in a single commit. The ingest task (`tasks/ingest_aircraft.py`) manages the session and commit — the worker helper should not call `commit()`.
- **Passing `seen_icao24s` as a Python set directly to `not_in()`:** SQLAlchemy `not_in()` accepts a list or sequence. Convert the set to a list first.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Stale cutoff calculation | Custom datetime arithmetic | `app.freshness.stale_cutoff()` | Already implemented, tested, clock-mockable |
| Is-stale boolean | Inline comparison | `app.freshness.is_stale()` | Handles None case correctly |
| Stale threshold constant | Hardcoded integer | `settings.AIRCRAFT_STALE_SECONDS` | Env-overridable, tested |

## Common Pitfalls

### Pitfall 1: `workers/ingest_aircraft.py` vs `tasks/ingest_aircraft.py`
**What goes wrong:** There are two ingest files. `workers/ingest_aircraft.py` contains the `upsert_aircraft()` and `build_new_trail()` helpers (unit-testable, no session commit). `tasks/ingest_aircraft.py` is the full RQ task that owns the session and commit. ACFT-01 and ACFT-02 touch both: the parsing happens in the worker helper, the tombstone and commit happen in the task.

**How to avoid:** Extend `upsert_aircraft()` in `workers/ingest_aircraft.py` to accept and write the new fields. Remove the `await db.commit()` call from inside `upsert_aircraft()` (it shouldn't be there for the tombstone pattern). Move commit to the task-level session block.

**Warning signs:** If tests for `upsert_aircraft()` need a real DB session to verify commit behavior, the commit is in the wrong place.

### Pitfall 2: `fetch_aircraft_states` Return Signature Change
**What goes wrong:** Currently `fetch_aircraft_states()` returns `list`. To extract `fetched_at`, it must also return the `time` field from the response. Callers need updating.

**How to avoid:** Change the return to a tuple `(states: list, response_time: int)` and update the single caller in `ingest_aircraft()`.

### Pitfall 3: `not_in()` with Empty Set
**What goes wrong:** If `valid_states` is empty (no aircraft with valid position), the tombstone sweep would mark ALL rows as inactive — a catastrophic false tombstone.

**How to avoid:** Guard the tombstone with `if seen_icao24s:`. The existing code already has `if not valid_states: return 0` which skips the session block entirely, so this is implicit, but add an explicit guard inside the session block for safety.

### Pitfall 4: `position_source` Availability on Unauthenticated Endpoint
**What goes wrong:** STATE.md has a pending todo: "Verify `position_source` (sv[16]) presence in live OpenSky data before writing assertions (may require authenticated endpoint)."

**How to avoid:** The ingest must parse sv[16] with a length guard and write it — but the route should NOT assert/require it. The test for ACFT-01 should test that the field is present in `set_={}` via a mock, not that a specific value is stored. Keep length guard defensive.

### Pitfall 5: `fetched_at` Type — Integer vs Datetime
**What goes wrong:** OpenSky `time` is a Unix integer timestamp. PostgreSQL `fetched_at` column is `TIMESTAMPTZ`. The conversion must happen before the upsert: `datetime.fromtimestamp(response_time, tz=timezone.utc)`.

**How to avoid:** Convert at the call site in `ingest_aircraft()` and pass the `datetime` object into `upsert_aircraft()` as a parameter.

### Pitfall 6: `workers/ingest_aircraft.py` commit inside `upsert_aircraft()`
**What goes wrong:** The current `upsert_aircraft()` calls `await db.commit()` at the end (line 126 of `workers/ingest_aircraft.py`). If this remains, the tombstone sweep in the task-level session will fail because the session is already committed and in a terminal state for the current transaction.

**How to avoid:** Remove `await db.commit()` from `upsert_aircraft()`. The session commit should only occur once at the end of the task-level session block, after both upserts and tombstone.

## Code Examples

### Tombstone Sweep Pattern
```python
# Source: project pattern established for v4.0 (STATE.md decision)
from sqlalchemy import update as sa_update

seen_icao24s = list({sv[0] for sv in valid_states})
if seen_icao24s:
    await session.execute(
        sa_update(Aircraft)
        .where(Aircraft.icao24.not_in(seen_icao24s))
        .values(is_active=False)
    )
await session.commit()
```

### Route Freshness Filter Pattern (from existing code style)
```python
# Source: routes_aircraft.py existing pattern + ACFT-03 requirement
from app.freshness import stale_cutoff, is_stale
from app.config import settings

cutoff = stale_cutoff(settings.AIRCRAFT_STALE_SECONDS)
result = await db.execute(
    select(Aircraft).where(
        Aircraft.is_active == True,
        Aircraft.latitude.is_not(None),
        Aircraft.longitude.is_not(None),
        Aircraft.fetched_at >= cutoff,
    )
)
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| OpenSky Basic Auth | OAuth2 Bearer token via client_credentials | March 18, 2026 | Already implemented in ingest_aircraft.py |
| No freshness filtering on list endpoint | `is_active AND fetched_at >= cutoff` | Phase 19 | Stale positions excluded from globe |
| No tombstone | `is_active=False` for absent rows | Phase 19 | Departed aircraft removed from display |
| Partial state vector (sv[0..10]) | Full sv[0..16] with length guards | Phase 19 | Richer data: vertical_rate, geo_altitude, position_source |

## Open Questions

1. **`position_source` availability on unauthenticated endpoint**
   - What we know: STATE.md flags this as a pending todo; sv[16] may only be populated on authenticated calls
   - What's unclear: Whether the current OAuth2 Bearer token grants access to position_source, or if it requires a higher-tier credential
   - Recommendation: Parse with length guard, write to DB without assertions on value. Do not add a test that asserts a specific `position_source` value from live data.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | pytest + pytest-asyncio |
| Config file | `backend/pytest.ini` or `backend/pyproject.toml` (check existing) |
| Quick run command | `cd backend && python -m pytest tests/test_ingest_aircraft.py tests/test_aircraft.py -x -q` |
| Full suite command | `cd backend && python -m pytest -x -q` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ACFT-01 | sv[3]/sv[11]/sv[13]/sv[16] parsed and written in set_={} | unit | `python -m pytest tests/test_ingest_aircraft.py -x -q` | ✅ (add new test cases) |
| ACFT-01 | len(sv) > N guard prevents IndexError on short vectors | unit | `python -m pytest tests/test_ingest_aircraft.py -x -q` | ✅ (add new test case) |
| ACFT-02 | fetched_at/last_seen_at/is_active=True written on seen rows | unit | `python -m pytest tests/test_ingest_aircraft.py -x -q` | ✅ (add new test cases) |
| ACFT-02 | Tombstone: absent rows marked is_active=False after ingest | unit | `python -m pytest tests/test_ingest_aircraft.py -x -q` | ✅ (add new test case) |
| ACFT-03 | GET /api/aircraft excludes rows with fetched_at < cutoff | integration | `python -m pytest tests/test_aircraft.py -x -q` | ✅ (add new test case) |
| ACFT-03 | GET /api/aircraft excludes rows with is_active=False | integration | `python -m pytest tests/test_aircraft.py -x -q` | ✅ (add new test case) |
| ACFT-03 | Response includes time_position, fetched_at, is_stale, position_age_seconds | integration | `python -m pytest tests/test_aircraft.py -x -q` | ✅ (add new test case) |
| ACFT-03 | Freshness fallback: time_position null → last_contact used for position_age | integration | `python -m pytest tests/test_aircraft.py -x -q` | ✅ (add new test case) |
| ACFT-03 | Existing keys (icao24, callsign, lat, lon, baro_altitude, velocity, true_track, trail) still present | integration | `python -m pytest tests/test_aircraft.py::test_list_aircraft -x -q` | ✅ (existing, must stay green) |

### Sampling Rate
- **Per task commit:** `cd backend && python -m pytest tests/test_ingest_aircraft.py tests/test_aircraft.py -x -q`
- **Per wave merge:** `cd backend && python -m pytest -x -q`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
None — existing test infrastructure covers all phase requirements. New test cases are added to existing files, not new files.

## Sources

### Primary (HIGH confidence)
- `backend/app/tasks/ingest_aircraft.py` — current ingest implementation, state-vector field mapping (sv[0..10])
- `backend/app/workers/ingest_aircraft.py` — `upsert_aircraft()` and `build_new_trail()` helpers
- `backend/app/api/routes_aircraft.py` — current route implementation
- `backend/app/models/aircraft.py` — confirmed all target columns present: `time_position`, `geo_altitude`, `vertical_rate`, `position_source`, `fetched_at`, `last_seen_at`, `is_active`
- `backend/app/freshness.py` — `stale_cutoff()` and `is_stale()` implementations
- `backend/app/config.py` — `AIRCRAFT_STALE_SECONDS` setting
- `backend/alembic/versions/a4f7c2e9b1d3_add_freshness_columns.py` — confirms all freshness columns in DB
- `.planning/REQUIREMENTS.md` — ACFT-01, ACFT-02, ACFT-03 exact requirements
- `.planning/STATE.md` — architectural decisions, pending todos re: position_source

### Secondary (MEDIUM confidence)
- OpenSky state-vector field order confirmed via existing code (`sv[3]` currently unused, `sv[4]` = last_contact) and REQUIREMENTS.md explicit index mapping

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already in project, no new dependencies
- Architecture: HIGH — all patterns derived from existing code in the project and explicit REQUIREMENTS.md
- Pitfalls: HIGH — derived from direct code inspection of files being modified (commit location bug, return signature change needed)

**Research date:** 2026-03-13
**Valid until:** 2026-04-12 (stable domain — OpenSky API and project patterns are stable)
