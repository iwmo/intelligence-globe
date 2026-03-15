---
phase: 17
slug: schema-migration
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-13
---

# Phase 17 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest 7.x |
| **Config file** | backend/pytest.ini or backend/pyproject.toml |
| **Quick run command** | `cd backend && python -m pytest tests/test_migrations.py -x -q` |
| **Full suite command** | `cd backend && python -m pytest -x -q` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd backend && python -m pytest tests/test_migrations.py -x -q`
- **After every plan wave:** Run `cd backend && python -m pytest -x -q`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 17-01-01 | 01 | 1 | MIG-01 | manual | `alembic upgrade head` on fresh stack | ❌ W0 | ⬜ pending |
| 17-01-02 | 01 | 1 | MIG-01 | manual | `\d aircraft` schema inspection | ❌ W0 | ⬜ pending |
| 17-01-03 | 01 | 1 | MIG-01 | manual | `\d military_aircraft` schema inspection | ❌ W0 | ⬜ pending |
| 17-01-04 | 01 | 1 | MIG-01 | manual | `\d ships` schema inspection | ❌ W0 | ⬜ pending |
| 17-01-05 | 01 | 1 | MIG-01 | manual | `\d gps_jamming_cells` schema inspection | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `backend/tests/test_migrations.py` — migration smoke test (alembic upgrade/downgrade)
- [ ] `backend/tests/conftest.py` — shared DB fixtures (if not exists)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| `aircraft` has all 7 freshness columns | MIG-01 | Schema inspection requires live DB | `docker compose exec db psql -U postgres -d intelligence_globe -c '\d aircraft'` |
| `military_aircraft` has freshness columns | MIG-01 | Schema inspection requires live DB | `docker compose exec db psql -U postgres -d intelligence_globe -c '\d military_aircraft'` |
| `ships` has freshness columns | MIG-01 | Schema inspection requires live DB | `docker compose exec db psql -U postgres -d intelligence_globe -c '\d ships'` |
| `gps_jamming_cells` has freshness columns | MIG-01 | Schema inspection requires live DB | `docker compose exec db psql -U postgres -d intelligence_globe -c '\d gps_jamming_cells'` |
| `is_active` defaults to true on existing rows | MIG-01 | Requires populated DB | `SELECT count(*) FROM aircraft WHERE is_active IS NULL` → must be 0 |
| `position_snapshots` children not dropped | MIG-01 | Partition tables not visible to autogenerate | `\d+ position_snapshots` — children still listed |
| Fresh stack upgrade applies without error | MIG-01 | Requires Docker Compose | `docker compose down -v && docker compose up -d && alembic upgrade head` |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
