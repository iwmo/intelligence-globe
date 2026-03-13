---
phase: 20
slug: military-ships-jamming-ingest
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-13
---

# Phase 20 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest 7.x (asyncio) |
| **Config file** | `backend/pytest.ini` or `backend/pyproject.toml` |
| **Quick run command** | `cd backend && python -m pytest tests/test_ingest_military.py tests/test_ingest_ais.py tests/test_gps_jamming.py -x -q` |
| **Full suite command** | `cd backend && python -m pytest -x -q` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd backend && python -m pytest tests/test_ingest_military.py tests/test_ingest_ais.py tests/test_gps_jamming.py -x -q`
- **After every plan wave:** Run `cd backend && python -m pytest -x -q`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 20-01-01 | 01 | 1 | MIL-01 | unit | `cd backend && python -m pytest tests/test_ingest_military.py -x -q -k "fetched_at or last_seen_at or is_active"` | ✅ | ⬜ pending |
| 20-01-02 | 01 | 1 | MIL-01 | unit | `cd backend && python -m pytest tests/test_ingest_military.py -x -q -k "tombstone"` | ✅ | ⬜ pending |
| 20-02-01 | 02 | 2 | SHIP-01 | unit | `cd backend && python -m pytest tests/test_ingest_ais.py -x -q -k "last_seen_at or is_active"` | ✅ | ⬜ pending |
| 20-02-02 | 02 | 2 | SHIP-01 | unit | `cd backend && python -m pytest tests/test_ingest_ais.py -x -q -k "deactivation or tombstone"` | ✅ | ⬜ pending |
| 20-03-01 | 03 | 3 | JAM-01 | unit | `cd backend && python -m pytest tests/test_gps_jamming.py -x -q -k "active_only or is_active"` | ✅ | ⬜ pending |
| 20-03-02 | 03 | 3 | JAM-01 | unit | `cd backend && python -m pytest tests/test_gps_jamming.py -x -q -k "aggregated_at or source_fetched_at or source_is_stale"` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. No new test files needed — all test cases are added to existing test files:
- `backend/tests/test_ingest_military.py` — existing, extend with MIL-01 cases
- `backend/tests/test_ingest_ais.py` — existing, extend with SHIP-01 cases
- `backend/tests/test_gps_jamming.py` — existing, extend with JAM-01 cases

*Wave 0 installs no new framework — pytest already available.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Military tombstone fires after real poll cycle | MIL-01 | Requires live airplanes.live API call | After deploy, watch DB: `SELECT hex, is_active FROM military_aircraft ORDER BY updated_at DESC LIMIT 20` — confirm previously-seen hex gone from API has `is_active=false` |
| AIS deactivation fires after Redis TTL expiry | SHIP-01 | Requires real Redis TTL to expire | After deploy, wait for AIS flush cycle, check: `SELECT mmsi, is_active FROM ships WHERE is_active=false LIMIT 5` — should populate |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
