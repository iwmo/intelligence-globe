# Technology Stack Research

**Domain:** 3D Globe OSINT Platform — v2.0 WorldView Parity feature additions
**Researched:** 2026-03-11
**Confidence:** HIGH (CesiumJS, USGS, NOAA verified via official docs) / MEDIUM (AIS, flight data APIs) / LOW (gpsjam.org data URL pattern — no official API docs found)

> **Scope note:** This file covers ONLY the additions and decisions needed for v2.0 features.
> The base stack (CesiumJS 1.139, React 19, Vite 7, TypeScript 5, FastAPI, PostgreSQL + PostGIS, Redis, RQ, Docker Compose)
> is validated, deployed, and documented from v1.0. Do not re-research it.

---

## Recommended Stack

### Core Technologies (v2.0 additions only)

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| **CesiumJS PostProcessStageLibrary** | built into cesium 1.139 | NVG/Noir/custom GLSL presets | `PostProcessStageLibrary.createNightVisionStage()` is a built-in factory that produces a green-tinted NVG post-process stage. `viewer.scene.postProcessStages.bloom` is a built-in `PostProcessStageComposite` with direct uniform access. No additional library needed — all presets are custom GLSL fragments on top of the existing `PostProcessStage` API. |
| **CesiumJS WebMapServiceImageryProvider** | built into cesium 1.139 | NOAA NEXRAD weather radar overlay | Native WMS support exists in CesiumJS. `WebMapServiceImageryProvider` supports time-enabled WMS-T layers via the `clock` property. NOAA nowCoast provides the NEXRAD WMS endpoint with CORS enabled. No additional library needed. |
| **CesiumJS Clock + ClockViewModel** | built into cesium 1.139 | 4D historical replay | `viewer.clock.currentTime`, `startTime`, `stopTime`, `multiplier`, `clockRange` and `ClockRange.LOOP_STOP` / `CLAMPED` are all built-in. The `AnimationViewModel` provides play/pause/step. No additional library needed. |
| **mgrs** | 2.1.0 | MGRS coordinate display in HUD | MIT. Zero runtime dependencies. Ships TypeScript types. Three methods: `forward([lon,lat], precision)` → MGRS string, `inverse(mgrs)` → bbox, `toPoint(mgrs)` → [lon,lat]. Maintained by proj4js contributors. NGA-originated, NATO standard. |
| **aisstream.io WebSocket API** | free (beta) | Maritime AIS real-time vessel feed | WebSocket at `wss://stream.aisstream.io/v0/stream`. Free API key via GitHub OAuth sign-in. Requires `APIKey` + `BoundingBoxes` in subscription JSON within 3 seconds of connect. No SLA. Delivers 24+ AIS message types including position, speed, heading, vessel name. No polling, push-only. |
| **airplanes.live REST API** | free (non-commercial) | Military / unfiltered aircraft layer | Base URL: `https://api.airplanes.live/v2/`. Endpoint `/mil` returns all aircraft tagged military. No API key required. ADSBExchange v2-compatible JSON schema (`dbFlags & 1` = military bit). Community-run, no SLA. Polling interval: 15–30 s. |
| **USGS Earthquake GeoJSON Feed** | v1.0 (stable) | Earthquake layer | `https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson` — no auth, no rate limit documented. Returns FeatureCollection with point geometries, magnitude, depth, time. Feed updates every 1 minute. CORS enabled. Consumed directly from frontend via TanStack Query. |
| **NOAA nowCoast NEXRAD WMS** | WMS 1.3.0 | Weather radar overlay | WMS endpoint: `https://nowcoast.noaa.gov/arcgis/services/nowcoast/radar_meteo_imagery_nexrad_time/MapServer/WMSServer`. MRMS composite reflectivity at 1 km resolution. Time-enabled (WMS-T), 5-minute update cadence for CONUS + Hawaii + Puerto Rico + Guam + Alaska. CORS enabled per community verification. No auth. Used via `WebMapServiceImageryProvider`. |
| **Overpass API (osm-based)** | free public endpoint | OSM road network fetch for particle sim | `https://overpass-api.de/api/interpreter` (or mirror). Fetch `way["highway"]` within current viewport bbox. Returns Overpass JSON. Convert to GeoJSON via `osmtogeojson`. Cache result in Redis (road networks do not change frequently). Fetch triggered once per visible region, not per frame. |
| **osmtogeojson** | 3.0.0-beta.5 | Convert Overpass JSON → GeoJSON | Standard converter for Overpass API output. Works in browser and Node. Ships as ESM-compatible UMD. `@types/osmtogeojson` available (v2.2.34). Beta label is stable in practice — 5+ years unchanged API. Alternative: `osm2geojson-ultra` (faster TypeScript rewrite, use if osmtogeojson proves slow at large road sets). |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| **h3-js** | 4.1.0 | Hexagonal grid for GPS jamming heatmap | Uber's H3 spatial indexing library. CesiumJS renders hexagon polygons using `PolygonPrimitive`. h3-js converts H3 cell IDs (from gpsjam CSV) to lat/lng boundary polygons. Use when rendering the gpsjam heatmap layer. Pure JS, works in browser. `h3-js` ships TypeScript types natively. |
| **@types/osmtogeojson** | 2.2.34 | TypeScript types for osmtogeojson | Install alongside `osmtogeojson` when using TypeScript. Pin to 2.2.34 — API has not changed. |
| **date-fns** | 3.x | Timeline scrubber date formatting | Lightweight date formatting for the 4D replay HUD. Replaces `moment.js` (deprecated). Format ISO8601 timestamps as `yyyy-MM-dd HH:mm:ss UTC`. Zero-dependency alternative: `Intl.DateTimeFormat` (native, but less ergonomic for formatting CesiumJS JulianDate conversions). Use `date-fns` only if `JulianDate.toIso8601()` output is insufficient. |

