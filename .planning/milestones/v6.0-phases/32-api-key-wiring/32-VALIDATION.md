---
phase: 32
slug: api-key-wiring
status: draft
nyquist_compliant: false
wave_0_complete: true
created: 2026-03-14
---

# Phase 32 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework (backend)** | pytest 8.x + pytest-asyncio (asyncio_mode = auto) |
| **Config file (backend)** | `backend/pytest.ini` |
| **Quick run command** | `cd backend && pytest tests/test_osint.py -x` |
| **Full suite command** | `cd backend && pytest && cd ../frontend && npx vitest run` |
| **Framework (frontend)** | vitest (configured in `frontend/vite.config.ts` test block) |
| **Config file (frontend)** | `frontend/vite.config.ts` (test key) |
| **Estimated runtime** | ~15 seconds (backend pytest) + ~10 seconds (frontend vitest) |

---

## Sampling Rate

- **After every task commit:** Run `cd backend && pytest tests/test_osint.py -x`
- **After every plan wave:** Run `cd backend && pytest && cd ../frontend && npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** ~25 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 32-01-01 | 01 | 1 | SEC-04 | unit | `cd backend && pytest tests/test_osint.py -x` | ✅ | ⬜ pending |
| 32-01-02 | 01 | 1 | SEC-04 | unit | `cd backend && pytest tests/test_osint.py -x` | ✅ | ⬜ pending |
| 32-01-03 | 01 | 1 | SEC-04 | smoke | `cd frontend && npx vitest run src/components/__tests__/OsintEventPanel.test.tsx` | ✅ | ⬜ pending |
| 32-01-04 | 01 | 1 | SEC-04 | manual | docker compose smoke test | N/A | ⬜ pending |
| 32-01-05 | 01 | 1 | SEC-04 | manual | README review | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements.

- `backend/tests/test_osint.py` — 3 auth tests already exist (no-key, wrong-key, correct-key)
- `frontend/src/components/__tests__/OsintEventPanel.test.tsx` — smoke tests already exist
- `backend/pytest.ini` — pytest config already configured

*No Wave 0 stubs needed. All tests exist and pass.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| API_KEY forwarded to backend container in production | SEC-04 | Requires running docker compose stack end-to-end | `docker compose up && curl -X POST http://localhost/api/osint-events -H 'X-API-Key: <value>' -H 'Content-Type: application/json' -d '{"ts":"2026-01-01T00:00:00Z","category":"KINETIC","label":"test"}' && expect 201` |
| VITE_API_KEY baked into frontend build | SEC-04 | Requires docker build to verify ARG injection | `docker compose build frontend && docker compose up && open browser → submit OSINT form → verify 201 in network tab` |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
