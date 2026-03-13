# Phase 18: Shared Freshness Helper - Research

**Researched:** 2026-03-13
**Domain:** Python datetime utilities, pydantic-settings, FastAPI dependency injection
**Confidence:** HIGH

---

## Summary

Phase 18 creates two artifacts: a pure-Python `app/freshness.py` module with `stale_cutoff()` and `is_stale()` helper functions, and an extension of the existing `Settings` class in `app/config.py` to expose four new integer environment variables (`AIRCRAFT_STALE_SECONDS`, `MILITARY_STALE_SECONDS`, `SHIP_STALE_SECONDS`, `GPS_JAMMING_STALE_SECONDS`).

The problem domain is narrow and well-understood. No new libraries are needed — the project already has `pydantic-settings>=2.0` (which handles env var coercion natively), Python's `datetime` stdlib (which provides timezone-aware arithmetic), and `pytest-asyncio>=0.24` (for any tests). All research confirms the idiomatic patterns are straightforward.

The key correctness constraint is timezone awareness: `datetime.now(UTC)` returns a timezone-aware object; `timedelta` subtraction preserves that awareness; any comparison against `fetched_at`/`last_seen_at` database columns (stored as `TIMESTAMPTZ`) must also be timezone-aware to avoid SQLAlchemy raising `TypeError: can't compare offset-naive and offset-aware datetimes`. All datetime construction MUST use `datetime.now(timezone.utc)` or `datetime.now(UTC)` (Python 3.11+ alias), never `datetime.utcnow()` which is deprecated and returns a naive object.

**Primary recommendation:** Implement `freshness.py` as a zero-dependency pure-Python module using `datetime.now(timezone.utc) - timedelta(seconds=threshold_s)`. Extend `Settings` with four `int` fields using pydantic-settings default values. No new packages required.

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| FRESH-01 | New `app/freshness.py` module provides `stale_cutoff(threshold_s) -> datetime` and `is_stale(ts, threshold_s) -> bool` reused by all routes | Python stdlib `datetime` + `timedelta`; zero new dependencies; pure functions are trivially testable |
| FRESH-02 | `Settings` class gains `AIRCRAFT_STALE_SECONDS` (120), `MILITARY_STALE_SECONDS` (600), `SHIP_STALE_SECONDS` (900), `GPS_JAMMING_STALE_SECONDS` (600) with automatic env var coercion via pydantic-settings | `pydantic-settings>=2.0` already installed; `int` field type annotation triggers automatic coercion from env string to int; no `Field(...)` import required for simple defaults |
</phase_requirements>

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Python `datetime` (stdlib) | 3.11+ | Timezone-aware datetime arithmetic | No dependency; `datetime.now(timezone.utc)` and `timedelta` cover 100% of freshness needs |
| `pydantic-settings` | >=2.0 (already installed) | Env var coercion into typed `Settings` fields | Already powering `config.py`; type annotation alone (`int`) triggers automatic string→int coercion |
| `pytest` + `pytest-asyncio` | >=8.0 / >=0.24 (already installed) | Unit tests for freshness functions and settings | Already in `requirements-dev.txt`; `asyncio_mode = auto` configured in `pytest.ini` |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `unittest.mock.patch` (stdlib) | 3.11+ | Clock mocking in tests | Use `patch("app.freshness.datetime")` to freeze time in unit tests for deterministic assertions |
| `freezegun` | optional | Alternative clock mocking | Only needed if `patch` approach proves awkward; project has no prior usage — prefer stdlib mock |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `datetime.now(timezone.utc)` | `datetime.utcnow()` | `utcnow()` is deprecated in Python 3.12 and returns a naive datetime — NEVER USE |
| `timezone.utc` | `pytz.UTC` or `zoneinfo.ZoneInfo("UTC")` | Both work; stdlib `timezone.utc` is simpler, zero-dependency, and already used in `snapshot_positions.py` |
| Inline threshold constants | Settings env vars | Env vars allow threshold tuning without code changes or redeployment — required by FRESH-02 |

**Installation:** No new packages needed. All dependencies already present.

---

## Architecture Patterns

