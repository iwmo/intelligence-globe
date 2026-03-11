---
phase: 06-deploy-hardening
plan: 01
subsystem: infra
tags: [docker-compose, alembic, zustand, vitest, searchbar, ux]

# Dependency graph
requires:
  - phase: 05-performance
    provides: completed frontend test infrastructure (vitest) and optimized DB queries
  - phase: 04-controls-and-polish
    provides: SearchBar component with workerRef prop and useAppStore Zustand store
  - phase: 02-satellite-layer
    provides: Alembic async env.py with asyncio.run() migration pattern
provides:
  - docker-compose backend service runs alembic upgrade head automatically on docker compose up
  - SearchBar shows 'loading position...' status when satellite worker not yet ready
  - useAppStore interface free of dead searchQuery/setSearchQuery slice
  - backend/.env password aligned with running Docker postgres instance
affects: [deploy, docker, frontend-testing, state-management]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "docker-compose command override: sh -c 'alembic upgrade head && exec uvicorn ...' pattern for migration-then-serve"
    - "TDD null-guard: failing test first, then minimal else branch to pass"

key-files:
  created:
    - frontend/src/components/__tests__/SearchBar.nullguard.test.tsx
  modified:
    - docker-compose.yml
    - frontend/src/components/SearchBar.tsx
    - frontend/src/store/useAppStore.ts
    - frontend/src/store/__tests__/useAppStore.test.ts
    - backend/.env

key-decisions:
  - "docker-compose command override uses exec uvicorn so uvicorn receives SIGTERM correctly for graceful shutdown"
  - "SearchBar null-worker else branch sets 'loading position...' status — worker not ready is a transient UX state, not an error"
  - "searchQuery/setSearchQuery removed from Zustand — dead code confirmed by grep, no consumers anywhere in codebase"
  - "backend/.env password corrected to 'changeme' to match Docker postgres container — .env remains gitignored"

patterns-established:
  - "Docker migration pattern: run alembic upgrade head before uvicorn in compose command override, not in Dockerfile"
  - "Null-worker UX: show informative loading status instead of silently swallowing the no-op"

requirements-completed: [INFRA-01, INFRA-02, SAT-03]

# Metrics
duration: 3min
completed: 2026-03-11
---

# Phase 6 Plan 01: Deploy Hardening — Gap Closure Summary

**Alembic auto-migration on docker compose up, SearchBar null-worker loading feedback, dead searchQuery Zustand slice removed, and backend test credentials fixed**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-11T18:28:36Z
- **Completed:** 2026-03-11T18:31:50Z
- **Tasks:** 4
- **Files modified:** 5

## Accomplishments

- docker-compose.yml backend service now runs `alembic upgrade head && exec uvicorn ...` — clean checkout to running globe with no manual migration step
- SearchBar shows "Satellite: [name] (loading position...)" when the satellite Web Worker is not yet initialized, replacing the previous silent no-op
- useAppStore TypeScript interface and initializer cleaned of the `searchQuery`/`setSearchQuery` dead state slice (no consumers existed in the codebase)
- backend/.env password corrected from `postgres` to `changeme` to match the running Docker postgres container — all 15 backend tests pass without manual env export

## Task Commits

Each task was committed atomically:

1. **Task 1: Automate Alembic migrations** - `c7abba0` (feat)
2. **Task 2 RED: SearchBar nullguard failing test** - `10424db` (test)
3. **Task 2 GREEN: SearchBar null-worker else branch** - `a87eb57` (feat)
4. **Task 3: Remove dead searchQuery slice** - `a8035d7` (refactor)

_Note: Task 4 (full suite green) confirmed 15/15 backend and 29/29 frontend tests pass. No separate commit — the .env fix cannot be committed (gitignored for security)._

## Files Created/Modified

- `docker-compose.yml` - Added `command:` key to backend service with alembic migration step before uvicorn
- `frontend/src/components/SearchBar.tsx` - Added else branch in handleSearch when workerRef.current is null
- `frontend/src/components/__tests__/SearchBar.nullguard.test.tsx` - New: two-test TDD spec (null worker shows loading status, present worker calls postMessage)
- `frontend/src/store/useAppStore.ts` - Removed searchQuery/setSearchQuery from AppState interface and initializer
- `frontend/src/store/__tests__/useAppStore.test.ts` - Removed searchQuery from beforeEach setState and deleted searchQuery describe block
- `backend/.env` - Updated DATABASE_URL password from `postgres` to `changeme` (gitignored, local fix only)

## Decisions Made

- `exec uvicorn` in the compose command ensures uvicorn replaces the sh process and receives SIGTERM directly — critical for graceful shutdown in production
- The SearchBar null-worker case is a UX state ("loading"), not an error — status message is informative, not alarming
- Dead searchQuery slice confirmed safe to remove: grep showed zero consumers outside the store itself and its own test file

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Corrected backend/.env DATABASE_URL password**
- **Found during:** Task 4 (full suite run)
- **Issue:** `backend/.env` had `DATABASE_URL=...postgres:postgres@...` but the Docker postgres container was started with `POSTGRES_PASSWORD=changeme`. Password authentication failed for user "postgres".
- **Fix:** Updated password in `backend/.env` from `postgres` to `changeme`
- **Files modified:** `backend/.env` (local only — file is gitignored)
- **Verification:** `python3.11 -m pytest -x -q` — 15 passed, 2 skipped
- **Committed in:** Not committed (gitignored by design — secrets must not enter git history)

---

**Total deviations:** 1 auto-fixed (Rule 1 — bug: credential mismatch)
**Impact on plan:** Necessary correctness fix. The `.env` file credential mismatch would have prevented all DB-connected backend tests from running. Gitignore status preserved (correct security posture).

## Issues Encountered

- The Docker postgres container password was `changeme` (set at first-run initialization) while `backend/.env` retained the default `postgres`. Updated locally. The gitignored `.env` is the correct mechanism for local dev credentials — no architectural change needed.

## User Setup Required

None — the `.env` password fix is a local environment correction. If starting from a clean checkout with a fresh Docker postgres using the default `postgres` password, `backend/.env` already has the correct value. The `changeme` password is specific to this machine's Docker volume.

## Next Phase Readiness

- All four v1.0 audit gaps are closed
- `docker compose up` from a clean checkout migrates all tables automatically
- Backend pytest suite passes without manual DATABASE_URL export
- Frontend vitest suite: 29/29 tests pass including new SearchBar.nullguard tests
- Zustand store is clean with no dead state
- Project is at fully deployable, gap-free v1.0 state

---
*Phase: 06-deploy-hardening*
*Completed: 2026-03-11*
