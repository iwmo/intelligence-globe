---
phase: 6
slug: deploy-hardening
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-11
---

# Phase 6 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework (backend)** | pytest with pytest-asyncio, asyncio_mode = auto |
| **Framework (frontend)** | Vitest (configured in vite.config.ts `test` block) |
| **Backend config file** | `backend/pytest.ini` |
| **Frontend config file** | `frontend/vite.config.ts` (test block) |
| **Quick run command** | `cd backend && python3.11 -m pytest tests/ -x -q && cd ../frontend && npx vitest run` |
| **Full suite command** | `cd backend && python3.11 -m pytest && cd ../frontend && npx vitest run` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd backend && python3.11 -m pytest -x -q && cd ../frontend && npx vitest run`
- **After every plan wave:** Run full backend + frontend suite
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** ~30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 6-01-01 | 01 | 1 | INFRA-01 | integration | `cd backend && python3.11 -m pytest tests/test_satellites.py::test_satellite_table_exists tests/test_db.py -x` | ✅ `backend/tests/test_satellites.py` | ⬜ pending |
| 6-01-02 | 01 | 1 | SAT-03 | unit | `cd frontend && npx vitest run src/components/__tests__/SearchBar.nullguard.test.tsx` | ❌ Wave 0 | ⬜ pending |
| 6-01-03 | 01 | 1 | INFRA-02 | unit | `cd frontend && npx vitest run src/store/__tests__/useAppStore.test.ts` | ✅ exists (needs update) | ⬜ pending |
| 6-01-04 | 01 | 1 | INFRA-02 | integration | `cd backend && python3.11 -m pytest -x -q` | ✅ existing suite | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `frontend/src/components/__tests__/SearchBar.nullguard.test.tsx` — covers SAT-03 null worker case. Render SearchBar with `workerRef = { current: null }`, simulate search matching a satellite, assert no error thrown and status contains "loading"
- [ ] `frontend/src/store/__tests__/useAppStore.test.ts` — update to remove `searchQuery` references after dead slice removal (not a new file — required modification)

*Existing backend infrastructure covers INFRA-01 and INFRA-02 table existence tests.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| `docker compose up` from clean checkout brings all services online with tables migrated | INFRA-01 | Requires Docker daemon and full compose stack | Run `docker compose down -v && docker compose up -d`, wait for all services healthy, confirm backend logs show `alembic upgrade head` succeeded, hit `GET /api/v1/satellites` returns 200 |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
