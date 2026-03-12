---
phase: 9
slug: gps-jamming-street-traffic
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-12
---

# Phase 9 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest 7.x (backend) / vitest (frontend) |
| **Config file** | backend/pytest.ini or pyproject.toml / frontend/vite.config.ts |
| **Quick run command** | `cd backend && pytest tests/test_gps_jamming.py tests/test_street_traffic.py -x -q` |
| **Full suite command** | `cd backend && pytest -q && cd ../frontend && npx vitest run` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd backend && pytest tests/test_gps_jamming.py tests/test_street_traffic.py -x -q`
- **After every plan wave:** Run `cd backend && pytest -q && cd ../frontend && npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 9-01-01 | 01 | 1 | LAY-02 | unit | `pytest tests/test_gps_jamming.py::test_nic_nacp_aggregation -xq` | ❌ W0 | ⬜ pending |
| 9-01-02 | 01 | 1 | LAY-02 | unit | `pytest tests/test_gps_jamming.py::test_h3_cell_generation -xq` | ❌ W0 | ⬜ pending |
| 9-01-03 | 01 | 1 | LAY-02 | unit | `pytest tests/test_gps_jamming.py::test_severity_classification -xq` | ❌ W0 | ⬜ pending |
| 9-01-04 | 01 | 1 | LAY-02 | integration | `pytest tests/test_gps_jamming.py::test_api_endpoint -xq` | ❌ W0 | ⬜ pending |
| 9-02-01 | 02 | 2 | LAY-04 | unit | `pytest tests/test_street_traffic.py::test_overpass_fetch -xq` | ❌ W0 | ⬜ pending |
| 9-02-02 | 02 | 2 | LAY-04 | unit | `pytest tests/test_street_traffic.py::test_viewport_scoping -xq` | ❌ W0 | ⬜ pending |
| 9-02-03 | 02 | 2 | LAY-04 | manual | N/A — visual particle animation | N/A | ⬜ pending |
| 9-02-04 | 02 | 2 | LAY-04 | manual | N/A — altitude gate visibility | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `backend/tests/test_gps_jamming.py` — stubs for LAY-02 (NIC/NACp aggregation, H3 cell generation, severity classification, API endpoint)
- [ ] `backend/tests/test_street_traffic.py` — stubs for LAY-04 (Overpass fetch, viewport scoping)
- [ ] `backend/tests/conftest.py` — shared fixtures (mock ADS-B data, mock Overpass response)

*If h3 or httpx not yet in requirements.txt — Wave 0 adds them.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| H3 hexagons render color-coded (green/yellow/red) on globe without framerate drop | LAY-02 | Visual rendering in CesiumJS GroundPrimitive — no headless test | Enable GPS Jamming layer, zoom to Middle East/Eastern Europe, confirm hex colors and label text |
| "GPS degradation anomaly" label appears on hover/select | LAY-02 | DOM/3D label interaction requires browser | Click a hex cell, confirm label text includes disclaimer |
| Particle dots animate along road geometry | LAY-04 | Canvas animation — no automated test | Zoom below 500 km over urban area, confirm dot movement along roads |
| Particles disappear when zoomed out past 500 km | LAY-04 | Camera altitude gate — visual only | Zoom out to global view, confirm no particles visible |
| Particle density scales with zoom level | LAY-04 | Visual density judgment | Zoom in progressively, confirm more particles appear at closer zoom |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
