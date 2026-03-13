---
phase: 18
plan: "01"
subsystem: backend
tags: [freshness, config, tdd, utilities]
dependency_graph:
  requires: []
  provides: [app.freshness.stale_cutoff, app.freshness.is_stale, settings.AIRCRAFT_STALE_SECONDS, settings.MILITARY_STALE_SECONDS, settings.SHIP_STALE_SECONDS, settings.GPS_JAMMING_STALE_SECONDS]
  affects: [phases 19-21 stale filtering consumers]
tech_stack:
  added: []
  patterns: [TDD red-green, module-level datetime import for patchability, pydantic-settings UPPER_SNAKE_CASE env-var fields]
key_files:
  created:
    - backend/app/freshness.py
    - backend/tests/test_freshness.py
  modified:
    - backend/app/config.py
decisions:
  - "Import 'from datetime import datetime' (not 'import datetime') so patch('app.freshness.datetime') targets the module-level name correctly in tests"
  - "UPPER_SNAKE_CASE field names for stale threshold settings to match env var convention and support attribute access (settings.AIRCRAFT_STALE_SECONDS)"
  - "config.py changes are additive only — no existing fields renamed or removed"
metrics:
  duration: "~8 minutes"
  completed: "2026-03-13"
  tasks_completed: 3
  files_changed: 3
---

# Phase 18 Plan 01: Shared Freshness Helper Summary

Reusable `stale_cutoff()` and `is_stale()` pure functions plus four environment-variable-overridable stale thresholds in `Settings`, implemented via TDD with 8 passing unit tests.

## What Was Built

### backend/app/freshness.py (new)

Pure-Python module providing two functions:

- `stale_cutoff(threshold_s: int) -> datetime` — returns a timezone-aware UTC datetime `threshold_s` seconds before now. Uses `from datetime import datetime` import style so the module-level `datetime` name is patchable via `patch("app.freshness.datetime")` in tests.
- `is_stale(ts: datetime | None, threshold_s: int) -> bool` — returns `True` if `ts` is `None` or older than `stale_cutoff(threshold_s)`. Boundary semantics: `ts < cutoff` triggers stale (exact match is fresh).

### backend/app/config.py (extended)

Four new integer fields added to `Settings` (additive, no existing fields touched):

| Field | Default | Env Var |
|-------|---------|---------|
| `AIRCRAFT_STALE_SECONDS` | 120 | `AIRCRAFT_STALE_SECONDS` |
| `MILITARY_STALE_SECONDS` | 600 | `MILITARY_STALE_SECONDS` |
| `SHIP_STALE_SECONDS` | 900 | `SHIP_STALE_SECONDS` |
| `GPS_JAMMING_STALE_SECONDS` | 600 | `GPS_JAMMING_STALE_SECONDS` |

### backend/tests/test_freshness.py (new)

8 unit tests covering all behaviors (all GREEN):

1. `test_stale_cutoff_returns_timezone_aware` — tzinfo not None
2. `test_stale_cutoff_exact_offset` — frozen clock returns exact datetime
3. `test_is_stale_none_is_stale` — None always stale
4. `test_is_stale_old_timestamp` — 1s before cutoff = stale
5. `test_is_stale_fresh_timestamp` — 1s after cutoff = fresh
6. `test_is_stale_boundary_exactly_at_cutoff` — exact cutoff = fresh (ts < cutoff semantics)
7. `test_settings_defaults` — all four defaults verified
8. `test_settings_env_override` — monkeypatch + fresh `Settings()` instantiation verifies runtime override

## Downstream Usage

Phases 19-21 can now use:

```python
from app.freshness import stale_cutoff, is_stale
from app.config import settings

# Filter stale aircraft
cutoff = stale_cutoff(settings.AIRCRAFT_STALE_SECONDS)
# or
if is_stale(entity.seen_at, settings.MILITARY_STALE_SECONDS):
    ...
```

## Deviations from Plan

None — plan executed exactly as written.

## Pre-existing Test Failure (Out of Scope)

`tests/test_military.py::test_military_detail` fails with `200 != 404` — confirmed pre-existing before this plan (verified via `git stash`). Not caused by this plan's changes. Logged for future phase attention.

## Verification Results

```
$ python -c "from app.freshness import stale_cutoff, is_stale; print(stale_cutoff(120))"
2026-03-13 11:18:32.388152+00:00

$ python -c "from app.config import settings; print(settings.AIRCRAFT_STALE_SECONDS, settings.MILITARY_STALE_SECONDS, settings.SHIP_STALE_SECONDS, settings.GPS_JAMMING_STALE_SECONDS)"
120 600 900 600
```

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 (RED) | 8aa0137 | test(18-01): add failing test scaffold for freshness module |
| 2 (GREEN) | df4afe0 | feat(18-01): implement app/freshness.py with stale_cutoff and is_stale |
| 3 (GREEN) | e365cc3 | feat(18-01): extend app/config.py with four stale threshold settings |

## Self-Check: PASSED