### Recommended Project Structure
```
backend/app/
├── freshness.py          # NEW: stale_cutoff(), is_stale()
├── config.py             # MODIFIED: add 4 stale threshold fields to Settings
└── (no other changes in this phase)

backend/tests/
└── test_freshness.py     # NEW: unit tests for freshness module
```

### Pattern 1: Pure Function `stale_cutoff`
**What:** Returns a timezone-aware datetime representing the oldest acceptable timestamp.
**When to use:** Called in route filters — `WHERE fetched_at >= stale_cutoff(settings.AIRCRAFT_STALE_SECONDS)`.
**Example:**
```python
# Source: Python stdlib datetime documentation
from datetime import datetime, timedelta, timezone

def stale_cutoff(threshold_s: int) -> datetime:
    """Return a timezone-aware datetime `threshold_s` seconds before now (UTC)."""
    return datetime.now(timezone.utc) - timedelta(seconds=threshold_s)
```

### Pattern 2: Pure Function `is_stale`
**What:** Boolean helper to check whether a single timestamp is stale.
**When to use:** Applied per-entity in response serializers — `"is_stale": is_stale(r.fetched_at, AIRCRAFT_STALE_SECONDS)`.
**Example:**
```python
from datetime import datetime

def is_stale(ts: datetime | None, threshold_s: int) -> bool:
    """Return True when ts is None or older than threshold_s seconds ago."""
    if ts is None:
        return True
    return ts < stale_cutoff(threshold_s)
```

### Pattern 3: Settings Extension via pydantic-settings
**What:** Add typed `int` fields to the existing `Settings` class with default values. pydantic-settings automatically reads from environment variables whose names match the field names (uppercased).
**When to use:** This is the only pattern for FRESH-02. Do not use a separate config file or module-level constants.
**Example:**
```python
# Source: pydantic-settings v2 documentation
from pydantic_settings import BaseSettings
from pydantic import ConfigDict

class Settings(BaseSettings):
    model_config = ConfigDict(env_file=".env", extra="ignore")

    # Existing fields (unchanged)
    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/opensignal"
    redis_url: str = "redis://localhost:6379/0"
    frontend_origin: str = "http://localhost:3000"
    version: str = "0.1.0"

    # Freshness thresholds (FRESH-02)
    AIRCRAFT_STALE_SECONDS: int = 120
    MILITARY_STALE_SECONDS: int = 600
    SHIP_STALE_SECONDS: int = 900
    GPS_JAMMING_STALE_SECONDS: int = 600
```

**Field naming note:** pydantic-settings v2 matches env var names case-insensitively by default. Using uppercase field names (`AIRCRAFT_STALE_SECONDS`) is idiomatic for env-var-backed settings and makes the env var source obvious. Lowercase field names also work — env var names are matched case-insensitively — but uppercase is conventional for this class of setting.

### Pattern 4: Clock Mocking in Unit Tests
**What:** Freeze `datetime.now()` inside `freshness.py` to write deterministic assertions without sleeping or flapping.
**When to use:** Required for TEST-06 (boundary tests for `stale_cutoff` and `is_stale`).
**Example:**
```python
# Source: Python unittest.mock documentation
from unittest.mock import patch
from datetime import datetime, timezone
import app.freshness as freshness

FROZEN_NOW = datetime(2026, 3, 13, 12, 0, 0, tzinfo=timezone.utc)

def test_stale_cutoff_120():
    with patch("app.freshness.datetime") as mock_dt:
        mock_dt.now.return_value = FROZEN_NOW
        result = freshness.stale_cutoff(120)
    assert result == datetime(2026, 3, 13, 11, 58, 0, tzinfo=timezone.utc)

def test_is_stale_true():
    stale_ts = datetime(2026, 3, 13, 11, 57, 59, tzinfo=timezone.utc)
    with patch("app.freshness.datetime") as mock_dt:
        mock_dt.now.return_value = FROZEN_NOW
        assert freshness.is_stale(stale_ts, 120) is True

def test_is_stale_false():
    fresh_ts = datetime(2026, 3, 13, 11, 59, 0, tzinfo=timezone.utc)
    with patch("app.freshness.datetime") as mock_dt:
        mock_dt.now.return_value = FROZEN_NOW
        assert freshness.is_stale(fresh_ts, 120) is False

def test_is_stale_none():
    assert freshness.is_stale(None, 120) is True
```

