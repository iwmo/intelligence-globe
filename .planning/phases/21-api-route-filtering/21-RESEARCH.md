# Phase 21: API Route Filtering - Research

**Researched:** 2026-03-13
**Domain:** FastAPI route modification, SQLAlchemy async filtering, response envelope design
**Confidence:** HIGH

## Summary

Phase 21 is a pure route-layer change. All the hard work — freshness columns in the schema (Phase 17), the `freshness.py` helper module (Phase 18), and the ingest-side freshness writes (Phase 20) — is already complete. This phase wires those columns into the three list endpoints that are still returning unfiltered rows.

The pattern is already proven by `routes_aircraft.py` (ACFT-03, complete). Military and ships follow the same filter structure: add `is_active == True` and `fetched_at >= stale_cutoff(...)` / `last_seen_at >= stale_cutoff(...)` conditions to the existing WHERE clause, and add freshness fields to each dict in the response list. The GPS jamming endpoint is different in shape: its route returns an envelope `{ "cells": [...] }` and needs three top-level metadata fields — `aggregated_at`, `source_fetched_at`, `source_is_stale` — lifted from the stored cell rows.

JAM-03 requires that when military source data is stale, cells are returned with `source_is_stale=true` rather than an empty set. Because `ingest_gps_jamming` already writes `source_is_stale` to every stored cell (JAM-01, Phase 20), the route simply reads what the DB holds — it does not re-compute staleness. The route needs a comment and a dedicated test to document and enforce this non-obvious "return stale cells, never empty" behavior.

**Primary recommendation:** Copy the ACFT-03 pattern from `routes_aircraft.py` into `routes_military.py` and `routes_ships.py`, then extend the GPS jamming envelope with three top-level fields read from the first cell row (all cells in a batch share the same metadata values since ingest writes identical values to all cells in one pass).

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| MIL-02 | `/api/military` filters to `is_active=True AND fetched_at >= stale_cutoff`; response includes `fetched_at`, `is_stale`; existing keys preserved | `MilitaryAircraft.is_active` and `fetched_at` columns exist (MIG-01); `stale_cutoff` and `is_stale` from `app.freshness` (FRESH-01); proven pattern in `routes_aircraft.py` |
| SHIP-02 | `/api/ships` filters to `is_active=True AND last_seen_at >= stale_cutoff`; response includes `last_seen_at`, `fetched_at`, `is_stale`; existing keys preserved | `Ship.is_active` and `last_seen_at` columns exist (MIG-01); Ship model has no `fetched_at` column — `fetched_at` in response must be `None` or sourced from `last_seen_at`; see "Ship fetched_at gap" pitfall below |
| JAM-02 | `/api/gps-jamming` response envelope includes `aggregated_at`, `source_fetched_at`, `source_is_stale` at the top level | `GpsJammingCell` model already has all three columns (MIG-01); ingest writes them (JAM-01); route just needs to surface them in the envelope |
| JAM-03 | When military source data is stale, cells are returned with `source_is_stale=true` (not empty set); behavior documented and tested | `source_is_stale` is stored per-cell by ingest; route reads it passively — no re-computation needed; requires explicit comment in route code and a dedicated test |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| FastAPI | existing | HTTP routing, dependency injection | Already in use project-wide |
| SQLAlchemy async | existing | Async ORM queries | Already in use project-wide |
| `app.freshness` | project | `stale_cutoff()`, `is_stale()` | FRESH-01 module built in Phase 18 |
| `app.config.settings` | project | `MILITARY_STALE_SECONDS`, `SHIP_STALE_SECONDS` | FRESH-02 — env-overridable thresholds |

### No New Dependencies
This phase requires zero new package installations. All libraries and utilities are already present.

## Architecture Patterns

