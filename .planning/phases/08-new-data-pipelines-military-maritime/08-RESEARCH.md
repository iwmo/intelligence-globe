# Phase 8: New Data Pipelines — Military + Maritime - Research

**Researched:** 2026-03-12
**Domain:** ADS-B military flight ingestion (airplanes.live), AIS maritime streaming (aisstream.io), CesiumJS multi-layer rendering, Redis position caching, FastAPI WebSocket proxy
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| LAY-01 | User sees military flights as distinct amber icons, toggleable separately from commercial flights, sourced from airplanes.live /v2/mil at 300-second cadence | airplanes.live /v2/mil endpoint confirmed live with full field schema; RQ self-re-enqueue pattern from aircraft ingest is directly reusable; PointPrimitiveCollection + amber Color is the correct rendering approach |
| LAY-03 | User sees maritime traffic (ship icons) from AIS data with click-to-inspect vessel metadata, layer recovers gracefully from WebSocket reconnections | aisstream.io WebSocket confirmed with MetaData+PositionReport structure; Redis ship cache pattern prevents freeze on reconnect; FastAPI background task with websockets `async for` reconnect loop is the correct proxy approach |
</phase_requirements>

---

## Summary

Phase 8 adds two independent data layers: military aircraft (LAY-01) and maritime ships (LAY-03). The two pipelines have fundamentally different data acquisition patterns — military uses a simple REST poll, maritime uses a persistent WebSocket stream — and each requires distinct backend infrastructure, a new database model, new API routes, and new frontend Layer + DetailPanel components.

The military pipeline closely mirrors the existing commercial aircraft pipeline. airplanes.live `/v2/mil` returns the same JSON schema as the commercial ADS-B feeds (the `hex`, `flight`, `t`, `alt_baro`, `gs`, `track`, `lat`, `lon` fields are identical). The primary differences are: polling every 300 seconds (not 90s), using amber color (`#F59E0B`) instead of orange, a new `military_aircraft` table, and a distinct toggle key in the Zustand store.

The maritime pipeline is substantially more complex. aisstream.io streams AIS messages over a persistent WebSocket that disconnects every few minutes (no SLA). The backend must run a long-lived async background worker that reconnects using the `websockets` library's infinite `async for` iterator, writes vessel positions to Redis on every message (as the last-known-position cache), and batch-upserts to PostgreSQL on a timer (every 30 seconds) so the frontend can poll a REST endpoint without hitting Redis directly. The frontend ship layer polls `/api/ships/` on a 30-second interval, renders cyan (`#06B6D4`) points, and dispatches click events to the existing `ScreenSpaceEventHandler` with a new `mmsi:` string prefix for disambiguation.

**Primary recommendation:** Implement LAY-01 first (low-risk, mirrors existing aircraft pattern), then LAY-03 (requires new backend WebSocket worker and Redis cache design). Both share the same frontend layer/panel/toggle pattern established in Phase 6 for the aircraft layer.

---

## Standard Stack

### Core (already in project — no new installation required)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| FastAPI | current | New route routers: /api/military/, /api/ships/ | Already used for aircraft, satellites |
| SQLAlchemy (async) | current | New models: MilitaryAircraft, Ship | Existing ORM pattern |
| Alembic | current | Schema migrations for military_aircraft, ships tables | Existing migration chain |
| Redis (redis-py) | current | Ship last-known-position cache (hset/hgetall by MMSI) | Already in Docker Compose stack |
| RQ | current | Military aircraft ingest self-re-enqueue worker | Existing RQ pattern from aircraft ingest |
| React + Zustand | current | New store slices: militaryAircraft, ships toggles | Existing store architecture |
| @tanstack/react-query | current | useQuery hooks: useMilitaryAircraft, useShips | Existing hook pattern |
| CesiumJS PointPrimitiveCollection | current | Military amber dots (reuse aircraft render pattern) | BlendOption.OPAQUE proven at scale |

### New Dependencies

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| websockets (Python) | >=12.0 | aisstream.io WebSocket client with auto-reconnect via `async for` | Maritime ingest worker only |

**Installation (backend only — websockets may already be present):**
```bash
pip install websockets
```

Verify it is not already in requirements.txt before adding.

---

## Architecture Patterns

### Recommended File Layout for Phase 8

