---
phase: 12
slug: osint-event-correlation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-12
---

# Phase 12 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.x (frontend) + pytest 8.x (backend) |
| **Config file** | `frontend/vite.config.ts` (`test.environment: 'jsdom'`) / `backend/pytest.ini` (`asyncio_mode = auto`) |
| **Quick run command** | `cd frontend && npx vitest run src/components/__tests__/OsintEventPanel.test.tsx src/hooks/__tests__/useOsintEvents.test.ts` |
| **Full suite command** | `cd frontend && npx vitest run` and `cd backend && python -m pytest -x -q` |
| **Estimated runtime** | ~30 seconds (frontend) + ~20 seconds (backend) |

---

## Sampling Rate

- **After every task commit:** Run quick run command for the task's specific test file(s)
- **After every plan wave:** Run `cd frontend && npx vitest run` and `cd backend && python -m pytest -x -q`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** ~50 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 12-01-01 | 01 | 0 | REP-05, REP-06 | unit/integration | see Wave 0 gaps below | ❌ W0 | ⬜ pending |
| 12-02-01 | 02 | 1 | REP-06 | integration | `cd backend && python -m pytest tests/test_osint.py -x` | ❌ W0 | ⬜ pending |
| 12-02-02 | 02 | 1 | REP-06 | smoke | `cd frontend && npx vitest run src/components/__tests__/OsintEventPanel.test.tsx` | ❌ W0 | ⬜ pending |
| 12-03-01 | 03 | 1 | REP-05 | unit | `cd frontend && npx vitest run src/workers/__tests__/propagation.worker.test.ts` | ❌ W0 | ⬜ pending |
| 12-03-02 | 03 | 1 | REP-05 | smoke | `cd frontend && npx vitest run src/components/__tests__/SatelliteLayer.overpass.test.tsx` | ❌ W0 | ⬜ pending |
| 12-04-01 | 04 | 2 | REP-06 | unit | `cd frontend && npx vitest run src/store/__tests__/useAppStore.test.ts` | ❌ W0 | ⬜ pending |
| 12-04-02 | 04 | 2 | REP-06 | smoke | `cd frontend && npx vitest run src/components/__tests__/PlaybackBar.category.test.tsx` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `backend/tests/test_osint.py` — stubs for REP-06: `test_list_events`, `test_create_event`, `test_invalid_category`
- [ ] `frontend/src/components/__tests__/OsintEventPanel.test.tsx` — smoke test for event entry form rendering
- [ ] `frontend/src/components/__tests__/PlaybackBar.category.test.tsx` — category chip rendering + filter behavior
- [ ] `frontend/src/components/__tests__/SatelliteLayer.overpass.test.tsx` — TLE age warning smoke test
- [ ] `frontend/src/workers/__tests__/propagation.worker.test.ts` — unit test for `COMPUTE_OVERPASS` message type
- [ ] Extend `frontend/src/store/__tests__/useAppStore.test.ts` — add `activeCategories` initial state and `toggleCategory` behavior assertions
- [ ] Extend `frontend/src/hooks/__tests__/useOsintEvents.test.ts` — unit test for `useOsintEvents` hook (disabled state, event array shape)

*Framework already installed — vitest 4.x in devDependencies, pytest in requirements-dev.txt. No new packages needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Arc lines visually render from satellites to AOI on globe during replay | REP-05 | Visual rendering — Cesium primitives not easily tested in jsdom | Start replay, set AOI marker, observe geodesic arcs from overhead satellites |
| Category chip filtering hides non-matching globe layers | REP-06 | Cross-layer visual coherence requires live Cesium scene | Select MARITIME chip only; verify aircraft + jamming layers visually suppressed |
| TLE staleness warning appears in UI when TLE age > 7 days | REP-05 | Requires mocking `tleLastUpdated` store date in browser | Set `tleLastUpdated` to 8+ days ago in devtools, observe warning banner |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 50s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
