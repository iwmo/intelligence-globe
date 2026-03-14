# Phase 28: API Key Auth - Research

**Researched:** 2026-03-14
**Domain:** FastAPI dependency injection — static API key middleware for write endpoint protection
**Confidence:** HIGH

---

## Summary

Phase 28 adds a single-layer security gate to the FastAPI backend: any `POST` route must carry an `X-API-Key` header whose value matches the `API_KEY` environment variable. All `GET` routes remain open. No JWT, no sessions, no third-party auth library — the requirement document explicitly rules these out as over-engineering for a single-user homelab tool.

The implementation surface is small. FastAPI's built-in `Header` dependency and `Depends()` mechanism are exactly the right tool. A single dependency function (`verify_api_key`) reads the header from the incoming request, compares it against `settings.api_key`, and raises `HTTPException(status_code=401)` on failure. That function is applied either per-route via `Depends()` or at the router level via `dependencies=[Depends(verify_api_key)]`. Because only write endpoints need protection, the router-level approach applied to `routes_osint.py` is cleanest.

The second deliverable of this phase is tests. The existing `test_osint.py` already covers `POST /api/osint-events` with a valid body and expects 200/201 — that test must be updated to pass the correct header. Three new tests cover the three auth-specific behaviours: no header → 401, wrong value → 401, correct value → 201. Because the test client is ASGI-based (`httpx.AsyncClient` + `ASGITransport`), no network is needed and tests run in the same pytest session as all existing backend tests.

**Primary recommendation:** Use a FastAPI `Header` dependency injected via `Depends()` at the router level of the OSINT router. Store the key in `settings.api_key` (pydantic-settings, loaded from `API_KEY` env var). Tests use `monkeypatch` to control the env var value without touching `.env`.

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| SEC-04 | Static API key middleware protects `POST /api/osint` (and any future write endpoints) — key configured via `API_KEY` env var, returns 401 if missing/invalid | FastAPI `Header` + `Depends()` pattern; pydantic-settings field addition; pytest `monkeypatch` for env var control |
</phase_requirements>

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| FastAPI | >=0.115 (already in requirements.txt) | HTTP framework, dependency injection | Already the app framework; `Header` and `Depends` are first-party |
| pydantic-settings | >=2.0 (already in requirements.txt) | Load `API_KEY` from env into `Settings` | Already used for all other config; adding one field is zero overhead |

### No New Dependencies Required

All tools needed are already present. No new `pip install` required.

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `Header` dependency per-router | `Middleware` on the full app | Middleware runs on every request including GETs; would require URL-path inspection logic — more fragile |
| `Header` dependency per-router | `APIKeyHeader` from `fastapi.security` | Functionally equivalent but adds OpenAPI security schema machinery not needed here; REQUIREMENTS.md says no auth UI required |
| pydantic-settings field | `os.environ.get()` inline | Direct env read is acceptable but pydantic-settings gives validation (missing key raises at startup), consistent with codebase style |

---

## Architecture Patterns

### Recommended Project Structure

No new files or directories required. Changes touch:

```
backend/
├── app/
│   ├── config.py          # Add api_key field to Settings
│   ├── api/
│   │   ├── deps.py        # NEW — verify_api_key dependency function
│   │   └── routes_osint.py  # Add dependencies=[Depends(verify_api_key)] to POST route
└── tests/
    └── test_osint.py      # Update existing test + add 3 new auth tests
```

### Pattern 1: FastAPI Header Dependency

**What:** A standalone dependency function that reads a request header and raises 401 if it does not match the configured secret.

**When to use:** Protecting specific routes or routers without affecting the entire application.

**How it works in FastAPI:** `Header` automatically maps the `X-Api-Key` HTTP header (FastAPI normalises hyphens to underscores and lowercases). The dependency is injected by listing it in `Depends()`.

```python
# Source: FastAPI official docs — https://fastapi.tiangolo.com/tutorial/header-params/
# Source: FastAPI official docs — https://fastapi.tiangolo.com/tutorial/dependencies/
from fastapi import Depends, Header, HTTPException

from app.config import settings


async def verify_api_key(x_api_key: str = Header(...)) -> None:
    """Raise 401 if the X-API-Key header is missing or does not match API_KEY."""
    if x_api_key != settings.api_key:
        raise HTTPException(status_code=401, detail="Invalid or missing API key")
```