### Pattern 1: ACFT-03 Filter Pattern (reference implementation)
**What:** Active + fresh WHERE filter, per-row `is_stale` computed at response time, `fetched_at` in ISO format.
**When to use:** Military and ships list endpoints.
**Example (from `routes_aircraft.py`, lines 37-66):**
```python
# Source: backend/app/api/routes_aircraft.py
cutoff = stale_cutoff(settings.AIRCRAFT_STALE_SECONDS)
result = await db.execute(
    select(Aircraft).where(
        Aircraft.is_active == True,
        Aircraft.latitude.is_not(None),
        Aircraft.longitude.is_not(None),
        Aircraft.fetched_at >= cutoff,
    )
)
rows = result.scalars().all()
return [
    {
        # ... existing keys preserved ...
        "fetched_at": r.fetched_at.isoformat() if r.fetched_at else None,
        "is_stale": is_stale(r.fetched_at, settings.AIRCRAFT_STALE_SECONDS),
    }
    for r in rows
]
```

### Pattern 2: GPS Jamming Envelope with Top-Level Metadata
**What:** Single SELECT of all cells; lift `aggregated_at`, `source_fetched_at`, `source_is_stale` from any one cell (all cells in a batch share identical metadata). Provide `None` defaults when the table is empty.
**When to use:** GPS jamming list endpoint only.
**Example (intended shape):**
```python
# Source: backend/app/api/routes_gps_jamming.py (after Phase 21)
result = await db.execute(select(GpsJammingCell))
cells = result.scalars().all()

# All cells in a batch share the same metadata — use first row or None
first = cells[0] if cells else None
return {
    "aggregated_at": first.aggregated_at.isoformat() if first and first.aggregated_at else None,
    "source_fetched_at": first.source_fetched_at.isoformat() if first and first.source_fetched_at else None,
    "source_is_stale": first.source_is_stale if first is not None else None,
    "cells": [
        {
            "h3index": c.h3index,
            "bad_ratio": c.bad_ratio,
            "severity": c.severity,
            "aircraft_count": c.aircraft_count,
            "updated_at": c.updated_at.isoformat() if c.updated_at else None,
        }
        for c in cells
    ],
}
```

### Pattern 3: MIL-02 Route Change
Apply the ACFT-03 pattern to `routes_military.py`:
- Add `MilitaryAircraft.is_active == True` and `MilitaryAircraft.fetched_at >= cutoff` to the WHERE clause.
- Add `"fetched_at": r.fetched_at.isoformat() if r.fetched_at else None` and `"is_stale": is_stale(r.fetched_at, settings.MILITARY_STALE_SECONDS)` to each response dict.
- All existing keys (`hex`, `flight`, `aircraft_type`, `alt_baro`, `gs`, `track`, `lat`, `lon`, `squawk`) must remain unchanged.

### Pattern 4: SHIP-02 Route Change
Apply the ACFT-03 pattern to `routes_ships.py`, with one deviation — the `Ship` model has no `fetched_at` column (only `last_seen_at`):
- Filter: `Ship.is_active == True` and `Ship.last_seen_at >= cutoff`.
- Threshold: `settings.SHIP_STALE_SECONDS`.
- `is_stale` computed from `last_seen_at`: `is_stale(r.last_seen_at, settings.SHIP_STALE_SECONDS)`.
- SHIP-02 spec says response includes `last_seen_at`, `fetched_at`, `is_stale`. Since the `Ship` model has no `fetched_at`, the `fetched_at` field in the response MUST be `None` (additive field, never removes existing keys). Confirm with requirement text: "response includes `last_seen_at`, `fetched_at`, `is_stale`" — include all three, `fetched_at` as `None`.
- All existing keys (`mmsi`, `vessel_name`, `vessel_type`, `lat`, `lon`, `sog`, `cog`, `heading`, `nav_status`, `last_update`) must remain unchanged.

### Recommended File Changes
```
backend/app/api/
├── routes_military.py   # Add is_active + fetched_at filter; add fetched_at + is_stale to response
├── routes_ships.py      # Add is_active + last_seen_at filter; add last_seen_at + fetched_at + is_stale to response
└── routes_gps_jamming.py  # Add aggregated_at + source_fetched_at + source_is_stale to envelope
```

