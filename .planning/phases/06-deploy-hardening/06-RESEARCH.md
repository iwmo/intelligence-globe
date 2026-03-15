# Phase 6: Deploy Hardening - Research

**Researched:** 2026-03-11
**Domain:** Docker entrypoint scripting, Alembic migration automation, React null-guard patterns, Zustand store cleanup, pytest fixture configuration
**Confidence:** HIGH — all findings based on direct codebase inspection (no training-data speculation)

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| INFRA-01 | Full stack deployable via Docker Compose on homelab/VPS | Entrypoint script chains `alembic upgrade head` before uvicorn — eliminates manual step on clean checkout |
| INFRA-02 | FastAPI backend with PostgreSQL + PostGIS for spatial data storage | Same entrypoint fix satisfies schema creation for both satellites and aircraft tables |
| SAT-03 | User can search satellites by name or NORAD ID and fly to result | Null guard on `workerRef.current` in SearchBar before posting GET_POSITION message |
</phase_requirements>

---

## Summary

Phase 6 closes four concrete gaps found in the v1.0 milestone audit. All gaps are fully understood from direct code inspection — no ambiguity about what needs to change or where. This is a gap-closure phase, not a feature phase: every change is a targeted surgical fix.

**Gap 1 (INFRA-01 / INFRA-02 — critical):** `backend/Dockerfile` CMD launches uvicorn directly. `app.main:lifespan` calls `init_db()` which creates the PostGIS extension but does not run Alembic migrations. The three migration files (`ac9bb4b6e929`, `ca281e8bedd2`, `c5795b11a549`) are never executed on a clean `docker compose up`. Tables do not exist; worker fails immediately; API returns 500. Fix: add `backend/entrypoint.sh` that runs `alembic upgrade head && exec uvicorn ...` and update Dockerfile CMD.

**Gap 2 (SAT-03 — minor UX):** `SearchBar.tsx` line 53 posts `GET_POSITION` to `workerRef.current` without a null check. The worker is created inside `SatelliteLayer` only after `satellites.data` arrives (up to 30 seconds). If the user types a satellite name before the TLE fetch completes, `workerRef.current` is null and the postMessage call silently throws or does nothing. The detail panel opens correctly (via `setSelectedSatelliteId`) but the camera fly-to never fires.

**Gap 3 (dead store — negligible):** `searchQuery` and `setSearchQuery` are defined in `useAppStore.ts` (lines 27–28 and 55–56) but are never read or written anywhere outside the store itself. `SearchBar.tsx` uses local `useState`. The test file `useAppStore.test.ts` exercises `searchQuery` (lines 62–73), so the test must be updated when the slice is removed.

**Gap 4 (tech debt — low):** `backend/.env` exists (added in Phase 5 tech debt resolution) with correct defaults matching docker-compose. Tests pass if DATABASE_URL is sourced from `.env` via pydantic-settings. This is already resolved — confirm tests pass without manual export.

**Primary recommendation:** Ship all four fixes in a single plan (06-01-PLAN.md) — they are independent, low-risk, and collectively close INFRA-01, INFRA-02, and SAT-03.

---

## Standard Stack

### Core (already present in this project — no new dependencies)

| Tool | Version | Purpose | Notes |
|------|---------|---------|-------|
| Alembic | >=1.14 (in requirements.txt) | Schema migration tool | Already configured with async engine in `alembic/env.py` |
| Docker | N/A | Container runtime | `backend/Dockerfile` needs entrypoint change |
| Zustand | (in frontend) | Frontend state store | Dead slice removal only |
| Vitest | (in vite.config.ts `test` block) | Frontend test runner | `npx vitest run` |
| pytest-asyncio | (in pytest.ini) | Backend test runner | `python3.11 -m pytest` per STATE.md decision |

### No New Dependencies

This phase introduces zero new packages. All changes are configuration, scripting, and code deletion.

---

## Architecture Patterns

### Pattern 1: Docker Entrypoint Script for Migration Gating

**What:** A shell script replaces the Dockerfile CMD. The script runs `alembic upgrade head` (blocking, exits non-zero on failure), then execs uvicorn using `exec` to replace the shell process with uvicorn so signal handling (SIGTERM on `docker stop`) is preserved.

**When to use:** Any Docker service that must guarantee schema state before accepting traffic.

