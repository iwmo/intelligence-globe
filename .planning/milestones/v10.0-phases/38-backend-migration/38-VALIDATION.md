---
phase: 38
slug: backend-migration
status: complete
nyquist_compliant: true
wave_0_complete: true
created: 2026-03-15
---

# Phase 38 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest + pytest-asyncio |
| **Config file** | `backend/pytest.ini` |
| **Quick run command** | `cd backend && python -m pytest tests/test_ingest_adsbiol.py -x -q` |
| **Full suite command** | `cd backend && python -m pytest -x -q` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd backend && python -m pytest tests/test_ingest_adsbiol.py -x -q`
- **After every plan wave:** Run `cd backend && python -m pytest -x -q`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** ~10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 38-01-01 | 01 | 0 | INGEST-01 | unit | `pytest tests/test_ingest_adsbiol.py::test_null_position_filtered -x` | ✅ | ✅ green |
| 38-01-02 | 01 | 0 | INGEST-01 | unit | `pytest tests/test_ingest_adsbiol.py::test_parse_commercial_aircraft -x` | ✅ | ✅ green |
| 38-01-03 | 01 | 0 | INGEST-02 | unit | `pytest tests/test_ingest_adsbiol.py::test_military_url_has_filter_mil -x` | ✅ | ✅ green |
| 38-01-04 | 01 | 0 | INGEST-03 | unit | `pytest tests/test_ingest_adsbiol.py::test_base_url_configurable -x` | ✅ | ✅ green |
| 38-01-05 | 01 | 0 | INGEST-04 | unit | `pytest tests/test_ingest_adsbiol.py::test_no_opensky_references -x` | ✅ | ✅ green |
| 38-01-06 | 01 | 0 | INGEST-05 | unit | `pytest tests/test_ingest_adsbiol.py::test_bbox_param_format -x` | ✅ | ✅ green |
| 38-01-07 | 01 | 0 | INGEST-05 | unit | `pytest tests/test_ingest_adsbiol.py::test_no_bbox_when_redis_empty -x` | ✅ | ✅ green |
| 38-01-08 | 01 | 0 | SCHEMA-01 | unit | `pytest tests/test_ingest_adsbiol.py::test_ground_altitude_normalised -x` | ✅ | ✅ green |
| 38-01-09 | 01 | 0 | SCHEMA-02 | unit | `pytest tests/test_ingest_adsbiol.py::test_emergency_field_stored -x` | ✅ | ✅ green |
| 38-01-10 | 01 | 0 | SCHEMA-03 | unit | `pytest tests/test_ingest_adsbiol.py::test_nav_modes_field -x` | ✅ | ✅ green |
| 38-01-11 | 01 | 0 | SCHEMA-04 | unit | `pytest tests/test_ingest_adsbiol.py::test_speed_fields -x` | ✅ | ✅ green |
| 38-01-12 | 01 | 0 | SCHEMA-05 | unit | `pytest tests/test_ingest_adsbiol.py::test_roll_field -x` | ✅ | ✅ green |
| 38-01-13 | 01 | 0 | SCHEMA-06 | unit | `pytest tests/test_ingest_adsbiol.py::test_registration_type_fields -x` | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `tests/test_ingest_adsbiol.py` — stubs for all INGEST-* and SCHEMA-* requirements (created in plan 01)
- [x] Retire or update `tests/test_ingest_aircraft.py` — module-level pytest.skip added (plan 01)

Note: Wave 0 completed in plan 01 (TDD RED phase). All 13 tests created before implementation.

*(Shared fixtures in `tests/conftest.py` already exist with NullPool DB engine — no changes needed)*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| No OpenSky or airplanes.live network requests made during aircraft ingest | INGEST-01, INGEST-02 | Requires live worker + network inspection | Run worker, inspect logs for any `opensky.org` or `airplanes.live` HTTP calls — none should appear |
| `ADSBIO_BASE_URL` env var change takes effect without code edit | INGEST-03 | Requires Docker env var swap + restart | Set `ADSBIO_BASE_URL` to a mock server, restart worker, verify ingest hits the new URL |
| Aircraft altitude values in DB are in feet after migration | SCHEMA-01 | Requires DB inspection post-migration | Query `SELECT icao24, baro_altitude FROM aircraft LIMIT 10` — values should be ~1000–45000 (feet), not ~300–14000 (metres) |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 10s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-03-15
