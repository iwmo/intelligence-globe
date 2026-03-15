# Phase 42: Fix Detail API Roll Field - Research

**Researched:** 2026-03-15
**Domain:** FastAPI route dict serialization / TypeScript interface parity
**Confidence:** HIGH

## Summary

This is a precision gap-closure: one field (`roll`) is present on the `Aircraft` SQLAlchemy model and returned by the list endpoint (`GET /api/aircraft/`) but is absent from the return dict of the detail endpoint (`GET /api/aircraft/{icao24}`). The fix requires a single line addition in `routes_aircraft.py` and a single field addition to the `AircraftDetail` TypeScript interface in `AircraftDetailPanel.tsx`.

The `roll` column (`Float`, nullable) is confirmed present in `Aircraft` model (line 52 of `backend/app/models/aircraft.py`). The list endpoint includes `"roll": r.roll` (line 85 of `routes_aircraft.py`). The detail endpoint return dict at lines 163-183 includes `emergency`, `nav_modes`, `ias`, `tas`, `mach`, `registration`, and `type_code` but is missing `roll`. The `AircraftDetail` TypeScript interface in `AircraftDetailPanel.tsx` (lines 4-21) mirrors this omission — `roll` is not present in the interface, so any downstream consumer (e.g., `computeIconRotation`) that receives a detail response cannot access roll.

The fix is surgical and low-risk. No schema migration, no new dependencies, no frontend render changes. The only work is: add one key to the Python dict, add one field to the TypeScript interface, and add/extend a test asserting `"roll"` is present in the detail endpoint response.

**Primary recommendation:** Add `"roll": aircraft.roll` to the `get_aircraft()` return dict in `routes_aircraft.py` and add `roll: number | null` to the `AircraftDetail` interface in `AircraftDetailPanel.tsx`. Extend `test_aircraft_detail` in `test_aircraft.py` to assert the `"roll"` key is present in the response body.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| FastAPI | (project-installed) | Route handler and response serialization | Already used throughout `routes_aircraft.py` |
| SQLAlchemy async | (project-installed) | ORM — `Aircraft.roll` is `Mapped[float | None]` | Model already has the column |
| pytest-asyncio | (project-installed) | Async test runner for backend tests | All backend tests use this pattern |
| httpx / ASGITransport | (project-installed) | In-process HTTP client for backend tests | Used in all existing `test_aircraft.py` tests |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| TypeScript | (project-installed) | Interface typing for `AircraftDetail` | Required to add `roll: number | null` |
| Vitest | (project-installed) | Frontend test runner | Only relevant if a frontend test is extended |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Manual dict key addition | Pydantic response model | Pydantic would enforce schema at serialization time but is overkill for a one-line fix in an otherwise dict-returning route |

**Installation:**
No new packages required. All dependencies already present.

## Architecture Patterns

### Recommended Project Structure
No structural changes. The fix touches two existing files:
```
backend/app/api/routes_aircraft.py   # add "roll" key to get_aircraft() return dict
frontend/src/components/AircraftDetailPanel.tsx  # add roll: number | null to AircraftDetail interface
backend/tests/test_aircraft.py       # extend test_aircraft_detail to assert "roll" in body
```

### Pattern 1: List/Detail Field Symmetry
**What:** The list endpoint and detail endpoint return dicts are kept in sync for all fields that consumers downstream (e.g., `computeIconRotation`) need to access.
**When to use:** Any time a field is added to one endpoint, audit the other.
**Example:**
```python
# routes_aircraft.py — list endpoint already has this (line 85):
"roll": r.roll,

# Detail endpoint return dict should mirror it:
return {
    ...
    "roll": aircraft.roll,   # ADD THIS LINE
}
```

### Pattern 2: TypeScript Interface Addition
**What:** The `AircraftDetail` interface in `AircraftDetailPanel.tsx` is updated alongside the backend dict.
**When to use:** Every time the detail endpoint gains a new field.
**Example:**
```typescript
// AircraftDetailPanel.tsx — AircraftDetail interface (currently lines 4-21)
interface AircraftDetail {
  ...
  mach: number | null;
  registration: string | null;
  type_code: string | null;
  roll: number | null;  // ADD THIS LINE
}
```

