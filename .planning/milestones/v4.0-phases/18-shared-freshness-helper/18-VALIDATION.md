---
phase: 18
slug: shared-freshness-helper
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-13
---

# Phase 18 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest 8.x + pytest-asyncio 0.24 |
| **Config file** | `backend/pytest.ini` — `asyncio_mode = auto`, `testpaths = tests` |
| **Quick run command** | `cd backend && pytest tests/test_freshness.py -x` |
| **Full suite command** | `cd backend && pytest` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd backend && pytest tests/test_freshness.py -x`
- **After every plan wave:** Run `cd backend && pytest`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** ~5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 18-01-01 | 01 | 0 | FRESH-01 | unit | `cd backend && pytest tests/test_freshness.py -x` | ❌ W0 | ⬜ pending |
| 18-01-02 | 01 | 1 | FRESH-01 | unit | `cd backend && pytest tests/test_freshness.py::test_stale_cutoff_exact_offset -x` | ❌ W0 | ⬜ pending |
| 18-01-03 | 01 | 1 | FRESH-01 | unit | `cd backend && pytest tests/test_freshness.py::test_is_stale_none_is_stale -x` | ❌ W0 | ⬜ pending |
| 18-01-04 | 01 | 1 | FRESH-01 | unit | `cd backend && pytest tests/test_freshness.py::test_is_stale_boundary_exactly_at_cutoff -x` | ❌ W0 | ⬜ pending |
| 18-02-01 | 02 | 1 | FRESH-02 | unit | `cd backend && pytest tests/test_freshness.py::test_settings_defaults -x` | ❌ W0 | ⬜ pending |
| 18-02-02 | 02 | 1 | FRESH-02 | unit | `cd backend && pytest tests/test_freshness.py::test_settings_env_override -x` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/test_freshness.py` — stubs for FRESH-01 and FRESH-02 (import test, stale_cutoff exact offset, is_stale None, is_stale boundary, settings defaults, settings env override)

*Existing infrastructure covers all other phase requirements.*

---

## Manual-Only Verifications

*All phase behaviors have automated verification.*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
