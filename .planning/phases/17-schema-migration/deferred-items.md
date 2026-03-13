# Deferred Items — Phase 17 Schema Migration

## Pre-existing test failure (out of scope for 17-01)

**File:** `backend/tests/test_military.py::test_military_detail`
**Failure:** `assert 200 == 404` — the detail route returns 200 for unknown hex instead of 404
**Pre-existing:** Yes — failure confirmed before any 17-01 changes (verified via git stash)
**Not caused by:** 17-01 model or migration changes
**Recommended fix:** The `/api/military/{hex}` route handler needs to check if the record exists and raise `HTTPException(status_code=404)` when not found. Likely returning an empty response body instead of 404.
**Priority:** Low (cosmetic API behavior) — does not block v4.0 data reliability work
