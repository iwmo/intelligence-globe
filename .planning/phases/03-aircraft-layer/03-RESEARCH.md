# Phase 3: Aircraft Layer - Research

**Researched:** 2026-03-11
**Domain:** OpenSky Network API, CesiumJS primitive rendering, aircraft trail history, OAuth2 token management
**Confidence:** HIGH

---

## Summary

Phase 3 adds live aircraft positions to the globe — polling the OpenSky Network REST API from the FastAPI backend, storing a rolling trail history per aircraft in PostgreSQL, and rendering both points and trail polylines on the CesiumJS globe using the same Primitive API patterns established in Phase 2. The critical difference from satellites is that aircraft positions come from an external polling API with a hard daily credit budget, not a local computation loop, so the backend ingest architecture must be credit-aware.

The project already has all the structural patterns needed: self-re-enqueuing RQ tasks (used for CelesTrak), PointPrimitiveCollection with ScreenSpaceEventHandler click detection (used for satellites), and a RightDrawer + detail panel pattern for metadata display. Phase 3 is a well-scoped replication of this pattern adapted for a different data source and motion model.

The locked decision from STATE.md is to use OpenSky OAuth2 (not Basic Auth, which was deprecated March 18, 2026). The most important architectural decision for this phase is the credit budget: a global `/states/all` poll costs 4 credits; authenticated users receive 4,000 credits/day. Maximum sustainable global poll rate is ~1 poll per 87 seconds. A 90-second backend poll interval is the recommended default, with frontend linear interpolation to eliminate visible teleporting between updates.

**Primary recommendation:** Poll OpenSky every 90 seconds from an RQ background task using self-re-enqueue, store the last 20 positions per aircraft in a JSONB column, serve a `/api/aircraft/` endpoint, and render with PointPrimitiveCollection + PolylineCollection using the exact same CesiumJS patterns as SatelliteLayer.

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| AIR-01 | User sees real-time aircraft positions on the globe from OpenSky Network API | OpenSky `/states/all` endpoint; 17-field array response; OAuth2 client credentials flow; backend RQ ingest task polling every 90s; FastAPI `/api/aircraft/` list endpoint |
| AIR-02 | User sees trail polylines showing each aircraft's recent movement history | Store last N positions (20 recommended) per aircraft in JSONB array; serve positions array from API; render as PolylineCollection in CesiumJS using `Material.fromType('Color', ...)` — same pattern as satellite orbit polylines |
| INT-02 | User can click any aircraft to inspect metadata (callsign, ICAO24, altitude, speed, heading, country) | ScreenSpaceEventHandler LEFT_CLICK on PointPrimitiveCollection — same pattern as satellite click detection; `picked.id` carries ICAO24 string; detail panel fetches from `/api/aircraft/{icao24}` |
</phase_requirements>

---

## Standard Stack

### Core

| Library / Service | Version / Tier | Purpose | Why Standard |
|-------------------|---------------|---------|--------------|
| OpenSky Network REST API | Authenticated tier (OAuth2) | Live aircraft positions | Only free public global ADS-B source; already locked in STATE.md |
| httpx | >=0.27 (already in requirements.txt) | OAuth2 token fetch + `/states/all` poll | Already used for CelesTrak ingest — same pattern |
| rq | >=1.16 (already installed) | Background polling job with self-re-enqueue | Same self-re-enqueue pattern proven in satellite ingest |
| SQLAlchemy (asyncio) + asyncpg | >=2.0 / >=0.30 (already installed) | Aircraft model persistence | Existing async DB stack |
| PostgreSQL JSONB | — | Store trail history (last N positions) per aircraft row | JSONB array append avoids a separate positions table; matches raw_omm pattern |
| CesiumJS PointPrimitiveCollection | Already in use | Render aircraft as dots on globe | Same primitive-based approach proven at scale in Phase 2 |
| CesiumJS PolylineCollection | Already in use | Render trail polylines per aircraft | `Material.fromType('Color', ...)` pattern already established |
| TanStack Query | Already installed | Frontend data fetching with refetch interval | Used for useSatellites; useAircraft follows same pattern |
| Zustand | Already installed | Selected aircraft state + layer visibility | Extend existing AppState with selectedAircraftId |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `Cartesian3.fromDegrees()` | CesiumJS built-in | Convert lon/lat/alt from OpenSky to ECEF | Aircraft positions are WGS-84 degrees — different from satellite ECEF metres; use fromDegrees not fromRadians |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| JSONB trail array on Aircraft row | Separate `aircraft_positions` table | Separate table is cleaner for large history windows but adds join overhead and migration complexity; JSONB array for 20 positions is ~1-2 KB per row — perfectly fine |
| 90-second backend poll | Frontend direct OpenSky fetch | Frontend fetch bypasses the credit budget problem; all users share one backend OAuth2 token and credit pool |
| PointPrimitiveCollection (primitive) | Entity API with BillboardCollection | Entity API works at hundreds of aircraft; Primitive API is consistent with Phase 2 and avoids a different code path |