### Pattern 2: Router-Level Dependency

**What:** Apply a dependency to every route in a router without modifying individual route decorators.

**When to use:** When an entire router (or a subset of methods) should share an auth check. Prevents forgetting to add `Depends()` to future routes.

```python
# Source: FastAPI official docs — https://fastapi.tiangolo.com/tutorial/bigger-applications/
from fastapi import APIRouter, Depends
from app.api.deps import verify_api_key

# Apply to the whole router — every route including GET would require the key.
# Since GETs must remain open, apply only to the POST route decorator:
@router.post("", dependencies=[Depends(verify_api_key)], status_code=201)
async def create_event(body: OsintEventCreate, db: AsyncSession = Depends(get_db)):
    ...
```

**Note:** The requirement is that GETs are unaffected. Applying `dependencies=` only to the `POST` route decorator (not the `APIRouter()` constructor) is the correct scope.

### Pattern 3: Adding `api_key` to pydantic-settings `Settings`

```python
# backend/app/config.py — add one field
class Settings(BaseSettings):
    ...
    api_key: str = ""   # loaded from API_KEY env var; empty string means "unset"
```

Empty-string default allows the app to start in dev without `API_KEY` set. The middleware will reject all POSTs until a real key is configured, which is the correct fail-secure behaviour. If a stricter startup failure is preferred, omit the default — pydantic-settings will raise `ValidationError` at import time when `API_KEY` is absent, which surfaces the misconfiguration early.

**Recommendation:** Use `api_key: str = ""` with an empty default for dev friendliness. The `.env.example` already has `API_KEY=your-secret-api-key` so operators are guided.

### Pattern 4: Testing Header Auth with httpx AsyncClient

```python
# Source: httpx docs — https://www.python-httpx.org/api/#asyncclient
# Source: existing conftest.py pattern in this repo
import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app


@pytest.mark.asyncio
async def test_create_event_no_key():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post("/api/osint-events", json={...})
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_create_event_wrong_key(monkeypatch):
    monkeypatch.setattr("app.config.settings.api_key", "correct-key")
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post(
            "/api/osint-events", json={...}, headers={"X-API-Key": "wrong-key"}
        )
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_create_event_correct_key(monkeypatch):
    monkeypatch.setattr("app.config.settings.api_key", "correct-key")
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post(
            "/api/osint-events", json={...}, headers={"X-API-Key": "correct-key"}
        )
    assert response.status_code == 201
```

### Anti-Patterns to Avoid

- **Middleware on the full app:** Would intercept `GET` requests and require path-matching logic. Brittle, hard to maintain, fails the "read endpoints unaffected" requirement.
- **Hardcoding a secret in source code:** The whole point of Phase 27 + 28 is env-var-driven secrets. Never put the key literal in code.
- **Comparing secrets with `==` is acceptable here:** The threat model is a homelab with a single shared secret. Timing-safe comparison (`hmac.compare_digest`) is only necessary if timing attacks are a realistic threat (i.e., publicly reachable APIs). The REQUIREMENTS.md explicitly scopes this as a homelab single-user tool. Use `==` for simplicity; note this in code comments if desired.
- **Returning 403 instead of 401:** The success criteria explicitly require 401. 401 means "unauthenticated" (no valid credentials supplied), 403 means "authenticated but unauthorised". For a missing or wrong API key, 401 is correct per RFC 7235.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Reading a request header | Custom middleware parsing `request.headers` | FastAPI `Header()` parameter in `Depends()` | FastAPI handles header normalisation (case, hyphen→underscore); reduces boilerplate |
| Loading `API_KEY` from env | `os.environ.get("API_KEY")` inline | pydantic-settings field on `Settings` | Already the project pattern; provides type validation and startup-time failure on missing required fields |
| Reusable auth across routes | Copy-paste auth logic per route | `deps.py` module with `verify_api_key` function | Single source of truth; future write endpoints import the same function |

