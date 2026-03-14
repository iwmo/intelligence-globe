# Phase 32: API Key Wiring - Research

**Researched:** 2026-03-14
**Domain:** Docker Compose environment injection, Vite env vars, React fetch headers, .env.example documentation
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| SEC-04 | Static API key middleware protects `POST /api/osint-events` — key configured via `API_KEY` env var, returns 401 if missing/invalid; `API_KEY` forwarded to backend container and `X-API-Key` header sent by UI | All four success criteria are mechanical wiring: env block in docker-compose.yml, header in OsintEventPanel.tsx, .env.example entry, README table row — each maps directly to an audited gap documented in v6.0-MILESTONE-AUDIT.md |
</phase_requirements>

---

## Summary

This phase is a pure gap-closure sprint. The v6.0 milestone audit (`v6.0-MILESTONE-AUDIT.md`) identified two independent wiring failures that prevent SEC-04 from functioning in production. The middleware code (`backend/app/api/deps.py`) and route protection (`backend/app/api/routes_osint.py`) are already correct and tested. The failure points are upstream (env not forwarded) and downstream (header not sent).

The four success criteria map one-to-one to four file edits across three files plus one table-row append in README.md. There is no new logic to design, no new dependencies to introduce, and no architecture decisions to make. Every change is a known pattern already used elsewhere in the same files.

**Primary recommendation:** Make the four targeted edits in a single plan (32-01-PLAN.md), verify with existing test suites (pytest for backend, vitest for frontend), and confirm with a manual docker compose smoke test.

---

## Standard Stack

No new libraries are introduced in this phase. All changes use existing infrastructure.

### Core (already present)
| Component | Version/Location | Purpose | Status |
|-----------|-----------------|---------|--------|
| Docker Compose environment injection | docker-compose.yml lines 37-43 | Forward env vars to backend container | Pattern already used for AISSTREAM_API_KEY (line 86) |
| Vite `import.meta.env` | frontend/vite.config.ts | Expose VITE_* vars to React at bundle time | Already used for VITE_CESIUM_ION_TOKEN |
| FastAPI `Header` dependency | backend/app/api/deps.py | Validate X-API-Key on POST | Already implemented and tested |
| pytest + httpx | backend/pytest.ini + backend/tests/ | Backend auth coverage | test_osint.py already covers 3 auth scenarios |
| vitest + jsdom | frontend/vite.config.ts `test` block | Frontend component smoke tests | OsintEventPanel.test.tsx already exists |

### No Alternatives Needed
This phase has no library choices. Every tool is mandated by existing project infrastructure.

---

## Architecture Patterns

### Pattern 1: Docker Compose `:?` env injection (established)
**What:** `VARNAME: ${VARNAME:?Error message}` in a service's `environment` block injects the host env var into the container and fails loud at `docker compose up` time if the var is unset.
**When to use:** For all credential variables — this is the project-established pattern per Phase 27 decision.
**Existing instance:** `AISSTREAM_API_KEY: ${AISSTREAM_API_KEY:?Set AISSTREAM_API_KEY in .env}` on line 86 of docker-compose.yml.

**What to add to backend service environment block:**
```yaml
# After OPENSKY_CLIENT_SECRET on line 43:
API_KEY: ${API_KEY:?Set API_KEY in .env}
```

Note: The backend service environment block (lines 37-43) currently has six vars: `DATABASE_URL`, `REDIS_URL`, `FRONTEND_ORIGIN`, `VERSION`, `OPENSKY_CLIENT_ID`, `OPENSKY_CLIENT_SECRET`. `API_KEY` is absent — the audit confirmed this is the root cause of MISSING-01.

### Pattern 2: Vite `import.meta.env` header injection (established)
**What:** Vite inlines `VITE_*` environment variables at bundle compile time. They are accessed at runtime via `import.meta.env.VITE_VARNAME` in TypeScript/TSX.
**When to use:** Any frontend secret that must be sent as a request header or used in client-side logic. VITE_* vars are baked into the JS bundle — not suitable for secrets that must remain server-side.
**Existing pattern in project:** `VITE_CESIUM_ION_TOKEN` is passed as a Docker build ARG (Phase 29 decision) so the token is inlined during the production build. `VITE_API_KEY` follows the same mechanism.

**IMPORTANT decision from Phase 29:** "VITE_CESIUM_ION_TOKEN passed as build ARG not runtime env — Vite inlines env vars at bundle compile time; runtime env in nginx container has no effect." The same applies to `VITE_API_KEY`.