### Anti-Patterns to Avoid
- **Re-computing `source_is_stale` in the GPS jamming route:** The value was written by ingest — reading it from the DB is the correct approach. Recomputing at route time would create a discrepancy with what was stored and make JAM-03 test logic inconsistent.
- **Filtering GPS jamming cells by staleness:** The requirement explicitly states that stale cells MUST be returned (not an empty set). Do NOT add a staleness WHERE clause to the GPS jamming SELECT.
- **Removing `updated_at` from existing GPS jamming cell response:** The existing `updated_at` field in cells must remain.
- **Using `onupdate` for freshness fields:** The project architectural decision (see STATE.md) is that all freshness fields are written explicitly in `set_={}` — `onupdate` is silently ignored on the `on_conflict_do_update` path.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Staleness cutoff datetime | Custom `datetime.now() - timedelta(...)` in route | `stale_cutoff(settings.MILITARY_STALE_SECONDS)` from `app.freshness` | Single source of truth; already tested in Phase 18 |
| Per-row staleness boolean | Inline comparison | `is_stale(r.fetched_at, settings.MILITARY_STALE_SECONDS)` from `app.freshness` | None-safe; already tested; consistent across all routes |
| Stale threshold values | Hardcoded integer literals | `settings.MILITARY_STALE_SECONDS`, `settings.SHIP_STALE_SECONDS` | Env-overridable via pydantic-settings; FRESH-02 compliant |

## Common Pitfalls

### Pitfall 1: Ship Model Has No `fetched_at` Column
**What goes wrong:** SHIP-02 spec says response should include `fetched_at`. The `Ship` model only has `last_seen_at` and `is_active` (MIG-01 added only those two). Writing `r.fetched_at` will raise `AttributeError` at runtime.
**Why it happens:** The Ship's AIS data arrives via WebSocket stream — there is no discrete "fetch request" timestamped by the ingest; the ingest worker writes `last_seen_at` as the timestamp.
**How to avoid:** Return `"fetched_at": None` (literal None, not a model attribute) in the ship response dict. This is an additive field that satisfies the spec while being honest about the data model.
**Warning signs:** `AttributeError: Ship has no attribute 'fetched_at'` at test time.

### Pitfall 2: `stale_cutoff()` Called at Module Scope (Not at Request Time)
**What goes wrong:** If `cutoff = stale_cutoff(...)` is called at import/module scope or as a default argument, the cutoff datetime is frozen at server start, not computed per-request. All filtering stops working after the threshold duration passes.
**Why it happens:** Python default arguments are evaluated once at function definition.
**How to avoid:** Call `stale_cutoff(settings.MILITARY_STALE_SECONDS)` inside the route handler function body, as ACFT-03 already does.
**Warning signs:** Route returns empty list immediately after server start; passes tests at t=0 but fails later.

### Pitfall 3: Forgetting to Preserve Existing Response Keys
**What goes wrong:** SHIP-02 requirement 5 states: "Existing response keys for all three endpoints are preserved — no previously-returned field is removed or renamed." Dropping any of the listed keys breaks the frontend contract.
**Why it happens:** Copy-paste from aircraft route that uses different key names (`latitude`/`longitude` vs `lat`/`lon`).
**How to avoid:** Keep the exact existing key structure; only append new keys (`fetched_at`, `last_seen_at`, `is_stale`, `source_*`).
**Warning signs:** Existing `test_list_military` or `test_list_ships` tests assert for `"lat"` and `"lon"` — if renamed to `"latitude"` they would fail.