### Pattern 3: Backend Test for New Response Field
**What:** Existing `test_aircraft_detail` seeds an `Aircraft` row and GETs the detail endpoint. Extend it to assert the new field is present (and optionally assert its value when seeded non-null).
**When to use:** For every addition to the detail endpoint response contract.
**Example:**
```python
# test_aircraft.py — inside test_aircraft_detail, after existing assertions:
assert "roll" in body, "roll must be present in detail response"
# Optionally assert value when seeded:
assert body["roll"] is None  # seeded row has no roll value set
```

### Anti-Patterns to Avoid
- **Adding a new separate test function instead of extending the existing one:** The existing `test_aircraft_detail` already seeds a row and hits the endpoint — extend it rather than duplicating infrastructure.
- **Adding a Pydantic response model to enforce shape:** Overkill for this single-field gap; dict return is the project pattern for all aircraft routes.
- **Modifying the list endpoint:** It already returns `roll` correctly. No change needed there.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Response shape enforcement | Custom serializer or validator | Direct dict key addition | The project uses plain dicts throughout routes; consistency beats correctness theater |
| Test data factory | Custom fixture builder | Inline `Aircraft(...)` instantiation | All existing tests use inline construction with `AsyncSessionLocal` — match the pattern |

## Common Pitfalls

### Pitfall 1: Forgetting the TypeScript Interface
**What goes wrong:** Backend returns `roll` but `AircraftDetail` interface does not declare it, so TypeScript treats it as `undefined` at the call site and the roll-banking transform silently stops working.
**Why it happens:** Backend and frontend files are changed independently; easy to forget one half.
**How to avoid:** Treat routes_aircraft.py and AircraftDetailPanel.tsx as a single atomic change in the plan step.
**Warning signs:** `data.roll` is `undefined` in the browser console even though the network response contains it.

### Pitfall 2: Seeding `roll` as `None` and Missing the Null Case
**What goes wrong:** Test only checks `"roll" in body` but doesn't verify that a non-null value round-trips correctly.
**Why it happens:** The existing `test_aircraft_detail` seeds a row without setting `roll`, so `body["roll"]` will be `None`. This validates presence but not correctness of a float value.
**How to avoid:** Either (a) accept the null check as sufficient given schema coverage comes from SCHEMA-05 tests in Phase 38, or (b) seed `roll=15.5` in a new or extended test and assert `body["roll"] == 15.5`.

### Pitfall 3: conftest.py NullPool Isolation
**What goes wrong:** Using `AsyncSessionLocal` directly outside the test conftest patch scope, which routes go through the NullPool-patched session factory.
**Why it happens:** conftest.py patches `db_module.AsyncSessionLocal` — tests that import `AsyncSessionLocal` directly before the patch is applied can get the production pool.
**How to avoid:** Follow the exact pattern in existing `test_aircraft_detail` — import `AsyncSessionLocal` inside the test function body (not at module scope), as done in lines 54-56 of `test_aircraft.py`.

## Code Examples

Verified patterns from existing codebase:

### Detail Endpoint Return Dict (current state — missing `roll`)
```python
# Source: backend/app/api/routes_aircraft.py lines 163-183
return {
    "icao24": aircraft.icao24,
    ...
    "mach": aircraft.mach,
    "registration": aircraft.registration,
    "type_code": aircraft.type_code,
    # "roll" is missing here — this is the bug
}
```

### List Endpoint (correct — already includes `roll`)
```python
# Source: backend/app/api/routes_aircraft.py lines 67-88
{
    ...
    "roll": r.roll,   # present here, absent from detail — asymmetry
}
```

### Aircraft Model Column
```python
# Source: backend/app/models/aircraft.py line 52
roll: Mapped[float | None] = mapped_column(Float, nullable=True)
```

