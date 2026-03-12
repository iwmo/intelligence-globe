# Deferred Items — Phase 09

## Pre-existing Failures (out of scope for Plan 02)

### test_military_detail returns 200 instead of 404

- **File:** backend/tests/test_military.py::test_military_detail
- **Discovered:** Plan 02, Task 2 (during full suite run)
- **Status:** Pre-existing failure — existed before Plan 02 changes
- **Issue:** GET /api/military/ae1234 returns 200 (empty result) instead of 404 for unknown hex
- **Resolution needed:** routes_military.py detail endpoint should raise HTTPException(404) when hex not found
- **Verified pre-existing:** git stash confirmed same failure on unmodified code