```
backend/app/
├── models/
│   ├── military_aircraft.py   # New — mirrors aircraft.py, adds is_military flag (always True)
│   └── ship.py                # New — MMSI pk, vessel_name, vessel_type, lat, lon, sog, cog, heading, last_update
├── tasks/
│   └── ingest_military.py     # New — RQ worker, polls airplanes.live /v2/mil every 300s
├── workers/
│   └── ingest_ais.py          # New — long-lived async WebSocket worker, Redis cache + PG batch write
├── api/
│   ├── routes_military.py     # New — GET /api/military/, GET /api/military/{hex}
│   └── routes_ships.py        # New — GET /api/ships/, GET /api/ships/{mmsi}
└── main.py                    # Add 2 new router includes

backend/alembic/versions/
└── XXXX_add_military_aircraft_and_ships_tables.py

frontend/src/
├── hooks/
│   ├── useMilitaryAircraft.ts # New — refetchInterval: 300_000
│   └── useShips.ts            # New — refetchInterval: 30_000
├── components/
│   ├── MilitaryAircraftLayer.tsx  # New — PointPrimitiveCollection, amber color
│   ├── MilitaryDetailPanel.tsx    # New — callsign, ICAO24, type, altitude, speed, heading
│   ├── ShipLayer.tsx              # New — PointPrimitiveCollection, cyan color
│   └── ShipDetailPanel.tsx        # New — MMSI, vessel name, type, speed, heading, last update
└── store/
    └── useAppStore.ts             # Extend: add militaryAircraft + ships to layers{}, add selectedMilitaryId + selectedShipId
```

### Pattern 1: Military Aircraft Ingest (RQ Self-Re-enqueue)

**What:** Poll airplanes.live `/v2/mil` every 300 seconds via RQ task, upsert to `military_aircraft` table.
**When to use:** Stateless REST data source, low frequency, acceptable stale window.
**Example:**
```python
# Source: mirrors backend/app/tasks/ingest_aircraft.py pattern
MIL_URL = "http://api.airplanes.live/v2/mil"
POLL_INTERVAL_SECONDS = 300

async def ingest_military_aircraft() -> int:
    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.get(MIL_URL)
        resp.raise_for_status()
        data = resp.json()
    aircraft_list = data.get("ac") or []
    # filter: skip if lat/lon absent
    valid = [a for a in aircraft_list if a.get("lat") and a.get("lon")]
    async with AsyncSessionLocal() as session:
        for ac in valid:
            stmt = pg_insert(MilitaryAircraft).values(
                hex=ac["hex"],
                flight=ac.get("flight", "").strip() or None,
                aircraft_type=ac.get("t"),
                alt_baro=None if ac.get("alt_baro") == "ground" else ac.get("alt_baro"),
                gs=ac.get("gs"),
                track=ac.get("track"),
                latitude=ac["lat"],
                longitude=ac["lon"],
                squawk=ac.get("squawk"),
            ).on_conflict_do_update(
                index_elements=["hex"],
                set_=dict(..., updated_at=func.now()),
            )
            await session.execute(stmt)
        await session.commit()
    return len(valid)
```

### Pattern 2: AIS WebSocket Worker with Redis Cache (Long-lived background task)

**What:** Persistent asyncio worker that connects to aisstream.io, writes each vessel position to Redis (HSET `ships:{mmsi}` field per vessel), and batch-flushes to PostgreSQL every 30 seconds.
**When to use:** Streaming data source with mandatory reconnect resilience.

```python
# Source: websockets docs + aisstream official example pattern
import asyncio, json, os, redis.asyncio as aioredis
from websockets.asyncio.client import connect

WS_URL = "wss://stream.aisstream.io/v0/stream"
BATCH_INTERVAL = 30  # seconds

async def run_ais_worker():
    redis = aioredis.from_url(os.getenv("REDIS_URL", "redis://redis:6379/0"))
    subscribe_msg = json.dumps({
        "APIKey": os.environ["AISSTREAM_API_KEY"],
        "BoundingBoxes": [[[-90, -180], [90, 180]]],
        "FilterMessageTypes": ["PositionReport"],
    })

    async for websocket in connect(WS_URL, ping_interval=None):
        try:
            await websocket.send(subscribe_msg)  # MUST send within 3 seconds
            async for raw in websocket:
                msg = json.loads(raw)
                if msg.get("MessageType") != "PositionReport":
                    continue
                meta = msg["MetaData"]
                mmsi = str(meta["MMSI"])
                pos = msg["Message"]["PositionReport"]
                await redis.hset(f"ship:{mmsi}", mapping={
                    "mmsi": mmsi,
                    "ship_name": meta.get("ShipName", ""),
                    "latitude": meta["latitude"],
                    "longitude": meta["longitude"],
                    "sog": pos.get("Sog", 0),
                    "cog": pos.get("Cog", 0),
                    "true_heading": pos.get("TrueHeading", 511),  # 511 = not available
                    "nav_status": pos.get("NavigationalStatus", 0),
                    "time_utc": meta.get("time_utc", ""),
                })
                await redis.expire(f"ship:{mmsi}", 600)  # 10-min TTL
        except Exception:
            continue  # triggers reconnect via async for

async def batch_flush_ships_to_pg():
    """Periodic task: read all ship:{*} keys from Redis, upsert to PostgreSQL."""
    ...
```