### Development Tools (v2.0 additions)

| Tool | Purpose | Notes |
|------|---------|-------|
| **Overpass Turbo** | Interactive OSM query dev tool (overpass-turbo.eu) | Use during development to prototype road network queries before hardcoding them. Not shipped in the app. |
| **NOAA nowCoast GetCapabilities** | Verify available WMS layers and time dimensions | Fetch `?request=GetCapabilities&service=WMS` from the WMS URL during development to enumerate available layers and valid time extents. |

---

## Installation

```bash
# Frontend — new packages for v2.0 only
# (cesium, react, zustand, @tanstack/react-query already installed)
npm install mgrs h3-js osmtogeojson
npm install -D @types/osmtogeojson

# date-fns — only if native Intl.DateTimeFormat proves insufficient
# npm install date-fns
```

```bash
# Backend — no new Python packages required for v2.0
# All new data sources are either:
#   (a) consumed directly by the frontend (USGS, NOAA WMS, Overpass, airplanes.live)
#   (b) proxied via existing FastAPI + httpx endpoints (AIS WebSocket relay)
#   (c) fetched and cached by existing RQ workers (gpsjam CSV daily ingest)
# httpx, shapely, redis already in requirements.txt
```

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| `airplanes.live /v2/mil` (free, no auth) | ADSBexchange RapidAPI ($10/month) | If airplanes.live uptime becomes unacceptable in production. ADSBexchange is the authoritative source but costs money. |
| `airplanes.live /v2/mil` | `opendata.adsb.fi /api/v2/mil` (1 req/s rate limit) | adsb.fi is a valid free fallback with identical ADSBexchange v2 JSON schema. Use if airplanes.live is down. Both can be tried in sequence. |
| `aisstream.io` WebSocket | MarineTraffic API (paid, $50+/mo) | MarineTraffic has richer vessel metadata and SLA. Use if aisstream.io beta instability is unacceptable for production or if historical AIS is needed. |
| `aisstream.io` WebSocket | `aisstream` Python package (backend relay) | If WebSocket management in the frontend proves brittle, relay AIS through FastAPI WebSocket endpoint on the backend. Backend maintains one persistent upstream WS connection, fans out to frontend clients. |
| NOAA nowCoast NEXRAD WMS | RainViewer API (free tier, REST tiles) | RainViewer (`https://api.rainviewer.com/public/weather-maps.json`) provides global radar tiles as PNG tile URLs in a simpler format. Use if NOAA WMS-T time integration in CesiumJS proves difficult. RainViewer is easier to integrate but US-only coverage is less precise. |
| Overpass API for roads | Natural Earth road GeoJSON | Natural Earth provides pre-built GeoJSON for major roads worldwide (no live query needed). Use for the initial particle simulation layer if Overpass query latency is unacceptable for realtime viewport changes. |
| `osmtogeojson` (browser) | `osmtogeojson` CLI (backend pre-processing) | If road network GeoJSON files are pre-built per region and served as static assets, no client-side conversion is needed. Better for homelab use where regions are known in advance. |
| `PostProcessStage` custom GLSL | Three.js EffectComposer (separate renderer) | Three.js post-processing is more mature, but requires running a second WebGL renderer alongside CesiumJS — extremely complex and GPU-expensive. Not recommended. Stay entirely within CesiumJS post-processing pipeline. |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| **CesiumJS Entity API for new layers** | Entity API collapses at 5,000+ objects (proven in v1.0). All new layers (ships, earthquakes, jamming hexagons) must use Primitive API: `PointPrimitiveCollection`, `PolylinePrimitiveCollection`, `GeometryInstance + Appearance`. | CesiumJS Primitive API (established v1.0 pattern) |
| **CZML for 4D replay** | CZML is XML-like and parsed synchronously. For a custom timeline with snapshot data stored in PostgreSQL, driving `viewer.clock` directly and updating Primitive positions per-tick is far more performant and flexible. CZML is designed for pre-baked animated datasets, not dynamic multi-layer replay. | Direct `viewer.clock.onTick` + Primitive position updates |
| **MarineTraffic free tier** | MarineTraffic deprecated their free tier API for new signups. Any "free" key from old documentation will 403. Use aisstream.io. | `aisstream.io` free WebSocket API |
| **OpenAIP or Flightradar24** | Both are proprietary or require paid keys. No free military data. | `airplanes.live /v2/mil` (free, no auth) |
| **moment.js** | 67KB, deprecated since 2020. No tree-shaking. | `date-fns` (13KB, tree-shakable) or native `Intl.DateTimeFormat` |
| **Leaflet.js** | 2D only. No globe projection. Incompatible with CesiumJS 3D viewport. Do not mix map libraries. | CesiumJS `WebMapServiceImageryProvider` and `ImageryLayer` for all overlay layers |
| **WebSocket reconnect from scratch** | aisstream.io drops connections on inactivity. Writing manual reconnect logic is fragile. | Use `reconnecting-websocket` (1KB) or implement exponential backoff in a custom hook. See PITFALLS.md. |
| **gpsjam.org scraping** | No official API. Site HTML changes break scrapers. | Fetch daily CSV directly from the static data URL (see Data Sources section) |

