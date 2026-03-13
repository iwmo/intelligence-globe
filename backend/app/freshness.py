from datetime import datetime, timedelta, timezone


def stale_cutoff(threshold_s: int) -> datetime:
    """Return a timezone-aware UTC datetime `threshold_s` seconds before now."""
    return datetime.now(timezone.utc) - timedelta(seconds=threshold_s)


def is_stale(ts: "datetime | None", threshold_s: int) -> bool:
    """Return True when ts is None or older than threshold_s seconds ago."""
    if ts is None:
        return True
    return ts < stale_cutoff(threshold_s)