**Critical:** `await websocket.send(subscribe_msg)` MUST happen immediately after connection opens — aisstream closes the connection if subscribe is not received within 3 seconds.

**Reconnect behavior:** The `async for websocket in connect(...)` pattern from the `websockets` library automatically reconnects with exponential backoff (starting 3 seconds, max 60 seconds) on `OSError`, `asyncio.TimeoutError`, and WebSocket close events. Setting `ping_interval=None` prevents the library from sending pings that aisstream.io does not expect.

### Pattern 3: Frontend Layer Component (mirrors AircraftLayer.tsx)

**What:** React component that takes `viewer` prop, creates a `PointPrimitiveCollection`, subscribes to data hook, runs rAF lerp loop for smooth movement.
**When to use:** Any new real-time point layer on the globe.

Key differences for MilitaryAircraftLayer vs AircraftLayer:
- Color: `Color.fromCssColorString('#F59E0B')` (amber)
- Click ID prefix: use the `hex` value directly as the point's `id` — add `mmsi:` prefix for ships
- Store key: `layers.militaryAircraft` (not `layers.aircraft`)

Key differences for ShipLayer vs AircraftLayer:
- Color: `Color.fromCssColorString('#06B6D4')` (cyan)
- No lerp needed: ships move slowly enough that direct position updates suffice
- ID: `mmsi:` + mmsi string (e.g. `"mmsi:123456789"`) for click disambiguation

### Pattern 4: Click Disambiguation Extension

The existing `ScreenSpaceEventHandler` in `AircraftLayer.tsx` already handles satellites and commercial aircraft by inspecting the `picked.id` type. Phase 8 must extend it to handle two additional entity types. **Do not create new ScreenSpaceEventHandlers** — add MMSI prefix detection to the existing handler.

```typescript
// In the existing click handler (AircraftLayer.tsx or a shared handler):
if (typeof picked.id === 'string' && picked.id.startsWith('mmsi:')) {
    const mmsi = picked.id.slice(5);
    useAppStore.getState().setSelectedShipId(mmsi);
    useAppStore.getState().setSelectedMilitaryId(null);
    useAppStore.getState().setSelectedAircraftId(null);
    useAppStore.getState().setSelectedSatelliteId(null);
} else if (typeof picked.id === 'string' && picked.id.startsWith('mil:')) {
    const hex = picked.id.slice(4);
    useAppStore.getState().setSelectedMilitaryId(hex);
    // clear others...
}
```

Alternatively: military aircraft use the same bare hex string but store dispatch routes differently if the ID is known to be military. Using a `mil:` prefix is cleaner — avoids potential ICAO24 collisions between military and commercial tables.

### Anti-Patterns to Avoid

