---
phase: 33
slug: viewport-culling
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-14
---

# Phase 33 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.x + jsdom (frontend), pytest (backend) |
| **Config file** | `frontend/vite.config.ts` (test section), `backend/pytest.ini` |
| **Quick run command** | `cd frontend && npx vitest run src/hooks/__tests__/useViewportBbox.test.ts` |
| **Full suite command** | `cd frontend && npx vitest run && cd ../backend && python -m pytest` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd frontend && npx vitest run src/hooks/__tests__/useViewportBbox.test.ts`
- **After every plan wave:** Run `cd frontend && npx vitest run && cd ../backend && python -m pytest`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| VPC-01 | 01 | 0 | useViewportBbox writes bbox to store on moveEnd | unit | `cd frontend && npx vitest run src/hooks/__tests__/useViewportBbox.test.ts` | ❌ W0 | ⬜ pending |
| VPC-02 | 01 | 0 | useViewportBbox writes null when computeViewRectangle returns undefined | unit | same | ❌ W0 | ⬜ pending |
| VPC-03 | 01 | 1 | /api/aircraft/ without bbox returns full dataset | unit | `cd backend && python -m pytest tests/test_routes_aircraft.py::test_list_aircraft_no_bbox -x` | ❌ W0 | ⬜ pending |
| VPC-04 | 01 | 1 | /api/aircraft/?min_lat=... returns only in-bbox aircraft | unit | `cd backend && python -m pytest tests/test_routes_aircraft.py::test_list_aircraft_bbox -x` | ❌ W0 | ⬜ pending |
| VPC-05 | 01 | 1 | /api/ships/ with bbox params filters correctly | unit | `cd backend && python -m pytest tests/test_routes_ships.py::test_list_ships_bbox -x` | ❌ W0 | ⬜ pending |
| VPC-06 | 01 | 1 | /api/military/ with bbox params filters correctly | unit | `cd backend && python -m pytest tests/test_routes_military.py::test_list_military_bbox -x` | ❌ W0 | ⬜ pending |
| VPC-07 | 01 | 0 | IDL case (minLon > maxLon) falls back to global query | unit | `cd frontend && npx vitest run src/hooks/__tests__/useViewportBbox.test.ts` | ❌ W0 | ⬜ pending |
| VPC-08 | 01 | 1 | Playback mode sends no bbox to API | unit | `cd frontend && npx vitest run src/hooks/__tests__/useAircraft.bbox.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `frontend/src/hooks/__tests__/useViewportBbox.test.ts` — stubs for VPC-01, VPC-02, VPC-07
- [ ] `frontend/src/hooks/__tests__/useAircraft.bbox.test.ts` — stub for VPC-08
- [ ] `backend/tests/test_routes_aircraft.py` — extend with VPC-03, VPC-04 test cases (file may already exist)
- [ ] `backend/tests/test_routes_ships.py` — extend with VPC-05 test case
- [ ] `backend/tests/test_routes_military.py` — extend with VPC-06 test case

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Globe panning triggers re-fetch with updated bbox | End-to-end | Requires live Cesium viewer | Pan globe, open network tab, verify new requests carry min_lat/max_lat/min_lon/max_lon params |
| Aircraft disappear when panned out of view | Visual | Requires live data | Pan to ocean, verify no land-based aircraft shown |
| Satellites and GPS jamming unaffected | Visual | Requires live data | Ensure satellite layer and GPS jamming layer still show globally after bbox is active |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