This means `VITE_API_KEY` must be passed as a Docker build ARG in the frontend service — analogous to `VITE_CESIUM_ION_TOKEN`. The current frontend build block in docker-compose.yml:

```yaml
frontend:
  build:
    context: ./frontend
    target: production
    args:
      VITE_CESIUM_ION_TOKEN: ${VITE_CESIUM_ION_TOKEN:?Set VITE_CESIUM_ION_TOKEN in .env}
```

`VITE_API_KEY` must be added here as a second `args` entry — otherwise the header value will be `undefined` in the production build. This is the same "bake at build time" constraint that Phase 29 documented.

**The fetch call to update in OsintEventPanel.tsx (lines 48-51):**
```typescript
// Current (broken):
const r = await fetch('/api/osint-events', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

// Correct (adds X-API-Key):
const r = await fetch('/api/osint-events', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-API-Key': import.meta.env.VITE_API_KEY,
  },
  body: JSON.stringify(body),
});
```

### Pattern 3: .env.example documentation (established)
**What:** Every env var consumed by the stack has a placeholder entry in `.env.example` with a descriptive comment line above it.
**Existing pattern:**
```bash
# API Authentication — used by Phase 28 middleware to protect write endpoints
API_KEY=your-secret-api-key
```
`VITE_API_KEY` must be added adjacent to `API_KEY` since they share the same secret value:
```bash
# Frontend API key — same secret as API_KEY; sent as X-API-Key header on OSINT event POST
VITE_API_KEY=your-secret-api-key
```

### Pattern 4: README API Keys table (established)
**What:** The README's `## API Keys` section has a Markdown table documenting each variable with service, free-tier status, and registration URL.
**Existing row for context:**
```
| `API_KEY` | Internal write-endpoint authentication | N/A — set any secret string | — |
```
`VITE_API_KEY` must be added as a new row:
```
| `VITE_API_KEY` | Frontend header for OSINT event submission — same secret as `API_KEY` | N/A — set any secret string | — |
```
The README currently says "All four key types are required" — this description must also be updated to "five" (or reworded) since a fifth variable is being added.

### Anti-Patterns to Avoid
- **Do not use `:-` soft-default for credentials:** The project decision from Phase 27 is `:?` (fail loud) for all credential variables. Do not write `API_KEY: ${API_KEY:-}`.
- **Do not rely on runtime env for Vite vars in the nginx container:** Vite inlines `VITE_*` at compile time. Setting `VITE_API_KEY` as a runtime container env var on the frontend service has no effect. It must be a build ARG.
- **Do not add error handling to OsintEventPanel beyond the header fix:** The audit notes silent failure on 401 (`if (r.ok)` silently drops failure) but the phase success criteria do not include error UI. Stay strictly in scope.
- **Do not touch `deps.py` or `routes_osint.py`:** The middleware and route protection are already correct. Phase 32 is wiring only.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead |
|---------|-------------|-------------|
| Env var injection into container | Custom entrypoint scripts | Docker Compose `environment` block with `:?` syntax |
| Frontend build-time secrets | Runtime env injection, custom webpack plugins | Vite `VITE_*` ARG passed at `docker build` time |
| API key validation | Custom middleware | Already implemented in `backend/app/api/deps.py` |

---

## Common Pitfalls

### Pitfall 1: Forgetting the frontend build ARG
**What goes wrong:** Developer adds `VITE_API_KEY` to `.env.example` and `OsintEventPanel.tsx` but does not add it as a build ARG in the frontend service block of docker-compose.yml. In the production Docker build the variable is not available to Vite, so `import.meta.env.VITE_API_KEY` evaluates to `undefined`. The request header becomes `X-API-Key: undefined` (the string "undefined"), which does not match the secret, causing 401.
**Why it happens:** Forgetting that Vite variables must be present at compile time, not runtime.
**How to avoid:** Add `VITE_API_KEY: ${VITE_API_KEY:?Set VITE_API_KEY in .env}` to the frontend `build.args` block — mirror of how `VITE_CESIUM_ION_TOKEN` is handled.
**Warning signs:** Production POST returns 401 even though `API_KEY` is set in `.env`.

### Pitfall 2: Placing API_KEY in the wrong service block
**What goes wrong:** `API_KEY` is added to the `worker` or `ais-worker` environment block instead of (or in addition to) the `backend` block. These services do not expose HTTP endpoints and never check API keys.
**How to avoid:** Add to the `backend` service environment block only. This is the service that runs FastAPI/uvicorn.