### Pitfall 4: GPS Jamming Envelope — `None` When Table Is Empty
**What goes wrong:** Accessing `cells[0]` to extract metadata raises `IndexError` when the table is empty (e.g., in test environment with no rows).
**Why it happens:** The table may be empty in development or test environments before the daily ingest runs.
**How to avoid:** Guard with `first = cells[0] if cells else None`, then use conditional expressions for each metadata field.
**Warning signs:** `IndexError: list index out of range` in test or on first deploy before ingest runs.

### Pitfall 5: `is_stale` Returns `True` for `None` Timestamps
**What goes wrong:** Rows that have `fetched_at=NULL` (pre-migration rows, or rows ingested before Phase 20 code was deployed) will be included in the filtered result (they pass the `>= cutoff` check if the DB returns them), but `is_stale(None, ...)` returns `True`.
**Why it happens:** SQLAlchemy `column >= cutoff` with a nullable column excludes NULL rows automatically in PostgreSQL — `NULL >= anything` is `UNKNOWN`, which evaluates as false in a WHERE clause. So NULL rows are already filtered out by the stale cutoff condition. No special handling needed.
**Warning signs:** Not a problem in practice, but worth knowing: the existing `is_stale()` function already handles `None` correctly.

## Code Examples

### MIL-02: routes_military.py list handler
```python
# Source: modeled on backend/app/api/routes_aircraft.py (ACFT-03 pattern)
from app.freshness import stale_cutoff, is_stale
from app.config import settings

@router.get("")
@router.get("/")
async def list_military_aircraft(db: AsyncSession = Depends(get_db)):
    """Return fresh, active military aircraft with freshness metadata."""
    cutoff = stale_cutoff(settings.MILITARY_STALE_SECONDS)
    result = await db.execute(
        select(MilitaryAircraft).where(
            MilitaryAircraft.is_active == True,
            MilitaryAircraft.latitude.is_not(None),
            MilitaryAircraft.longitude.is_not(None),
            MilitaryAircraft.fetched_at >= cutoff,
        )
    )
    rows = result.scalars().all()
    return [
        {
            "hex": r.hex,
            "flight": r.flight,
            "aircraft_type": r.aircraft_type,
            "alt_baro": r.alt_baro,
            "gs": r.gs,
            "track": r.track,
            "lat": r.latitude,
            "lon": r.longitude,
            "squawk": r.squawk,
            "updated_at": r.updated_at.isoformat() if r.updated_at else None,
            "fetched_at": r.fetched_at.isoformat() if r.fetched_at else None,
            "is_stale": is_stale(r.fetched_at, settings.MILITARY_STALE_SECONDS),
        }
        for r in rows
    ]
```

### SHIP-02: routes_ships.py list handler
```python
# Source: modeled on ACFT-03 pattern; note last_seen_at used (not fetched_at)
from app.freshness import stale_cutoff, is_stale
from app.config import settings

@router.get("")
@router.get("/")
async def list_ships(db: AsyncSession = Depends(get_db)):
    """Return fresh, active ships with freshness metadata."""
    cutoff = stale_cutoff(settings.SHIP_STALE_SECONDS)
    result = await db.execute(
        select(Ship).where(
            Ship.is_active == True,
            Ship.latitude.is_not(None),
            Ship.longitude.is_not(None),
            Ship.last_seen_at >= cutoff,
        )
    )
    rows = result.scalars().all()
    return [
        {
            "mmsi": r.mmsi,
            "vessel_name": r.vessel_name,
            "vessel_type": r.vessel_type,
            "lat": r.latitude,
            "lon": r.longitude,
            "sog": r.sog,
            "cog": r.cog,
            "heading": r.true_heading,
            "nav_status": r.nav_status,
            "last_update": r.last_update,
            "updated_at": r.updated_at.isoformat() if r.updated_at else None,
            "last_seen_at": r.last_seen_at.isoformat() if r.last_seen_at else None,
            "fetched_at": None,  # Ship model has no fetched_at column
            "is_stale": is_stale(r.last_seen_at, settings.SHIP_STALE_SECONDS),
        }
        for r in rows
    ]
```