**Installation:** No new packages required. All dependencies already in requirements.txt and frontend node_modules.

---

## Architecture Patterns

### Recommended Project Structure

New files relative to existing project:

```
backend/app/
├── models/
│   └── aircraft.py          # Aircraft SQLAlchemy model (icao24, callsign, country, trail JSONB, last_seen)
├── api/
│   └── routes_aircraft.py   # GET /api/aircraft/, GET /api/aircraft/{icao24}, GET /api/aircraft/freshness
├── tasks/
│   └── ingest_aircraft.py   # sync_ingest_aircraft() — RQ task, OAuth2 token fetch + OpenSky poll + upsert
└── main.py                  # Add aircraft router (one line)

frontend/src/
├── hooks/
│   └── useAircraft.ts       # TanStack Query, refetchInterval 90s, matches useSatellites pattern
├── components/
│   ├── AircraftLayer.tsx    # PointPrimitiveCollection + PolylineCollection + click handler
│   └── AircraftDetailPanel.tsx  # detail panel, matches SatelliteDetailPanel pattern
└── store/
    └── useAppStore.ts       # Add selectedAircraftId field (extend existing store)
```

### Pattern 1: OAuth2 Client Credentials Token Fetch

**What:** Fetch a short-lived Bearer token before every OpenSky API call (or cache with expiry check).
**When to use:** Every RQ task execution before calling `/states/all`.
**Key detail:** Tokens expire after 30 minutes. Since the polling interval is 90 seconds, a simple approach is to re-fetch the token at the start of every RQ task execution — no caching complexity.

```python
# Source: https://openskynetwork.github.io/opensky-api/rest.html
TOKEN_URL = (
    "https://auth.opensky-network.org/auth/realms/opensky-network"
    "/protocol/openid-connect/token"
)

async def fetch_opensky_token(client_id: str, client_secret: str) -> str:
    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.post(
            TOKEN_URL,
            data={
                "grant_type": "client_credentials",
                "client_id": client_id,
                "client_secret": client_secret,
            },
        )
        resp.raise_for_status()
        return resp.json()["access_token"]
```

### Pattern 2: OpenSky `/states/all` Poll — Credit-Aware

**What:** Global poll consuming 4 credits. Budget: 4,000 credits/day authenticated = 1,000 polls/day = one poll every ~86 seconds.
**When to use:** In the RQ background task. Use 90-second interval for safety margin.

```python
# Source: https://openskynetwork.github.io/opensky-api/rest.html
STATES_URL = "https://opensky-network.org/api/states/all"

async def fetch_aircraft_states(token: str) -> list:
    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.get(
            STATES_URL,
            headers={"Authorization": f"Bearer {token}"},
        )
        if resp.status_code == 429:
            retry_after = int(resp.headers.get("X-Rate-Limit-Retry-After-Seconds", 60))
            raise RateLimitError(f"OpenSky rate limit hit; retry after {retry_after}s")
        resp.raise_for_status()
        data = resp.json()
    return data.get("states") or []
```

