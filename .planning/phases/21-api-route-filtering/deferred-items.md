# Phase 21 Deferred Items

## Out-of-Scope Pre-existing Issue

**test_military_detail pre-existing failure**
- Found during: Plan 21-01 Task 1 verification (confirmed Plan 21-02)
- Issue: `GET /api/military/ae1234` returns HTTP 200 instead of 404 — hex `ae1234` literally exists as live military data in the database (a C130J aircraft). The test uses a hardcoded hex expecting it to not exist, but real data invalidates that assumption.
- Scope: Pre-existing test design issue not caused by freshness work. Out of scope for Phase 21.
- Action required: Update test fixture to use a truly non-existent hex (e.g., "00000000" or UUID-like value) or add a test-only mock/factory to isolate from live DB state.