---

## Stack Patterns by Feature

**For visual style presets (NVG, CRT, FLIR, Noir):**
- Use `PostProcessStageLibrary.createNightVisionStage()` for NVG — it is built in, no GLSL authoring required
- FLIR thermal: custom `PostProcessStage` with GLSL fragment that maps luminance → iron/rainbow LUT via a 1D texture uniform
- CRT scanlines + pixelation: custom `PostProcessStageComposite` chaining two stages (pixelation pass → scanline pass)
- Noir: `PostProcessStageLibrary.createBlackAndWhiteStage()` is built in; add a `createBrightnessStage()` stage for contrast adjustment
- All presets are toggled via `stage.enabled = true/false` — do not create/destroy stages per toggle (expensive)

**For post-processing sliders (Bloom, Sharpen, Gain, Scanlines, Pixelation):**
- Bloom: `viewer.scene.postProcessStages.bloom.enabled = true` then set uniforms: `bloom.uniforms.contrast`, `bloom.uniforms.brightness`, `bloom.uniforms.glowOnly`
- Sharpen: custom `PostProcessStage` with unsharp-mask GLSL; expose `strength` uniform
- Gain: custom `PostProcessStage` that multiplies RGB by a uniform scalar; trivial single-line GLSL
- Scanlines + Pixelation: uniforms on the CRT composite stage (pixel size, scanline spacing, opacity)
- Pass all slider values through a Zustand `postProcessStore` slice; update uniforms in a `useEffect` watching slice state

