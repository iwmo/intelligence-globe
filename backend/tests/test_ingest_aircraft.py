"""
OpenSky ingest retired in Phase 38 — see test_ingest_adsbiol.py.

The OpenSky-based ingest worker (app.workers.ingest_aircraft / app.tasks.ingest_aircraft)
was replaced by the ADSB.lol ingest worker (app.tasks.ingest_adsbiol) during Phase 38.

All tests in this file have been retired to avoid collection errors caused by stale
imports of app.workers.ingest_aircraft (module path that never existed) and references
to OPENSKY_CLIENT_ID, fetch_opensky_token, and fetch_aircraft_states from the old module.

See: backend/tests/test_ingest_adsbiol.py for the replacement test suite.
"""
import pytest

pytest.skip(
    "OpenSky ingest retired in Phase 38 — see test_ingest_adsbiol.py",
    allow_module_level=True,
)
