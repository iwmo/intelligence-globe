---
phase: 1
slug: foundation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-11
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest 8.x + httpx + pytest-asyncio |
| **Config file** | `backend/pytest.ini` or `pyproject.toml [tool.pytest.ini_options]` — Wave 0 installs |
| **Quick run command** | `pytest backend/tests/test_health.py -x` |
| **Full suite command** | `pytest backend/tests/ -v` |
| **Estimated runtime** | ~5 seconds (backend only) |

---

## Sampling Rate

- **After every task commit:** Run `pytest backend/tests/test_health.py -x`
- **After every plan wave:** Run `pytest backend/tests/ -v`
- **Before `/gsd:verify-work`:** Full suite must be green + manual globe visual check
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 1-01-01 | 01 | 0 | INFRA-01 | unit | `pytest backend/tests/test_db.py::test_postgres_reachable -x` | ❌ W0 | ⬜ pending |
| 1-01-02 | 01 | 0 | INFRA-01 | unit | `pytest backend/tests/test_db.py::test_redis_reachable -x` | ❌ W0 | ⬜ pending |
| 1-01-03 | 01 | 0 | INFRA-02 | unit | `pytest backend/tests/test_health.py::test_health_returns_200 -x` | ❌ W0 | ⬜ pending |
| 1-01-04 | 01 | 1 | INFRA-02 | unit | `pytest backend/tests/test_health.py::test_health_has_version -x` | ❌ W0 | ⬜ pending |
| 1-01-05 | 01 | 1 | INFRA-02 | integration | `pytest backend/tests/test_db.py::test_postgis_extension_exists -x` | ❌ W0 | ⬜ pending |
| 1-02-01 | 02 | 1 | GLOB-01 | manual | Open browser at `localhost:3000`, confirm 3D globe visible | N/A | ⬜ pending |
| 1-02-02 | 02 | 1 | GLOB-02 | manual | Confirm no CesiumJS chrome (no animation widget, geocoder, home button) | N/A | ⬜ pending |
| 1-02-03 | 02 | 2 | GLOB-02 | manual | Status bar shows "connected" — frontend health query reaches backend | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `backend/tests/test_health.py` — stubs for INFRA-02 (health endpoint 200, has version)
- [ ] `backend/tests/test_db.py` — stubs for INFRA-01 (postgres reachable, redis reachable, PostGIS extension exists)
- [ ] `backend/pytest.ini` or `pyproject.toml` — `asyncio_mode = "auto"`, testpaths configured
- [ ] pytest, httpx, pytest-asyncio in backend dev requirements

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Globe renders with terrain, atmosphere, day/night shading, star field | GLOB-01 | Visual rendering — no headless test framework in Phase 1 | Run `docker compose up`, open `localhost:3000`, confirm 3D globe visible with atmosphere and stars |
| No default CesiumJS chrome visible | GLOB-02 | Visual check | Confirm no animation widget, geocoder, home button, base layer picker, timeline |
| Dark cinematic theme applied (neon blue accents, black background) | GLOB-02 | Visual check | Confirm dark background, glowing blue accent color, no white/gray default styles |
| Frontend communicates with FastAPI health endpoint | INFRA-02 | E2E integration in container | Status bar shows "connected" status from TanStack Query health hook |
| `docker compose up` from clean checkout — all services healthy | INFRA-01 | Smoke test — requires Docker environment | `docker compose up -d && docker compose ps` — all services show "healthy" |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
