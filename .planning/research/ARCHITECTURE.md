# Architecture Research: v2.0 WorldView Parity Integration

**Domain:** Browser-based 3D OSINT geospatial platform — integrating 12 new features into existing CesiumJS/FastAPI v1.0 architecture
**Researched:** 2026-03-11
**Confidence:** HIGH

---

## Executive Summary

v2.0 adds 12 features onto a stable v1.0 foundation. The core architectural insight is that these 12 features split cleanly into four integration tiers, each requiring different amounts of new infrastructure:

- **Tier 1 — Frontend-only (no backend needed):** Landmark presets, Cinematic HUD, Visual style presets + sliders. These are pure React/CesiumJS additions.
- **Tier 2 — External tile services piped through CesiumJS ImageryLayer:** GPS Jamming heatmap, NOAA NEXRAD weather radar. CesiumJS already knows how to consume WMS/tile sources; no backend proxy required.
- **Tier 3 — New backend data pipelines + new frontend layers:** Military flights (ADSB Exchange), Maritime traffic (AIS), Earthquakes (USGS), Street traffic particles (OSM). Each needs a new FastAPI router, new PostgreSQL table, and new RQ ingestion task.
- **Tier 4 — New backend storage architecture + frontend replay engine:** 4D Historical Replay and OSINT Event Correlation. These are the most complex and establish the snapshot/event store that everything else builds on.

The recommended build order works from simplest to most complex, front-loading Tier 1 and Tier 2 (no backend changes, instant visual payoff) and back-loading Tier 4 (requires snapshot infrastructure to accumulate data before replay is usable).

---

## Standard Architecture

### System Overview (v2.0 Extended)

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Frontend (React + TypeScript)                │
│                                                                      │
│  ┌──────────────┐  ┌───────────────┐  ┌──────────────────────────┐  │
│  │  GlobeView   │  │  Post-Process │  │     Cinematic HUD        │  │
│  │  (CesiumJS)  │  │  Engine       │  │  (React overlay, z-layer)│  │
│  └──────┬───────┘  └───────────────┘  └──────────────────────────┘  │
│         │                                                            │
│  ┌──────▼────────────────────────────────────────────────────────┐  │
│  │                    Layer Components (render null to DOM)       │  │
│  │  SatelliteLayer  AircraftLayer  MilitaryLayer  MaritimeLayer   │  │
│  │  EarthquakeLayer  WeatherLayer  GPSJamLayer  TrafficLayer      │  │
│  └──────┬────────────────────────────────────────────────────────┘  │
│         │                                                            │
│  ┌──────▼──────────────────────────────────────────────────────┐    │
│  │  Zustand Store (useAppStore)                                 │    │
│  │  layers, filters, selectedId, visualPreset, replayState      │    │
│  └──────┬──────────────────────────────────────────────────────┘    │
│         │                                                            │
│  ┌──────▼───────────────┐  ┌────────────────────────────────────┐   │
│  │  Web Workers         │  │  ReplayEngine                      │   │
│  │  propagation.worker  │  │  (snapshot buffer, clock binding)   │   │
│  │  traffic.worker      │  │                                    │   │
│  └──────────────────────┘  └────────────────────────────────────┘   │
└───────────────────────────────────┬─────────────────────────────────┘
                                    │ HTTP REST
┌───────────────────────────────────▼─────────────────────────────────┐
│                         FastAPI (Backend)                            │
│  routes_satellites  routes_aircraft  routes_military  routes_ships   │
│  routes_earthquakes  routes_osint    routes_replay    routes_health  │
└───────────┬──────────────┬───────────────────────────┬──────────────┘
            │              │                           │
┌───────────▼───┐  ┌───────▼───────────┐  ┌───────────▼──────────────┐
│  PostgreSQL   │  │     Redis          │  │  RQ Workers               │
│  + PostGIS    │  │  (cache + queue)   │  │  ingest_military          │
│  satellites   │  │                   │  │  ingest_ships              │
│  aircraft     │  │                   │  │  ingest_earthquakes        │
│  military     │  │                   │  │  snapshot_recorder         │
│  ships        │  └───────────────────┘  │  osint_correlator          │
│  earthquakes  │                         └──────────────────────────┘
│  snapshots    │
│  osint_events │
└───────────────┘

External Sources (fetched directly by frontend):
  gpsjam.org daily CSV  →  CesiumJS ImageryLayer (heatmap tiles)
  NOAA NEXRAD WMS       →  CesiumJS WebMapServiceImageryProvider
  USGS GeoJSON feed     →  frontend fetch + CesiumJS PointPrimitive

External Sources (proxied through backend):
  ADSB Exchange API     →  RQ worker  →  military table
  aisstream.io WS       →  RQ worker  →  ships table
  OSM Overpass API      →  one-time fetch + cache  →  traffic.worker