### Existing Test Pattern to Follow
```python
# Source: backend/tests/test_aircraft.py lines 52-112 (test_aircraft_detail)
aircraft = Aircraft(
    icao24=icao24,
    callsign="TEST001",
    ...
)
session.add(aircraft)
await session.commit()
# ...
response = await client.get(f"/api/aircraft/{icao24}")
assert response.status_code == 200
body = response.json()
assert body["icao24"] == icao24
# Pattern: add assertion here:
assert "roll" in body
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Detail endpoint missing `roll` | Add `"roll": aircraft.roll` to return dict | Phase 42 (now) | Eliminates MISSING-01 / BROKEN-01 audit findings; `AircraftDetail.roll` goes from undefined to `number | null` |

**Deprecated/outdated:**
- Nothing deprecated in this phase.

## Open Questions

1. **Should `roll` be rendered in the detail panel UI?**
   - What we know: The phase goal is API + TypeScript interface parity, not UI rendering. The roll field drives the globe icon banking transform via `AircraftRecord`, not the detail panel. Phase 39 implemented `computeIconRotation` which uses `AircraftRecord.roll` (from the list endpoint), not `AircraftDetail.roll`.
   - What's unclear: Whether any consumer of `AircraftDetail` currently uses `roll` or whether this is purely a completeness fix.
   - Recommendation: Add the interface field but do NOT add a roll display row to the panel — that is out of scope per the phase goal. The plan should be explicit: TypeScript interface update only, no JSX change.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | pytest + pytest-asyncio (backend); Vitest (frontend) |
| Config file | `backend/pytest.ini` or `pyproject.toml` (backend); `frontend/vitest.config.ts` (frontend) |
| Quick run command | `cd backend && pytest tests/test_aircraft.py -x -q` |
| Full suite command | `cd backend && pytest -x -q` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| (SC-1) `GET /api/aircraft/{icao24}` response includes `"roll"` | Detail endpoint returns roll key | integration | `cd backend && pytest tests/test_aircraft.py::test_aircraft_detail -x` | Extends existing test |
| (SC-2) `AircraftDetail.roll` is `number | null`, never `undefined` | TypeScript interface completeness | type-check / compile | `cd frontend && npx tsc --noEmit` | Extends existing interface |
| (SC-3) Existing tests pass | No regressions | integration | `cd backend && pytest tests/test_aircraft.py -x -q` | All exist |

### Sampling Rate
- **Per task commit:** `cd backend && pytest tests/test_aircraft.py -x -q`
- **Per wave merge:** `cd backend && pytest -x -q`
- **Phase gate:** Full backend suite green before `/gsd:verify-work`

### Wave 0 Gaps
None — existing test infrastructure covers all phase requirements. `test_aircraft_detail` in `test_aircraft.py` will be extended in-place; no new files needed.

## Sources

### Primary (HIGH confidence)
- Direct code read: `backend/app/api/routes_aircraft.py` — confirmed `roll` absent from detail return dict (lines 163-183), present in list return dict (line 85)
- Direct code read: `backend/app/models/aircraft.py` line 52 — `roll: Mapped[float | None]` column confirmed
- Direct code read: `frontend/src/components/AircraftDetailPanel.tsx` lines 4-21 — `AircraftDetail` interface confirmed missing `roll`
- Direct code read: `backend/tests/test_aircraft.py` lines 52-112 — existing `test_aircraft_detail` structure confirmed; no `"roll"` assertion present

### Secondary (MEDIUM confidence)
- Project STATE.md — confirms MISSING-01 and BROKEN-01 as the audit findings this phase closes
- Project ROADMAP.md phase 42 description — confirms success criteria and single-plan scope

### Tertiary (LOW confidence)
None.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all technology is already in use in the project; no new libraries
- Architecture: HIGH — the fix pattern is identical to how `registration` and `type_code` were added in Phase 41
- Pitfalls: HIGH — derived directly from reading the code and test infrastructure

**Research date:** 2026-03-15
**Valid until:** 2026-04-15 (stable codebase, no fast-moving dependencies)
