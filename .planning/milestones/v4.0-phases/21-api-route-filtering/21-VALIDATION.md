---
phase: 21
slug: api-route-filtering
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-13
---

# Phase 21 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest + pytest-asyncio (asyncio_mode=auto) |
| **Config file** | `backend/pytest.ini` |
| **Quick run command** | `cd backend && python -m pytest tests/test_military.py tests/test_ships.py tests/test_gps_jamming.py -x -q` |
| **Full suite command** | `cd backend && python -m pytest -x -q` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd backend && python -m pytest tests/test_military.py tests/test_ships.py tests/test_gps_jamming.py -x -q`
- **After every plan wave:** Run `cd backend && python -m pytest -x -q`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** ~15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 21-01-01 | 01 | 0 | MIL-02 | integration | `cd backend && python -m pytest tests/test_military.py -x -q` | ❌ W0 | ⬜ pending |
| 21-01-02 | 01 | 0 | SHIP-02 | integration | `cd backend && python -m pytest tests/test_ships.py -x -q` | ❌ W0 | ⬜ pending |
| 21-01-03 | 01 | 0 | JAM-02, JAM-03 | integration | `cd backend && python -m pytest tests/test_gps_jamming.py -x -q` | ❌ W0 | ⬜ pending |
| 21-02-01 | 02 | 1 | MIL-02 | integration | `cd backend && python -m pytest tests/test_military.py -x -q` | ✅ | ⬜ pending |
| 21-02-02 | 02 | 1 | SHIP-02 | integration | `cd backend && python -m pytest tests/test_ships.py -x -q` | ✅ | ⬜ pending |
| 21-03-01 | 03 | 1 | JAM-02, JAM-03 | integration | `cd backend && python -m pytest tests/test_gps_jamming.py -x -q` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/test_military.py` — add failing tests for MIL-02 filter behavior (active-only + freshness filter, `fetched_at`/`is_stale` in response)
- [ ] `tests/test_ships.py` — add failing tests for SHIP-02 filter behavior (active-only + freshness filter, `last_seen_at`/`fetched_at`/`is_stale` in response)
- [ ] `tests/test_gps_jamming.py` — add failing tests for JAM-02 envelope fields and JAM-03 stale-cells-returned behavior

Note: All three test files already exist. No new files need to be created. The existing shape/status tests (`test_list_military`, `test_list_ships`, `test_gps_jamming_route`) are preserved.

---

## Manual-Only Verifications

*All phase behaviors have automated verification.*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
