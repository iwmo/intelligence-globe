---
phase: 4
slug: controls-and-polish
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-11
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest + pytest-asyncio (backend/tests/) |
| **Config file** | `backend/pytest.ini` or `backend/pyproject.toml` |
| **Quick run command** | `cd backend && python3.11 -m pytest tests/ -x -q` |
| **Full suite command** | `cd backend && python3.11 -m pytest tests/ -v` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd backend && python3.11 -m pytest tests/ -x -q`
- **After every plan wave:** Run `cd backend && python3.11 -m pytest tests/ -v`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 04-xx-01 | search | 1 | SAT-03 | unit (API) | `python3.11 -m pytest tests/test_satellites.py::test_satellite_detail_returns_metadata -x` | ✅ existing | ⬜ pending |
| 04-xx-02 | search | 1 | AIR-03 | unit (API) | `python3.11 -m pytest tests/test_aircraft.py::test_aircraft_detail_returns_metadata -x` | ✅ existing | ⬜ pending |
| 04-xx-03 | filters | 2 | SAT-04 | unit (API) | `python3.11 -m pytest tests/test_satellites.py::test_satellite_list_filter_constellation -x` | ❌ Wave 0 | ⬜ pending |
| 04-xx-04 | filters | 2 | SAT-04 | unit (API) | `python3.11 -m pytest tests/test_satellites.py::test_satellite_list_filter_altitude -x` | ❌ Wave 0 | ⬜ pending |
| 04-xx-05 | filters | 2 | AIR-04 | unit (API) | `python3.11 -m pytest tests/test_aircraft.py::test_aircraft_list_filter_altitude -x` | ❌ Wave 0 | ⬜ pending |
| 04-xx-06 | filters | 2 | AIR-04 | unit (API) | `python3.11 -m pytest tests/test_aircraft.py::test_aircraft_list_filter_bbox -x` | ❌ Wave 0 | ⬜ pending |
| 04-xx-07 | freshness | 1 | GLOB-03 | unit (API) | `python3.11 -m pytest tests/test_satellites.py::test_freshness_endpoint -x` | ✅ existing | ⬜ pending |
| 04-xx-08 | layer-toggle | 2 | INT-03 | manual | Visual verification on globe | N/A | ⬜ pending |
| 04-xx-09 | responsive | 3 | INT-04 | manual | Browser devtools responsive mode at 768px | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

> NOTE: Backend filter query params are NOT required. Phase 4 uses client-side filtering.
> Wave 0 stubs apply ONLY if planner adds server-side filter params to backend endpoints.

If client-side filtering is kept (recommended):
- [ ] No Wave 0 test stubs needed — existing tests cover all automated requirements

If server-side filtering is added (optional):
- [ ] `backend/tests/test_satellites.py` — add `test_satellite_list_filter_constellation`, `test_satellite_list_filter_altitude`
- [ ] `backend/tests/test_aircraft.py` — add `test_aircraft_list_filter_altitude`, `test_aircraft_list_filter_bbox`

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Layer visibility toggle hides satellites on globe | INT-03 | CesiumJS PointPrimitive visibility is visual-only | Toggle satellite layer off → confirm dots disappear from globe; toggle on → dots reappear |
| Layer visibility toggle hides aircraft on globe | INT-03 | CesiumJS PointPrimitive visibility is visual-only | Toggle aircraft layer off → confirm planes disappear; toggle on → reappear |
| No layout overflow at 768px viewport | INT-04 | CSS layout is visual | Open browser devtools → set viewport 768px wide → confirm no horizontal scroll, no overlapping panels |
| Globe camera flies to selected satellite | SAT-03 | Camera animation is visual | Search for a satellite → select result → confirm globe animates to satellite position |
| Globe camera flies to selected aircraft | AIR-03 | Camera animation is visual | Search for aircraft by callsign → select → confirm globe flies to position |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
