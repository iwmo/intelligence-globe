---
phase: 3
slug: aircraft-layer
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-11
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest + pytest-asyncio (already configured) |
| **Config file** | `backend/pytest.ini` (asyncio_mode = auto, asyncio_default_fixture_loop_scope = session) |
| **Quick run command** | `python3.11 -m pytest backend/tests/test_aircraft.py -x -q` |
| **Full suite command** | `python3.11 -m pytest backend/tests/ -q` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `python3.11 -m pytest backend/tests/test_aircraft.py -x -q`
- **After every plan wave:** Run `python3.11 -m pytest backend/tests/ -q`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** ~10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 3-01-01 | 01 | 0 | AIR-01 | unit | `python3.11 -m pytest backend/tests/test_aircraft.py::test_list_aircraft -x` | ❌ W0 | ⬜ pending |
| 3-01-02 | 01 | 0 | AIR-01 | unit | `python3.11 -m pytest backend/tests/test_aircraft.py::test_aircraft_freshness -x` | ❌ W0 | ⬜ pending |
| 3-01-03 | 01 | 0 | AIR-01 | unit | `python3.11 -m pytest backend/tests/test_ingest_aircraft.py::test_null_position_filtered -x` | ❌ W0 | ⬜ pending |
| 3-01-04 | 01 | 0 | AIR-02 | unit | `python3.11 -m pytest backend/tests/test_ingest_aircraft.py::test_trail_capped_at_20 -x` | ❌ W0 | ⬜ pending |
| 3-01-05 | 01 | 0 | INT-02 | unit | `python3.11 -m pytest backend/tests/test_aircraft.py::test_aircraft_detail -x` | ❌ W0 | ⬜ pending |
| 3-02-01 | 02 | 1 | AIR-01 | integration | `python3.11 -m pytest backend/tests/test_aircraft.py -x -q` | ❌ W0 | ⬜ pending |
| 3-02-02 | 02 | 1 | AIR-02 | integration | `python3.11 -m pytest backend/tests/test_ingest_aircraft.py -x -q` | ❌ W0 | ⬜ pending |
| 3-03-01 | 03 | 2 | INT-02 | manual | Visual inspection — aircraft click opens detail panel | N/A | ⬜ pending |
| 3-03-02 | 03 | 2 | AIR-01 | manual | Visual inspection — aircraft points appear on globe | N/A | ⬜ pending |
| 3-03-03 | 03 | 2 | AIR-01 | manual | Visual inspection — no teleporting (lerp working) | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `backend/tests/test_aircraft.py` — stubs for AIR-01 (list endpoint, freshness) and INT-02 (detail endpoint)
- [ ] `backend/tests/test_ingest_aircraft.py` — stubs for AIR-01 null position filter, AIR-02 trail capping
- [ ] `backend/app/models/aircraft.py` — Aircraft SQLAlchemy model (required by tests)
- [ ] Alembic migration — required before integration tests can run against live DB
- [ ] `OPENSKY_CLIENT_ID` + `OPENSKY_CLIENT_SECRET` in `.env` — required before integration tests hit live OpenSky

*Existing pytest infrastructure covers all other phase requirements.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Aircraft points appear on globe with no teleporting | AIR-01 | Requires live OpenSky data and visual CesiumJS inspection | Open app, zoom to active airspace (Europe/US), observe aircraft points updating every 90s; verify smooth lerp movement between updates |
| Trail polyline appears on aircraft click | AIR-02 | Requires interactive CesiumJS globe | Click an aircraft point; verify a trail polyline appears showing last N positions |
| Clicking aircraft opens detail panel with correct metadata | INT-02 | Requires interactive globe + UI | Click any aircraft; verify RightDrawer opens with callsign, ICAO24, altitude, speed, heading, and country displayed |
| No authentication errors in backend logs | AIR-01 | Requires live OpenSky OAuth2 credentials | Check `docker compose logs worker` — no 401 or 403 from OpenSky token endpoint |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
