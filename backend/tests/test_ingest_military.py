"""
airplanes.live military ingest retired in Phase 38 — see test_ingest_adsbiol.py.

The airplanes.live military ingest worker (app.tasks.ingest_military) was replaced
by the ADSB.lol ingest worker (app.tasks.ingest_adsbiol) during Phase 38.

All tests in this file have been retired to avoid collection errors caused by stale
imports of app.tasks.ingest_military (module deleted in Plan 04).

See: backend/tests/test_ingest_adsbiol.py for the replacement test suite.
"""
import pytest

pytest.skip(
    "airplanes.live military ingest retired in Phase 38 — see test_ingest_adsbiol.py",
    allow_module_level=True,
)