```

### Component Responsibilities

| Component | Responsibility | Type |
|-----------|----------------|------|
| `PostProcessEngine` | Manages `scene.postProcessStages`, exposes uniform setters | New React component |
| `CinematicHUD` | Floating React overlay, MGRS coords, classification banner, telemetry | New React component |
| `VisualPresetPanel` | UI controls for preset selection + slider values, writes to store | New React component |
| `MilitaryLayer` | PointPrimitiveCollection for military aircraft, polls `/api/military` | New layer component |
| `MaritimeLayer` | PointPrimitiveCollection for AIS vessels, polls `/api/ships` | New layer component |
| `EarthquakeLayer` | PointPrimitive per quake sized by magnitude, direct USGS fetch | New layer component |
| `WeatherLayer` | `WebMapServiceImageryProvider` draping NEXRAD on globe | New layer component |
| `GPSJamLayer` | Daily CSV → custom heatmap `ImageryLayer` or `GroundPrimitive` | New layer component |
| `TrafficLayer` | OSM road segment particle simulation via `traffic.worker` | New layer component |
| `LandmarkPanel` | Curated JSON list, keyboard shortcut handler, `viewer.camera.flyTo` | New frontend component |
| `ReplayEngine` | Snapshot buffer, `viewer.clock` binding, playback state machine | New class / hook |
| `TimelinePanel` | React scrubber UI, speed controls, event markers on timeline | New React component |
| `OSINTEventLayer` | OSINT event markers, satellite overpass lines, filter UI | New layer component |
| `useAppStore` | Extend with: visualPreset, postProcessUniforms, replayState, new layers | Modified existing |
| `GlobeView` | Expose `viewer` ref for PostProcessEngine; unchanged otherwise | Minimally modified |
| `AircraftLayer` | Extend click dispatcher to handle military/ship primitive IDs | Modified existing |
| `routes_aircraft.py` | No changes needed | Unchanged |
| `routes_satellites.py` | No changes needed | Unchanged |
| `routes_military.py` | `GET /api/military` — list with bbox filter | New router |
| `routes_ships.py` | `GET /api/ships` — list with bbox filter | New router |
| `routes_earthquakes.py` | `GET /api/earthquakes` — proxy or pass-through | New router (optional) |
| `routes_osint.py` | CRUD for OSINT events, overpass query endpoint | New router |
| `routes_replay.py` | `GET /api/replay/snapshots?start&end&layers` | New router |
| `ingest_military.py` | RQ task: ADSB Exchange API → military table | New worker task |
| `ingest_ships.py` | RQ task: aisstream.io WS consumer → ships table | New worker task |
| `snapshot_recorder.py` | RQ task: periodic snapshot archival for replay | New worker task |
| `models/military.py` | SQLAlchemy model for military flight positions | New model |
| `models/ship.py` | SQLAlchemy model for AIS vessel positions | New model |
| `models/snapshot.py` | Time-partitioned snapshot table (all layer positions) | New model |
| `models/osint_event.py` | OSINT event with spatial point and tag list | New model |
| `traffic.worker.ts` | OSM road segments → particle positions per frame | New Web Worker |

---

## Feature Integration Analysis

### Feature 1: Visual Style Presets (NVG/CRT/FLIR/Noir)

**Integration tier:** Tier 1 — Frontend-only
**Approach:** CesiumJS `PostProcessStage` with custom GLSL fragment shaders.

CesiumJS exposes `scene.postProcessStages` (a `PostProcessStageCollection`). Each custom stage takes a fragment shader that reads from the scene texture via `czm_framebufferTexture` (or a custom uniform) and outputs modified color. Stages can be composed with `PostProcessStageComposite`.

The four presets map to distinct shader profiles:

| Preset | Shader Effect | Key Uniforms |
|--------|---------------|--------------|
| NVG (Night Vision) | Desaturate → green channel boost, scanline overlay, vignette | `u_greenBoost: float`, `u_scanlineIntensity: float` |
| CRT | Scanlines + barrel distortion + phosphor glow + chromatic aberration | `u_scanlineCount: float`, `u_distortion: float` |
| FLIR (Thermal) | Luminance to false-color gradient (black-body: black→red→orange→white) | `u_heatMap: sampler2D` (gradient texture) |
| Noir | Desaturate + high contrast + grain + vignette | `u_contrast: float`, `u_grainIntensity: float` |

**Architecture pattern:** One `PostProcessStage` per preset, swapped by enable/disable. Do not create/destroy stages on preset change — create all four on init, enable only the active one. This avoids GPU pipeline recompilation overhead.

**New components:**
- `PostProcessEngine.tsx` — singleton managing stage lifecycle, exposes `setPreset(name)` and `setUniform(preset, key, value)`
- Store additions: `visualPreset: 'normal' | 'nvg' | 'crt' | 'flir' | 'noir'`, `postProcessUniforms: Record<string, number>`

**Modified components:**
- `GlobeView.tsx` — call `onViewerReady` before `PostProcessEngine` mounts so stages attach to live viewer
- `useAppStore.ts` — add `visualPreset`, `postProcessUniforms`, setters

**No backend changes.**

---

### Feature 2: Post-Processing Sliders (Bloom, Sharpen, Gain, Scanlines, Pixelation)

**Integration tier:** Tier 1 — Frontend-only
**Approach:** Mix of CesiumJS built-in stages and custom stages.

CesiumJS `scene.postProcessStages.bloom` is a built-in `PostProcessStage`. Its key uniforms:
- `bloom.uniforms.contrast` (default: 128.0, range: -255 to 255)
- `bloom.uniforms.brightness` (default: -0.3)
- `bloom.uniforms.glowOnly` (boolean)
- `bloom.enabled` (boolean)

Sharpen, Gain, Scanlines, Pixelation require custom `PostProcessStage` with GLSL:
- **Sharpen:** Convolution kernel applied to texture
- **Gain:** Scalar multiply on RGB channels
- **Scanlines:** Horizontal line pattern at configurable frequency
- **Pixelation:** Floor UV coordinates to `floor(uv * resolution / pixelSize) * pixelSize / resolution`

**Key insight:** Scanlines and pixelation need to be managed inside the preset stages (not as separate stages) when a preset is active, otherwise they compound with preset effects incorrectly. `PostProcessEngine` should detect active preset and route slider values to the correct stage.

**New components:** Extends `PostProcessEngine` (above), new `PostProcessPanel.tsx` React UI

**No backend changes.**

---

### Feature 3: Cinematic HUD Overlay

**Integration tier:** Tier 1 — Frontend-only
**Approach:** Absolute-positioned React `<div>` layered over the CesiumJS canvas. CSS `pointer-events: none` on the overlay so globe interaction passes through.

The HUD displays:
- Classification banner (top bar, hardcoded text like "UNCLASSIFIED // OSINT")
- MGRS / lat-lon readout — subscribe to `viewer.camera.moveEnd` event, compute from `viewer.camera.positionCartographic`
- Selected entity telemetry — read from Zustand `selectedSatelliteId` / `selectedAircraftId` and render inline
- Timestamp clock (UTC) — `setInterval` driving React state

**Architecture note:** HUD components should read from Zustand store only, never from Cesium viewer directly. This keeps HUD testable without a live viewer.

**New components:** `CinematicHUD.tsx`, `MGRSReadout.tsx`, `TelemetryPanel.tsx`
**No backend changes.**

---

### Feature 4: Military Flights Layer (ADSB Exchange)

**Integration tier:** Tier 3 — New backend pipeline + new frontend layer

**Data flow:**
```
ADSB Exchange API (RapidAPI personal use tier)
    ↓ (RQ task, every 60s — rate limited)
