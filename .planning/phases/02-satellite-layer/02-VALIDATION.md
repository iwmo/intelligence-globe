---
phase: 2
slug: satellite-layer
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-11
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest 8.x + httpx + pytest-asyncio |
| **Config file** | `backend/pytest.ini` (exists, `asyncio_mode = auto`) |
| **Quick run command** | `python3.11 -m pytest backend/tests/test_satellites.py -x` |
| **Full suite command** | `python3.11 -m pytest backend/tests/ -v` |
| **Estimated runtime** | ~10 seconds (quick) / ~30 seconds (full) |

Frontend verification is manual-only (visual + browser DevTools performance profiler). No Playwright/Cypress yet.

---

## Sampling Rate

- **After every task commit:** Run `python3.11 -m pytest backend/tests/test_satellites.py -x`
- **After every plan wave:** Run `python3.11 -m pytest backend/tests/ -v`
- **Before `/gsd:verify-work`:** Full suite must be green + manual globe visual check
- **Max feedback latency:** ~10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 2-??-01 | TBD | 0 | SAT-01 | unit | `python3.11 -m pytest backend/tests/test_satellites.py::test_satellite_list_returns_200 -x` | ❌ W0 | ⬜ pending |
| 2-??-02 | TBD | 0 | SAT-01 | integration | `python3.11 -m pytest backend/tests/test_satellites.py::test_satellite_table_exists -x` | ❌ W0 | ⬜ pending |
| 2-??-03 | TBD | 0 | INT-01 | unit | `python3.11 -m pytest backend/tests/test_satellites.py::test_satellite_detail_returns_metadata -x` | ❌ W0 | ⬜ pending |
| 2-??-04 | TBD | 0 | INT-01 | unit | `python3.11 -m pytest backend/tests/test_satellites.py::test_satellite_detail_404_for_unknown -x` | ❌ W0 | ⬜ pending |
| 2-??-05 | TBD | 0 | GLOB-03 | unit | `python3.11 -m pytest backend/tests/test_satellites.py::test_tle_freshness_returns_timestamp -x` | ❌ W0 | ⬜ pending |
| 2-??-06 | TBD | 1+ | SAT-01 | visual (manual) | Open browser, confirm 5,000+ point cloud visible on globe | N/A | ⬜ pending |
| 2-??-07 | TBD | 1+ | SAT-01 | visual (manual) | Browser DevTools → Performance tab, confirm ~60 FPS | N/A | ⬜ pending |
| 2-??-08 | TBD | 1+ | SAT-02 | visual (manual) | Click a satellite; confirm orbit polyline renders above globe | N/A | ⬜ pending |
| 2-??-09 | TBD | 1+ | INT-01 | visual (manual) | Click satellite; confirm RightDrawer opens with NORAD ID, altitude, velocity, constellation | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `backend/tests/test_satellites.py` — stubs for SAT-01, INT-01, GLOB-03 (freshness)
- [ ] `backend/app/models/satellite.py` — Satellite SQLAlchemy model + Alembic migration
- [ ] `backend/app/tasks/ingest_satellites.py` — sync wrapper + async fetch function
- [ ] `backend/app/worker.py` — RQ Worker entry point
- [ ] `backend/app/api/routes_satellites.py` — list, detail, freshness endpoints
- [ ] `frontend/src/workers/propagation.worker.ts` — Web Worker with LOAD_OMM + PROPAGATE + COMPUTE_ORBIT handlers
- [ ] `frontend/src/components/SatelliteLayer.tsx` — PointPrimitiveCollection management
- [ ] `frontend/src/components/SatelliteDetailPanel.tsx` — RightDrawer content
- [ ] `frontend/src/hooks/useSatellites.ts` — TanStack Query hook
- [ ] Alembic migration: `alembic revision --autogenerate -m "add_satellites_table"`
- [ ] `npm install satellite.js` in frontend

*Existing infrastructure covers shared fixtures (conftest.py, pytest.ini, NullPool engine patch) — no changes needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| 5,000+ satellite points visible on globe | SAT-01 | Visual rendering — no headless test yet | Open browser at localhost, zoom out globe, confirm dense point cloud |
| No frame rate collapse with 5,000+ points | SAT-01 | Performance profiling — no automated benchmark yet | Browser DevTools → Performance tab → confirm ~60 FPS during propagation loop |
| Orbit path polyline renders for selected satellite | SAT-02 | CesiumJS visual primitive — no headless test | Click a satellite point; confirm colored polyline appears above globe |
| Ground track renders on globe surface | SAT-02 | CesiumJS visual primitive — no headless test | Same satellite selected; confirm dashed ground track drawn on surface |
| Click opens satellite metadata panel | INT-01 | Browser interaction — no Playwright yet | Click any satellite point; confirm RightDrawer opens with NORAD ID, altitude, velocity, TLE epoch, constellation |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