### JAM-02 + JAM-03: routes_gps_jamming.py envelope
```python
# Source: modeled on current routes_gps_jamming.py; metadata lifted from first cell
@router.get("")
@router.get("/")
async def list_gps_jamming_cells(db: AsyncSession = Depends(get_db)):
    """Return gps_jamming_cells with freshness metadata envelope.

    JAM-03: When military source data is stale, cells are returned with
    source_is_stale=True rather than an empty set. This is intentional —
    an empty response silently converts a staleness event into a blank
    globe layer. The ingest layer (JAM-01) writes source_is_stale=True
    to every stored cell when the military feed is stale; the route simply
    surfaces what the DB holds.
    """
    result = await db.execute(select(GpsJammingCell))
    cells = result.scalars().all()

    first = cells[0] if cells else None
    return {
        "aggregated_at": first.aggregated_at.isoformat() if first and first.aggregated_at else None,
        "source_fetched_at": first.source_fetched_at.isoformat() if first and first.source_fetched_at else None,
        "source_is_stale": first.source_is_stale if first is not None else None,
        "cells": [
            {
                "h3index": c.h3index,
                "bad_ratio": c.bad_ratio,
                "severity": c.severity,
                "aircraft_count": c.aircraft_count,
                "updated_at": c.updated_at.isoformat() if c.updated_at else None,
            }
            for c in cells
        ],
    }
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| No staleness filter — all rows returned | `is_active=True AND timestamp >= stale_cutoff` filter | Phase 19 (aircraft), Phase 21 (military + ships) | Frontend sees only live data |
| No freshness metadata in responses | Per-row `is_stale`, `fetched_at`, `last_seen_at` fields | Phase 19 (aircraft), Phase 21 (military + ships) | Frontend can render freshness indicators (v4.1) |
| GPS jamming: `{ "cells": [...] }` only | GPS jamming: `{ "aggregated_at": ..., "source_fetched_at": ..., "source_is_stale": ..., "cells": [...] }` | Phase 21 | Frontend and monitoring can check data age |

**Deprecated/outdated:**
- Bare `select(MilitaryAircraft)` without freshness filter in `routes_military.py` — replaced by filtered query in Phase 21.
- Bare `select(Ship)` without freshness filter in `routes_ships.py` — replaced by filtered query in Phase 21.

## Open Questions

1. **GPS jamming metadata consistency across cells in the envelope**
   - What we know: `ingest_gps_jamming` writes the same `aggregated_at`, `source_fetched_at`, `source_is_stale` to all cells in a single aggregation pass. So reading from `cells[0]` is consistent with all other cells.
   - What's unclear: Whether a future partial upsert (e.g., some cells updated, others not) could create inconsistent metadata across cells.
   - Recommendation: For Phase 21 scope, reading from `cells[0]` is correct and sufficient. If partial upserts become a concern in a later phase, a separate `jamming_metadata` table or a SQL `MAX(aggregated_at)` query could be used instead.

2. **`fetched_at: None` for ships — meets SHIP-02 spec intent?**
   - What we know: The `Ship` model has no `fetched_at` column. SHIP-02 spec lists `fetched_at` as a new response field. The field was presumably included for parity with the other endpoints.
   - What's unclear: Whether downstream consumers (frontend, tests) will treat `fetched_at: null` as acceptable.
   - Recommendation: Return `"fetched_at": None` (explicit null) in the ship response. The field is present in the response (satisfying the spec), and the null value is self-documenting. Phase 22 tests should assert `"fetched_at" in item` (field present), not assert a non-null value.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | pytest + pytest-asyncio (asyncio_mode=auto) |
| Config file | `backend/pytest.ini` |
| Quick run command | `cd backend && python -m pytest tests/test_military.py tests/test_ships.py tests/test_gps_jamming.py -x -q` |
| Full suite command | `cd backend && python -m pytest -x -q` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| MIL-02 | `/api/military` returns only active + fresh rows | integration | `pytest tests/test_military.py -x -q` | existing file, needs new tests |
| MIL-02 | Response includes `fetched_at` and `is_stale` keys | integration | `pytest tests/test_military.py -x -q` | existing file, needs new tests |
| MIL-02 | Existing keys (`hex`, `flight`, `lat`, `lon`, etc.) preserved | integration | `pytest tests/test_military.py::test_list_military -x -q` | existing test passes already |
| SHIP-02 | `/api/ships` returns only active + fresh rows | integration | `pytest tests/test_ships.py -x -q` | existing file, needs new tests |
| SHIP-02 | Response includes `last_seen_at`, `fetched_at`, `is_stale` | integration | `pytest tests/test_ships.py -x -q` | existing file, needs new tests |
| SHIP-02 | Existing keys (`mmsi`, `lat`, `lon`, `sog`, `heading`, etc.) preserved | integration | `pytest tests/test_ships.py::test_list_ships -x -q` | existing test passes already |
| JAM-02 | Envelope includes `aggregated_at`, `source_fetched_at`, `source_is_stale` | integration | `pytest tests/test_gps_jamming.py -x -q` | existing file, needs new test |
| JAM-03 | Stale cells returned with `source_is_stale=true`, not empty set | integration | `pytest tests/test_gps_jamming.py -x -q` | needs dedicated test + code comment |

### Sampling Rate
- **Per task commit:** `cd backend && python -m pytest tests/test_military.py tests/test_ships.py tests/test_gps_jamming.py -x -q`
- **Per wave merge:** `cd backend && python -m pytest -x -q`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/test_military.py` — needs new test for MIL-02 filter behavior (file exists, add test cases)
- [ ] `tests/test_ships.py` — needs new test for SHIP-02 filter behavior (file exists, add test cases)
- [ ] `tests/test_gps_jamming.py` — needs JAM-02 envelope test and JAM-03 dedicated staleness test (file exists, add test cases)