- **Creating a new ScreenSpaceEventHandler for each layer:** The existing handler race condition note in AircraftLayer.tsx is real. All click handling stays in one handler.
- **Connecting aisstream.io WebSocket from the browser:** The API key would be exposed in client JS. The backend must proxy.
- **Polling aisstream.io REST:** They are WebSocket-only. There is no REST fallback.
- **Global bounding box with no filter:** Global subscription sends ~300 msg/s. Use `FilterMessageTypes: ["PositionReport"]` to reduce load. Consider regional bounding box unless global coverage is required.
- **Re-creating PointPrimitiveCollection on data refresh:** Creates GPU memory leak. Create once, update `point.position` in-place.
- **Using Entity API for ships:** Same rule as satellites/aircraft — Primitive API only for >100 objects.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| WebSocket auto-reconnect with backoff | Custom retry loop with `time.sleep` | `async for websocket in connect(uri)` from `websockets` | Built-in exponential backoff, handles all transient errors including server-initiated closes |
| AIS last-known-position persistence across reconnects | In-memory dict in Python process | Redis HSET `ship:{mmsi}` with TTL | Survives worker restarts; process memory lost on reconnect/restart |
| Military aircraft data | Custom scraper or ADSB Exchange | airplanes.live `/v2/mil` (free, no auth) | ADSB Exchange moved to paid RapidAPI; airplanes.live is the correct free source |
| AIS vessel metadata (ship name/type) | Parse NMEA sentences | aisstream.io MetaData.ShipName + ShipStaticData messages | Pre-parsed, JSON, already joined |
| Geographic filtering | Custom lat/lon bounds check | aisstream.io BoundingBoxes subscription parameter | Server-side filter; reduces bandwidth |

**Key insight:** The aisstream.io `websockets` infinite iterator is the entire reconnect story — no custom backoff logic required. Adding `ping_interval=None` is the documented workaround for aisstream.io compatibility.

---

## Common Pitfalls

### Pitfall 1: Subscribe Message Not Sent Within 3 Seconds
**What goes wrong:** aisstream.io closes the connection silently if the subscription JSON is not received within 3 seconds of the WebSocket handshake.
**Why it happens:** The `async for websocket in connect(...)` pattern gives you a live connection — but you must immediately `await websocket.send(subscribe_msg)` before entering the message loop.
**How to avoid:** First line after entering the `async for websocket` block must be `await websocket.send(subscribe_msg)`. No `await asyncio.sleep()` before it.
**Warning signs:** Connection closes after exactly 3 seconds with no messages received.

### Pitfall 2: alt_baro = "ground" for Landed Aircraft
**What goes wrong:** `alt_baro` in the airplanes.live response can be the string `"ground"` (not a number) when the aircraft is on the ground. Casting directly to `Float` will raise a type error.
**Why it happens:** ADS-B protocol uses a special sentinel for on-ground state.
**How to avoid:** `alt_baro = None if ac.get("alt_baro") == "ground" else ac.get("alt_baro")`
**Warning signs:** Database insert fails with `ValueError: invalid literal for float`.

### Pitfall 3: Module-Scope Maps Not Cleared Between Layer Re-Mounts
**What goes wrong:** `pointsByIcao24`, `prevPositions`, `currPositions` are module-scope in `AircraftLayer.tsx` and cleared on unmount. The new `MilitaryAircraftLayer.tsx` must follow the same pattern — its maps must be distinct module-scope variables, not shared with the aircraft layer.
**Why it happens:** Two components sharing the same module-scope map would corrupt each other's position data.
**How to avoid:** Each Layer file declares its own module-scope maps. Military layer has `militaryPointsByHex`, `militaryPrevPositions`, `militaryCurrPositions`.

### Pitfall 4: aisstream.io TTL and Stale Ships
**What goes wrong:** Ships that stop transmitting remain in the ships table indefinitely, cluttering the globe with ghost vessels.
**Why it happens:** AIS transmissions stop when a vessel powers off or goes out of coverage. No DELETE is triggered.
**How to avoid:** Set Redis TTL of 600 seconds (10 minutes) on each `ship:{mmsi}` key. When batch-flushing to PostgreSQL, only upsert vessels whose Redis key still exists (i.e., received a message in the last 10 minutes). Optionally: add a cleanup task that DELETEs ships rows where `last_update < NOW() - INTERVAL '15 minutes'`.

### Pitfall 5: RightDrawer Ships Panel Conflict
**What goes wrong:** The existing `RightDrawer` renders `SatelliteDetailPanel` or `AircraftDetailPanel` based on which `selectedId` is non-null. Adding `selectedShipId` and `selectedMilitaryId` requires the drawer to handle 4 possible non-null states.
**Why it happens:** Current logic is `isOpen = selectedSatelliteId !== null || selectedAircraftId !== null`.
**How to avoid:** Extend `isOpen` to include the two new IDs, add conditional renders for `ShipDetailPanel` and `MilitaryDetailPanel` inside the drawer. Ensure exactly one is selected at a time (clicking a new entity clears all others).

