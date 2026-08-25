"""Slippy-tile helpers and congestion buckets for TomTom flow sampling."""

from __future__ import annotations

import math
from datetime import datetime, timezone

MIN_TILE_ZOOM = 8
MAX_TILE_ZOOM = 16
MERCATOR_LAT_LIMIT = 85.05112878
TRAFFIC_MAX_SPAN_DEG = 0.08


def utc_day_key(epoch_ms: float | None = None) -> str:
    if epoch_ms is None:
        return datetime.now(timezone.utc).strftime("%Y-%m-%d")
    return datetime.fromtimestamp(epoch_ms / 1000, tz=timezone.utc).strftime("%Y-%m-%d")


def clamp_bbox(
    min_lat: float,
    max_lat: float,
    min_lon: float,
    max_lon: float,
    max_span: float = TRAFFIC_MAX_SPAN_DEG,
) -> tuple[float, float, float, float]:
    south, north = sorted((min_lat, max_lat))
    west, east = sorted((min_lon, max_lon))
    mid_lat = (south + north) / 2
    mid_lon = (west + east) / 2
    half = max_span / 2
    return (
        max(-85.0, mid_lat - half),
        min(85.0, mid_lat + half),
        max(-180.0, mid_lon - half),
        min(180.0, mid_lon + half),
    )


def sample_grid(
    min_lat: float,
    max_lat: float,
    min_lon: float,
    max_lon: float,
    n: int = 3,
) -> list[tuple[float, float]]:
    if n < 1:
        return []
    lats = [min_lat] if n == 1 else [min_lat + i * (max_lat - min_lat) / (n - 1) for i in range(n)]
    lons = [min_lon] if n == 1 else [min_lon + i * (max_lon - min_lon) / (n - 1) for i in range(n)]
    return [(lat, lon) for lat in lats for lon in lons]


def congestion_ratio(current_kmh: float | None, free_kmh: float | None) -> float | None:
    if current_kmh is None or free_kmh is None or free_kmh <= 0:
        return None
    return max(0.0, min(1.0, current_kmh / free_kmh))


def congestion_bucket(ratio: float | None, closed: bool = False) -> str:
    if closed:
        return "closed"
    if ratio is None:
        return "unknown"
    if ratio >= 0.85:
        return "free"
    if ratio >= 0.55:
        return "slow"
    if ratio >= 0.30:
        return "heavy"
    return "standstill"
