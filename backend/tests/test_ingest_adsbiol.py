"""
Unit tests for ADSB.lol aircraft ingest worker — RED phase.

Covers INGEST-01 through INGEST-05 and SCHEMA-01 through SCHEMA-06.
All tests import from app.tasks.ingest_adsbiol which does NOT exist yet.
Running pytest on this file will produce ImportError or ModuleNotFoundError
until Plan 03 creates that module. That is intentional — this is the RED phase.
"""
import os
import pathlib
import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from app.tasks.ingest_adsbiol import (
    parse_adsbiol_aircraft,
    ingest_commercial_aircraft,
    ingest_military_aircraft,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_ac(**overrides):
    """Build a full, valid ADSB.lol aircraft dict (mirrors live API shape)."""
    ac = {
        "hex": "a1b2c3",
        "lat": 37.6,
        "lon": -122.4,
        "alt_baro": 35000,
        "gs": 480,
        "track": 270.0,
        "baro_rate": -64,
        "r": "N12345",
        "t": "B738",
        "emergency": "none",
        "nav_modes": ["autopilot"],
        "ias": 280,
        "tas": 460,
        "mach": 0.78,
        "roll": 0.0,
        "flight": "UAL123 ",
    }
    ac.update(overrides)
    return ac


def _make_mock_http(ac_list=None):
    """Return a patched httpx.AsyncClient context manager that returns ac_list."""
    if ac_list is None:
        ac_list = [_make_ac()]
    mock_resp = MagicMock()
    mock_resp.raise_for_status = MagicMock()
    mock_resp.json = MagicMock(return_value={"ac": ac_list, "total": len(ac_list)})
    mock_client = AsyncMock()
    mock_client.get = AsyncMock(return_value=mock_resp)
    mock_http_cm = MagicMock()
    mock_http_cm.__aenter__ = AsyncMock(return_value=mock_client)
    mock_http_cm.__aexit__ = AsyncMock(return_value=False)
    return mock_http_cm, mock_client


def _make_mock_session():
    """Return a patched AsyncSessionLocal context manager."""
    mock_session = AsyncMock()
    mock_session.execute = AsyncMock()
    mock_session.commit = AsyncMock()
    mock_cm = MagicMock()
    mock_cm.__aenter__ = AsyncMock(return_value=mock_session)
    mock_cm.__aexit__ = AsyncMock(return_value=False)
    return mock_cm, mock_session


def _make_mock_redis(return_value=None):
    """Return a patched redis client whose get() returns return_value."""
    mock_redis = MagicMock()
    mock_redis.get = MagicMock(return_value=return_value)
    return mock_redis


# ---------------------------------------------------------------------------
# INGEST-01: null-position filtering
# ---------------------------------------------------------------------------

def test_null_position_filtered():
    """parse_adsbiol_aircraft must return None when lat or lon is None."""
    assert parse_adsbiol_aircraft(_make_ac(lat=None)) is None
    assert parse_adsbiol_aircraft(_make_ac(lon=None)) is None


# ---------------------------------------------------------------------------
# INGEST-01: full parse of a commercial aircraft dict
# ---------------------------------------------------------------------------

def test_parse_commercial_aircraft():
    """parse_adsbiol_aircraft must map all ADSB.lol fields to the expected schema."""
    ac = _make_ac()
    result = parse_adsbiol_aircraft(ac)

    assert result is not None
    assert result["icao24"] == ac["hex"]
    assert result["callsign"] == ac["flight"].strip()
    assert result["latitude"] == ac["lat"]
    assert result["longitude"] == ac["lon"]
    assert result["baro_altitude"] == ac["alt_baro"]
    assert result["velocity"] == ac["gs"]
    assert result["true_track"] == ac["track"]
    assert result["vertical_rate"] == ac["baro_rate"]
    assert result["registration"] == ac["r"]
    assert result["type_code"] == ac["t"]
    assert result["emergency"] == ac["emergency"]
    assert result["nav_modes"] == ac["nav_modes"]
    assert result["ias"] == ac["ias"]
    assert result["tas"] == ac["tas"]
    assert result["mach"] == ac["mach"]
    assert result["roll"] == ac["roll"]


# ---------------------------------------------------------------------------
# INGEST-02: military URL uses filter_mil; commercial does not
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_military_url_has_filter_mil():
    """ingest_military_aircraft() URL must contain filter_mil; commercial URL must not."""
    mock_http_cm, mock_client = _make_mock_http()
    mock_db_cm, _ = _make_mock_session()

    captured_urls = []
    original_get = mock_client.get

    async def capturing_get(url, **kwargs):
        captured_urls.append(url)
        return await original_get(url, **kwargs)

    mock_client.get = capturing_get

    with patch("app.tasks.ingest_adsbiol.httpx.AsyncClient", return_value=mock_http_cm), \
         patch("app.tasks.ingest_adsbiol.AsyncSessionLocal", return_value=mock_db_cm), \
         patch("app.tasks.ingest_adsbiol.redis_client", _make_mock_redis(None)):
        await ingest_military_aircraft()

    assert len(captured_urls) == 1
    assert "filter_mil" in captured_urls[0]

    # Now verify commercial does NOT include filter_mil
    mock_http_cm2, mock_client2 = _make_mock_http()
    mock_db_cm2, _ = _make_mock_session()
    commercial_urls = []

    async def capturing_get2(url, **kwargs):
        commercial_urls.append(url)
        return await (AsyncMock(return_value=mock_http_cm2.__aenter__.return_value.get.return_value))(url, **kwargs)

    mock_client2.get = AsyncMock(side_effect=lambda url, **kw: _sync_capture_and_return(url, commercial_urls, mock_http_cm2))

    # Re-mock with a simpler approach
    mil_cm, mil_client = _make_mock_http()
    com_cm, com_client = _make_mock_http()
    com_urls = []

    original_com_get = com_client.get.side_effect

    async def com_capturing(url, **kwargs):
        com_urls.append(url)
        resp = MagicMock()
        resp.raise_for_status = MagicMock()
        resp.json = MagicMock(return_value={"ac": [_make_ac()], "total": 1})
        return resp

    com_client.get = com_capturing
    mock_db_cm3, _ = _make_mock_session()

    with patch("app.tasks.ingest_adsbiol.httpx.AsyncClient", return_value=com_cm), \
         patch("app.tasks.ingest_adsbiol.AsyncSessionLocal", return_value=mock_db_cm3), \
         patch("app.tasks.ingest_adsbiol.redis_client", _make_mock_redis(None)):
        await ingest_commercial_aircraft()

    assert len(com_urls) == 1
    assert "filter_mil" not in com_urls[0]


def _sync_capture_and_return(url, url_list, mock_http_cm):
    """Helper — not a real async function; used only to satisfy side_effect type."""
    url_list.append(url)
    return mock_http_cm.__aenter__.return_value.get.return_value


# ---------------------------------------------------------------------------
# INGEST-03: base URL is configurable via ADSBIO_BASE_URL env var
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_base_url_configurable():
    """ingest_commercial_aircraft() must use ADSBIO_BASE_URL env var as the base URL."""
    mock_http_cm, mock_client = _make_mock_http()
    mock_db_cm, _ = _make_mock_session()
    captured_urls = []

    async def capturing_get(url, **kwargs):
        captured_urls.append(url)
        resp = MagicMock()
        resp.raise_for_status = MagicMock()
        resp.json = MagicMock(return_value={"ac": [_make_ac()], "total": 1})
        return resp

    mock_client.get = capturing_get

    with patch.dict(os.environ, {"ADSBIO_BASE_URL": "http://custom-host:9999"}), \
         patch("app.tasks.ingest_adsbiol.httpx.AsyncClient", return_value=mock_http_cm), \
         patch("app.tasks.ingest_adsbiol.AsyncSessionLocal", return_value=mock_db_cm), \
         patch("app.tasks.ingest_adsbiol.redis_client", _make_mock_redis(None)):
        await ingest_commercial_aircraft()

    assert len(captured_urls) == 1
    assert captured_urls[0].startswith("http://custom-host:9999"), (
        f"Expected URL to start with http://custom-host:9999, got: {captured_urls[0]}"
    )


# ---------------------------------------------------------------------------
# INGEST-04: no OpenSky references in the module source
# ---------------------------------------------------------------------------

def test_no_opensky_references():
    """ingest_adsbiol.py must contain no OpenSky-specific identifiers."""
    source_path = pathlib.Path(__file__).parent.parent / "app" / "tasks" / "ingest_adsbiol.py"
    if not source_path.exists():
        pytest.xfail(reason="ingest_adsbiol.py not yet created (Plan 03 will create it)")

    contents = source_path.read_text()
    assert "OPENSKY_CLIENT_ID" not in contents, "Found OPENSKY_CLIENT_ID in ingest_adsbiol.py"
    assert "fetch_opensky_token" not in contents, "Found fetch_opensky_token in ingest_adsbiol.py"
    assert "opensky-network.org" not in contents, "Found opensky-network.org URL in ingest_adsbiol.py"


# ---------------------------------------------------------------------------
# INGEST-05: bounding-box parameter formatting
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_bbox_param_format():
    """When Redis has a viewport bbox, the URL must include box= in the correct order."""
    # Redis returns: "min_lat,min_lon,max_lat,max_lon" = "10.0,20.0,50.0,60.0"
    # Expected box= mapping: box=min_lat,max_lat,min_lon,max_lon = box=10.0,50.0,20.0,60.0
    mock_http_cm, mock_client = _make_mock_http()
    mock_db_cm, _ = _make_mock_session()
    captured_urls = []

    async def capturing_get(url, **kwargs):
        captured_urls.append(url)
        resp = MagicMock()
        resp.raise_for_status = MagicMock()
        resp.json = MagicMock(return_value={"ac": [_make_ac()], "total": 1})
        return resp

    mock_client.get = capturing_get

    with patch("app.tasks.ingest_adsbiol.httpx.AsyncClient", return_value=mock_http_cm), \
         patch("app.tasks.ingest_adsbiol.AsyncSessionLocal", return_value=mock_db_cm), \
         patch("app.tasks.ingest_adsbiol.redis_client", _make_mock_redis(b"10.0,20.0,50.0,60.0")):
        await ingest_commercial_aircraft()

    assert len(captured_urls) == 1
    assert "box=10.0,50.0,20.0,60.0" in captured_urls[0], (
        f"Expected 'box=10.0,50.0,20.0,60.0' in URL, got: {captured_urls[0]}"
    )


@pytest.mark.asyncio
async def test_no_bbox_when_redis_empty():
    """When Redis returns None for viewport_bbox, the URL must NOT contain box=."""
    mock_http_cm, mock_client = _make_mock_http()
    mock_db_cm, _ = _make_mock_session()
    captured_urls = []

    async def capturing_get(url, **kwargs):
        captured_urls.append(url)
        resp = MagicMock()
        resp.raise_for_status = MagicMock()
        resp.json = MagicMock(return_value={"ac": [_make_ac()], "total": 1})
        return resp

    mock_client.get = capturing_get

    with patch("app.tasks.ingest_adsbiol.httpx.AsyncClient", return_value=mock_http_cm), \
         patch("app.tasks.ingest_adsbiol.AsyncSessionLocal", return_value=mock_db_cm), \
         patch("app.tasks.ingest_adsbiol.redis_client", _make_mock_redis(None)):
        await ingest_commercial_aircraft()

    assert len(captured_urls) == 1
    assert "box=" not in captured_urls[0], (
        f"Expected no 'box=' in URL when Redis is empty, got: {captured_urls[0]}"
    )


# ---------------------------------------------------------------------------
# SCHEMA-01: alt_baro="ground" normalised to None; numeric values preserved
# ---------------------------------------------------------------------------

def test_ground_altitude_normalised():
    """parse_adsbiol_aircraft must normalise alt_baro='ground' to baro_altitude=None."""
    result_ground = parse_adsbiol_aircraft(_make_ac(alt_baro="ground"))
    assert result_ground is not None
    assert result_ground["baro_altitude"] is None

    result_35k = parse_adsbiol_aircraft(_make_ac(alt_baro=35000))
    assert result_35k is not None
    assert result_35k["baro_altitude"] == 35000

    result_1k = parse_adsbiol_aircraft(_make_ac(alt_baro=1000))
    assert result_1k is not None
    assert result_1k["baro_altitude"] == 1000


# ---------------------------------------------------------------------------
# SCHEMA-02: emergency field stored as string or None
# ---------------------------------------------------------------------------

def test_emergency_field_stored():
    """parse_adsbiol_aircraft must preserve emergency string values and return None when absent."""
    result_none = parse_adsbiol_aircraft(_make_ac(emergency="none"))
    assert result_none["emergency"] == "none"

    result_general = parse_adsbiol_aircraft(_make_ac(emergency="general"))
    assert result_general["emergency"] == "general"

    ac_no_emergency = _make_ac()
    del ac_no_emergency["emergency"]
    result_missing = parse_adsbiol_aircraft(ac_no_emergency)
    assert result_missing["emergency"] is None


# ---------------------------------------------------------------------------
# SCHEMA-03: nav_modes field preserved as list or None
# ---------------------------------------------------------------------------

def test_nav_modes_field():
    """parse_adsbiol_aircraft must preserve nav_modes list and return None (not []) when absent."""
    result_list = parse_adsbiol_aircraft(_make_ac(nav_modes=["autopilot", "althold"]))
    assert result_list["nav_modes"] == ["autopilot", "althold"]

    ac_no_nav = _make_ac()
    del ac_no_nav["nav_modes"]
    result_missing = parse_adsbiol_aircraft(ac_no_nav)
    assert result_missing["nav_modes"] is None


# ---------------------------------------------------------------------------
# SCHEMA-04: speed fields ias/tas/mach preserved or None
# ---------------------------------------------------------------------------

def test_speed_fields():
    """parse_adsbiol_aircraft must preserve ias/tas/mach values and return None when absent."""
    result = parse_adsbiol_aircraft(_make_ac(ias=280, tas=460, mach=0.78))
    assert result["ias"] == 280
    assert result["tas"] == 460
    assert result["mach"] == 0.78

    ac_no_speed = _make_ac()
    del ac_no_speed["ias"]
    del ac_no_speed["tas"]
    del ac_no_speed["mach"]
    result_missing = parse_adsbiol_aircraft(ac_no_speed)
    assert result_missing["ias"] is None
    assert result_missing["tas"] is None
    assert result_missing["mach"] is None


# ---------------------------------------------------------------------------
# SCHEMA-05: roll field preserved or None
# ---------------------------------------------------------------------------

def test_roll_field():
    """parse_adsbiol_aircraft must preserve roll value and return None when absent."""
    result = parse_adsbiol_aircraft(_make_ac(roll=15.5))
    assert result["roll"] == 15.5

    ac_no_roll = _make_ac()
    del ac_no_roll["roll"]
    result_missing = parse_adsbiol_aircraft(ac_no_roll)
    assert result_missing["roll"] is None


# ---------------------------------------------------------------------------
# SCHEMA-06: registration and type_code fields preserved or None
# ---------------------------------------------------------------------------

def test_registration_type_fields():
    """parse_adsbiol_aircraft must map r->registration and t->type_code; None when absent."""
    result = parse_adsbiol_aircraft(_make_ac(r="N12345", t="B738"))
    assert result["registration"] == "N12345"
    assert result["type_code"] == "B738"

    ac_no_reg = _make_ac()
    del ac_no_reg["r"]
    del ac_no_reg["t"]
    result_missing = parse_adsbiol_aircraft(ac_no_reg)
    assert result_missing["registration"] is None
    assert result_missing["type_code"] is None