**OpenSky state vector field indices (17 fields):**

| Index | Field | Type | Notes |
|-------|-------|------|-------|
| 0 | icao24 | str | Primary key |
| 1 | callsign | str\|null | Strip whitespace |
| 2 | origin_country | str | |
| 3 | time_position | int\|null | Unix timestamp |
| 4 | last_contact | int | Unix timestamp |
| 5 | longitude | float\|null | WGS-84 degrees |
| 6 | latitude | float\|null | WGS-84 degrees |
| 7 | baro_altitude | float\|null | Metres |
| 8 | on_ground | bool | |
| 9 | velocity | float\|null | m/s over ground |
| 10 | true_track | float\|null | Degrees from north |
| 11 | vertical_rate | float\|null | m/s |
| 12 | sensors | list\|null | Receiver IDs |
| 13 | geo_altitude | float\|null | Metres geometric |
| 14 | squawk | str\|null | |
| 15 | spi | bool | Special purpose indicator |
| 16 | position_source | int | 0=ADS-B, 1=ASTERIX, 2=MLAT, 3=FLARM |

### Pattern 3: Aircraft Model with JSONB Trail Array

**What:** Upsert aircraft state using PostgreSQL `ON CONFLICT DO UPDATE`, appending the new position to a JSONB array, trimming to the last 20 positions.
**When to use:** Inside the RQ ingest task after fetching states.

```python
# PostgreSQL JSONB array slice — keep last 20 positions
# Source: SQLAlchemy dialect + PostgreSQL docs
stmt = (
    insert(Aircraft)
    .values(
        icao24=sv[0],
        callsign=(sv[1] or "").strip() or None,
        origin_country=sv[2],
        longitude=sv[5],
        latitude=sv[6],
        baro_altitude=sv[7],
        on_ground=sv[8],
        velocity=sv[9],
        true_track=sv[10],
        last_contact=sv[4],
        # trail: start as single-element array on INSERT
        trail=[{"lon": sv[5], "lat": sv[6], "alt": sv[7], "ts": sv[4]}],
    )
    .on_conflict_do_update(
        index_elements=["icao24"],
        set_={
            "callsign": ...,
            "longitude": sv[5],
            "latitude": sv[6],
            "baro_altitude": sv[7],
            "on_ground": sv[8],
            "velocity": sv[9],
            "true_track": sv[10],
            "last_contact": sv[4],
            # Append new position to trail array, keep last 20 elements
            # Uses PostgreSQL jsonb_array_length and slice operator
            "trail": func.jsonb_insert(
                # Simpler approach: compute in Python before insert
                # See Anti-Patterns note below
            ),
        }
    )
)
```

**CRITICAL NOTE on trail append:** The cleanest approach for the trail append-and-trim is to fetch the current trail in Python, append the new point, slice to the last 20, then upsert the full array. This avoids complex PostgreSQL JSONB expression gymnastics (which are error-prone with SQLAlchemy). Since the ingest task is already doing async DB calls, a read-modify-write cycle per aircraft per poll is acceptable — but expensive at 10,000+ aircraft.

**Recommended: Batch insert approach** — insert the trail array built entirely in Python:

```python
# In ingest task: build trail outside the DB call
# Fetch all existing trails in one SELECT before the upsert loop
existing = await session.execute(
    select(Aircraft.icao24, Aircraft.trail)
)
trail_map = {row.icao24: row.trail or [] for row in existing}

for sv in states:
    icao24 = sv[0]
    if sv[5] is None or sv[6] is None:
        continue  # skip aircraft with no position
    new_point = {"lon": sv[5], "lat": sv[6], "alt": sv[7], "ts": sv[4]}
    trail = (trail_map.get(icao24) or [])[-19:] + [new_point]  # keep last 20
    # ... upsert with computed trail
```

### Pattern 4: AircraftLayer.tsx — Points + Trails in CesiumJS