**For the cinematic HUD (classification markings, MGRS readout, telemetry):**
- HUD is a React overlay div absolutely positioned over the Cesium canvas — not a CesiumJS entity or label
- Use `mgrs` package: `forward([lon, lat], 4)` converts the camera center to MGRS with 10m precision
- Camera position → lat/lon: `viewer.camera.positionCartographic` → `CesiumMath.toDegrees()`
- Classification markings, corner text, scan-line aesthetic: pure CSS + Tailwind — no additional library

**For military flights layer:**
- Poll `https://api.airplanes.live/v2/mil` every 15–30 s via TanStack Query
- Render using existing `PointPrimitiveCollection` pattern from v1.0 aircraft layer
- Deduplicate with civilian aircraft layer by `hex` (ICAO24) in the Zustand aircraft store
- Military flag indicator: different color constant (e.g. amber) and optional icon overlay

**For GPS jamming heatmap:**
- Fetch daily CSV from `https://gpsjam.org/data/YYYY-MM-DD.csv` (where date is today or yesterday)
- CSV columns: `hex` (H3 cell ID at resolution 4), `pct_bad` (fraction of aircraft reporting poor nav accuracy), `count`
- Use `h3-js`: `h3.cellToBoundary(hexId)` → array of `[lat, lng]` pairs → convert to CesiumJS `Cartesian3.fromDegreesArray`
- Render as `GroundPrimitive` + `PolygonGeometry` colored by `pct_bad` (green < 2% → yellow 2–10% → red > 10%)
- Backend RQ worker fetches and caches the daily CSV in Redis with 12-hour TTL; frontend polls FastAPI proxy endpoint

**For maritime traffic (AIS):**
- Connect from **frontend** via `WebSocket` to `wss://stream.aisstream.io/v0/stream`
- Subscription: `{ APIKey, BoundingBoxes: [[[minLat,minLon],[maxLat,maxLon]]], FilterMessageTypes: ["PositionReport"] }`
- Update bounding box on camera move (debounced 2 s) by sending a new subscription message
- Render vessel positions as `PointPrimitiveCollection`; trails as `PolylinePrimitiveCollection` (last N positions per MMSI stored in Zustand)
- Alternative pattern: relay through backend FastAPI WebSocket endpoint if browser cross-origin WS proves problematic

**For earthquake layer:**
- `GET https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson` — no auth
- TanStack Query with 60-second refetch interval (feed updates every 1 minute)
- Render: `PointPrimitiveCollection` with point scale proportional to magnitude (`Math.pow(10, magnitude) * scale_factor`)
- Click-to-inspect: reuse existing metadata panel component from v1.0

**For NOAA NEXRAD weather radar:**
- ```typescript
  const radarProvider = new Cesium.WebMapServiceImageryProvider({
    url: 'https://nowcoast.noaa.gov/arcgis/services/nowcoast/radar_meteo_imagery_nexrad_time/MapServer/WMSServer',
    layers: '1',
    parameters: { transparent: true, format: 'image/png' },
    clock: viewer.clock,
    times: new Cesium.TimeIntervalCollection([...]),
  });
  viewer.imageryLayers.add(new Cesium.ImageryLayer(radarProvider, { alpha: 0.6 }));
  ```