### Pitfall 3: Using `:-` instead of `:?` for the new vars
**What goes wrong:** Writing `API_KEY: ${API_KEY:-}` allows docker compose to silently start the backend with an empty API key. `settings.api_key` becomes `""`, and `deps.py` line 23 (`x_api_key != settings.api_key`) will accept any request that sends an empty `X-API-Key` header — or rejects all non-empty keys.
**How to avoid:** Use `${API_KEY:?Set API_KEY in .env}` consistent with all other credentials in the project.

### Pitfall 4: README key count mismatch
**What goes wrong:** Adding `VITE_API_KEY` as a fifth row in the API Keys table but leaving "All four key types are required" in the introductory paragraph. First-time readers are confused.
**How to avoid:** Update the count in the paragraph above the table from "four" to "five" (or use "all" without a hard count).

---

## Code Examples

### docker-compose.yml — backend environment block (verified from current file)
Current backend environment block ends at line 43 with `OPENSKY_CLIENT_SECRET`. The addition goes after that line:
```yaml
environment:
  DATABASE_URL: postgresql+asyncpg://${POSTGRES_USER:-postgres}:${POSTGRES_PASSWORD:?Set POSTGRES_PASSWORD in .env}@postgres:5432/${POSTGRES_DB:-opensignal}
  REDIS_URL: redis://redis:6379/0
  FRONTEND_ORIGIN: ${FRONTEND_ORIGIN:-http://localhost}
  VERSION: ${VERSION:-0.1.0}
  OPENSKY_CLIENT_ID: ${OPENSKY_CLIENT_ID:?Set OPENSKY_CLIENT_ID in .env}
  OPENSKY_CLIENT_SECRET: ${OPENSKY_CLIENT_SECRET:?Set OPENSKY_CLIENT_SECRET in .env}
  API_KEY: ${API_KEY:?Set API_KEY in .env}          # <-- ADD THIS
```

### docker-compose.yml — frontend build args (verified from current file)
Current frontend build args block contains one entry. Add the second:
```yaml
args:
  VITE_CESIUM_ION_TOKEN: ${VITE_CESIUM_ION_TOKEN:?Set VITE_CESIUM_ION_TOKEN in .env}
  VITE_API_KEY: ${VITE_API_KEY:?Set VITE_API_KEY in .env}   # <-- ADD THIS
```

### OsintEventPanel.tsx — fetch call (lines 48-51, verified from current file)
```typescript
const r = await fetch('/api/osint-events', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-API-Key': import.meta.env.VITE_API_KEY,
  },
  body: JSON.stringify(body),
});
```

### .env.example — new entry (verified: VITE_API_KEY currently absent)
Add after the existing `API_KEY` line:
```bash
# API Authentication — used by Phase 28 middleware to protect write endpoints
API_KEY=your-secret-api-key
# Frontend API key — must match API_KEY; sent as X-API-Key header when submitting OSINT events
VITE_API_KEY=your-secret-api-key
```

---

## State of the Art

| Old Approach | Current Approach | Notes |
|--------------|------------------|-------|
| Hardcoded credential fallbacks in compose | `:?` fail-loud syntax | Established in Phase 27 |
| curl for container healthchecks | Python urllib stdlib | Phase 29 — python:3.12-slim has no curl |
| No auth on write routes | X-API-Key header + deps.py dependency | Implemented in Phase 28 |

---

## Open Questions

1. **Should `VITE_API_KEY` and `API_KEY` have the same value?**
   - What we know: Yes — they are the same shared secret. The backend reads `API_KEY`, the frontend sends `VITE_API_KEY` as the `X-API-Key` header. They must match.
   - What's unclear: Whether to document "set both to the same string" explicitly or rely on context.
   - Recommendation: The `.env.example` comment and README row should both state "must match `API_KEY`" to be unambiguous.

2. **Is the `VITE_API_BASE_URL` stale entry in `.env.example` in scope?**
   - What we know: The audit flagged `VITE_API_BASE_URL=http://localhost:8000` as stale — nginx serves relative `/api/` paths in production. This variable is used by `vite.config.ts` dev server proxy but is otherwise unused.
   - What's unclear: Whether removing or commenting it out is in scope for Phase 32.
   - Recommendation: Out of scope for this phase. The success criteria do not reference it. Leave it for a future cleanup pass.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework (backend) | pytest 8.x + pytest-asyncio (asyncio_mode = auto) |