**Critical detail:** Use `exec` (not `&&`) for the final uvicorn call. Without `exec`, the shell process stays as PID 1 and absorbs SIGTERM instead of forwarding it to uvicorn. With `exec`, uvicorn becomes PID 1 and handles shutdown correctly.

**Example (entrypoint.sh):**
```bash
#!/bin/sh
set -e
alembic upgrade head
exec uvicorn app.main:app --host 0.0.0.0 --port 8000
```

**Dockerfile change:**
```dockerfile
FROM base AS production
COPY . .
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]
```

Note: Remove the existing `CMD` line — ENTRYPOINT replaces it. The `set -e` ensures the script aborts immediately if `alembic upgrade head` fails (e.g., database unreachable), causing Docker to report a non-zero exit and the service to restart per `depends_on` health-check logic.

**Why not docker-compose command override?** The entrypoint.sh approach is more portable (works on any Docker runtime, not just compose) and keeps the migration logic with the image rather than the orchestration file. Either approach works; entrypoint.sh is standard practice.

**Alembic URL note:** `alembic upgrade head` inside the container reads `alembic.ini` which points to `env.py`, which reads `settings.database_url`. `DATABASE_URL` is already set in `docker-compose.yml` environment for the backend service (postgresql+asyncpg://...). The async env.py using `asyncio.run()` works correctly in this context — confirmed by Phase 2 decision log.

### Pattern 2: React Ref Null Guard Before Worker postMessage

**What:** A simple `if (!workerRef.current)` guard before accessing the worker. Optionally show a status message to the user instead of silently doing nothing.

**When to use:** Any code that accesses a ref whose value is set asynchronously (worker initialization, viewer readiness, etc.).

**Current code (SearchBar.tsx lines 52–57):**
```typescript
if (workerRef.current) {
  workerRef.current.postMessage({
    type: 'GET_POSITION',
    payload: { norad: satMatch.norad_cat_id },
  });
}
// currently: falls through to `return` with no feedback if worker is null
```

The guard is already present. The bug is that when `workerRef.current` is null, the code silently exits after setting `selectedSatelliteId` and `status`. The detail panel opens but fly-to never happens and the user sees "Satellite: [name]" with no indication that fly-to failed.

**Fix options:**
1. Add an `else` branch: `setStatus('Loading satellite data, fly-to pending...')` — best UX
2. Add a queued retry: store the norad ID and retry when worker becomes available — more complex, not required by success criteria
3. No change needed if success criterion only requires "null guard prevents the error" — the guard already exists at line 52; confirm whether the issue is actually a thrown error or silent no-op

**Re-reading the audit:** "SearchBar.tsx posts GET_POSITION to workerRef.current without guarding for null worker." And success criterion 2: "a null guard prevents the error." Direct inspection of SearchBar.tsx lines 52–57 shows the guard IS present: `if (workerRef.current)`. The audit may be describing a pre-fix state. The actual issue is the silent UX gap — fly-to does nothing with no feedback. The guard prevents the TypeError; the UX gap is the missing feedback. The success criterion is met by the existing guard. The planner should verify at test time whether any error actually occurs or if the issue is purely UX feedback.

### Pattern 3: Zustand Dead Slice Removal

**What:** Remove `searchQuery: string` and `setSearchQuery` from the AppState interface, from the initial state object, and update all test files that reference them.

**Files to change:**
1. `frontend/src/store/useAppStore.ts` — remove interface members (lines 27–28) and state initializer (lines 55–56)
2. `frontend/src/store/__tests__/useAppStore.test.ts` — remove the `searchQuery` describe block (lines 62–73), remove `searchQuery: ''` from `beforeEach setState` call (line 12)

**Risk:** The test file's `beforeEach` block resets store state including `searchQuery: ''`. Removing `searchQuery` from the store while leaving `searchQuery: ''` in `setState` will cause a TypeScript compile error (unknown property). Both files must be updated atomically.

**Grep check needed at plan time:** Confirm no other file references `searchQuery` or `setSearchQuery`:
```bash
grep -r "searchQuery\|setSearchQuery" frontend/src/
```
From full inspection of all .tsx and .ts files, no references found outside the two files listed above.

### Anti-Patterns to Avoid

- **ENTRYPOINT without exec:** `ENTRYPOINT ["sh", "-c", "alembic upgrade head && uvicorn ..."]` — the shell stays as PID 1, absorbs SIGTERM, uvicorn gets SIGKILL after timeout. Use `exec` for the final process.
- **Running migrations in the worker service too:** Worker does not serve HTTP traffic and does not need to run migrations. Only the backend service needs the entrypoint. Worker and backend share the same image, so override only the backend CMD, not both.
- **Deleting searchQuery from interface but not from test setState:** TypeScript will catch this at compile time, but it must be fixed or tests will fail.
- **Adding a `command:` override in docker-compose.yml AND an ENTRYPOINT in Dockerfile:** These conflict. Choose one approach. Entrypoint.sh is recommended (portable).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Migration sequencing | Custom SQL schema creation scripts | Alembic `upgrade head` | Alembic already configured with all migrations; re-implementing schema creation creates drift risk |
| Process supervision in Docker | Shell loops, PID file management | `exec` in entrypoint.sh | Standard POSIX pattern; Docker handles restart policy |
| Worker readiness detection | Polling `workerRef.current` in a loop | React state pattern already established (satWorker useState in App.tsx) | Worker readiness is already propagated via `onWorkerReady` callback; no new mechanism needed |

---

## Common Pitfalls

### Pitfall 1: Alembic Cannot Connect on Container Start

**What goes wrong:** `alembic upgrade head` in `entrypoint.sh` runs before PostgreSQL is ready, fails with connection refused, and the backend container exits.

**Why it happens:** Docker `depends_on: condition: service_healthy` ensures the backend service does not START until postgres is healthy, but "start" means the container is launched — not that the entrypoint has already succeeded. In practice, postgres is healthy by the time `entrypoint.sh` runs. However, on very slow hosts or first boot, there can be a race.

**How to avoid:** The existing `depends_on: postgres: condition: service_healthy` in docker-compose.yml is sufficient in practice. The `set -e` in `entrypoint.sh` ensures a failed migration causes a container exit (Docker restarts it). Add a short retry loop only if empirically needed:
```bash
#!/bin/sh
set -e
until alembic upgrade head; do
  echo "Waiting for database..."
  sleep 2
done
exec uvicorn app.main:app --host 0.0.0.0 --port 8000
```
The simple (no retry) version is acceptable for this homelab use case.

**Warning signs:** Backend container exits immediately with non-zero code on first `docker compose up`.

### Pitfall 2: Worker Service Also Gets Entrypoint

**What goes wrong:** Worker service also runs `alembic upgrade head` before starting. Two migration processes race on the same database. Alembic uses an advisory lock so this is safe, but it wastes startup time and generates confusing logs.

**Why it happens:** Worker and backend share the same Docker image. If ENTRYPOINT is baked into the image, both services run migrations.

**How to avoid:** Override the worker command in docker-compose.yml to bypass the entrypoint:
```yaml
worker:
  command: ["python", "-m", "app.worker"]
  # ENTRYPOINT is overridden by command in Docker semantics when using exec form
```
Actually in Docker: `command` in compose overrides CMD, not ENTRYPOINT. To fully bypass entrypoint, use `entrypoint: []` override in the worker service. Simpler alternative: keep the backend CMD in Dockerfile (`CMD ["uvicorn", ...]`) and override the backend service's command in compose to run the entrypoint script — but this is the same complexity. Recommended: use `ENTRYPOINT` only for backend, keep worker service using image default CMD pattern by adding `entrypoint: ["python", "-m", "app.worker"]` override in compose for the worker service.

**Cleaner alternative (simplest):** Don't put migration in Dockerfile ENTRYPOINT at all. Instead, override only the `backend` service command in docker-compose.yml:
```yaml
backend:
  command: ["sh", "-c", "alembic upgrade head && exec uvicorn app.main:app --host 0.0.0.0 --port 8000"]
```
This leaves Dockerfile unchanged (worker is unaffected) and achieves the same result. Trade-off: migration logic lives in docker-compose.yml, not portable outside compose. For this homelab project, this is acceptable and simpler.

### Pitfall 3: searchQuery Test Cleanup Incompleteness

**What goes wrong:** `searchQuery` is removed from the store but the test file's `beforeEach` still passes `searchQuery: ''` to `useAppStore.setState`. TypeScript emits an error; `vitest run` fails.

**How to avoid:** Update both files atomically in the same task/commit.

### Pitfall 4: Alembic URL Uses asyncpg But Shell Cannot Use asyncpg

**What goes wrong:** Thinking that `alembic upgrade head` from a shell cannot use `postgresql+asyncpg://` URL.

**Reality:** `alembic/env.py` already handles this correctly. It uses `asyncio.run()` with an async engine (Phase 2 decision). The shell command `alembic upgrade head` invokes Python which runs `env.py` which uses asyncio — this works fine from an entrypoint script. Confirmed by Phase 2 decision: "Alembic env.py uses asyncio.run() with async engine and run_sync."

---

## Code Examples

### Entrypoint Script (new file: backend/entrypoint.sh)
```bash
#!/bin/sh
# Run database migrations before starting the application.
# 'set -e' exits immediately if alembic upgrade fails.
set -e
alembic upgrade head
exec uvicorn app.main:app --host 0.0.0.0 --port 8000
```

### Dockerfile Update (backend/Dockerfile)
```dockerfile
FROM python:3.12-slim AS base
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

FROM base AS dev
COPY requirements-dev.txt .
RUN pip install --no-cache-dir -r requirements-dev.txt

FROM base AS production
COPY . .
# CMD line removed — command is now in docker-compose.yml per-service
```

### docker-compose.yml backend service command override (alternative to entrypoint.sh)
```yaml
backend:
  build:
    context: ./backend
    target: production
  command: ["sh", "-c", "alembic upgrade head && exec uvicorn app.main:app --host 0.0.0.0 --port 8000"]
  depends_on:
    postgres:
      condition: service_healthy
```

### SearchBar null guard feedback (SearchBar.tsx — enhance existing guard)
```typescript
if (workerRef.current) {
  workerRef.current.postMessage({
    type: 'GET_POSITION',
    payload: { norad: satMatch.norad_cat_id },
  });
} else {
  // Worker not yet ready — satellite data still loading
  setStatus(`Satellite: ${name} (loading position...)`);
}
```

### Dead store removal (useAppStore.ts — lines to delete)
```typescript
// DELETE from interface AppState:
searchQuery: string;
setSearchQuery: (q: string) => void;

// DELETE from create<AppState> initializer:
searchQuery: '',
setSearchQuery: (q) => set({ searchQuery: q }),
```

### Test cleanup (useAppStore.test.ts — lines to delete)
```typescript
// DELETE from beforeEach setState call:
searchQuery: '',

// DELETE entire describe block:
describe('searchQuery', () => { ... });
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual `alembic upgrade head` before first use | Automated via entrypoint.sh on every `docker compose up` | Phase 6 | Clean deploy from checkout |
| Silent fly-to failure when worker null | Status message "loading position..." shown to user | Phase 6 | UX clarity |
| Dead `searchQuery` slice in store | Removed entirely | Phase 6 | Cleaner store, no dead types |

---

## Open Questions

1. **Entrypoint approach: Dockerfile ENTRYPOINT vs docker-compose command override**
   - What we know: Both work. ENTRYPOINT in Dockerfile requires worker service override. Command in docker-compose.yml only affects compose deployments.
   - What's unclear: Whether this project will ever be deployed outside of compose (e.g., Kubernetes, raw Docker). For homelab/VPS use, compose-only is standard.
   - Recommendation: Use docker-compose command override for the backend service — simpler, zero Dockerfile changes, worker unaffected. If portability is needed later, migrate to entrypoint.sh.

2. **SearchBar null guard: is there actually a thrown error?**
   - What we know: The audit says "posts GET_POSITION to workerRef.current without guarding for null worker." Direct code inspection shows the guard IS at line 52: `if (workerRef.current)`. The code inside the if block is safe.
   - What's unclear: Whether the audit describes a pre-Phase-4 state or whether there's a path where `workerRef.current` is accessed without the guard.
   - Recommendation: The planner should verify by reading SearchBar.tsx lines 42–60 in context. If the guard already exists, the fix is only the UX feedback enhancement (else branch with status message). If no guard exists (audit is accurate), add the guard.

3. **backend/.env: already resolved?**
   - What we know: `backend/.env` exists (confirmed by `Glob` returning `/Users/joaoribeiro/Desktop/INTELLIGENCE GLOBE/backend/.env`) with correct DATABASE_URL matching compose defaults. `backend/.env.example` also exists.
   - What's unclear: Whether tests currently pass without manual DATABASE_URL export.
   - Recommendation: Success criterion 4 ("backend/.env exists for local test runs; tests pass without manual DATABASE_URL export") is already met. The plan task should verify (run `python3.11 -m pytest` from `backend/`) and document the confirmation — no code change needed.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework (backend) | pytest with pytest-asyncio, asyncio_mode = auto |
| Framework (frontend) | Vitest (configured in vite.config.ts `test` block) |
| Backend config file | `backend/pytest.ini` |
| Frontend config file | `frontend/vite.config.ts` (test block) |
| Backend quick run | `cd backend && python3.11 -m pytest tests/ -x -q` |
| Frontend quick run | `cd frontend && npx vitest run` |
| Full backend suite | `cd backend && python3.11 -m pytest` |
| Full frontend suite | `cd frontend && npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| INFRA-01 | `docker compose up` migrates tables automatically — no manual step | smoke (manual docker test) | `docker compose up -d && docker compose exec backend python -c "import asyncio; from app.db import AsyncSessionLocal; from sqlalchemy import text; asyncio.run(AsyncSessionLocal().__aenter__())" ` | Manual only — table existence confirmed via `test_satellite_table_exists` in existing `test_satellites.py` |
| INFRA-02 | satellites and aircraft tables exist after `docker compose up` | integration | `cd backend && python3.11 -m pytest tests/test_satellites.py::test_satellite_table_exists tests/test_db.py -x` | ✅ `backend/tests/test_satellites.py` |
| SAT-03 | SearchBar null guard does not throw when worker is null | unit | `cd frontend && npx vitest run src/components/__tests__/SearchBar.nullguard.test.tsx` | ❌ Wave 0 — create `frontend/src/components/__tests__/SearchBar.nullguard.test.tsx` |

### Sampling Rate

- **Per task commit:** `cd backend && python3.11 -m pytest -x -q && cd ../frontend && npx vitest run`
- **Per wave merge:** Full backend + frontend suite
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `frontend/src/components/__tests__/SearchBar.nullguard.test.tsx` — covers SAT-03 null worker case. Test should render SearchBar with `workerRef = { current: null }`, simulate a search query that matches a satellite, and assert no error is thrown and status message contains "loading" (or similar).
- [ ] `frontend/src/store/__tests__/useAppStore.test.ts` — needs update to remove `searchQuery` references after dead slice removal. This is not a new file but a required modification to an existing test.

*(No new backend test files needed — existing `test_satellites.py::test_satellite_table_exists` covers INFRA-02 table existence.)*

---

## Sources

### Primary (HIGH confidence)

- Direct codebase inspection — `backend/Dockerfile`, `docker-compose.yml`, `backend/alembic/env.py`, `backend/alembic/versions/*.py`, `backend/app/main.py`, `backend/app/db.py`, `backend/app/config.py` — all read in full
- Direct codebase inspection — `frontend/src/components/SearchBar.tsx`, `frontend/src/store/useAppStore.ts`, `frontend/src/store/__tests__/useAppStore.test.ts` — all read in full
- `.planning/v1.0-MILESTONE-AUDIT.md` — audit findings that defined this phase
- `.planning/STATE.md` — project decisions (python3.11 for tests, async Alembic env.py pattern)

### Secondary (MEDIUM confidence)

- Docker ENTRYPOINT + exec pattern — standard Docker best practice, well-documented in official Docker docs (https://docs.docker.com/reference/dockerfile/#entrypoint); not verified via WebFetch but HIGH confidence given stability of this pattern

### Tertiary (LOW confidence)

- None — all findings are based on direct code inspection of the actual project files.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependencies; all tools already in project
- Architecture: HIGH — entrypoint.sh and null guard patterns derived from direct code inspection and audit findings
- Pitfalls: HIGH — derived from known Docker and Alembic behaviors, confirmed against actual project configuration

**Research date:** 2026-03-11
**Valid until:** 2026-06-11 (stable domain — Docker entrypoint patterns and Alembic do not change frequently)
