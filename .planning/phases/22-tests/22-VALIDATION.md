---
phase: 22
slug: tests
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-13
---

# Phase 22 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest 7.x |
| **Config file** | backend/pytest.ini or pyproject.toml |
| **Quick run command** | `docker compose exec backend pytest tests/ -q` |
| **Full suite command** | `docker compose exec backend pytest tests/ -v` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `docker compose exec backend pytest tests/ -q`
- **After every plan wave:** Run `docker compose exec backend pytest tests/ -v`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 22-01-01 | 01 | 1 | TEST-06 | unit | `docker compose exec backend pytest tests/test_freshness.py -q` | ✅ | ⬜ pending |
| 22-01-02 | 01 | 1 | TEST-01 | integration | `docker compose exec backend pytest tests/test_aircraft.py -q` | ✅ | ⬜ pending |
| 22-02-01 | 02 | 1 | TEST-03 | integration | `docker compose exec backend pytest tests/test_military.py -q` | ✅ | ⬜ pending |
| 22-02-02 | 02 | 1 | TEST-04 | integration | `docker compose exec backend pytest tests/test_ships.py -q` | ✅ | ⬜ pending |
| 22-03-01 | 03 | 2 | TEST-05 | integration | `docker compose exec backend pytest tests/test_gps_jamming.py -q` | ✅ | ⬜ pending |
| 22-03-02 | 03 | 2 | TEST-02 | integration | `docker compose exec backend pytest tests/test_aircraft.py -q` | ✅ | ⬜ pending |
| 22-04-01 | 04 | 3 | TEST-07 | regression | `docker compose exec backend pytest tests/ -q` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. All test files and Docker environment are already in place.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Docker backend is running | All | Container required for pytest | Run `docker compose up -d` before testing |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