- Layer is toggled by `imageryLayer.show = false/true` — do not add/remove from collection on toggle
- WMS time parameter is driven by `viewer.clock` — integrates with the 4D replay timeline automatically
- CORS is enabled on nowCoast per NOAA documentation

**For street traffic particle simulation:**
- Fetch road network from Overpass API for visible viewport bbox using TanStack Query (cache: `staleTime: Infinity`)
- Convert response with `osmtogeojson`, extract `LineString` features where `highway` property exists
- Spawn `ParticleSystem` instances along road polylines using CesiumJS `ParticleEmitter`; position emitters at road start points
- Particle velocity direction follows polyline tangent (derive from first two vertices of each way)
- Use `BlendOption.TRANSLUCENT` on particle collection
- Performance gate: only render particles for roads within 500 km of camera; disable at zoom > 5000 km altitude

**For 4D historical replay:**
- `viewer.clock.startTime` and `stopTime` set to replay window (e.g., last 24 h)
- `viewer.clock.multiplier` controlled by a speed slider (0.25×, 1×, 5×, 10×, 60×, 600×)
- `viewer.clock.clockRange = Cesium.ClockRange.CLAMPED` for single-pass; `LOOP_STOP` for looping
- On each `viewer.clock.onTick`, query local snapshot store for entities at `currentTime`
- Snapshot data fetched from FastAPI `/api/snapshots?start=&end=&type=` and cached in Zustand
- Backend: PostgreSQL `aircraft_snapshots` table (already exists) queried with `timestamp BETWEEN start AND end`

---

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| `mgrs@2.1.0` | TypeScript 5.x | Ships `index.d.ts`. No @types needed. |
| `h3-js@4.1.0` | cesium@1.139, TypeScript 5.x | Ships TypeScript types natively. Uses ES2015 module format. No polyfills needed for Chrome 111+. |
| `osmtogeojson@3.0.0-beta.5` | TypeScript 5.x (via @types/osmtogeojson) | UMD + ESM compatible. Works in browser and Node. `@types/osmtogeojson@2.2.34` provides types. |
| NOAA WMS (CORS) | `WebMapServiceImageryProvider` | CORS confirmed enabled on nowcoast.noaa.gov. No proxy needed. |
| aisstream.io WSS | Browser native `WebSocket` | Standard WSS — no special polyfills. Confirmed `wss://stream.aisstream.io/v0/stream`. |
| `airplanes.live /v2/mil` | `fetch` / TanStack Query | Standard REST, JSON, CORS enabled. |
| USGS GeoJSON | `fetch` / TanStack Query | CORS enabled. No auth. Stable v1.0 feed URL since 2012. |
| `PostProcessStageLibrary` | cesium@1.139 | All built-in stages verified: `createNightVisionStage()`, `createBlackAndWhiteStage()`, `createBrightnessStage()`, `createBlurStage()`, `createDepthOfFieldStage()`, `createEdgeDetectionStage()`, `createLensFlareStage()`, `createSilhouetteStage()`. Bloom is a property on `PostProcessStageCollection` (`viewer.scene.postProcessStages.bloom`), NOT a factory function. |

---

## Data Sources — Full Reference

### Military Aircraft
- **Primary:** `https://api.airplanes.live/v2/mil` — free, no auth, ADSBExchange v2 JSON schema, community-run
- **Fallback:** `https://opendata.adsb.fi/api/v2/mil` — free, no auth, same schema, 1 req/s rate limit
- **Paid option:** ADSBexchange RapidAPI, $10/month, same schema, SLA available
- **Auth:** None for primary/fallback. `X-RapidAPI-Key` header for paid ADSBexchange.