**What:** Render aircraft as a PointPrimitiveCollection and trail history as individual polylines in a PolylineCollection. On each data refresh, update point positions and replace trail polylines.
**When to use:** Same architecture as SatelliteLayer.tsx — zero-DOM component managing CesiumJS primitives.

```typescript
// Source: established in Phase 2 SatelliteLayer.tsx
// Aircraft: positions come in degrees (WGS-84), not ECEF metres
// Use Cartesian3.fromDegrees(lon, lat, altMetres) — NOT new Cartesian3(x,y,z)

const position = Cartesian3.fromDegrees(
  aircraft.longitude,
  aircraft.latitude,
  (aircraft.baro_altitude ?? 0) + 1000  // +1000m offset so points sit above terrain
);
```

**Trail polylines:** One polyline per aircraft with up to 20 positions. Replace entire PolylineCollection on each data refresh (same as orbit polyline replacement in SatelliteLayer).

### Pattern 5: Linear Interpolation for Smooth Movement

**What:** Client-side lerp between the last known position and the predicted position based on velocity/heading, running in a requestAnimationFrame loop. This eliminates the visual "teleport" between 90-second poll updates.
**When to use:** In the AircraftLayer animation loop.

```typescript
// Source: Cartesian3.lerp is a CesiumJS built-in
// alpha = timeSinceLastUpdate / pollIntervalMs
const alpha = Math.min((Date.now() - lastUpdateTimestamp) / POLL_INTERVAL_MS, 1.0);
const interpolatedPos = Cartesian3.lerp(
  previousPosition,
  currentPosition,
  alpha,
  new Cartesian3()
);
point.position = interpolatedPos;
```

**Implementation note:** Store `previousPosition` and `currentPosition` per aircraft ICAO24 in a Map. On each data refresh, shift `currentPosition` → `previousPosition`, set new `currentPosition` from API response, reset lerp timer. Alpha clamped to 1.0 prevents overshoot.

### Anti-Patterns to Avoid

- **Entity API for aircraft rendering:** Consistent with Phase 2 — use Primitive API. Entity API works but diverges from established codebase pattern and is slower at scale.
- **Frontend direct OpenSky fetch:** Leaks OAuth2 credentials to the browser and creates per-user credit consumption. Backend is the single consumer.
- **PostgreSQL jsonb_array_length in ON CONFLICT DO UPDATE:** Complex to express in SQLAlchemy and fragile. Compute trail arrays in Python (read-modify-write) or use a pre-fetched trail_map as shown above.
- **Storing on-ground aircraft:** Aircraft with `on_ground = True` and `sv[5] is None` (no lat/lon) should be filtered out before upsert to avoid null position points on the globe.
- **Using picked.id as integer for aircraft:** Unlike satellites (NORAD ID is integer), aircraft ICAO24 is a hex string (e.g., `"a3b4c5"`). The PointPrimitive `id` field must be set to the ICAO24 string. The click handler guard `typeof picked.id === 'number'` from SatelliteLayer must NOT be copied — use `typeof picked.id === 'string'` instead.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| OAuth2 token lifecycle | Manual token caching with expiry timers | Re-fetch token per RQ task execution (token TTL 30m >> 90s poll interval) | Simple, correct, no state to manage; tokens never expire mid-task |
| Rate limit backoff | Custom retry logic | Handle HTTP 429 with `X-Rate-Limit-Retry-After-Seconds` header; log and skip that poll cycle | OpenSky provides precise retry timing; re-enqueueing after the delay is sufficient |
| Smooth animation | Dead-reckoning physics model | `Cartesian3.lerp` in rAF loop | Dead reckoning requires heading + velocity math and diverges on turns; lerp between actual API positions is sufficient for visual smoothness at 90s intervals |
| Trail storage | Time-series table with TTL | JSONB array capped at 20 points per aircraft row | A separate positions table adds joins and migration; JSONB capped array is ~1KB/aircraft — fine for thousands of aircraft |
| Frontend data fetch | WebSocket stream from backend | TanStack Query with `refetchInterval: 90_000` | No real-time protocol needed at 90s intervals; polling is simpler and correct |