---

## Common Pitfalls

### Pitfall 1: FastAPI Header Name Normalisation

**What goes wrong:** Developer writes `X-API-Key` header in the client but the dependency function parameter is named `x_api_key` — this is correct and works. However, if the parameter is named `api_key` (without the `x_`), FastAPI will look for a header named `api-key`, not `x-api-key`, and the dependency will always receive `None`.

**Why it happens:** FastAPI maps Python parameter names to header names by replacing underscores with hyphens. The `x_` prefix matters.

**How to avoid:** Name the parameter `x_api_key: str = Header(...)` to match the `X-API-Key` HTTP header exactly.

**Warning signs:** Dependency always raises 401 even when the header is present in the request.

### Pitfall 2: Existing `test_create_event` Will Break

**What goes wrong:** `test_osint.py::test_create_event` currently sends a POST with no auth header and asserts `status_code in (200, 201)`. After adding the dependency, this test will receive 401 and fail.

**Why it happens:** The test was written before auth existed.

**How to avoid:** Update `test_create_event` to pass the `X-API-Key` header (and monkeypatch `settings.api_key` accordingly). This is a planned modification, not a bug.

**Warning signs:** `test_create_event` fails immediately after adding the dependency — expected, fix it.

### Pitfall 3: `monkeypatch` Scope with pydantic-settings Singletons

**What goes wrong:** `monkeypatch.setenv("API_KEY", "correct-key")` does NOT update `settings.api_key` if `settings` was already instantiated as a module-level singleton. Pydantic-settings reads the env at construction time.

**Why it happens:** `settings = Settings()` runs at module import time. Setting the env var after import has no effect on the already-constructed object.

**How to avoid:** Use `monkeypatch.setattr("app.config.settings.api_key", "correct-key")` to directly patch the attribute on the singleton instance. This is the correct pattern for this codebase (same approach used by `conftest.py` for the DB engine).

**Warning signs:** Auth tests pass when run in isolation but fail when the test suite runs in order (the singleton already has a stale value).

### Pitfall 4: `status_code` Default on the POST Route

**What goes wrong:** FastAPI returns 200 by default for any route that doesn't specify `status_code`. The success criteria require HTTP 201 for a successful POST.

**Why it happens:** Existing `@router.post("")` decorator has no `status_code` argument.

**How to avoid:** Add `status_code=201` to the `@router.post("")` decorator in `routes_osint.py`. This also requires updating `test_create_event` to assert exactly 201 rather than `in (200, 201)`.

**Warning signs:** Existing test uses `assert response.status_code in (200, 201)` — the loose assertion hid that the route was returning 200. Tighten to `== 201` as part of this phase.

---

## Code Examples

### Dependency module (`backend/app/api/deps.py`)

```python
# Source: FastAPI official docs — https://fastapi.tiangolo.com/tutorial/dependencies/
from fastapi import Header, HTTPException
from app.config import settings


async def verify_api_key(x_api_key: str = Header(...)) -> None:
    """Raise HTTP 401 when X-API-Key header is missing or does not match API_KEY."""
    if x_api_key != settings.api_key:
        raise HTTPException(status_code=401, detail="Invalid or missing API key")
```

### Settings update (`backend/app/config.py`)

```python
class Settings(BaseSettings):
    model_config = ConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/opensignal"
    redis_url: str = "redis://localhost:6379/0"
    frontend_origin: str = "http://localhost:3000"
    version: str = "0.1.0"
    api_key: str = ""  # loaded from API_KEY env var

    AIRCRAFT_STALE_SECONDS: int = 120
    MILITARY_STALE_SECONDS: int = 600
    SHIP_STALE_SECONDS: int = 900
    GPS_JAMMING_STALE_SECONDS: int = 600
```

### Protected POST route (`backend/app/api/routes_osint.py`)