### GPS Jamming Heatmap
- **Source:** gpsjam.org daily CSV
- **URL pattern:** `https://gpsjam.org/data/YYYY-MM-DD.csv` (e.g. `2026-03-10.csv`)
- **Format:** CSV with columns `hex` (H3 cell ID, resolution 4), `pct_bad`, `count`
- **Confidence:** LOW — no official API documentation found. URL pattern inferred from source code references and community usage. Verify by fetching the URL before building the ingest worker.
- **Strategy:** RQ worker fetches daily at 00:05 UTC, stores in Redis with 24-hour TTL. FastAPI endpoint serves cached data to frontend. If URL pattern changes, fallback: ADSB-derived jamming inference from aircraft NACp field (navigation accuracy category) in airplanes.live data.

### Maritime AIS
- **Source:** aisstream.io
- **Endpoint:** `wss://stream.aisstream.io/v0/stream` (secure WebSocket)
- **Auth:** API key in subscription JSON (`APIKey` field). Sign up free at aisstream.io via GitHub OAuth.
- **Status:** Free (beta), no SLA, no uptime guarantee
- **Subscription message:** `{ "APIKey": "...", "BoundingBoxes": [[[minLat, minLon], [maxLat, maxLon]]], "FilterMessageTypes": ["PositionReport"] }`
- **Key fields:** `MetaData.latitude`, `MetaData.longitude`, `MetaData.MMSI`, `MetaData.ShipName`, `Message.PositionReport.Sog` (speed over ground), `Message.PositionReport.Cog` (course)

### Earthquakes
- **Source:** USGS Earthquake Hazards Program
- **Endpoint:** `https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson`
- **Auth:** None
- **Format:** GeoJSON FeatureCollection, Point geometries
- **Key fields:** `properties.mag`, `properties.place`, `properties.time` (Unix ms), `properties.depth` (km), `geometry.coordinates` [lon, lat, depth]
- **Update cadence:** Every 1 minute
- **Confidence:** HIGH — official USGS feed, stable since 2012

### Weather Radar
- **Source:** NOAA nowCoast MRMS NEXRAD composite
- **WMS URL:** `https://nowcoast.noaa.gov/arcgis/services/nowcoast/radar_meteo_imagery_nexrad_time/MapServer/WMSServer`
- **Layer:** `1` (base reflectivity mosaic)
- **Auth:** None
- **CORS:** Enabled
- **Update cadence:** Every 5 minutes
- **Coverage:** CONUS, Hawaii, Puerto Rico, Guam, Alaska
- **CesiumJS integration:** `WebMapServiceImageryProvider` with `parameters: { transparent: true, format: 'image/png' }`
- **Confidence:** HIGH — official NOAA service, verified WMS endpoint

### Road Network (particle simulation)
- **Source:** OpenStreetMap via Overpass API
- **Endpoint:** `https://overpass-api.de/api/interpreter`
- **Query:** `[out:json][timeout:25]; (way["highway"~"motorway|trunk|primary|secondary"]({{bbox}}); ); out geom;`
- **Auth:** None (public endpoint, rate-limited by abuse detection)
- **Note:** Use the Overpass API mirror list (`overpass.kumi.systems`, `overpass.openstreetmap.fr`) as fallbacks. Restrict highway types to `motorway|trunk|primary|secondary` to limit result size. Do not query tertiary/residential streets — too many features, too slow.

---

## Confidence Assessment