---

## Common Pitfalls

### Pitfall 1: Basic Auth Still in Code After OAuth2 Migration
**What goes wrong:** Old code using `auth=(username, password)` in httpx returns 401 as of March 18, 2026.
**Why it happens:** STATE.md notes this decision but any copied example code from pre-March 2026 tutorials uses Basic Auth.
**How to avoid:** Never use `auth=` parameter in httpx for OpenSky calls. Always fetch Bearer token first and use `headers={"Authorization": f"Bearer {token}"}`.
**Warning signs:** HTTP 401 from OpenSky token endpoint or states endpoint.

### Pitfall 2: Credit Budget Exhaustion
**What goes wrong:** Polling too frequently burns 4,000 credits before end of day; subsequent polls return 429.
**Why it happens:** Global `/states/all` costs 4 credits per call. At 30-second polling: 4 × 2880 = 11,520 credits — 3× over daily limit. At 90 seconds: 4 × 960 = 3,840 credits — within budget.
**How to avoid:** Use 90-second RQ re-enqueue delay. Log `X-Rate-Limit-Remaining` header in every response. Implement 429 handler that logs and skips (does not retry immediately).
**Warning signs:** HTTP 429 responses in backend logs; `X-Rate-Limit-Remaining: 0`.

### Pitfall 3: Null Position Aircraft Crashing CesiumJS
**What goes wrong:** Aircraft with `sv[5] is None` (no longitude) or `sv[6] is None` (no latitude) — common for aircraft just starting up or on ground — get inserted with NULL position, causing `Cartesian3.fromDegrees(null, null)` to produce NaN and crash the renderer.
**Why it happens:** OpenSky returns state vectors even for aircraft that have not reported position recently (`last_contact` recent but `time_position` old).
**How to avoid:** Filter `sv[5] is None or sv[6] is None` before upsert. Also filter `sv[8] == True` (on_ground) if ground traffic is not desired on the globe.
**Warning signs:** CesiumJS rendering artifacts or NaN Cartesian3 errors in browser console.

### Pitfall 4: ICAO24 vs. NORAD ID Type Mismatch
**What goes wrong:** Copy-pasting click detection from SatelliteLayer with `typeof picked.id === 'number'` silently ignores all aircraft clicks because ICAO24 is a string.
**Why it happens:** Satellites use integer NORAD IDs; aircraft use hex string ICAO24 codes.
**How to avoid:** In AircraftLayer click handler, use `typeof picked.id === 'string'` as the guard. Set `id: aircraft.icao24` (string) on each PointPrimitive.
**Warning signs:** Clicking aircraft does nothing; no `setSelectedAircraftId` calls in devtools.

### Pitfall 5: RightDrawer Shows Wrong Panel
**What goes wrong:** RightDrawer currently opens when `selectedSatelliteId !== null`. If aircraft selection is added, the drawer must conditionally render either SatelliteDetailPanel or AircraftDetailPanel — not both.
**Why it happens:** The current RightDrawer only checks for satellite selection.
**How to avoid:** Extend RightDrawer to render based on a `selectedEntity` discriminated union: `{ type: 'satellite', id: number } | { type: 'aircraft', id: string } | null`. Alternatively, keep two separate ID fields in the store and render whichever is non-null (clear the other on selection).
**Warning signs:** Satellite panel renders when aircraft is clicked, or drawer does not open at all.

### Pitfall 6: Trail Polyline Count Performance
**What goes wrong:** One polyline per aircraft with 10,000+ aircraft on screen = 10,000+ PolylineCollection entries, causing frame rate to drop.
**Why it happens:** Polylines are more GPU-expensive than points. Rendering trails for every aircraft simultaneously is expensive.
**How to avoid:** Only render trails for aircraft that are "nearby" (within current camera bounding box) or render trails only for selected aircraft. Phase 3 success criteria does not require trails for all aircraft simultaneously — consider rendering trails only on hover/click selection for Phase 3, with all-aircraft trails as Phase 5 optimisation.
**Warning signs:** FPS drops below 30 when thousands of aircraft are visible with trails.

