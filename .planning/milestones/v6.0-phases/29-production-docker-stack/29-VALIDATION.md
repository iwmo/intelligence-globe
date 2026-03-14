---
phase: 29
slug: production-docker-stack
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-14
---

# Phase 29 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Docker Compose smoke tests (manual) + pytest (backend health) |
| **Config file** | `backend/pytest.ini` |
| **Quick run command** | `cd backend && pytest tests/test_health.py -x` |
| **Full suite command** | `cd backend && pytest` |
| **Estimated runtime** | ~30 seconds (pytest) + ~2 min (docker compose up smoke) |

---

## Sampling Rate

- **After every task commit:** Run `cd backend && pytest tests/test_health.py -x`
- **After every plan wave:** Run full smoke test sequence (docker compose up + curl probes)
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** ~30 seconds (pytest); ~2 minutes (full stack smoke)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 29-01-01 | 01 | 1 | PROD-01 | smoke | `docker compose -f docker-compose.yml config \| grep target` → should show `production` | ✅ | ⬜ pending |
| 29-01-02 | 01 | 1 | PROD-02 | smoke | `docker compose -f docker-compose.yml build frontend && curl -s http://localhost/ \| grep -q '<!doctype html'` | ❌ W0 | ⬜ pending |
| 29-01-03 | 01 | 1 | PROD-03 | smoke | `docker compose -f docker-compose.yml config \| grep -c '3000'` → 0 | ✅ | ⬜ pending |
| 29-01-04 | 01 | 1 | PROD-04 | smoke | `docker compose -f docker-compose.yml up -d && sleep 10 && docker compose ps --format json` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `frontend/nginx.conf` — new file required for PROD-02 proxy config
- [ ] `frontend/Dockerfile` production stage updated to COPY nginx.conf
- [ ] `docker-compose.yml` base file updated for production targets and healthchecks

*No new test framework files required — all PROD-* tests are infrastructure smoke tests.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| `docker compose up` starts nginx on port 80 (no profile flags) | PROD-01, PROD-03 | Requires running Docker stack | `docker compose -f docker-compose.yml up -d && curl -s http://localhost/ \| grep -q html && echo PASS` |
| `/api/aircraft` proxied to backend returns JSON | PROD-02 | Requires full running stack with DB seeded | `curl -sf http://localhost/api/aircraft` — expect JSON array |
| Frontend served as nginx static build (no Vite HMR) | PROD-01 | Browser inspection needed | Open http://localhost in browser; DevTools Network tab should show no HMR websocket |
| `docker compose ps` shows `healthy` for backend, worker, ais-worker | PROD-04 | Requires running stack + start_period elapsed | `docker compose -f docker-compose.yml ps` — all three show `(healthy)` |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 120s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