| Feature Area | Confidence | Source | Notes |
|--------------|------------|--------|-------|
| CesiumJS post-processing (NVG, Bloom, B&W) | HIGH | Official Cesium docs, GitHub source | Built-in stages verified. FLIR/CRT require custom GLSL — standard WebGL patterns. |
| MGRS library (`mgrs@2.1.0`) | HIGH | npm, NGA-origin | Zero deps, ships types, MIT, stable API |
| Military flights (`airplanes.live /v2/mil`) | MEDIUM | Official API guide page | Free, no auth confirmed. Community-run — no guaranteed uptime. |
| GPS jamming CSV (`gpsjam.org/data/`) | LOW | Community references, not official docs | URL pattern inferred, not officially documented. Confirm before building. |
| AIS (`aisstream.io`) | MEDIUM | Official aisstream.io docs | Free, functional, beta with no SLA. In production by community users. |
| USGS Earthquake GeoJSON | HIGH | Official USGS docs | Stable federal data feed since 2012. |
| NOAA NEXRAD WMS | HIGH | Official NOAA service, verified endpoint | Federal service, CORS enabled, WMS-T time support confirmed. |
| Overpass API for roads | HIGH | OpenStreetMap official wiki | Public endpoint, stable query language since 2007. |
| `osmtogeojson` | MEDIUM | npm, GitHub | Beta label but API unchanged 5+ years. `osm2geojson-ultra` is faster TypeScript alternative if needed. |
| `h3-js@4.1.0` | HIGH | Official H3 docs (Uber) | Ships TS types natively, stable API, 5000+ GitHub stars. |
| CesiumJS Clock / 4D replay | HIGH | Official Cesium docs | `multiplier`, `clockRange`, `onTick` are core, stable CesiumJS API. |

---

## Sources

- [CesiumJS PostProcessStageLibrary docs](https://cesium.com/learn/cesiumjs/ref-doc/PostProcessStageLibrary.html) — built-in stage functions verified
- [CesiumJS PostProcessStageCollection docs](https://cesium.com/learn/cesiumjs/ref-doc/PostProcessStageCollection.html) — `bloom` property confirmed as built-in
- [CesiumJS PostProcessStage docs](https://cesium.com/learn/cesiumjs/ref-doc/PostProcessStage.html) — custom GLSL fragment shader API
- [CesiumJS Clock docs](https://cesium.com/learn/cesiumjs/ref-doc/Clock.html) — `multiplier`, `clockRange`, `startTime`, `stopTime`
- [CesiumJS WebMapServiceImageryProvider docs](https://cesium.com/learn/ion-sdk/ref-doc/WebMapServiceImageryProvider.html) — WMS-T `clock` integration
- [CesiumJS NightVision.glsl source](https://github.com/CesiumGS/cesium/blob/master/Source/Shaders/PostProcessStages/NightVision.glsl) — built-in NVG shader reference
- [mgrs on npm](https://www.npmjs.com/package/mgrs) — version 2.1.0, TS types confirmed
- [aisstream.io documentation](https://aisstream.io/documentation) — WebSocket endpoint, auth, subscription format
- [airplanes.live API guide](https://airplanes.live/api-guide/) — `/mil` endpoint, free/no-auth confirmed
- [USGS GeoJSON feed](https://earthquake.usgs.gov/earthquakes/feed/v1.0/geojson.php) — official feed documentation
- [NOAA nowCoast NEXRAD WMS](https://nowcoast.noaa.gov/arcgis/services/nowcoast/radar_meteo_imagery_nexrad_time/MapServer/WMSServer?request=GetCapabilities&service=WMS) — GetCapabilities endpoint
- [Overpass API OSM wiki](https://wiki.openstreetmap.org/wiki/Overpass_API) — query language and endpoint
- [osmtogeojson on npm](https://www.npmjs.com/package/osmtogeojson) — version 3.0.0-beta.5
- [h3-js on GitHub](https://github.com/uber/h3) — H3 hexagonal indexing, v4.1.0
- [gpsjam.org FAQ](https://gpsjam.org/faq) — hexagon display confirmed, CSV URL pattern NOT officially documented (LOW confidence)
- [ADSBexchange data page](https://www.adsbexchange.com/data/) — military data confirmed available
- [adsb.fi opendata GitHub](https://github.com/adsbfi/opendata) — fallback military endpoint confirmed

---

*Stack research for: Intelligence Globe v2.0 WorldView Parity — new library and API additions only*
*Researched: 2026-03-11*