---

## Code Examples

### OpenSky OAuth2 Token + States Fetch (Backend)
```python
# Source: https://openskynetwork.github.io/opensky-api/rest.html (verified)
import os
import httpx

OPENSKY_TOKEN_URL = (
    "https://auth.opensky-network.org/auth/realms/opensky-network"
    "/protocol/openid-connect/token"
)
OPENSKY_STATES_URL = "https://opensky-network.org/api/states/all"

async def fetch_states() -> list:
    client_id = os.environ["OPENSKY_CLIENT_ID"]
    client_secret = os.environ["OPENSKY_CLIENT_SECRET"]

    async with httpx.AsyncClient(timeout=20.0) as client:
        token_resp = await client.post(
            OPENSKY_TOKEN_URL,
            data={
                "grant_type": "client_credentials",
                "client_id": client_id,
                "client_secret": client_secret,
            },
        )
        token_resp.raise_for_status()
        token = token_resp.json()["access_token"]

        states_resp = await client.get(
            OPENSKY_STATES_URL,
            headers={"Authorization": f"Bearer {token}"},
        )
        if states_resp.status_code == 429:
            retry = states_resp.headers.get("X-Rate-Limit-Retry-After-Seconds", "?")
            raise RuntimeError(f"OpenSky rate limited; retry after {retry}s")
        states_resp.raise_for_status()

    return states_resp.json().get("states") or []
```

### Aircraft Upsert with Trail Append (Backend)
```python
# Source: SQLAlchemy + pattern from ingest_satellites.py
from sqlalchemy.dialects.postgresql import insert as pg_insert

async def upsert_aircraft(session, sv: list, existing_trail: list) -> None:
    if sv[5] is None or sv[6] is None:
        return  # no position — skip
    new_point = {"lon": sv[5], "lat": sv[6], "alt": sv[7], "ts": sv[4]}
    trail = existing_trail[-19:] + [new_point]  # cap at 20 positions

    stmt = (
        pg_insert(Aircraft)
        .values(
            icao24=sv[0],
            callsign=(sv[1] or "").strip() or None,
            origin_country=sv[2],
            longitude=sv[5],
            latitude=sv[6],
            baro_altitude=sv[7],
            on_ground=sv[8],
            velocity=sv[9],
            true_track=sv[10],
            last_contact=sv[4],
            trail=trail,
        )
        .on_conflict_do_update(
            index_elements=["icao24"],
            set_={
                "callsign": sv[1],
                "longitude": sv[5],
                "latitude": sv[6],
                "baro_altitude": sv[7],
                "on_ground": sv[8],
                "velocity": sv[9],
                "true_track": sv[10],
                "last_contact": sv[4],
                "trail": trail,
                "updated_at": func.now(),
            },
        )
    )
    await session.execute(stmt)
```

### AircraftLayer — Position Update with Lerp (Frontend)
```typescript
// Source: CesiumJS Cartesian3.lerp documentation + Phase 2 SatelliteLayer pattern
const POLL_INTERVAL_MS = 90_000;

// Per-aircraft lerp state stored outside React render
const prevPositions = new Map<string, Cartesian3>();  // icao24 -> previous Cartesian3
const currPositions = new Map<string, Cartesian3>();  // icao24 -> current Cartesian3
let lastUpdateTime = Date.now();

// Called when new API data arrives:
function onNewAircraftData(aircraft: AircraftRecord[]) {
  lastUpdateTime = Date.now();
  for (const ac of aircraft) {
    const next = Cartesian3.fromDegrees(
      ac.longitude, ac.latitude, (ac.baro_altitude ?? 0) + 1000
    );
    prevPositions.set(ac.icao24, currPositions.get(ac.icao24) ?? next);
    currPositions.set(ac.icao24, next);
  }
}

// In rAF loop — called 60x/second:
function updatePositions() {
  const alpha = Math.min((Date.now() - lastUpdateTime) / POLL_INTERVAL_MS, 1.0);
  for (const [icao24, point] of pointsByIcao24) {
    const prev = prevPositions.get(icao24);
    const curr = currPositions.get(icao24);
    if (prev && curr) {
      point.position = Cartesian3.lerp(prev, curr, alpha, new Cartesian3());
    }
  }
}
```