ingest_military RQ worker
    ↓
military_aircraft PostgreSQL table
    ↓
GET /api/military?bbox=...
    ↓
MilitaryLayer.tsx (PointPrimitiveCollection, distinct color)
```

**API details (MEDIUM confidence — from official ADSB Exchange docs):**
- RapidAPI personal/non-commercial tier available
- Endpoint pattern: `GET /v2/lat/{lat}/lon/{lon}/dist/{dist}/` returns aircraft JSON array
- Military flag available in response: field `mil` = 1 for military, FAA block-listed, or VIP aircraft
- Alternative: query `GET /v2/mil/` for military-only aircraft globally

**New backend:**
- `models/military.py` — `MilitaryAircraft` table: `icao24, callsign, registration, type, latitude, longitude, altitude, velocity, heading, mil_flag, updated_at`
- `tasks/ingest_military.py` — RQ task, self-re-enqueue pattern (same as existing `ingest_aircraft.py`), 60s interval
- `api/routes_military.py` — `GET /api/military` with bbox param, Redis cache (30s TTL)

**New frontend:**
- `MilitaryLayer.tsx` — identical structure to `AircraftLayer.tsx`, orange-red color `#FF4500`
- Store: add `layers.military: boolean` to `useAppStore`

**Modified:**
- `AircraftLayer.tsx` click dispatcher — extend to recognize military primitive IDs (distinct ID namespace needed, e.g., prefix `"mil_"` + icao24)
- `main.py` — include `routes_military_router`

---

### Feature 5: GPS Jamming Heatmap (gpsjam.org)

**Integration tier:** Tier 2 — External data source → CesiumJS ImageryLayer

**Data source analysis (LOW confidence — no official API found):**
gpsjam.org has no documented public API. The site is a simple Express app serving daily CSV files. The GitHub repo at `guofengji/gpsjam.org` confirms "each day of data is in one CSV file." The CSV contains H3 hexagon cell IDs + jamming percentage per cell.

**Recommended approach:** Fetch today's CSV from the known URL pattern, convert H3 hex cells to GeoJSON polygons in a Web Worker, render as `GroundPrimitive` polygon collection in CesiumJS (colored by jamming severity: green/yellow/red).

**Fallback approach if CSV URL is inaccessible:** Recompute jamming heatmap by fetching ADSB Exchange aircraft with low navigation accuracy (NACp < 7 in ADS-B) and aggregating over H3 cells client-side. This mirrors what gpsjam.org does and requires only the existing ADSB Exchange API key.

**Architecture pattern:**
```
gpsjam.org/geo/all-{YYYY-MM-DD}.csv (fetched from frontend)
    ↓
gps_jam.worker.ts (Web Worker)
  - Parse CSV
  - Decode H3 cell IDs to polygon boundaries (h3-js library)
  - Compute color by percentage
    ↓ transferable polygon data
GPSJamLayer.tsx
  - GroundPrimitiveCollection
  - ColorGeometryInstanceAttribute per polygon
```

**New components:**
- `gps_jam.worker.ts` — H3 decode + color mapping
- `GPSJamLayer.tsx` — `GroundPrimitive` collection