```python
from app.api.deps import verify_api_key

@router.post("", dependencies=[Depends(verify_api_key)], status_code=201)
async def create_event(body: OsintEventCreate, db: AsyncSession = Depends(get_db)):
    ...
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| No auth on write endpoints | `Header` dependency with `API_KEY` env var | Phase 28 | Unauthenticated callers get 401 |
| `POST` returns 200 | `POST` returns 201 (correct HTTP semantics for resource creation) | Phase 28 | Tests tightened from `in (200, 201)` to `== 201` |

---

## Open Questions

1. **Should `api_key: str = ""` fail loud at startup when unset?**
   - What we know: Empty default means the app starts but all POSTs are rejected (since `"" != any real key`). A required field (no default) would cause a startup `ValidationError` when `API_KEY` is not in the environment.
   - What's unclear: Whether the homelab deployment always has `.env` set up (it should, since Phase 27 provides `.env.example`).
   - Recommendation: Use empty-string default for Phase 28 (fail-secure at runtime, not startup). The operator is guided by `.env.example`. This can be tightened to a required field in a future hardening pass.

2. **Future write endpoints beyond `POST /api/osint-events`?**
   - What we know: The requirement says "and any future write endpoints". Currently only the OSINT router has a POST.
   - What's unclear: Whether Phase 29-31 will add new write routes.
   - Recommendation: Place `verify_api_key` in `app/api/deps.py` (not inline) so future routes can import it with one line. Document this in the plan.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | pytest + pytest-asyncio (existing) |
| Config file | `backend/pytest.ini` |
| Quick run command | `cd backend && pytest tests/test_osint.py -x -q` |
| Full suite command | `cd backend && pytest -x -q` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SEC-04 | POST with no header returns 401 | unit | `pytest tests/test_osint.py::test_create_event_no_key -x` | ❌ Wave 0 |
| SEC-04 | POST with wrong key returns 401 | unit | `pytest tests/test_osint.py::test_create_event_wrong_key -x` | ❌ Wave 0 |
| SEC-04 | POST with correct key returns 201 | unit | `pytest tests/test_osint.py::test_create_event_correct_key -x` | ❌ Wave 0 |
| SEC-04 | GET /api/osint-events returns 200 without key | unit | `pytest tests/test_osint.py::test_list_events -x` | ✅ exists (passes, no auth needed) |

### Sampling Rate

- **Per task commit:** `cd backend && pytest tests/test_osint.py -x -q`
- **Per wave merge:** `cd backend && pytest -x -q`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `tests/test_osint.py` — add `test_create_event_no_key`, `test_create_event_wrong_key`, `test_create_event_correct_key`; update `test_create_event` to pass header and assert 201
- [ ] `app/api/deps.py` — new file; must exist before routes import it

*(Existing test infrastructure covers all other phase requirements — no new fixtures or framework installs needed)*

---

## Sources

### Primary (HIGH confidence)

- FastAPI official docs — Header parameters: https://fastapi.tiangolo.com/tutorial/header-params/
- FastAPI official docs — Dependencies: https://fastapi.tiangolo.com/tutorial/dependencies/
- FastAPI official docs — Bigger Applications: https://fastapi.tiangolo.com/tutorial/bigger-applications/
- Codebase direct read — `backend/app/main.py`, `backend/app/config.py`, `backend/app/api/routes_osint.py`, `backend/tests/test_osint.py`, `backend/tests/conftest.py`

### Secondary (MEDIUM confidence)

- `.planning/REQUIREMENTS.md` — SEC-04 definition and explicit out-of-scope list (no JWT, no multi-user auth)
- `.planning/STATE.md` — Key decision: "Static API key (not JWT/session auth) — homelab tool, single user, simple shared secret sufficient"

### Tertiary (LOW confidence)

None — all findings verified against codebase or official docs.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — zero new dependencies; FastAPI `Header` + `Depends` are documented, stable, already in use in the project
- Architecture: HIGH — pattern is directly derivable from FastAPI official docs and existing codebase patterns
- Pitfalls: HIGH — derived from direct code reading (existing test assertions, pydantic-settings singleton, header normalisation rules)

**Research date:** 2026-03-14
**Valid until:** 2026-06-14 (FastAPI stable APIs change slowly; pydantic-settings v2 API is stable)