| Config file (backend) | `backend/pytest.ini` |
| Quick run command (backend) | `cd backend && pytest tests/test_osint.py -x` |
| Full suite command (backend) | `cd backend && pytest` |
| Framework (frontend) | vitest (configured in `frontend/vite.config.ts` test block) |
| Config file (frontend) | `frontend/vite.config.ts` (test key) |
| Quick run command (frontend) | `cd frontend && npx vitest run src/components/__tests__/OsintEventPanel.test.tsx` |
| Full suite command (frontend) | `cd frontend && npx vitest run` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SEC-04 | POST /api/osint-events returns 401 when X-API-Key absent | unit | `cd backend && pytest tests/test_osint.py::test_create_event_no_key -x` | YES |
| SEC-04 | POST /api/osint-events returns 401 when key is wrong | unit | `cd backend && pytest tests/test_osint.py::test_create_event_wrong_key -x` | YES |
| SEC-04 | POST /api/osint-events returns 201 when key is correct | unit | `cd backend && pytest tests/test_osint.py::test_create_event_correct_key -x` | YES |
| SEC-04 | OsintEventPanel renders and includes form fields | smoke | `cd frontend && npx vitest run src/components/__tests__/OsintEventPanel.test.tsx` | YES |
| SEC-04 | API_KEY forwarded to backend container (E2E) | manual | `docker compose up && curl -X POST http://localhost/api/osint-events -H 'X-API-Key: <value>' -H 'Content-Type: application/json' -d '{"ts":"2026-01-01T00:00:00Z","category":"KINETIC","label":"test"}'` | N/A |

### Sampling Rate
- **Per task commit:** `cd backend && pytest tests/test_osint.py -x`
- **Per wave merge:** `cd backend && pytest && cd ../frontend && npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
None — existing test infrastructure covers all phase requirements. All auth tests exist in `backend/tests/test_osint.py`. Frontend smoke tests exist in `frontend/src/components/__tests__/OsintEventPanel.test.tsx`.

The manual docker compose smoke test (E2E) is the only validation that cannot be automated and is gated as a human-verify checkpoint.

---

## Exact File Changes Summary

This is the complete surgical change set for Phase 32. Four edits across three files:

| File | Change | Lines Affected |
|------|--------|---------------|
| `docker-compose.yml` | Add `API_KEY: ${API_KEY:?Set API_KEY in .env}` to backend `environment` block | After line 43 |
| `docker-compose.yml` | Add `VITE_API_KEY: ${VITE_API_KEY:?Set VITE_API_KEY in .env}` to frontend `build.args` block | After line 99 |
| `frontend/src/components/OsintEventPanel.tsx` | Add `'X-API-Key': import.meta.env.VITE_API_KEY` to fetch headers | Line 50 |
| `.env.example` | Add `VITE_API_KEY=your-secret-api-key` with comment | After `API_KEY` line |
| `README.md` | Add `VITE_API_KEY` row to API Keys table; update key count from four to five | Lines 57-64 |

Note: README.md counts as a fifth edit across four files total. Five discrete file modifications.

---

## Sources

### Primary (HIGH confidence)
- `docker-compose.yml` (lines 1-107, read directly) — current backend and frontend environment/args blocks
- `frontend/src/components/OsintEventPanel.tsx` (lines 48-51, read directly) — confirmed missing X-API-Key header
- `backend/app/api/deps.py` (read directly) — middleware implementation confirmed correct
- `backend/app/api/routes_osint.py` (read directly) — `@router.post` with `dependencies=[Depends(verify_api_key)]` confirmed
- `backend/app/config.py` (read directly) — `api_key: str = ""` reads from `API_KEY` env var
- `.env.example` (read directly) — confirmed `VITE_API_KEY` absent
- `README.md` (read directly) — confirmed `VITE_API_KEY` absent from API Keys table
- `.planning/v6.0-MILESTONE-AUDIT.md` (read directly) — authoritative gap specification (MISSING-01, MISSING-02, BROKEN-01, BROKEN-02)
- `backend/tests/test_osint.py` (read directly) — confirmed 3 auth tests already pass
- `frontend/src/components/__tests__/OsintEventPanel.test.tsx` (read directly) — confirmed smoke tests exist

### Secondary (MEDIUM confidence)
- Vite documentation pattern: `VITE_*` env vars are inlined at build time, must be passed as build ARGs in Docker — consistent with Phase 29 project decision (documented in STATE.md).

### Tertiary (LOW confidence)
None.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependencies; all patterns verified from existing project files
- Architecture: HIGH — all four changes are mechanical edits with exact line references from read files
- Pitfalls: HIGH — pitfalls derived from audit evidence and established Phase 27/29 project decisions

**Research date:** 2026-03-14
**Valid until:** 2026-04-14 (stable; no external dependencies)