**New dependency:** `h3-js` npm package (Uber's H3 library, browser-compatible)

**No backend changes required** (though a backend cache proxy is a valid option if CORS blocks the CSV fetch).

---

### Feature 6: Maritime Traffic (AIS)

**Integration tier:** Tier 3 — New backend pipeline + new frontend layer

**Data source:** aisstream.io — free API, WebSocket only, requires API key (GitHub OAuth login), returns global vessel positions with bbox filtering.

**Critical architecture constraint:** aisstream.io is WebSocket-only (no REST). The API key cannot be exposed in browser JavaScript. Therefore maritime data **must** be proxied through the FastAPI backend. The backend worker maintains the WebSocket connection and writes positions to PostgreSQL. The frontend polls FastAPI REST endpoints.

**Data flow:**
```
aisstream.io WebSocket (wss://stream.aisstream.io/v0/stream)
    ↓ (persistent WS connection in ingest_ships worker)
ingest_ships RQ worker
  - Maintains asyncio WebSocket connection
  - Receives PositionReport messages (lat, lon, SOG, COG, MMSI, vessel name)
  - Upsert ships table (last known position, updated_at)
    ↓
ships PostgreSQL table
    ↓
GET /api/ships?bbox=...
    ↓ (Redis cache, 30s TTL)
MaritimeLayer.tsx (PointPrimitiveCollection, cyan color #00CED1)
```

**New backend:**
- `models/ship.py` — `Ship` table: `mmsi (PK), vessel_name, ship_type, latitude, longitude, sog, cog, heading, updated_at`
- `workers/ingest_ships.py` — asyncio WebSocket consumer (not RQ task loop, but a long-running process in the worker container). Alternatively, use a threading approach with a background thread inside an RQ task that runs indefinitely.
- `api/routes_ships.py` — `GET /api/ships?bbox=minLon,minLat,maxLon,maxLat`

**New frontend:**
- `MaritimeLayer.tsx` — same pattern as `AircraftLayer.tsx`, cyan color
- Store: add `layers.ships: boolean`

**Modified:**
- `docker-compose.yml` — ships worker may need its own service entry if using a persistent WS connection model
- `main.py` — include ships router

---

### Feature 7: Earthquake Layer (USGS GeoJSON)

**Integration tier:** Tier 2 / Tier 3 — can be frontend-direct or backend-proxied

**Data source:** USGS GeoJSON Feed — free, no API key, no rate limits documented, updates every minute.
- URL pattern: `https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson`
- Returns `FeatureCollection` with earthquake features: `mag`, `place`, `time`, `depth`, `coordinates [lon, lat, depth_km]`

**Recommended approach: frontend-direct** (no backend proxy needed). The USGS feed is public, CORS-enabled, and lightweight (~50-200 features for all_day).

**Architecture:**
```
EarthquakeLayer.tsx
  - useEffect: fetch USGS URL every 5 minutes
  - Map features to PointPrimitive per earthquake
  - pixelSize = clamp(mag * 4, 4, 20)  — magnitude-scaled size
  - color: mag < 4 = #FFD700 (yellow), mag 4-6 = #FF8C00 (orange), mag > 6 = #FF0000 (red)
  - id: earthquake feature id string (for click-to-inspect)
```

**New components:** `EarthquakeLayer.tsx`, `EarthquakeDetailPanel.tsx`
**No backend changes required.** Backend proxy optional for caching if desired.

---

### Feature 8: Weather Radar Overlay (NOAA NEXRAD)

**Integration tier:** Tier 2 — External WMS → CesiumJS ImageryLayer

**Data source:** Iowa Environmental Mesonet NEXRAD WMS (HIGH confidence):
- Base reflectivity (n0r): `https://mesonet.agron.iastate.edu/cgi-bin/wms/nexrad/n0r.cgi`
- Time-aware variant: `https://mesonet.agron.iastate.edu/cgi-bin/wms/nexrad/n0r-t.cgi`
- Layer name: `nexrad-n0r`

**CesiumJS integration:**
```typescript
new WebMapServiceImageryProvider({
  url: 'https://mesonet.agron.iastate.edu/cgi-bin/wms/nexrad/n0r.cgi',
  layers: 'nexrad-n0r',
  parameters: {
    transparent: true,
    format: 'image/png',
  },
})
```
Draping on the globe via `viewer.imageryLayers.addImageryProvider(...)`. Alpha control via `imageryLayer.alpha = 0.6`.

**New components:** `WeatherLayer.tsx` — manages `ImageryLayer` lifecycle, toggleable via store
**No backend changes.**

---

### Feature 9: Street Traffic Particle Simulation (OSM)

**Integration tier:** Tier 3 — Heavy computation, new Web Worker

**Data source:** OpenStreetMap Overpass API — fetch highway road segments for visible bbox.
- Query: `[out:json];way["highway"~"^(motorway|trunk|primary|secondary)$"](bbox);out geom;`
- Returns way geometry (node lat/lon arrays)
- One-time fetch per bbox, cached for session duration

**Architecture:**
```
OSM Overpass API
    ↓ (fetch on first load or bbox change > threshold)
GlobeView bbox → fetch road segments GeoJSON
    ↓
traffic.worker.ts (Web Worker)
  - Store road segment polylines as Float32Array of [lon, lat] pairs
  - Maintain particle state: N particles per major road segment
  - Each frame: advance particle position along road by speed * dt
  - Wrap particle at end of segment
  - Output Float32Array of [x, y, z] ECEF positions (transferable)
    ↓ (transferable Float32Array, zero-copy)
TrafficLayer.tsx
  - PointPrimitiveCollection, white/amber points
  - Update positions from worker output each frame
```

**Key constraint:** Road network data can be large (100k+ nodes for a metro area). Fetch only for bboxes below a zoom threshold (camera altitude < 500 km). Above that, hide the layer entirely.

**New components:**
- `traffic.worker.ts` — particle simulation worker
- `TrafficLayer.tsx` — PointPrimitiveCollection for traffic particles

**New dependency:** None required; Overpass API is CORS-enabled. `osmtogeojson` npm package optional for parsing OSM JSON to GeoJSON.

**No backend changes.**

---

### Feature 10: Landmark Navigation Presets

**Integration tier:** Tier 1 — Frontend-only

**Architecture:** Static JSON file (`landmarks.json`) bundled with the frontend. No fetch required.

```typescript
interface Landmark {
  id: string;
  name: string;
  shortcut: string;       // e.g. "1" for first landmark
  latitude: number;
  longitude: number;
  altitude: number;       // camera altitude in meters
  heading?: number;       // optional camera heading
  pitch?: number;
}
```

Navigation uses `viewer.camera.flyTo({ destination: Cartesian3.fromDegrees(...), duration: 1.5 })`.

**New components:**
- `landmarks.json` — bundled data file
- `LandmarkPanel.tsx` — dropdown/list UI
- `useLandmarkShortcuts.ts` — `keydown` listener hook

**No backend changes.**

---

### Feature 11: 4D Historical Replay

**Integration tier:** Tier 4 — New backend storage architecture + frontend engine

This is the most architecturally complex feature. It requires:
1. A snapshot recorder that archives positions for all active layers at regular intervals
2. A replay API that returns time-bounded snapshot chunks
3. A frontend playback engine that buffers, interpolates, and drives `viewer.clock`

#### 11a. Backend: Snapshot Recorder

**New table: `layer_snapshots`**
```sql
CREATE TABLE layer_snapshots (
  id          BIGSERIAL PRIMARY KEY,
  layer       VARCHAR(32) NOT NULL,   -- 'satellites', 'aircraft', 'military', 'ships'
  entity_id   VARCHAR(64) NOT NULL,   -- norad_id, icao24, mmsi
  timestamp   TIMESTAMPTZ NOT NULL,
  latitude    DOUBLE PRECISION,
  longitude   DOUBLE PRECISION,
  altitude    DOUBLE PRECISION,
  metadata    JSONB                   -- velocity, heading, callsign, etc.
);

CREATE INDEX idx_snapshots_layer_time ON layer_snapshots(layer, timestamp);
CREATE INDEX idx_snapshots_entity_time ON layer_snapshots(entity_id, timestamp);
```

**RQ task `snapshot_recorder.py`:**
- Runs every 60 seconds
- Queries current state from `aircraft`, `military`, `ships` tables
- For satellites: runs SGP4 propagation for all TLEs at current timestamp (batch)
- Inserts snapshot rows (bulk INSERT, not upsert)
- Data retention: 7 days rolling window (daily cleanup task)

**New router `routes_replay.py`:**
```
GET /api/replay/snapshots?start={ISO8601}&end={ISO8601}&layers={csv}&resolution={60s}
  → Returns time-bucketed snapshots, one position per entity per bucket
  → Paginated: returns first 10-minute chunk, frontend requests subsequent chunks

GET /api/replay/events?start={ISO8601}&end={ISO8601}
  → Returns OSINT events and earthquake events within time window
```

#### 11b. Frontend: ReplayEngine

**Architecture:**

```
TimelinePanel.tsx (React UI)
  ↓ dispatch actions
useReplayStore (Zustand slice)
  ↓
ReplayEngine (class or hook)
  - State machine: IDLE | LOADING | PLAYING | PAUSED | SCRUBBING
  - fetchChunk(start, end) → buffer snapshots
  - bindToClock(viewer.clock) → drive viewer.clock.currentTime
  - interpolatePositions(t) → compute lerped positions between snapshots
    ↓ positions per layer
All Layer components subscribe to replay positions override
  - When replayState.active === true, layer reads from replayPositions not live data
  - When replayState.active === false, layer reads from normal live hooks
```

**State flow diagram:**

```
User drags scrubber to T
    ↓
useReplayStore.seekTo(T)
    ↓
ReplayEngine.fetchChunk(T - buffer, T + buffer)
    ↓ FastAPI /api/replay/snapshots
    ↓ JSON chunk arrives
ReplayEngine.bufferChunk(chunk)
    ↓
viewer.clock.currentTime = T (CesiumJS JulianDate)
    ↓
All layers: interpolatePositions(T) → Cartesian3 positions
    ↓
viewer.scene.requestRender()
```

**Key CesiumJS integration:** Use `viewer.clock.onTick` event (not `requestAnimationFrame`) to drive playback when playing. This keeps replay synchronized with CesiumJS's own time system.

**New components:**
- `TimelinePanel.tsx` — scrubber, play/pause, speed selector (0.1x, 1x, 5x, 60x)
- `ReplayEngine.ts` — class (not React component) managing buffer and state machine
- `useReplayStore.ts` — Zustand slice for replay state (separate from main store for clarity)
- Alembic migration for `layer_snapshots` table

**Modified components:**
- `SatelliteLayer.tsx` — check `replayState.active`, use propagated positions OR replay positions
- `AircraftLayer.tsx` — same pattern
- `MilitaryLayer.tsx`, `MaritimeLayer.tsx` — same pattern
- `useAppStore.ts` — add `replayActive: boolean` flag

---

### Feature 12: OSINT Event Correlation

**Integration tier:** Tier 4 — New event storage + correlation computation

**Architecture:**

Events are manually entered by the user (paste coordinates, timestamp, description, tags) or imported from a JSON file. The system then computes which satellites had line-of-sight over the event location at the event time.

**New table `osint_events`:**
```sql
CREATE TABLE osint_events (
  id          SERIAL PRIMARY KEY,
  title       VARCHAR(256) NOT NULL,
  description TEXT,
  latitude    DOUBLE PRECISION NOT NULL,
  longitude   DOUBLE PRECISION NOT NULL,
  event_time  TIMESTAMPTZ NOT NULL,
  tags        TEXT[],                -- e.g. ['explosion', 'military', 'ukraine']
  source_url  VARCHAR(512),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
```

**Satellite overpass computation:**
For a given event (lat, lon, time), compute which satellites were visible (elevation > 5°) at that time. This is SGP4 propagation in reverse — propagate all TLEs to `event_time`, compute azimuth/elevation from event location to each satellite, filter by elevation > threshold.

This computation belongs in the backend (FastAPI route or RQ task) because:
1. It requires all TLEs (available in PostgreSQL)
2. It is CPU-intensive (5,000+ satellites × 1 SGP4 propagation each)
3. The result can be cached by (event_id, satellite_set_version)

**New router `routes_osint.py`:**
```
POST /api/osint/events        — Create event
GET  /api/osint/events        — List events with filter by tags
GET  /api/osint/events/{id}   — Get event + computed overpasses
POST /api/osint/events/{id}/compute-overpasses  — Trigger overpass computation
```

**Frontend `OSINTEventLayer.tsx`:**
- Renders event markers as `BillboardCollection` icons
- On event selection: fetch overpass data from API, render satellite overpass lines as `PolylineCollection` (great-circle arcs from event location to satellite ECEF position at event time)
- Filter panel by tags (Zustand-driven)

**New components:**
- `OSINTEventLayer.tsx`
- `OSINTEventPanel.tsx` — event entry form and list
- `routes_osint.py`
- `models/osint_event.py`
- Alembic migration

---

## Recommended Build Order

Dependencies drive the order. Tier 1 and Tier 2 have zero backend dependencies and can ship immediately. Tier 4 has a time dependency — the snapshot recorder must run for several days before replay data is useful.

### Phase 1: Visual Engine (Tier 1 + Tier 2, no backend) — 1 week

**Build:**
1. `PostProcessEngine.tsx` + four preset GLSL shaders (NVG, CRT, FLIR, Noir)
2. `PostProcessPanel.tsx` — preset selector + sliders (bloom, sharpen, gain, scanlines, pixelation)
3. `CinematicHUD.tsx` + `MGRSReadout.tsx` — coordinate overlay
4. `LandmarkPanel.tsx` + `landmarks.json` + keyboard shortcuts
5. `useAppStore` extensions: visualPreset, postProcessUniforms, new layer flags

**Why first:** Zero backend risk, instant visual payoff, demonstrates the platform aesthetic. All work is isolated to frontend.

**Dependency:** Existing `GlobeView.tsx` + viewer pattern already works.

### Phase 2: Tile Overlays (Tier 2) — 0.5 weeks

**Build:**
6. `WeatherLayer.tsx` — NOAA NEXRAD WMS ImageryProvider
7. `GPSJamLayer.tsx` — gpsjam CSV fetch + H3 decode + GroundPrimitive polygons
8. `EarthquakeLayer.tsx` — USGS direct fetch + magnitude-scaled points

**Why second:** No backend changes. Leverages CesiumJS ImageryLayer and PointPrimitive patterns already understood. Adds three visual layers in days.

### Phase 3: New Data Pipelines (Tier 3) — 2 weeks

**Build:**
9. Military flights backend: `models/military.py` + `ingest_military.py` + `routes_military.py` + Alembic migration
10. `MilitaryLayer.tsx` frontend
11. Ships backend: `models/ship.py` + `workers/ingest_ships.py` + `routes_ships.py` + Alembic migration
12. `MaritimeLayer.tsx` frontend
13. `TrafficLayer.tsx` + `traffic.worker.ts` — OSM particle simulation

**Why third:** Backend work needed but follows established patterns from v1.0 (same RQ worker model, same route structure). Military and ships are independent of each other — can be parallelized.

### Phase 4: Snapshot Infrastructure (Tier 4 foundation) — 1 week

**Build:**
14. `models/snapshot.py` + `snapshot_recorder.py` RQ task + Alembic migration
15. `routes_replay.py` (read-only endpoints, data starts accumulating)
16. Start recording snapshots — **let it run for 24-48h before building replay UI**

**Why fourth:** The snapshot recorder must be running before replay is useful. Build and deploy it early, let data accumulate while building the replay UI.

### Phase 5: Replay Engine (Tier 4 playback) — 1.5 weeks

**Build:**
17. `ReplayEngine.ts` — buffer management, interpolation, clock binding
18. `useReplayStore.ts` — Zustand slice
19. `TimelinePanel.tsx` — scrubber UI, speed controls
20. Modify all layer components to respect `replayActive` flag

**Why fifth:** Requires snapshot data (Phase 4 must have been running). The most complex frontend work.

### Phase 6: OSINT Event Correlation (Tier 4 events) — 1 week

**Build:**
21. `models/osint_event.py` + `routes_osint.py` + overpass computation endpoint
22. `OSINTEventLayer.tsx` + `OSINTEventPanel.tsx`

**Why sixth:** Depends on satellite data (already in DB). Independent from replay but benefits from being built after the platform is visually complete — it's the "intelligence analyst" feature.

---

## Data Flow Diagrams

### Post-Processing Pipeline

```
viewer.scene.render() (CesiumJS internal)
    ↓
Raw scene framebuffer (WebGL texture)
    ↓
PostProcessStageCollection (ordered pipeline)
    ├── Stage: preset (NVG/CRT/FLIR/Noir) — if enabled
    │     fragment shader reads czm_framebufferTexture
    │     outputs modified color
    │
    ├── Stage: bloom (built-in) — enabled/disabled by slider
    │     uniforms.contrast, uniforms.brightness
    │
    ├── Stage: sharpen (custom) — enabled/disabled by slider
    │
    ├── Stage: scanlines (custom) — if not already in preset
    │
    └── Stage: FXAA (built-in, always last)
          ↓
Final composited frame → canvas display
```

**Key constraint:** Preset stages that include scanlines must disable the standalone scanlines stage to avoid double-application. `PostProcessEngine` manages this mutual exclusion.

### Replay Data Flow

```
User interaction: drag scrubber to time T
    ↓
useReplayStore.seekTo(T)
    ↓
ReplayEngine.getPositionsAt(T)?
  ├── YES (buffer hit) → interpolate between surrounding snapshots
  └── NO (buffer miss) → fetchChunk(T - 5min, T + 5min) from FastAPI
                              ↓
                         GET /api/replay/snapshots?start&end&layers
                              ↓
                         SQL: SELECT * FROM layer_snapshots
                              WHERE layer = ANY(layers)
                              AND timestamp BETWEEN start AND end
                              ORDER BY entity_id, timestamp
                              ↓
                         JSON response (array of snapshot rows)
                              ↓
                         ReplayEngine.bufferChunk(rows)
    ↓ (either path)
positions: Map<entity_id, Cartesian3> at time T
    ↓ (pushed to each layer via replayPositions prop or store slice)
SatelliteLayer / AircraftLayer / MilitaryLayer / MaritimeLayer
    ↓
viewer.scene.primitives — update each point position
    ↓
viewer.scene.requestRender()
```

### Maritime AIS Proxy Flow

```
aisstream.io WS server (wss://stream.aisstream.io/v0/stream)
    ↓ persistent connection
ingest_ships.py (Python asyncio WebSocket client, runs in worker container)
    ↓ receives PositionReport messages
ships PostgreSQL table (upsert on mmsi, update lat/lon/sog/cog/updated_at)
    ↓
Redis cache (ships:bbox:{hash}, TTL 30s)
    ↓
GET /api/ships?bbox=...
    ↓ HTTP poll every 30s
MaritimeLayer.tsx
    ↓
PointPrimitiveCollection — update positions
```

**Why proxy is required:** aisstream.io requires an API key. Browser JS cannot securely hold an API key. The backend is the correct secret holder.

---

## New vs Modified Components Summary

### New Frontend Components

| Component | File | Purpose |
|-----------|------|---------|
| PostProcessEngine | `components/PostProcessEngine.tsx` | Manages CesiumJS PostProcessStage lifecycle |
| PostProcessPanel | `components/PostProcessPanel.tsx` | Preset selector + sliders UI |
| CinematicHUD | `components/CinematicHUD.tsx` | Tactical overlay (classification, coords, telemetry) |
| MGRSReadout | `components/MGRSReadout.tsx` | Camera position in MGRS / lat-lon |
| MilitaryLayer | `components/MilitaryLayer.tsx` | Military aircraft primitives |
| MaritimeLayer | `components/MaritimeLayer.tsx` | AIS vessel primitives |
| EarthquakeLayer | `components/EarthquakeLayer.tsx` | USGS earthquake points |
| WeatherLayer | `components/WeatherLayer.tsx` | NOAA NEXRAD ImageryLayer |
| GPSJamLayer | `components/GPSJamLayer.tsx` | GPS jamming heatmap polygons |
| TrafficLayer | `components/TrafficLayer.tsx` | OSM road particle simulation |
| LandmarkPanel | `components/LandmarkPanel.tsx` | City/landmark navigation UI |
| TimelinePanel | `components/TimelinePanel.tsx` | 4D replay scrubber + controls |
| OSINTEventLayer | `components/OSINTEventLayer.tsx` | OSINT event markers + overpass lines |
| OSINTEventPanel | `components/OSINTEventPanel.tsx` | Event entry form and list |
| ReplayEngine | `lib/ReplayEngine.ts` | Snapshot buffer + playback state machine |
| useReplayStore | `store/useReplayStore.ts` | Zustand slice for replay state |
| landmarks.json | `data/landmarks.json` | Curated landmark coordinates |

### New Web Workers

| Worker | File | Purpose |
|--------|------|---------|
| GPS Jam decoder | `workers/gps_jam.worker.ts` | H3 hex decode + color mapping |
| Traffic particle | `workers/traffic.worker.ts` | OSM road particle simulation |

### Modified Frontend Components

| Component | Change |
|-----------|--------|
| `useAppStore.ts` | Add `visualPreset`, `postProcessUniforms`, `layers.military/ships/earthquakes/weather/gpsJam/traffic`, `replayActive` |
| `App.tsx` | Mount new layer components, HUD, PostProcessEngine, TimelinePanel |
| `AircraftLayer.tsx` | Extend click dispatcher for military + ship primitive ID namespaces; add replay position override |
| `SatelliteLayer.tsx` | Add replay position override (when `replayActive`, use snapshot positions instead of worker propagation) |

### New Backend Files

| File | Purpose |
|------|---------|
| `models/military.py` | MilitaryAircraft SQLAlchemy model |
| `models/ship.py` | Ship SQLAlchemy model |
| `models/snapshot.py` | LayerSnapshot time-series model |
| `models/osint_event.py` | OSINTEvent SQLAlchemy model |
| `api/routes_military.py` | Military aircraft API endpoints |
| `api/routes_ships.py` | Ships API endpoints |
| `api/routes_replay.py` | Replay snapshot query endpoints |
| `api/routes_osint.py` | OSINT event CRUD + overpass computation |
| `tasks/ingest_military.py` | ADSB Exchange ingestion RQ task |
| `workers/ingest_ships.py` | AISstream WebSocket consumer |
| `tasks/snapshot_recorder.py` | Periodic snapshot archival RQ task |

### Modified Backend Files

| File | Change |
|------|--------|
| `app/main.py` | Register four new routers |
| `alembic/versions/` | New migration: military, ships, snapshots, osint_events tables |

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Creating PostProcessStage Objects on Preset Switch

**What people do:** Destroy and recreate `PostProcessStage` objects every time the user changes presets.
**Why it's wrong:** CesiumJS must recompile GLSL shaders on stage creation. This causes a visible frame drop (50-200ms stall) on each preset switch.
**Do this instead:** Create all preset stages at init time, set `stage.enabled = false` on all, then enable only the active one. Switching presets is then just two boolean assignments.

### Anti-Pattern 2: Running SGP4 Propagation in the Main Thread for Replay

**What people do:** On replay scrub, propagate all 5,000 satellite TLEs on the main thread at the target timestamp.
**Why it's wrong:** 5,000 SGP4 propagations take ~50ms on main thread, causing visible jank.
**Do this instead:** Replay for satellites uses pre-recorded snapshots from `layer_snapshots` table (taken every 60s by `snapshot_recorder`). The accuracy tradeoff (60s granularity vs real-time) is acceptable for OSINT replay.

### Anti-Pattern 3: Frontend Direct WebSocket to aisstream.io

**What people do:** Connect the browser directly to `wss://stream.aisstream.io/v0/stream` with the API key in JavaScript source.
**Why it's wrong:** API key is exposed in browser DevTools, violating aisstream.io terms and security requirements.
**Do this instead:** Backend worker maintains the WS connection, stores vessel positions in PostgreSQL, frontend polls the backend REST API.

### Anti-Pattern 4: Fetching the Full OSM Road Network Globally

**What people do:** Fetch all highways globally from Overpass API on app init.
**Why it's wrong:** Overpass API times out on large queries; global highway data is gigabytes.
**Do this instead:** Fetch only when camera altitude is below ~500km threshold, fetch only the visible bbox, cache the result for the session. Show an empty layer at high zoom.

### Anti-Pattern 5: Storing Snapshot Rows for Every Frame

**What people do:** Record snapshots at 1 Hz to get smooth replay.
**Why it's wrong:** At 60s intervals, 5,000 satellites + 3,000 aircraft generates ~480,000 rows/day. At 1 Hz that is 7-day storage of 2.88 billion rows — PostgreSQL table bloat, query degrades.
**Do this instead:** 60s snapshot interval (interpolation between snapshots handles smooth playback). For replay, lerp positions between consecutive snapshots. This gives acceptable visual quality with manageable storage.

### Anti-Pattern 6: Stacking Multiple ScreenSpaceEventHandlers for New Layers

**What people do:** Add a new `ScreenSpaceEventHandler` for each new layer (MilitaryLayer, MaritimeLayer) to handle clicks.
**Why it's wrong:** v1.0 learned this lesson — dual handlers cause race conditions where both handlers call `scene.pick()` independently and both handle the same click.
**Do this instead:** The existing unified click dispatcher in `AircraftLayer.tsx` already handles this correctly. Extend it to recognize military (`"mil_" + icao24`) and ship (`"ship_" + mmsi`) ID namespaces.

---

## Integration Points Summary

### External Services

| Service | Integration Pattern | Frontend/Backend | Notes |
|---------|---------------------|-----------------|-------|
| ADSB Exchange API | RQ worker polls REST every 60s | Backend proxy (API key hidden) | RapidAPI personal tier; military flag in response |
| aisstream.io | Backend asyncio WS consumer | Backend proxy (API key hidden) | WebSocket-only, bbox subscription |
| USGS Earthquake GeoJSON | Frontend direct fetch every 5 min | Frontend-direct | CORS enabled, no auth required |
| NOAA NEXRAD WMS | CesiumJS `WebMapServiceImageryProvider` | Frontend-direct | Iowa Environmental Mesonet proxy |
| gpsjam.org CSV | Frontend direct fetch (daily) | Frontend-direct | No official API; CSV from known URL pattern |
| OpenStreetMap Overpass | Frontend direct fetch on viewport change | Frontend-direct | CORS enabled, bbox-scoped queries only |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| PostProcessEngine ↔ GlobeView | `viewer` ref passed as prop | Engine reads `viewer.scene.postProcessStages` |
| ReplayEngine ↔ Layer components | Zustand `replayActive` + `replayPositions` store slice | Layers poll store, not direct coupling |
| traffic.worker ↔ TrafficLayer | `postMessage` with transferable `Float64Array` | Same zero-copy pattern as propagation.worker |
| gps_jam.worker ↔ GPSJamLayer | `postMessage` with polygon coordinate arrays | Worker outputs GroundPrimitive-ready data |
| ingest_ships ↔ PostgreSQL | SQLAlchemy async session in worker process | Ships table upsert on MMSI |
| snapshot_recorder ↔ all models | Direct async DB queries inside RQ task | Reads aircraft/military/ships tables, writes snapshots |

---

## Sources

### High Confidence (Official Documentation)

- [CesiumJS PostProcessStage](https://cesium.com/learn/cesiumjs/ref-doc/PostProcessStage.html)
- [CesiumJS PostProcessStageCollection](https://cesium.com/learn/cesiumjs/ref-doc/PostProcessStageCollection.html)
- [CesiumJS PostProcessStageLibrary](https://cesium.com/learn/cesiumjs/ref-doc/PostProcessStageLibrary.html)
- [CesiumJS WebMapServiceImageryProvider](https://cesium.com/learn/ion-sdk/ref-doc/WebMapServiceImageryProvider.html)
- [USGS GeoJSON Earthquake Feed Format](https://earthquake.usgs.gov/earthquakes/feed/v1.0/geojson.php)
- [Iowa Environmental Mesonet NEXRAD WMS](https://mesonet.agron.iastate.edu/docs/nexrad_mosaic/)
- [aisstream.io WebSocket API Documentation](https://aisstream.io/documentation)

### Medium Confidence (Community-Verified Patterns)

- [ADSB Exchange Data Page](https://www.adsbexchange.com/data/) — military flag availability confirmed
- [gpsjam.org FAQ](https://gpsjam.org/faq) — no official API; CSV-per-day structure confirmed via GitHub repo
- [gpsjam.org GitHub (guofengji)](https://github.com/guofengji/gpsjam.org) — "each day of data is in one CSV file"
- [OpenStreetMap Overpass API](https://wiki.openstreetmap.org/wiki/Overpass_API) — bbox highway query pattern
- [h3-js library](https://github.com/uber/h3-js) — H3 cell decode for GPS jam visualization

### Low Confidence (Requires Validation)

- gpsjam.org CSV URL format (`/geo/all-{YYYY-MM-DD}.csv`) — **inferred from Express app structure, not documented. Validate by inspecting browser network tab at gpsjam.org before coding.**
- ADSB Exchange `/v2/mil/` endpoint for military-only global query — verify against current RapidAPI docs before use; pricing implications unknown.

---

*Architecture research for: OpenSignal Globe v2.0 WorldView Parity*
*Researched: 2026-03-11*
*Confidence: HIGH for CesiumJS integration patterns, MEDIUM for external data source formats, LOW for undocumented endpoints (gpsjam.org CSV URL, ADSB Exchange military endpoint)*
