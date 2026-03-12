---
phase: 10
slug: snapshot-infrastructure
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-12
---

# Phase 10 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest 8.x + pytest-asyncio 0.24 |
| **Config file** | `/backend/pytest.ini` (`asyncio_mode = auto`) |
| **Quick run command** | `cd backend && python -m pytest tests/test_snapshot.py tests/test_replay.py -x -q` |
| **Full suite command** | `cd backend && python -m pytest -x -q` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd backend && python -m pytest tests/test_snapshot.py tests/test_replay.py -x -q`
- **After every plan wave:** Run `cd backend && python -m pytest -x -q`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 10-01-01 | 01 | 0 | REP-01 | unit | `pytest tests/test_snapshot.py::test_snapshot_from_aircraft -x` | ❌ W0 | ⬜ pending |
| 10-01-02 | 01 | 0 | REP-01 | unit | `pytest tests/test_snapshot.py::test_snapshot_from_military -x` | ❌ W0 | ⬜ pending |
| 10-01-03 | 01 | 0 | REP-01 | unit | `pytest tests/test_snapshot.py::test_snapshot_from_ship -x` | ❌ W0 | ⬜ pending |
| 10-01-04 | 01 | 0 | REP-01 | unit | `pytest tests/test_snapshot.py::test_ensure_partition_name -x` | ❌ W0 | ⬜ pending |
| 10-02-01 | 02 | 0 | REP-01 | integration | `pytest tests/test_replay.py::test_replay_route_exists -x` | ❌ W0 | ⬜ pending |
| 10-02-02 | 02 | 0 | REP-01 | integration | `pytest tests/test_replay.py::test_replay_layer_filter -x` | ❌ W0 | ⬜ pending |
| 10-02-03 | 02 | 0 | REP-01 | integration | `pytest tests/test_replay.py::test_replay_invalid_layer -x` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/test_snapshot.py` — unit stubs for `snapshot_from_aircraft`, `snapshot_from_military`, `snapshot_from_ship`, `test_ensure_partition_name`
- [ ] `tests/test_replay.py` — API contract tests: GET /api/replay/snapshots returns 200, layer filter works, invalid layer returns 404

*Framework install not needed — pytest and pytest-asyncio already in `requirements-dev.txt`.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| RQ task self-re-enqueues every 60s without blocking live API | REP-01 | Requires running RQ worker + live DB | Start worker, observe logs for 2+ minutes, confirm live API responds within 500ms |
| Daily partitions created automatically | REP-01 | Requires clock advancing past midnight | Trigger `ensure_partition()` manually with next-day date, verify partition exists |
| Partitions >7 days dropped automatically | REP-01 | Requires historical partition to drop | Create partition for 8 days ago, run task, verify old partition is gone |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