### Pitfall 6: Redis Connection in Async Context
**What goes wrong:** Using the synchronous `redis` library inside an `asyncio` worker deadlocks or blocks the event loop.
**Why it happens:** `redis.Redis` is synchronous; it must not be called from async code.
**How to avoid:** Use `redis.asyncio.Redis` (available since redis-py 4.2) or `aioredis`. The backend already has redis-py installed — use `redis.asyncio.from_url(redis_url)`.

### Pitfall 7: Airplanes.live Rate Limit (1 req/s)
**What goes wrong:** If ingest_military fires more than once per second, requests are rate-limited.
**Why it happens:** The API enforces 1 req/s globally across all your requests.
**How to avoid:** 300-second interval gives massive headroom. The RQ self-re-enqueue fires once every 300s — no risk. Just don't add retry logic that fires rapid-fire on 429.

---

## Code Examples

Verified patterns from official sources and existing codebase:

### Military Aircraft Data Fetch (verified: live API call to api.airplanes.live/v2/mil)
```python
# Source: live API response from api.airplanes.live/v2/mil, 2026-03-12
# Top-level: {"ac": [...], "msg": "...", "now": 1741000000, "total": 1234, "ctime": ..., "ptime": ...}
# Each ac object:
{
    "hex": "ae1234",          # ICAO24 (6 hex chars)
    "flight": "RCH123   ",   # callsign (8 chars, padded with spaces)
    "t": "C17",               # aircraft type code
    "r": "07-7177",           # registration
    "alt_baro": 35000,        # feet, or string "ground"
    "alt_geom": 35100,        # feet
    "gs": 480.5,              # knots
    "track": 270.0,           # degrees true
    "lat": 35.123,
    "lon": -100.456,
    "squawk": "7000",
    "category": "A5",
    "desc": "Heavy Transport",
    "ownOp": "USAF"
}
```

### AISStream Subscribe + Receive (verified: official docs + example repo)
```python
# Source: aisstream.io/documentation, 2026-03-12
subscribe_msg = json.dumps({
    "APIKey": "<your_key>",
    "BoundingBoxes": [[[-90, -180], [90, 180]]],  # global
    "FilterMessageTypes": ["PositionReport"],       # position only
})

# Message received structure:
{
    "MessageType": "PositionReport",
    "MetaData": {
        "MMSI": 123456789,
        "MMSI_String": "123456789",
        "ShipName": "MV EXAMPLE",
        "latitude": 25.123,
        "longitude": 55.456,
        "time_utc": "2026-03-12 10:00:00.000000 +0000 UTC"
    },
    "Message": {
        "PositionReport": {
            "UserID": 123456789,
            "Latitude": 25.123,
            "Longitude": 55.456,
            "Sog": 12.5,          # knots
            "Cog": 270.0,         # degrees
            "TrueHeading": 268,   # degrees, 511 = not available
            "NavigationalStatus": 0,
            "RateOfTurn": 0,
            "Timestamp": 42
        }
    }
}
```

### websockets Infinite Reconnect (verified: websockets docs v12+/v16)
```python
# Source: websockets.readthedocs.io/en/stable, 2026-03-12
from websockets.asyncio.client import connect

async for websocket in connect(uri, ping_interval=None):
    try:
        await websocket.send(subscribe_msg)  # MUST be first action
        async for message in websocket:
            await process(message)
    except Exception:
        continue  # causes reconnect
```

### CesiumJS Amber Points (military layer, verified: existing codebase pattern)
```typescript
// Source: existing AircraftLayer.tsx pattern, adapted for military
const collection = viewer.scene.primitives.add(
    new PointPrimitiveCollection({ blendOption: BlendOption.OPAQUE })
);
const point = collection.add({
    position: Cartesian3.fromDegrees(lon, lat, (alt ?? 0) * 0.3048 + 1000), // feet→meters
    pixelSize: 5,
    color: Color.fromCssColorString('#F59E0B'),  // amber
    id: `mil:${hex}`,
});
```

Note: airplanes.live altitude is in **feet** (not meters like OpenSky). Convert: `alt_baro * 0.3048`.