**Important implementation note for mockability:** To allow `patch("app.freshness.datetime")` to work, `freshness.py` must import `datetime` as the class (not just the module), or expose `datetime.now` through a reference that can be patched. The safest pattern is to import `from datetime import datetime, timedelta, timezone` at module level — then `patch("app.freshness.datetime")` replaces the `datetime` name in that module's namespace cleanly.

### Anti-Patterns to Avoid
- **Using `datetime.utcnow()`:** Returns a naive datetime, deprecated in Python 3.12. Any comparison with TIMESTAMPTZ from PostgreSQL will raise `TypeError`.
- **Hardcoding threshold constants in route files:** Prevents threshold tuning without code changes. All thresholds must flow through `settings`.
- **Storing `settings` as a module-level singleton in freshness.py:** `freshness.py` should be a pure utility — it should not import from `config.py`. Routes and workers pass the threshold value as an argument.
- **Testing with `time.sleep()`:** Non-deterministic and slow. Always mock the clock.
- **`onupdate` for freshness timestamps in ORM:** Already documented in project decisions — `onupdate` is silently ignored on `on_conflict_do_update`; always set timestamps explicitly in `set_={}`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Env var coercion to int | Manual `int(os.environ.get(...))` | pydantic-settings `int` field | Already installed; handles missing vars, type errors, `.env` file loading |
| Timezone-aware "now" | Custom time source | `datetime.now(timezone.utc)` | Stdlib; no risk of naive datetime bugs |
| Settings singleton | Second `settings = Settings()` in freshness.py | Import `settings` from `app.config` in callers | Single source of truth; avoids double env var reads |

**Key insight:** The entire phase is stdlib + one already-installed library. Complexity lives in correctness details (timezone awareness, mockable clock) not in library selection.

---

## Common Pitfalls

### Pitfall 1: Naive Datetime Comparison
**What goes wrong:** `datetime.utcnow()` returns a naive datetime. Comparing it to a TIMESTAMPTZ column value (which SQLAlchemy returns as timezone-aware) raises `TypeError: can't compare offset-naive and offset-aware datetimes`. The route query fails at runtime, not import time.
**Why it happens:** Old Python habit; `utcnow()` is still in the docs and autocomplete.
**How to avoid:** Always use `datetime.now(timezone.utc)`. Add a `# noqa` or lint rule to ban `utcnow`.
**Warning signs:** `TypeError` in async route handlers; silent test failures if tests never hit the comparison path.

### Pitfall 2: `patch("datetime.datetime")` vs `patch("app.freshness.datetime")`
**What goes wrong:** Patching the stdlib `datetime.datetime` directly affects all modules that imported it, causing widespread test failures. The correct target is the name in the module under test.
**Why it happens:** Developers familiar with mocking sometimes patch the original rather than the reference.
**How to avoid:** Always patch the name as it appears in the module under test: `patch("app.freshness.datetime")`.
**Warning signs:** Other tests start failing when freshness tests run; clock mock has no effect.

### Pitfall 3: pydantic-settings Field Name Case
**What goes wrong:** pydantic-settings v2 matches env vars case-insensitively by default, but the field name in `Settings` determines the Python attribute name. If field is `aircraft_stale_seconds` but env var is `AIRCRAFT_STALE_SECONDS`, it works — but the Python attribute is lowercase, which may not match how other files reference it.
**Why it happens:** Mixed conventions between Python snake_case and env var UPPER_SNAKE_CASE.
**How to avoid:** Use UPPER_SNAKE_CASE for the field names in `Settings` to match env var names exactly. The success criteria explicitly name `settings.AIRCRAFT_STALE_SECONDS`.
**Warning signs:** `AttributeError: 'Settings' object has no attribute 'AIRCRAFT_STALE_SECONDS'` at runtime.