Note: No new test files need to be created. All three files already exist. The existing tests (`test_list_military`, `test_list_ships`, `test_gps_jamming_route`) will continue to pass after the route changes because they only assert shape/status, not the absence of freshness fields.

## Sources

### Primary (HIGH confidence)
- Direct code reading: `backend/app/api/routes_aircraft.py` — ACFT-03 reference implementation
- Direct code reading: `backend/app/api/routes_military.py` — current state (pre-Phase 21)
- Direct code reading: `backend/app/api/routes_ships.py` — current state (pre-Phase 21)
- Direct code reading: `backend/app/api/routes_gps_jamming.py` — current state (pre-Phase 21)
- Direct code reading: `backend/app/models/military_aircraft.py` — freshness columns confirmed
- Direct code reading: `backend/app/models/ship.py` — `last_seen_at` present, NO `fetched_at`
- Direct code reading: `backend/app/models/gps_jamming.py` — `aggregated_at`, `source_fetched_at`, `source_is_stale` confirmed
- Direct code reading: `backend/app/freshness.py` — `stale_cutoff`, `is_stale` API confirmed
- Direct code reading: `backend/app/config.py` — `MILITARY_STALE_SECONDS`, `SHIP_STALE_SECONDS` confirmed
- Direct code reading: `.planning/REQUIREMENTS.md` — MIL-02, SHIP-02, JAM-02, JAM-03 spec text
- Direct code reading: `.planning/STATE.md` — architectural decisions

### Secondary (MEDIUM confidence)
- None required — all findings sourced directly from project code.

### Tertiary (LOW confidence)
- None.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries are existing project dependencies; no new packages
- Architecture: HIGH — pattern established by ACFT-03 in routes_aircraft.py; models confirmed by direct reading
- Pitfalls: HIGH — Ship.fetched_at gap confirmed by model inspection; NULL filtering behavior is standard PostgreSQL

**Research date:** 2026-03-13
**Valid until:** 2026-04-13 (stable domain — no external API changes expected)