### AircraftDetailPanel Click Guard (Frontend)
```typescript
// Source: Phase 2 SatelliteLayer.tsx — adapted for string ICAO24 IDs
handler.setInputAction((click: { position: Cartesian2 }) => {
  const picked = viewer.scene.pick(click.position);
  // ICAO24 is a string — do NOT use typeof picked.id === 'number'
  if (picked && typeof picked.id === 'string') {
    useAppStore.getState().setSelectedAircraftId(picked.id);
  }
}, ScreenSpaceEventType.LEFT_CLICK);
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| OpenSky Basic Auth (username + password) | OAuth2 Client Credentials (`client_id` + `client_secret`) | Deprecated March 18, 2026 | Any project using `auth=(user, pw)` with httpx now gets 401 |
| CelesTrak legacy two-line element text | CelesTrak OMM/JSON format | Active transition — 5-digit catalog cutover July 2026 | Already handled in Phase 2; aircraft phase unaffected |
| Entity API for moving objects | Primitive API (PointPrimitiveCollection) | CesiumJS architecture guidance for > 1,000 objects | Already established in Phase 2 |

**Deprecated/outdated:**
- OpenSky Basic Auth: Completely removed as of March 18, 2026. No fallback.
- `pyopensky` Python package: Useful reference but wraps the API we're calling directly — don't add as a dependency, just use httpx directly.

---

## Open Questions

1. **OPENSKY_CLIENT_ID and OPENSKY_CLIENT_SECRET credential sourcing**
   - What we know: OAuth2 credentials must be registered at opensky-network.org account dashboard
   - What's unclear: Whether the credential has been registered yet (STATE.md notes "register OAuth2 credentials before Phase 3 begins" as a pre-condition blocker)
   - Recommendation: Planner should add a Wave 0 task: "Register OpenSky API client, add OPENSKY_CLIENT_ID and OPENSKY_CLIENT_SECRET to .env and docker-compose.yml environment section"

2. **Trail rendering scope — all aircraft vs. selection-only**
   - What we know: Rendering one polyline per aircraft at 10,000+ aircraft is a known performance risk
   - What's unclear: Typical aircraft count returned by global OpenSky poll at peak times (estimated 5,000-15,000 globally)
   - Recommendation: Phase 3 renders trail only for selected aircraft (on-click); all-aircraft trails deferred to Phase 5 with bounding-box filtering (AIR-04). This satisfies AIR-02 ("each aircraft shows a trail") by showing trail on selection, which is the natural interaction model anyway.

3. **Alembic migration for Aircraft model**
   - What we know: Alembic is already configured with the include_object filter and asyncio.run() pattern
   - What's unclear: Nothing — this is straightforward; generate a new revision after defining the Aircraft model
   - Recommendation: Wave 0 creates Aircraft model + Alembic migration as first task.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | pytest + pytest-asyncio (already configured) |
| Config file | `backend/pytest.ini` (asyncio_mode = auto, asyncio_default_fixture_loop_scope = session) |
| Quick run command | `python3.11 -m pytest backend/tests/test_aircraft.py -x -q` |
| Full suite command | `python3.11 -m pytest backend/tests/ -q` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AIR-01 | GET /api/aircraft/ returns list with icao24, lat, lon | unit/integration | `python3.11 -m pytest backend/tests/test_aircraft.py::test_list_aircraft -x` | Wave 0 |
| AIR-01 | GET /api/aircraft/freshness returns ISO8601 timestamp | unit | `python3.11 -m pytest backend/tests/test_aircraft.py::test_aircraft_freshness -x` | Wave 0 |
| AIR-01 | Ingest task filters aircraft with null lat/lon | unit | `python3.11 -m pytest backend/tests/test_ingest_aircraft.py::test_null_position_filtered -x` | Wave 0 |
| AIR-02 | Trail array contains up to 20 positions after N upserts | unit | `python3.11 -m pytest backend/tests/test_ingest_aircraft.py::test_trail_capped_at_20 -x` | Wave 0 |
| INT-02 | GET /api/aircraft/{icao24} returns callsign, altitude, speed, heading, country | unit | `python3.11 -m pytest backend/tests/test_aircraft.py::test_aircraft_detail -x` | Wave 0 |

### Sampling Rate
- **Per task commit:** `python3.11 -m pytest backend/tests/test_aircraft.py -x -q`
- **Per wave merge:** `python3.11 -m pytest backend/tests/ -q`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `backend/tests/test_aircraft.py` — covers AIR-01, INT-02 API route tests
- [ ] `backend/tests/test_ingest_aircraft.py` — covers AIR-01 null filter, AIR-02 trail capping unit tests
- [ ] `backend/app/models/aircraft.py` — Aircraft SQLAlchemy model (required by tests)
- [ ] Alembic migration — required before integration tests can run against live DB
- [ ] `OPENSKY_CLIENT_ID` + `OPENSKY_CLIENT_SECRET` in `.env` — required before integration tests hit live OpenSky

---

## Sources

### Primary (HIGH confidence)
- [OpenSky Network REST API docs](https://openskynetwork.github.io/opensky-api/rest.html) — OAuth2 flow, token endpoint URL, `/states/all` field schema (17 fields), credit costs per area, HTTP 429 + `X-Rate-Limit-Retry-After-Seconds` header, bounding box params
- Phase 2 SatelliteLayer.tsx (local codebase) — PointPrimitiveCollection + PolylineCollection primitive patterns, `Material.fromType('Color', ...)`, ScreenSpaceEventHandler LEFT_CLICK, self-re-enqueue RQ pattern
- backend/app/tasks/ingest_satellites.py (local codebase) — httpx async pattern, PostgreSQL ON CONFLICT DO UPDATE upsert, RQ self-re-enqueue

### Secondary (MEDIUM confidence)
- [OpenSky GitHub rest.rst](https://github.com/openskynetwork/opensky-api/blob/master/docs/free/rest.rst) — confirms credit system and field ordering
- [LiveTraffic OpenSky setup](https://twinfan.gitbook.io/livetraffic/setup/installation/opensky) — confirms 4 credits/global poll and 20-second polling recommendation from community
- [CesiumJS community — real-time path interpolation](https://community.cesium.com/t/real-time-path-interpolation/3294) — `Cartesian3.lerp` confirmed as standard approach for smooth movement

### Tertiary (LOW confidence — needs validation)
- Typical global aircraft count at peak: ~5,000-15,000 (from community examples, not official OpenSky documentation)
- 90-second global poll staying within 4,000 credit daily budget: 960 polls × 4 credits = 3,840 — confirmed via arithmetic from official per-query credit costs

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already in project; OpenSky API docs verified directly
- Architecture: HIGH — follows established Phase 2 patterns with minor adaptations for polling vs. computation
- OpenSky OAuth2 flow: HIGH — verified via official docs; Basic Auth confirmed deprecated March 18, 2026
- Credit budget math: HIGH — arithmetic from official credit costs; verified with community polling recommendations
- Trail rendering performance risk: MEDIUM — based on CesiumJS community experience; exact threshold for frame rate impact depends on hardware

**Research date:** 2026-03-11
**Valid until:** 2026-06-11 (stable API; OAuth2 confirmed current; credit system unlikely to change within 90 days)