### CesiumJS Cyan Points (ship layer)
```typescript
// Ships: no lerp needed (slow-moving), simpler update loop
const point = collection.add({
    position: Cartesian3.fromDegrees(lon, lat, 100), // ships at sea level + 100m visibility
    pixelSize: 4,
    color: Color.fromCssColorString('#06B6D4'),  // cyan
    id: `mmsi:${mmsi}`,
});
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| ADSB Exchange for military data | airplanes.live /v2/mil | March 2025 (ADSB Exchange went paid) | Must use airplanes.live; ADSB Exchange requires paid RapidAPI subscription |
| OpenSky Basic Auth | OAuth2 client_credentials | March 18, 2026 | Already handled in Phase 3; military uses airplanes.live (no auth) |
| `websockets.connect()` v10 style | `websockets.asyncio.client.connect()` v12+ style | websockets v12 (2023) | Import path changed; old `websockets.connect` still works as alias but new path is canonical |

**Deprecated/outdated:**
- `websockets.connect` (pre-v12 import): replaced by `websockets.asyncio.client.connect` — functionally equivalent but the new path is canonical in v12+.
- ADSB Exchange military endpoint: now paid-only, do not use.

---

## Open Questions

1. **aisstream.io BoundingBoxes scope**
   - What we know: Global `[[-90,-180],[90,180]]` subscription sends ~300 messages/second. This is the upper bound of what the client must handle.
   - What's unclear: Whether the homelab deployment can sustain 300 msg/s ingestion continuously without Redis or network saturation.
   - Recommendation: Start with global bounding box and `FilterMessageTypes: ["PositionReport"]` only. Monitor Redis memory usage. If needed, restrict to `[[-30,-20],[70,60]]` (Atlantic/Europe/ME) for Phase 8 scope.

2. **Ship vessel type display**
   - What we know: `PositionReport` messages carry only MMSI, position, speed, heading. Vessel name and type come from a separate `ShipStaticData` message (AIS Message Type 5) that arrives infrequently (every few minutes per vessel).
   - What's unclear: Whether the click-to-inspect requirement can be met from PositionReport data alone, or if ShipStaticData must also be processed and merged.
   - Recommendation: Subscribe to both `PositionReport` and `ShipStaticData` message types. Store vessel name/type in the Redis hash when ShipStaticData is received. The detail panel shows name/type from the DB row (which may be null for new vessels until their StaticData message arrives). This is honest and correct AIS behavior.

3. **AIS worker startup in Docker Compose**
   - What we know: The existing RQ worker (`rq worker`) runs as a separate service. A long-lived asyncio WebSocket loop is not a standard RQ job.
   - What's unclear: Whether to run the AIS worker as a separate Docker Compose service (`ais-worker`), or start it as a background asyncio task inside the FastAPI lifespan.
   - Recommendation: Run as a separate Docker Compose service (`command: python -m app.workers.ingest_ais`) for clean separation. This is the standard pattern for long-lived async workers alongside FastAPI. Alternatively, the FastAPI `lifespan` can `asyncio.create_task()` the worker — simpler but less isolated.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | pytest + pytest-asyncio (backend); Vitest + @testing-library/react (frontend) |
| Config file | `backend/pytest.ini` (asyncio_mode = auto); `frontend/vite.config.ts` (test.environment = jsdom) |
| Quick run command (backend) | `cd backend && pytest tests/test_military.py tests/test_ships.py -x` |
| Quick run command (frontend) | `cd frontend && npx vitest run src/components/__tests__/MilitaryAircraftLayer.test.tsx src/components/__tests__/ShipLayer.test.tsx` |
| Full suite command (backend) | `cd backend && pytest tests/ -x` |
| Full suite command (frontend) | `cd frontend && npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| LAY-01 | GET /api/military/ returns list with hex, flight, alt_baro, gs, track | unit/integration | `pytest tests/test_military.py::test_list_military -x` | Wave 0 |
| LAY-01 | GET /api/military/{hex} returns full record, 404 for unknown | unit/integration | `pytest tests/test_military.py::test_military_detail -x` | Wave 0 |
| LAY-01 | ingest_military correctly parses alt_baro="ground" as None | unit | `pytest tests/test_ingest_military.py::test_ground_altitude -x` | Wave 0 |
| LAY-01 | ingest_military skips aircraft with null lat/lon | unit | `pytest tests/test_ingest_military.py::test_null_position_skipped -x` | Wave 0 |
| LAY-01 | MilitaryAircraftLayer renders null to DOM (no crash) | smoke | `npx vitest run src/components/__tests__/MilitaryAircraftLayer.test.tsx` | Wave 0 |
| LAY-03 | GET /api/ships/ returns list with mmsi, vessel_name, lat, lon, sog, heading | unit/integration | `pytest tests/test_ships.py::test_list_ships -x` | Wave 0 |
| LAY-03 | GET /api/ships/{mmsi} returns full record, 404 for unknown | unit/integration | `pytest tests/test_ships.py::test_ship_detail -x` | Wave 0 |
| LAY-03 | parse_ais_message correctly extracts MetaData + PositionReport fields | unit | `pytest tests/test_ingest_ais.py::test_parse_position_report -x` | Wave 0 |
| LAY-03 | parse_ais_message ignores non-PositionReport message types | unit | `pytest tests/test_ingest_ais.py::test_non_position_report_ignored -x` | Wave 0 |
| LAY-03 | ShipLayer renders null to DOM (no crash) | smoke | `npx vitest run src/components/__tests__/ShipLayer.test.tsx` | Wave 0 |

