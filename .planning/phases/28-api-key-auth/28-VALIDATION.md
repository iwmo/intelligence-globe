---
phase: 28
slug: api-key-auth
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-14
---

# Phase 28 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest + pytest-asyncio (existing) |
| **Config file** | `backend/pytest.ini` |
| **Quick run command** | `cd backend && pytest tests/test_osint.py -x -q` |
| **Full suite command** | `cd backend && pytest -x -q` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd backend && pytest tests/test_osint.py -x -q`
- **After every plan wave:** Run `cd backend && pytest -x -q`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 28-01-01 | 01 | 0 | SEC-04 | unit | `pytest tests/test_osint.py::test_create_event_no_key -x` | ❌ W0 | ⬜ pending |
| 28-01-02 | 01 | 0 | SEC-04 | unit | `pytest tests/test_osint.py::test_create_event_wrong_key -x` | ❌ W0 | ⬜ pending |
| 28-01-03 | 01 | 0 | SEC-04 | unit | `pytest tests/test_osint.py::test_create_event_correct_key -x` | ❌ W0 | ⬜ pending |
| 28-01-04 | 01 | 1 | SEC-04 | unit | `pytest tests/test_osint.py -x -q` | ✅ exists | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/test_osint.py` — add `test_create_event_no_key`, `test_create_event_wrong_key`, `test_create_event_correct_key`; update `test_create_event` to pass `X-API-Key` header and assert exactly `201`
- [ ] `app/api/deps.py` — new file with `verify_api_key` dependency function (must exist before routes import it)

*Existing pytest infrastructure covers all other phase requirements — no new fixtures or framework installs needed.*

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
