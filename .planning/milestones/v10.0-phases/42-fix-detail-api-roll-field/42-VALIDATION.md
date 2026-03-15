---
phase: 42
slug: fix-detail-api-roll-field
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-15
---

# Phase 42 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest + pytest-asyncio (backend); Vitest (frontend) |
| **Config file** | `backend/pytest.ini` / `pyproject.toml` (backend); `frontend/vitest.config.ts` (frontend) |
| **Quick run command** | `cd backend && pytest tests/test_aircraft.py -x -q` |
| **Full suite command** | `cd backend && pytest -x -q` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd backend && pytest tests/test_aircraft.py -x -q`
- **After every plan wave:** Run `cd backend && pytest -x -q`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** ~5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 42-01-01 | 01 | 1 | SC-1: `roll` in detail response | integration | `cd backend && pytest tests/test_aircraft.py::test_aircraft_detail -x` | ✅ (extends existing) | ⬜ pending |
| 42-01-02 | 01 | 1 | SC-2: `AircraftDetail.roll` typed | type-check | `cd frontend && npx tsc --noEmit` | ✅ (extends existing) | ⬜ pending |
| 42-01-03 | 01 | 1 | SC-3: no regressions | integration | `cd backend && pytest tests/test_aircraft.py -x -q` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

*Existing infrastructure covers all phase requirements. `test_aircraft_detail` in `test_aircraft.py` will be extended in-place; no new files needed.*

---

## Manual-Only Verifications

*All phase behaviors have automated verification.*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
