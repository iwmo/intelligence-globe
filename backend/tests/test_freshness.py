"""Unit tests for app.freshness module and freshness settings in app.config."""
from datetime import datetime, timezone
from unittest.mock import patch

import pytest

from app.freshness import is_stale, stale_cutoff

FROZEN_NOW = datetime(2026, 3, 13, 12, 0, 0, tzinfo=timezone.utc)


# ---------------------------------------------------------------------------
# stale_cutoff tests
# ---------------------------------------------------------------------------


def test_stale_cutoff_returns_timezone_aware():
    """stale_cutoff result must carry tzinfo (be timezone-aware)."""
    with patch("app.freshness.datetime") as mock_dt:
        mock_dt.now.return_value = FROZEN_NOW
        result = stale_cutoff(120)
    assert result.tzinfo is not None


def test_stale_cutoff_exact_offset():
    """With frozen now=2026-03-13T12:00:00Z, stale_cutoff(120) == 11:58:00Z."""
    with patch("app.freshness.datetime") as mock_dt:
        mock_dt.now.return_value = FROZEN_NOW
        result = stale_cutoff(120)
    expected = datetime(2026, 3, 13, 11, 58, 0, tzinfo=timezone.utc)
    assert result == expected


# ---------------------------------------------------------------------------
# is_stale tests
# ---------------------------------------------------------------------------


def test_is_stale_none_is_stale():
    """Missing timestamp (None) must always be treated as stale."""
    assert is_stale(None, 120) is True


def test_is_stale_old_timestamp():
    """A timestamp 1s older than the cutoff must be considered stale."""
    with patch("app.freshness.datetime") as mock_dt:
        mock_dt.now.return_value = FROZEN_NOW
        cutoff = datetime(2026, 3, 13, 11, 58, 0, tzinfo=timezone.utc)
        # 1 second before the cutoff
        old_ts = datetime(2026, 3, 13, 11, 57, 59, tzinfo=timezone.utc)
        assert old_ts < cutoff  # sanity
        result = is_stale(old_ts, 120)
    assert result is True


def test_is_stale_fresh_timestamp():
    """A timestamp 1s newer than the cutoff must be considered fresh."""
    with patch("app.freshness.datetime") as mock_dt:
        mock_dt.now.return_value = FROZEN_NOW
        # 1 second after the cutoff (11:58:01Z)
        fresh_ts = datetime(2026, 3, 13, 11, 58, 1, tzinfo=timezone.utc)
        result = is_stale(fresh_ts, 120)
    assert result is False


def test_is_stale_boundary_exactly_at_cutoff():
    """A timestamp exactly equal to the cutoff is fresh (ts < cutoff → stale)."""
    with patch("app.freshness.datetime") as mock_dt:
        mock_dt.now.return_value = FROZEN_NOW
        at_cutoff = datetime(2026, 3, 13, 11, 58, 0, tzinfo=timezone.utc)
        result = is_stale(at_cutoff, 120)
    assert result is False


# ---------------------------------------------------------------------------
# Settings tests
# ---------------------------------------------------------------------------


def test_settings_defaults():
    """All four stale threshold settings must have expected default values."""
    from app.config import settings

    assert settings.AIRCRAFT_STALE_SECONDS == 120
    assert settings.MILITARY_STALE_SECONDS == 600
    assert settings.SHIP_STALE_SECONDS == 900
    assert settings.GPS_JAMMING_STALE_SECONDS == 600


def test_settings_env_override(monkeypatch):
    """AIRCRAFT_STALE_SECONDS env var overrides the default at runtime."""
    monkeypatch.setenv("AIRCRAFT_STALE_SECONDS", "300")
    from app.config import Settings

    fresh_settings = Settings()
    assert fresh_settings.AIRCRAFT_STALE_SECONDS == 300