### Sampling Rate
- **Per task commit:** Quick run (new test file for that plan only)
- **Per wave merge:** `cd backend && pytest tests/ -x && cd ../frontend && npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `backend/tests/test_military.py` — covers LAY-01 API contract
- [ ] `backend/tests/test_ingest_military.py` — covers LAY-01 ingest logic (ground altitude parsing, null position skip)
- [ ] `backend/tests/test_ships.py` — covers LAY-03 API contract
- [ ] `backend/tests/test_ingest_ais.py` — covers LAY-03 AIS message parsing (unit, no real WebSocket)
- [ ] `frontend/src/components/__tests__/MilitaryAircraftLayer.test.tsx` — smoke test (renders null, no crash)
- [ ] `frontend/src/components/__tests__/ShipLayer.test.tsx` — smoke test (renders null, no crash)

---

## Sources

### Primary (HIGH confidence)
- Live API call to `http://api.airplanes.live/v2/mil` — confirmed field schema (`hex`, `flight`, `t`, `alt_baro`, `gs`, `track`, `lat`, `lon`, `squawk`, `r`, `desc`, `ownOp`, `category`), top-level `ac` array structure
- `https://airplanes.live/rest-api-adsb-data-field-descriptions/` — confirmed field descriptions (rate limit: 1 req/s)
- `https://aisstream.io/documentation` — confirmed subscribe message format, MetaData fields (MMSI, ShipName, latitude, longitude, time_utc), PositionReport fields (Sog, Cog, TrueHeading, NavigationalStatus), 3-second subscribe timeout requirement
- `https://websockets.readthedocs.io/en/stable/reference/asyncio/client.html` — confirmed `async for websocket in connect(uri)` infinite reconnect pattern, `ping_interval=None` parameter
- Existing codebase: `backend/app/tasks/ingest_aircraft.py`, `backend/app/models/aircraft.py`, `frontend/src/components/AircraftLayer.tsx`, `frontend/src/store/useAppStore.ts` — confirmed patterns to replicate

### Secondary (MEDIUM confidence)
- `https://deepwiki.com/aisstream/example/2.3-message-types-and-formats` — ShipStaticData field names (Name, Type, ImoNumber, CallSign, UserID=MMSI, Dimension), verified against official docs
- `https://airplanes.live/api-guide/` — confirmed `/v2/mil` endpoint exists, returns military-tagged aircraft, rate limit 1 req/s
- `https://raw.githubusercontent.com/aisstream/example/main/python/main.py` — subscribe message JSON structure (APIKey + BoundingBoxes), asyncio pattern

### Tertiary (LOW confidence)
- Search result claims about aisstream.io ~300 msg/s global throughput — consistent with documentation wording but not measured
- AIS ShipStaticData transmission frequency (every few minutes) — from USCG AIS spec, not aisstream-specific

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already in project; websockets is the only addition and is well-documented
- Architecture (military pipeline): HIGH — direct mirror of existing ingest_aircraft.py pattern; field schema verified live
- Architecture (AIS pipeline): HIGH — subscribe message format and reconnect pattern verified from official docs; Redis cache design is standard pattern
- Pitfalls: HIGH — alt_baro="ground" verified in live API response; reconnect pitfalls from official docs
- AIS ShipStaticData merge: MEDIUM — behavior described in docs but not tested live

**Research date:** 2026-03-12
**Valid until:** 2026-04-12 (airplanes.live API stable; aisstream.io beta — re-verify if >30 days elapse)