### Pitfall 4: `is_stale` with None Timestamps
**What goes wrong:** If `fetched_at` or `last_seen_at` is `None` (rows written before Phase 17 migration, or rows for which the ingest hasn't run yet), a naive `ts < stale_cutoff(...)` raises `TypeError: '<' not supported between instances of 'NoneType' and 'datetime'`.
**Why it happens:** Pre-migration rows have nullable freshness columns; ingest hasn't populated them yet.
**How to avoid:** `is_stale` must explicitly handle `None` → return `True` (treat missing timestamp as stale).
**Warning signs:** 500 errors on routes after Phase 18 deploys but before Phase 19 ingest populates `fetched_at`.

---

## Code Examples

### freshness.py — complete module
```python
# Source: Python stdlib datetime documentation; pydantic-settings v2 docs
from datetime import datetime, timedelta, timezone


def stale_cutoff(threshold_s: int) -> datetime:
    """Return a timezone-aware UTC datetime `threshold_s` seconds before now."""
    return datetime.now(timezone.utc) - timedelta(seconds=threshold_s)


def is_stale(ts: "datetime | None", threshold_s: int) -> bool:
    """Return True when ts is None or older than threshold_s seconds ago."""
    if ts is None:
        return True
    return ts < stale_cutoff(threshold_s)
```

### config.py — Settings extension (additive only)
```python
from pydantic_settings import BaseSettings
from pydantic import ConfigDict


class Settings(BaseSettings):
    model_config = ConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/opensignal"
    redis_url: str = "redis://localhost:6379/0"
    frontend_origin: str = "http://localhost:3000"
    version: str = "0.1.0"

    # Freshness thresholds (FRESH-02) — overridable via environment variables
    AIRCRAFT_STALE_SECONDS: int = 120
    MILITARY_STALE_SECONDS: int = 600
    SHIP_STALE_SECONDS: int = 900
    GPS_JAMMING_STALE_SECONDS: int = 600


settings = Settings()
```

### test_freshness.py — unit test scaffold (TEST-06 prep)
```python
from datetime import datetime, timezone
from unittest.mock import patch

import pytest
import app.freshness as freshness

FROZEN_NOW = datetime(2026, 3, 13, 12, 0, 0, tzinfo=timezone.utc)


def test_stale_cutoff_returns_timezone_aware():
    result = freshness.stale_cutoff(120)
    assert result.tzinfo is not None


def test_stale_cutoff_exact_offset():
    with patch("app.freshness.datetime") as mock_dt:
        mock_dt.now.return_value = FROZEN_NOW
        result = freshness.stale_cutoff(120)
    assert result == datetime(2026, 3, 13, 11, 58, 0, tzinfo=timezone.utc)


def test_is_stale_none_is_stale():
    assert freshness.is_stale(None, 120) is True


def test_is_stale_old_timestamp():
    stale_ts = datetime(2026, 3, 13, 11, 57, 59, tzinfo=timezone.utc)
    with patch("app.freshness.datetime") as mock_dt:
        mock_dt.now.return_value = FROZEN_NOW
        assert freshness.is_stale(stale_ts, 120) is True


def test_is_stale_fresh_timestamp():
    fresh_ts = datetime(2026, 3, 13, 11, 59, 1, tzinfo=timezone.utc)
    with patch("app.freshness.datetime") as mock_dt:
        mock_dt.now.return_value = FROZEN_NOW
        assert freshness.is_stale(fresh_ts, 120) is False


def test_is_stale_boundary_exactly_at_cutoff():
    # Exactly at cutoff: ts == stale_cutoff → NOT stale (boundary is inclusive on fresh side)
    boundary_ts = datetime(2026, 3, 13, 11, 58, 0, tzinfo=timezone.utc)
    with patch("app.freshness.datetime") as mock_dt:
        mock_dt.now.return_value = FROZEN_NOW
        # boundary ts == cutoff → ts < cutoff is False → is_stale is False
        assert freshness.is_stale(boundary_ts, 120) is False
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `datetime.utcnow()` | `datetime.now(timezone.utc)` | Python 3.12 deprecation | Must use aware datetime throughout |
| `pydantic` v1 `BaseSettings` | `pydantic-settings` v2 separate package | pydantic v2 (2023) | Import from `pydantic_settings`, not `pydantic` |
| Manual `os.environ.get()` with `int()` cast | Typed field in `Settings` | pydantic-settings v2 | Single line, type-safe, .env file aware |

**Deprecated/outdated:**
- `datetime.utcnow()`: Deprecated Python 3.12; produces naive datetime; do not use.
- `from pydantic import BaseSettings`: Moved to separate `pydantic_settings` package in pydantic v2; would raise ImportError.

---

## Open Questions

1. **Boundary semantics for `is_stale` at exactly `threshold_s` seconds**
   - What we know: The requirement says "120 seconds before now" — a timestamp exactly at the cutoff is edge-case
   - What's unclear: Should `ts == stale_cutoff(...)` be stale or fresh?
   - Recommendation: Treat `ts >= stale_cutoff(...)` as fresh (`ts < cutoff` = stale). This is conventional and TEST-06 should document the boundary test explicitly.

2. **`freshness.py` import path for downstream phases**
   - What we know: Routes currently import from `app.db`, `app.models.*`, `app.config`
   - What's unclear: Will phases 19-21 use `from app.freshness import stale_cutoff, is_stale` directly, or inject via `Depends`?
   - Recommendation: Direct import is idiomatic for pure utility functions; FastAPI `Depends` is overkill for a stateless pure function. Document in FRESH-01 that callers import directly.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | pytest 8.x + pytest-asyncio 0.24 |
| Config file | `backend/pytest.ini` — `asyncio_mode = auto`, `testpaths = tests` |
| Quick run command | `cd backend && pytest tests/test_freshness.py -x` |
| Full suite command | `cd backend && pytest` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| FRESH-01 | `from app.freshness import stale_cutoff, is_stale` works | unit | `pytest tests/test_freshness.py -x` | Wave 0 |
| FRESH-01 | `stale_cutoff(120)` returns timezone-aware datetime 120s before now | unit | `pytest tests/test_freshness.py::test_stale_cutoff_exact_offset -x` | Wave 0 |
| FRESH-01 | `is_stale(None, N)` returns True | unit | `pytest tests/test_freshness.py::test_is_stale_none_is_stale -x` | Wave 0 |
| FRESH-01 | `is_stale` boundary at cutoff is False | unit | `pytest tests/test_freshness.py::test_is_stale_boundary_exactly_at_cutoff -x` | Wave 0 |
| FRESH-02 | `settings.AIRCRAFT_STALE_SECONDS` == 120 (default) | unit | `pytest tests/test_freshness.py::test_settings_defaults -x` | Wave 0 |
| FRESH-02 | Env var `AIRCRAFT_STALE_SECONDS=300` overrides default | unit | `pytest tests/test_freshness.py::test_settings_env_override -x` | Wave 0 |

### Sampling Rate
- **Per task commit:** `cd backend && pytest tests/test_freshness.py -x`
- **Per wave merge:** `cd backend && pytest`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/test_freshness.py` — covers FRESH-01 and FRESH-02 (test scaffold from Code Examples above)

---

## Sources

### Primary (HIGH confidence)
- Python 3.11 stdlib `datetime` documentation — `datetime.now(tz)`, `timedelta`, `timezone.utc`
- pydantic-settings v2 official docs — `BaseSettings`, typed field coercion, env var matching
- Project source `backend/app/config.py` — existing `Settings` class pattern (read directly)
- Project source `backend/app/tasks/snapshot_positions.py` — existing `from datetime import datetime, timezone` pattern (read directly)
- Project source `backend/pytest.ini` — `asyncio_mode = auto`, test path config (read directly)
- Python `unittest.mock` documentation — `patch()` for clock mocking

### Secondary (MEDIUM confidence)
- Python 3.12 release notes — `datetime.utcnow()` deprecation warning confirmed

### Tertiary (LOW confidence)
- None

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already installed in project; stdlib datetime is authoritative
- Architecture: HIGH — pattern directly derived from existing `config.py` and `snapshot_positions.py` in the codebase
- Pitfalls: HIGH — timezone/naive datetime pitfall is official Python docs; mock target pitfall is verified from `unittest.mock` docs

**Research date:** 2026-03-13
**Valid until:** 2026-09-13 (stable stdlib + pydantic-settings — 6 months)
