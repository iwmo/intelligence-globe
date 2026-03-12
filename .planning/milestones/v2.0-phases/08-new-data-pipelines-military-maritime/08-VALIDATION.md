---
phase: 8
slug: new-data-pipelines-military-maritime
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-12
---

# Phase 8 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest + pytest-asyncio (backend); Vitest + @testing-library/react (frontend) |
| **Config file** | `backend/pytest.ini` (asyncio_mode = auto); `frontend/vite.config.ts` (test.environment = jsdom) |
| **Quick run command** | `cd backend && pytest tests/test_military.py tests/test_ships.py -x` |
| **Full suite command** | `cd backend && pytest tests/ -x && cd ../frontend && npx vitest run` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd backend && pytest tests/test_military.py tests/test_ships.py -x`
- **After every plan wave:** Run `cd backend && pytest tests/ -x && cd ../frontend && npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 8-01-01 | 01 | 0 | LAY-01 | unit | `pytest tests/test_military.py::test_list_military -x` | ❌ W0 | ⬜ pending |
| 8-01-02 | 01 | 0 | LAY-01 | unit | `pytest tests/test_military.py::test_military_detail -x` | ❌ W0 | ⬜ pending |
| 8-01-03 | 01 | 0 | LAY-01 | unit | `pytest tests/test_ingest_military.py::test_ground_altitude -x` | ❌ W0 | ⬜ pending |
| 8-01-04 | 01 | 0 | LAY-01 | unit | `pytest tests/test_ingest_military.py::test_null_position_skipped -x` | ❌ W0 | ⬜ pending |
| 8-01-05 | 01 | 0 | LAY-01 | smoke | `npx vitest run src/components/__tests__/MilitaryAircraftLayer.test.tsx` | ❌ W0 | ⬜ pending |
| 8-02-01 | 02 | 0 | LAY-03 | unit | `pytest tests/test_ships.py::test_list_ships -x` | ❌ W0 | ⬜ pending |
| 8-02-02 | 02 | 0 | LAY-03 | unit | `pytest tests/test_ships.py::test_ship_detail -x` | ❌ W0 | ⬜ pending |
| 8-02-03 | 02 | 0 | LAY-03 | unit | `pytest tests/test_ingest_ais.py::test_parse_position_report -x` | ❌ W0 | ⬜ pending |
| 8-02-04 | 02 | 0 | LAY-03 | unit | `pytest tests/test_ingest_ais.py::test_non_position_report_ignored -x` | ❌ W0 | ⬜ pending |
| 8-02-05 | 02 | 0 | LAY-03 | smoke | `npx vitest run src/components/__tests__/ShipLayer.test.tsx` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `backend/tests/test_military.py` — covers LAY-01 API contract (list + detail endpoints)
- [ ] `backend/tests/test_ingest_military.py` — covers LAY-01 ingest logic (ground altitude parsing, null position skip)
- [ ] `backend/tests/test_ships.py` — covers LAY-03 API contract (list + detail endpoints)
- [ ] `backend/tests/test_ingest_ais.py` — covers LAY-03 AIS message parsing (unit, no real WebSocket)
- [ ] `frontend/src/components/__tests__/MilitaryAircraftLayer.test.tsx` — smoke test (renders null, no crash)
- [ ] `frontend/src/components/__tests__/ShipLayer.test.tsx` — smoke test (renders null, no crash)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Military amber icons appear on globe when toggle enabled | LAY-01 | Requires live CesiumJS rendering and real airplanes.live data | Enable Military Flights toggle; verify amber dots appear on globe; verify count > 0 in console |
| Click military aircraft shows detail panel | LAY-01 | Requires live CesiumJS ScreenSpaceEventHandler interaction | Click an amber dot; verify MilitaryDetailPanel shows callsign, ICAO24, type, altitude, speed, heading |
| Ship cyan icons appear on globe when toggle enabled | LAY-03 | Requires live aisstream.io WebSocket data | Enable Maritime Traffic toggle; verify cyan dots appear; wait up to 30 seconds for first batch |
| Click ship shows detail panel | LAY-03 | Requires live data and real click event | Click a cyan dot; verify ShipDetailPanel shows MMSI, name (may be null), speed, heading, last update |
| AIS layer recovers from WebSocket disconnection without freezing | LAY-03 | Requires network simulation | Force-disconnect AIS worker (e.g., `docker compose restart ais-worker`); verify globe does not freeze; verify ship data resumes within 60 seconds |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
