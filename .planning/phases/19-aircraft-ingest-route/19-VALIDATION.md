---
phase: 19
slug: aircraft-ingest-route
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-13
---

# Phase 19 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest 7.x (asyncio) |
| **Config file** | `backend/pytest.ini` or `backend/pyproject.toml` |
| **Quick run command** | `cd backend && pytest tests/test_ingest_aircraft.py tests/test_aircraft.py -x -q` |
| **Full suite command** | `cd backend && pytest -x -q` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd backend && pytest tests/test_ingest_aircraft.py tests/test_aircraft.py -x -q`
- **After every plan wave:** Run `cd backend && pytest -x -q`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 19-01-01 | 01 | 1 | ACFT-01 | unit | `cd backend && pytest tests/test_ingest_aircraft.py -x -q -k "time_position or vertical_rate or geo_altitude or position_source"` | ✅ | ⬜ pending |
| 19-01-02 | 01 | 1 | ACFT-02 | unit | `cd backend && pytest tests/test_ingest_aircraft.py -x -q -k "fetched_at or last_seen_at or is_active or tombstone"` | ✅ | ⬜ pending |
| 19-02-01 | 02 | 2 | ACFT-03 | unit | `cd backend && pytest tests/test_aircraft.py -x -q -k "stale or is_active or time_position or position_age"` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. No new test files or frameworks needed — tests go into existing `tests/test_ingest_aircraft.py` and `tests/test_aircraft.py`.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| `position_source` value present in live OpenSky response | ACFT-01 | OAuth2 unauthenticated tier may not populate sv[16] | Hit `/api/aircraft` live and inspect `position_source` field; null is acceptable |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
