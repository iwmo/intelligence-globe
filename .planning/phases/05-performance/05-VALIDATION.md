---
phase: 5
slug: performance
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-11
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Backend framework** | pytest 8.x with pytest-asyncio (asyncio_mode = auto) |
| **Backend config** | `backend/pytest.ini` |
| **Frontend framework** | vitest 4.0.18 |
| **Frontend config** | `vite.config.ts` (test.environment: jsdom, globals: true) |
| **Quick run command** | `python3.11 -m pytest tests/test_performance.py -x` + `npx vitest run src/workers/__tests__/` |
| **Full suite command** | `python3.11 -m pytest tests/ -x` + `npx vitest run` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `python3.11 -m pytest tests/test_performance.py -x` + `npx vitest run src/workers/__tests__/`
- **After every plan wave:** Run `python3.11 -m pytest tests/ -x` + `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green + manual FPS checklist confirmed
- **Max feedback latency:** ~30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 5-01-01 | 01 | 1 | INFRA-03 | Static analysis | `grep -r "BlendOption.OPAQUE" src/` | ✅ after fix | ⬜ pending |
| 5-01-02 | 01 | 1 | INFRA-03 | Manual (Chrome DevTools) | N/A — browser-only | N/A | ⬜ pending |
| 5-02-01 | 02 | 1 | INFRA-03 | Integration | `python3.11 -m pytest tests/test_performance.py::test_aircraft_list_latency -x` | ❌ W0 | ⬜ pending |
| 5-02-02 | 02 | 1 | INFRA-03 | DB migration | `python3.11 -m pytest tests/test_performance.py -x` | ❌ W0 | ⬜ pending |
| 5-03-01 | 03 | 2 | INFRA-03 | Unit (vitest) | `npx vitest run src/workers/__tests__/propagation.test.ts` | ❌ W0 | ⬜ pending |
| 5-03-02 | 03 | 2 | INFRA-03 | Unit (vitest) | `npx vitest run src/components/__tests__/SatelliteLayer.cleanup.test.tsx` | ❌ W0 | ⬜ pending |
| 5-03-03 | 03 | 2 | INFRA-03 | Static/grep audit | `grep -r "EntityCollection\|viewer.entities" src/` | N/A — code review | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `backend/tests/test_performance.py` — stubs for INFRA-03 query latency
- [ ] `frontend/src/workers/__tests__/propagation.test.ts` — covers INFRA-03 ISS ground track ECI/ECEF validation (imports `satellite.js` directly, no worker transport)
- [ ] `frontend/src/components/__tests__/SatelliteLayer.cleanup.test.tsx` — covers INFRA-03 viewer cleanup (vitest with jsdom + mocked Cesium primitives)
- [ ] Alembic migration file for aircraft lat/lon partial B-tree index

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| 60 FPS with 5,000+ satellites + hundreds of aircraft simultaneously | INFRA-03 | Requires running browser with live data — no headless equivalent | Open Chrome DevTools > Performance, record with full satellite catalog active, confirm sustained ≥60 FPS |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
