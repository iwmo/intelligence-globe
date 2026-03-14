---
phase: 28-api-key-auth
plan: 01
subsystem: auth
tags: [fastapi, api-key, http-header, pytest, tdd]

# Dependency graph
requires:
  - phase: 27-secrets-cleanup
    provides: API_KEY env var present in .env.example
provides:
  - verify_api_key FastAPI dependency function in backend/app/api/deps.py
  - Settings.api_key field loaded from API_KEY env var (fail-secure default "")
  - POST /api/osint-events protected by X-API-Key header, returns 201 on success
  - Six-test suite covering auth: no-key (401), wrong-key (401), correct-key (201), list (200), invalid-category (422)
affects: [29-production-docker, 30-ci-pipeline]

# Tech tracking
tech-stack:
  added: []
  patterns: [FastAPI dependency injection for route-level auth, fail-secure empty-default for secrets]

key-files:
  created:
    - backend/app/api/deps.py
  modified:
    - backend/app/config.py
    - backend/app/api/routes_osint.py
    - backend/tests/test_osint.py

key-decisions:
  - "Header parameter is Optional[str] with default=None so absent header yields 401 not 422"
  - "test_invalid_category updated to pass correct API key — auth runs before Pydantic validation, so valid key required to reach 422 code path"

patterns-established:
  - "Auth via reusable dep: import verify_api_key from app.api.deps; add to route as dependencies=[Depends(verify_api_key)]"
  - "monkeypatch.setattr on module-level singleton (not setenv) for test isolation — settings is already instantiated at import time"

requirements-completed: [SEC-04]

# Metrics
duration: 15min
completed: 2026-03-14
---

# Phase 28 Plan 01: API Key Auth Summary

**Static X-API-Key header auth on POST /api/osint-events via reusable FastAPI dependency, with fail-secure empty default and full TDD coverage (6 tests green)**

## Performance

- **Duration:** 15 min
- **Started:** 2026-03-14T07:20:00Z
- **Completed:** 2026-03-14T07:35:00Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- Created `backend/app/api/deps.py` with `verify_api_key` dependency — reusable for future write routes
- Added `api_key: str = ""` to Settings (fail-secure: empty default blocks all POSTs until operator sets API_KEY)
- Protected POST /api/osint-events with `dependencies=[Depends(verify_api_key)], status_code=201`
- Full backend suite green: 98 passed, 2 skipped — no regressions

## Task Commits

Each task was committed atomically:

1. **Task 1: Add api_key to Settings and create deps.py** - `45e6b76` (test — TDD RED phase)
2. **Task 2: Wire auth onto POST route and verify green suite** - `100bf4d` (feat — TDD GREEN phase)

**Plan metadata:** (docs commit — see below)

_Note: TDD tasks have two commits (RED test scaffold, then GREEN implementation)_

## Files Created/Modified

- `backend/app/api/deps.py` — `verify_api_key` async dependency; raises 401 on missing/wrong X-API-Key
- `backend/app/config.py` — `api_key: str = ""` field added to Settings class
- `backend/app/api/routes_osint.py` — POST decorator now has `dependencies=[Depends(verify_api_key)], status_code=201`
- `backend/tests/test_osint.py` — Three new auth tests + updated test_create_event + fixed test_invalid_category

## Decisions Made

- Header parameter uses `Optional[str] = Header(default=None)` rather than `str = Header(...)` so that absent header yields 401 (not FastAPI's 422 automatic response). Both reject the request but 401 is semantically correct and the test asserts 401.
- `monkeypatch.setattr("app.config.settings.api_key", ...)` not `monkeypatch.setenv` — settings singleton is instantiated at import time, env vars set after import have no effect.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed test_invalid_category after auth added to POST route**
- **Found during:** Task 2 (wire auth onto POST route)
- **Issue:** `test_invalid_category` sent no API key, so it received 401 (auth rejection) instead of 422 (Pydantic validation). Auth dependency runs before the request body is parsed, so an invalid category is never reached without a valid key.
- **Fix:** Added `monkeypatch` parameter, set `api_key` to `"correct-key"`, and added `X-API-Key` header to the request. The test now correctly verifies that an authenticated request with a bad category returns 422.
- **Files modified:** `backend/tests/test_osint.py`
- **Verification:** `pytest tests/test_osint.py` — 6 passed
- **Committed in:** `100bf4d` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 — bug in test logic)
**Impact on plan:** Fix was necessary for correctness — the test was asserting a behavior that auth made unreachable without a key. No scope creep.

## Issues Encountered

None beyond the test_invalid_category auto-fix documented above.

## User Setup Required

Operator must set `API_KEY` environment variable before running the backend in production. Without it, `settings.api_key` is `""` and all POST /api/osint-events requests are rejected with 401 (fail-secure behavior).

Add to `.env`:
```
API_KEY=<your-secret-key>
```

## Next Phase Readiness

- SEC-04 complete — OSINT write endpoint is protected
- `verify_api_key` dependency is reusable for any future write route (import from `app.api.deps`)
- Phase 29 (Production Docker) and Phase 30 (CI Pipeline) can proceed

---
*Phase: 28-api-key-auth*
*Completed: 2026-03-14*
