# Feature Research: v2.0 WorldView Parity

**Domain:** Geospatial Intelligence Globe — v2.0 New Features Only
**Researched:** 2026-03-11
**Confidence:** HIGH (core features), MEDIUM (data source availability for some layers)

---

## Scope

This document covers ONLY the 12 new v2.0 features. v1.0 features (satellite tracking, aircraft tracking, layer toggles, click-to-inspect, search, filters, dark theme, Docker deployment, FastAPI + PostgreSQL backend) are already built and are not re-researched here.

---

## Feature Landscape

### Table Stakes (Users Expect These in a WorldView-Class Tool)

Features that users of operational intelligence platforms assume exist. Missing them makes v2.0 feel like a fancy v1.0 patch rather than a new capability tier.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Landmark / city preset navigation** | Every mapping tool has saved places. WorldView/Google Earth have this. Users need fast camera jumps to crisis zones, capitals, conflict areas. | LOW | Camera flyTo() via CesiumJS is trivial. The value is in the curated list, not the code. Keyboard shortcuts (Q/W/E/R/T) over 5 slots is the WorldView pattern. |
| **Maritime traffic layer** | Ships are the third domain of geospatial intelligence (after satellites and aircraft). Any "situational awareness" tool without ships is incomplete. | MEDIUM | Free AIS: AISHub (registration required, free tier). aisstream.io WebSocket stream. MarineTraffic/Kpler are commercial. Open-source: aisstream.io or self-hosted OpenCPN server. Icons must be clearly distinct from aircraft (ship silhouette, heading indicator, different color). |
| **Earthquake layer** | Real-time natural events are a standard layer in all geo-intelligence tools. Required to contextualize anomalies near seismic zones. | LOW | USGS GeoJSON feed: `earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_hour.geojson`. Free, no auth, returns GeoJSON `FeatureCollection`. Update every 1-5 minutes. Magnitude-scaled markers are standard — circle radius proportional to magnitude. Color by magnitude tier (green < 3, yellow 3-5, orange 5-6, red > 6). 24h rolling window. Click-to-inspect shows magnitude, depth, location, time. |
| **Military flights layer** | ADSB Exchange is the only unfiltered tracker. "Military" filter is the primary reason OSINT researchers use ADSB Exchange over FlightRadar24 or OpenSky. Users expect this. | MEDIUM | ADSB Exchange REST API: `/api/mil` returns military ICAO24 registrations. ADSB.lol offers a compatible v2 API format for easy switch. Icons must visually differ from commercial — different shape (diamond vs circle), distinct color (amber/orange). Separate toggle from commercial aircraft layer. |
| **Weather radar overlay** | Operational context for aircraft diversions, maritime hazards, crisis response. Standard in every professional mapping tool. | MEDIUM | Iowa State Mesonet NEXRAD WMS: `https://mesonet.agron.iastate.edu/cgi-bin/wms/nexrad/n0r.cgi`, layer `nexrad-n0r-900913`. Free, no auth, WMS GetMap calls. CesiumJS `WebMapServiceImageryProvider` handles WMS natively. CONUS only — international data requires EUMETSAT or similar. Refresh every 5 minutes. Transparency slider is expected. |

### Differentiators (Competitive Advantage)

Features that no single OSINT platform combines in one view. These are what make v2.0 a WorldView-class product rather than a tracker aggregator.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Visual style presets (NVG / CRT / FLIR / Noir)** | No other open-source globe tool has switchable tactical visual modes. This alone makes the tool feel operational, not hobbyist. | MEDIUM | CesiumJS has a built-in `NightVision.glsl` PostProcessStage. CRT scanlines and FLIR thermal colormap are custom GLSL full-screen quad shaders added via `viewer.scene.postProcessStages.add(new Cesium.PostProcessStage({fragmentShader}))`. All presets are screen-space — they apply to the rendered frame buffer, not individual objects. NVG: desaturate + boost green channel + slight noise. CRT: horizontal scanline bands + phosphor green tint + barrel distortion. FLIR: grayscale + hot-cold colormap (blue-cold/white-hot). Noir: desaturate + boost contrast + vignette. Switching presets = disable previous stage, enable new one. |
| **Post-processing parameter controls** | User-adjustable Bloom, Sharpen, Gain, Scanline spacing/opacity, Pixelation sliders give the tool a "mission control operator" feel. No other OSINT visualization exposes this. | LOW-MEDIUM | CesiumJS `PostProcessStageLibrary` exposes `bloomIntensity`, `bloomContrast`, `bloomBrightness` as uniform floats bindable to slider inputs. Custom GLSL uniforms (scanline density, pixelation level) are passed as `uniforms` object to `PostProcessStage`. React sliders update uniform values in real-time via `viewer.scene.postProcessStages` refs. Each slider debounced at ~16ms to maintain 60 FPS. |
| **Cinematic HUD overlay** | Transforms the UI from "web app" to "intelligence terminal." Classification banners, MGRS readout, satellite telemetry ticker, REC timestamp — these exist in WorldView-style UIs and are instantly recognizable. | MEDIUM | This is a pure CSS/React overlay — NOT CesiumJS. Position: fixed, full viewport, pointer-events: none so mouse events pass through to the globe. Classification banner: red bar at top "TOP SECRET // SI-TK // NOFORN" in Courier/monospace. MGRS: computed from cursor lat/lon using `mgrs-js` (NGA library, MIT license) or `proj4js/mgrs`. Updated on `viewer.camera.changed` event. Satellite telemetry: live readouts for selected satellite (ORB, PASS, GSD, ALT, SUN angle, EL). REC timestamp: animated blinking "REC" indicator + ISO timestamp. GSD (Ground Sample Distance) can be estimated from altitude assuming a notional sensor. |
| **GPS Jamming heatmap** | The only public OSINT layer for GPS/GNSS interference inference. gpsjam.org is the only widely-known source. WorldView has nothing equivalent. Builds on v1.0's GNSS anomaly detection concept but with external data. | MEDIUM | gpsjam.org publishes daily hexagonal heatmaps (H3 hex grid) from ADSB-derived accuracy reports. Color coding: green > 98% good, yellow 2-10% degraded, red > 10% degraded. Data format: the site does not expose a clean public API — options are: (a) scrape the published daily GeoJSON files they host, (b) build own inference layer from ADSB Exchange NACp/NACv fields, or (c) use SkAI Data Services API. Recommended: self-build from ADSB Exchange `nic` and `nacp` fields, aggregate into H3 hexagons, store in PostGIS. Label honestly as inference, not geolocation. |
| **4D Historical replay** | Time is the most powerful intelligence dimension. FlightRadar24 Gold charges premium for this. No open-source globe has it. LIVE/PLAYBACK toggle, event dots on timeline, speed multipliers (1×, 3×, 5×, 15×, 3600×) are the expected pattern. | HIGH | This is the highest-complexity feature. Requires: (1) snapshot storage — periodic DB snapshots of all layer states (satellite positions, aircraft positions, events). (2) Timeline UI — custom scrubber bar NOT CesiumJS default widget. Event dots on timeline (color-coded by category: Kinetic, Airspace Closure, Maritime, Seismic, etc.). (3) Playback engine — `setInterval` or `requestAnimationFrame` loop advancing a virtual clock, fetching snapshots at each speed step, re-rendering all layers. (4) CesiumJS Clock API — `viewer.clock.multiplier` and `viewer.clock.currentTime` control playback speed and position. CZML can animate time-dynamic entities natively if positions are stored as sampled properties. Speed tiers: 1m/s (real-time review), 3m/s (fast review), 5m/s (rapid scan), 15m/s (coarse), 1h/s (strategic). |
| **OSINT event correlation** | Satellite overpass lines connecting ISR-capable satellites to ground areas of interest is a unique intelligence visualization. No other open tool does this. OSINT tags at bottom (Kinetic, Maritime, Airspace) add analytical framing. | HIGH | Two components: (a) Overpass lines — use satellite.js to compute which satellites have LOS (line of sight) to a selected ground point of interest at the current time. Draw polyline from satellite to ground. Animate as satellite moves. (b) Event filter tags — bottom bar with clickable tag chips (Kinetic, Airspace Closure, Maritime, Seismic) that filter the event/replay layer. Dependencies: satellite tracking (v1.0, already built), event data model (new), timeline (REP-01 to 04). |
| **Street traffic particle simulation** | Moving dot particles on the road network give a "city alive" feel at street zoom levels. DeckGL and Mapbox GL have this. No CesiumJS tool has it. | HIGH | Two sub-problems: (a) Road network data — OSM Overpass API for road geometries in the current view bbox. Cache aggressively. (b) Particle system — custom CesiumJS Primitive or WebGL overlay. Particles travel along road line segments at simulated speeds, randomly distributed. No real traffic data — this is a synthetic visual simulation. Density is zoom-dependent (fewer particles at high altitude, more at street level). Color by road class (motorway: bright white, arterial: cyan, local: dim). Interaction model: appears automatically when zoom level crosses ~500m altitude threshold. Toggle in layer controls. This is purely aesthetic — do NOT present as real traffic data. |

### Anti-Features (Do Not Build)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| **Real GPS jammer geolocation** | Users want to find the actual jammer device | Requires sensor triangulation not available from ADSB telemetry alone. Publishing a precise location is wrong and potentially defamatory. | Label all jamming data as "GNSS degradation anomaly cluster — inferred from aircraft telemetry, not geolocated." Use H3 hex cells, not precise points. |
| **Live commercial traffic as "military"** | Users want more coverage | ADSB Exchange military filter is based on ICAO24 military registrations. Labeling ambiguous aircraft as military is misleading. | Stick to ADSB Exchange `/api/mil` endpoint. Clearly label as "military-registered ICAO." |
| **CesiumJS Timeline widget for replay** | The built-in widget seems like an easy shortcut | The default Cesium timeline widget is not customizable enough for event dots, speed presets, category coloring, and LIVE/PLAYBACK toggle. It's a blocker, not a helper. | Build a custom React timeline component. Use `viewer.clock` API for the actual time control but drive it from custom UI. |
| **Real-time street traffic data** | Users might expect actual traffic conditions | Real-time road traffic data (TomTom, HERE) requires expensive API keys. OSM has no real-time layer. Even fake-looking particles add cognitive noise if users think they represent real conditions. | Synthetic particle simulation only, clearly not representing real traffic. Or omit entirely if the "cinematic feel" benefit doesn't justify the complexity. |
| **MarineTraffic / Kpler AIS** | Best coverage, most ship data | Commercial API, expensive at scale. License restricts redistribution. | Use AISHub (free, registration required) or aisstream.io (WebSocket, free tier). Label data source clearly. |
| **Post-processing applied per object** | Users might want to NVG-highlight specific satellites only | CesiumJS PostProcessStage is screen-space (full-frame buffer). Selective per-object post-processing requires stencil buffer hacks or separate render passes — extremely complex and fragile. | Apply presets globally. Use object color/opacity changes to highlight specific objects within a preset. |
| **Pixel-perfect FLIR thermal simulation** | Would look impressive | True FLIR requires actual thermal sensor data. Fake FLIR applied to a standard globe texture looks unconvincing unless the underlying data is thermal-appropriate. Attempting it looks bad. | Apply FLIR as a stylistic colormap preset (grayscale + hot-cold color ramp). Do not claim thermal accuracy. Label it "FLIR STYLE" not "FLIR SENSOR." |
| **Replay of GPS Jamming / weather layers** | Users want full-scene historical replay | Storing historical snapshots of every layer simultaneously (GPS jam tiles + weather radar + AIS + aircraft) multiplies storage requirements dramatically. | Replay phase 1: satellites + aircraft only. Replay phase 2: add events. Jamming/weather historical data is not generally available for free anyway. |
| **Keyboard shortcuts that conflict with browser defaults** | More shortcuts seem better | Ctrl+S, Ctrl+F, etc. conflict with browser save/find. Alt combinations are inconsistent cross-platform. | Use single-key shortcuts (Q/W/E/R/T for landmarks as specified) only when the globe viewport has focus. Escape to close panels. Avoid Ctrl/Alt combos. |

---

## Feature Dependencies

```
[CesiumJS Scene / PostProcessStageCollection]
    └──enables──> Visual Style Presets (NVG, CRT, FLIR, Noir)
                      └──requires──> Post-Processing Parameter Controls (uniforms → sliders)

[CSS/React Viewport Overlay]
    └──enables──> Cinematic HUD Overlay
                      ├──requires──> mgrs-js (coord conversion)
                      ├──requires──> Satellite Click-to-Inspect data (v1.0)
                      └──requires──> Camera position listener (viewer.camera.changed)

[ADSB Exchange API]
    └──enables──> Military Flights Layer
                      └──depends-on──> Aircraft Layer Toggle System (v1.0)

[USGS GeoJSON Feed]
    └──enables──> Earthquake Layer
                      └──depends-on──> Layer Toggle System (v1.0)

[Iowa State Mesonet WMS]
    └──enables──> Weather Radar Overlay
                      └──uses──> CesiumJS WebMapServiceImageryProvider (built-in)

[AISHub / aisstream.io]
    └──enables──> Maritime Traffic Layer
                      └──depends-on──> Layer Toggle System (v1.0)
                      └──enhances──> 4D Historical Replay (ships in playback)

[ADSB Exchange NACp/NACv fields OR gpsjam.org scrape]
    └──enables──> GPS Jamming Heatmap
                      └──depends-on──> PostGIS H3/hexagon aggregation
                      └──enhances──> OSINT Event Correlation (jamming events)

[OSM Overpass API + Custom WebGL Particles]
    └──enables──> Street Traffic Particle Simulation
                      └──isolated──> No dependencies on other v2.0 features

[CesiumJS camera.flyTo()]
    └──enables──> Landmark / City Preset Navigation
                      └──isolated──> No dependencies on other v2.0 features

[DB Snapshot Infrastructure]
    ├──required-by──> 4D Historical Replay
    │                     ├──requires──> Timeline Scrubber UI (custom React)
    │                     ├──requires──> viewer.clock API (CesiumJS)
    │                     └──enables──> OSINT Event Correlation (replay context)
    └──required-by──> OSINT Event Correlation (event data storage)

[satellite.js LOS computation]
    └──enables──> OSINT Event Correlation (overpass lines)
                      └──depends-on──> Satellite Tracking Worker (v1.0)
                      └──depends-on──> 4D Historical Replay (time context for overpasses)
```

### Dependency Notes

- **Post-processing controls require visual style presets first:** Sliders that control `bloomIntensity` etc. are meaningless without a PostProcessStage already on the scene. Build presets first, expose controls second.
- **Cinematic HUD is independent of visual presets:** The CSS overlay can be shown in any preset mode. No dependency, but they are designed to be used together.
- **4D Replay is the highest-order dependency:** OSINT event correlation with overpass lines is most powerful when the globe is in playback mode (showing a satellite overflying an area at the exact historical moment of an event). Replay should be built before full OSINT correlation.
- **GPS Jamming heatmap has no official API:** Building from ADSB Exchange NACp fields is the most reliable path. This is a backend engineering task (PostGIS + RQ job), not a frontend task.
- **Street traffic is fully isolated:** No other feature depends on it. It can be deferred or cut if the complexity/benefit ratio is unfavorable.
- **Landmark navigation is fully isolated:** Pure frontend, no backend. Build it in any phase without risk.
- **Military flights depends on ADSB Exchange rate limits:** The free tier is limited. The app should cache military positions and update every 15-30 seconds, not per frame.

---

## MVP Definition for v2.0

### Phase 1 — Visual Engine (Build First)

These establish the new visual identity and have no data dependencies.

- [ ] **Visual style presets** — NVG, CRT, FLIR, Noir via PostProcessStage. Switches the entire product feel instantly.
- [ ] **Post-processing parameter controls** — Bloom, Sharpen, Gain sliders. Low effort, high perceived quality.
- [ ] **Cinematic HUD overlay** — Classification banner, MGRS readout, telemetry ticker. Pure CSS/React, no backend.
- [ ] **Landmark / city preset navigation** — Q/W/E/R/T keyboard shortcuts + bottom quick-jump bar. Low effort.

### Phase 2 — New Data Layers (Build Second)

These add intelligence value and follow the v1.0 layer pattern.

- [ ] **Military flights layer** — ADSB Exchange `/api/mil`. Different icon from commercial.
- [ ] **Earthquake layer** — USGS GeoJSON. Magnitude-scaled markers. Easy integration.
- [ ] **Maritime traffic layer** — AISHub or aisstream.io. Ship icons, click-to-inspect.
- [ ] **Weather radar overlay** — Iowa State Mesonet WMS. CesiumJS WebMapServiceImageryProvider.
- [ ] **GPS Jamming heatmap** — Backend aggregation from ADSB NACp fields. H3 hex polygons.

### Phase 3 — 4D Intelligence Engine (Build Third)

These are architecturally complex and depend on Phases 1 and 2.

- [ ] **4D Historical replay** — Snapshot storage, timeline scrubber, speed controls. Must be built before event correlation.
- [ ] **OSINT event correlation** — Overpass lines, event filter tags. Requires replay context.
- [ ] **Street traffic particle simulation** — Synthetic road particle animation. Aesthetic only, safe to defer.

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Visual style presets | HIGH | MEDIUM | P1 |
| Post-processing controls | MEDIUM | LOW | P1 |
| Cinematic HUD overlay | HIGH | MEDIUM | P1 |
| Landmark navigation | MEDIUM | LOW | P1 |
| Military flights layer | HIGH | MEDIUM | P1 |
| Earthquake layer | MEDIUM | LOW | P1 |
| Maritime traffic layer | HIGH | MEDIUM | P2 |
| Weather radar overlay | MEDIUM | MEDIUM | P2 |
| GPS Jamming heatmap | HIGH | HIGH | P2 |
| 4D Historical replay | HIGH | HIGH | P2 |
| OSINT event correlation | HIGH | HIGH | P3 |
| Street traffic particles | LOW | HIGH | P3 |

**Priority key:**
- P1: Must have for v2.0 launch — establishes the new capability tier
- P2: Should have — fills out the intelligence picture
- P3: Nice to have — add when P1/P2 are stable

---

## Interaction Model Per Feature

### Visual Style Presets

- **Trigger:** Preset selector in top-right toolbar (tabs or icon buttons): NORMAL | NVG | CRT | FLIR | NOIR
- **Behavior:** Clicking a preset immediately swaps the active PostProcessStage. Transition is instantaneous (no animation needed — the frame buffer switch is instant).
- **Visual output:** NVG — green phosphor tint, slight noise. CRT — horizontal scanline bands, barrel distortion, phosphor bloom. FLIR — grayscale with hot-cold colormap (blue → white-hot). Noir — high-contrast desaturated with vignette.
- **Persistence:** Store in localStorage, restore on next load.

### Post-Processing Parameter Controls

- **Trigger:** Expand panel (collapse by default) adjacent to preset selector.
- **Behavior:** Each slider updates PostProcessStage uniforms in real-time. Labels and value readouts (e.g., "Bloom: 0.7") visible.
- **Controls:** Bloom Intensity (0–2.0), Sharpen Amount (0–1.0), Gain (0.5–2.0), Scanline Spacing (1–10px), Scanline Opacity (0–0.8), Pixelation Level (1–16).
- **Not all controls apply to all presets:** Grey out irrelevant sliders per preset. Scanlines only active in CRT. Pixelation only in FLIR.

### Cinematic HUD Overlay

- **Always visible** when HUD toggle is enabled (default: on).
- **Top bar:** Red classification banner "TOP SECRET // SI-TK // NOFORN" in uppercase monospace. Static text — this is a style element, not actual classification.
- **Bottom-left:** MGRS coordinate (10-digit precision) updating as camera moves. Lat/lon in decimal below it.
- **Bottom-right:** REC indicator (blinking red dot + "REC" text) + ISO 8601 timestamp updating every second.
- **Left sidebar:** When a satellite is selected — ORB (orbital period in minutes), PASS (next pass ETA), ALT (altitude km), INC (inclination deg), GSD (notional ground sample distance in meters), SUN (sun elevation angle at ground track), EL (elevation angle from observer).
- **Interaction:** HUD toggle button (keyboard shortcut: H) shows/hides entire overlay.

### Military Flights Layer

- **Icons:** Diamond shape (vs circle for commercial aircraft). Color: amber/orange. Distinct from commercial grey/blue.
- **Click-to-inspect:** Same panel as commercial aircraft but adds ICAO military registration note. Callsign, ICAO24, altitude, speed, heading.
- **Data refresh:** Every 30 seconds (rate limit consideration).
- **Toggle:** Separate from commercial aircraft toggle. Can coexist.
- **Filter integration:** Existing altitude/region filters apply.

### GPS Jamming Heatmap

- **Visual:** H3 hexagonal grid overlaid on globe. Green/yellow/red coloring by degradation percentage.
- **Opacity:** Default 50% — semi-transparent so globe detail shows through.
- **Click interaction:** Click a hex cell — shows popup with degradation %, aircraft count in sample, date/time of data.
- **Update cadence:** Daily update (data is aggregated over 24h). Show "data as of [date]" label.
- **Honesty label:** Permanent overlay text "GPS anomaly inference — not precise geolocation." Small, semi-transparent, bottom of map.

### Maritime Traffic Layer

- **Icons:** Ship silhouette SVG, heading indicator (direction triangle). Color by vessel type: tanker (red), cargo (cyan), passenger (white), military (amber), other (grey).
- **Click-to-inspect:** Vessel name, MMSI, type, speed (knots), heading, destination (if broadcast), flag state.
- **Data refresh:** Every 60 seconds (AIS update rate varies by vessel class).
- **Toggle:** Separate layer. Independent of aircraft/satellite layers.

### Earthquake Layer

- **Icons:** Circle markers. Radius scaled to magnitude (M2 = tiny, M7+ = large). Color by magnitude tier.
- **Click-to-inspect:** Magnitude, depth, location name, origin time, USGS event link.
- **Update cadence:** Every 5 minutes from USGS hourly feed. 24-hour rolling window.
- **Animation:** New events pulse briefly on appearance.

### Weather Radar Overlay

- **Visual:** Semi-transparent NEXRAD precipitation tiles overlaid on globe. Standard radar color scale (green = light rain, yellow/orange = moderate, red/purple = severe).
- **Opacity:** User-adjustable slider in layer control panel.
- **Update cadence:** Every 5 minutes.
- **Coverage note:** CONUS only initially. Label non-coverage areas clearly.
- **Toggle:** Layer control with opacity slider.

### Street Traffic Particle Simulation

- **Trigger:** Automatically activates when camera altitude < 500m. Toggle in layer controls.
- **Visual:** Small dots (3–5px) moving along road line segments. Speed proportional to road class. Motorway particles move faster than local roads.
- **Color:** Road-class coded. Does NOT represent real traffic.
- **Disclaimer label:** "Synthetic simulation — not real traffic data." Visible when layer active.
- **Performance gate:** Road geometry fetched from OSM Overpass API for current bbox. Cache heavily. Max 2,000 active particles at a time.

### Landmark / City Preset Navigation

- **Bottom quick-jump bar:** Row of 5 labeled buttons at bottom of screen. Default POIs: [KYIV, STRAIT OF HORMUZ, SOUTH CHINA SEA, RED SEA, IRANIAN PLATEAU] — operationally relevant to current geopolitics.
- **Keyboard shortcuts:** Q=slot1, W=slot2, E=slot3, R=slot4, T=slot5. Active only when globe has focus.
- **Behavior:** Pressing a key or clicking a button triggers `viewer.camera.flyTo()` with a preset cartographic position and heading/pitch.
- **Customization (v2.1):** Defer user-defined POIs to a future iteration. Hardcode the initial 5.

### 4D Historical Replay

- **Mode toggle:** LIVE / PLAYBACK toggle in top control bar.
- **LIVE mode:** Current behavior (v1.0 real-time tracking).
- **PLAYBACK mode:** Timeline scrubber appears at bottom. Date/time range selector. Playback controls: ⏮ (start), ⏪ (rewind), ⏸ (pause), ▶ (play), ⏩ (forward), ⏭ (end).
- **Speed selector:** Discrete steps — 1×, 3×, 5×, 15×, 3600× (labeled as "1m/s", "3m/s", "5m/s", "15m/s", "1h/s").
- **Event dots on timeline:** Small colored dots on the scrubber track mark events. Color by category: red=Kinetic, orange=Airspace Closure, blue=Maritime, brown=Seismic, yellow=GPS Anomaly.
- **Backend:** RQ job snapshots all layer states every N minutes to PostgreSQL. Snapshot table: `(snapshot_id, layer, entity_id, timestamp, position_json, metadata_json)`.
- **Playback engine:** Frontend fetches snapshots for current virtual time. Renders them as static positions (no live propagation in playback mode for aircraft/ships). Satellites CAN be propagated from TLEs using historical virtual clock — no snapshot needed for them.

### OSINT Event Correlation

- **Overpass lines:** When an event (e.g., airstrike report, maritime incident) is selected, draw arc lines from all ISR-capable satellites with LOS to that point at the event timestamp. Line weight proportional to satellite sensor capability (if known).
- **Overpass computation:** Uses satellite.js `observe()` to compute elevation angle from event location to each satellite at the event time. Filter to elevation > 10 degrees (above horizon).
- **Event filter tags:** Bottom bar chip filters — [ALL] [KINETIC] [AIRSPACE] [MARITIME] [SEISMIC] [JAMMING]. Click to filter which events are shown on globe and timeline.
- **Interaction:** Click an event marker → event panel opens with description, timestamp, source, category, correlating satellites listed.
- **Data source:** Events ingested from user-defined OSINT feeds or manually added (v2.0 scope: manual add + USGS earthquakes + ADSB airspace closures).

---

## Complexity Ranking (Honest Assessment)

### LOW Complexity (< 3 days each)

- Landmark / city preset navigation — pure frontend, CesiumJS flyTo() call
- Earthquake layer — USGS GeoJSON, already-known pattern from v1.0
- Post-processing parameter controls — slider → uniform binding
- Cinematic HUD overlay — CSS/React, no backend

### MEDIUM Complexity (3–7 days each)

- Visual style presets — custom GLSL required for CRT/FLIR, NVG is built-in
- Military flights layer — ADSB Exchange integration, icon differentiation
- Maritime traffic layer — AIS source research + icon set + click-inspect
- Weather radar overlay — WMS integration with CesiumJS WebMapServiceImageryProvider

### HIGH Complexity (1–3 weeks each)

- GPS Jamming heatmap — backend aggregation pipeline from NACp fields, H3 hexagons, no clean API
- 4D Historical replay — snapshot storage design, custom timeline UI, playback engine, clock sync
- OSINT event correlation — LOS computation at historical time, event data model, UI composition
- Street traffic particle simulation — OSM road network fetching, custom particle WebGL system, performance management

---

## Sources

- [CesiumJS PostProcessStageLibrary Documentation](https://cesium.com/learn/cesiumjs/ref-doc/PostProcessStageLibrary.html)
- [CesiumJS PostProcessStage Reference](https://cesium.com/learn/cesiumjs/ref-doc/PostProcessStage.html)
- [CesiumJS NightVision.glsl built-in shader](https://github.com/CesiumGS/cesium/blob/master/Source/Shaders/PostProcessStages/NightVision.glsl)
- [CesiumJS Animation / Clock API](https://cesium.com/learn/cesiumjs/ref-doc/Animation.html)
- [Cesium Time Animation using CZML](https://cesium.com/blog/2018/03/21/czml-time-animation/)
- [USGS Earthquake GeoJSON Summary Feed](https://earthquake.usgs.gov/earthquakes/feed/v1.0/geojson.php)
- [USGS Earthquake Catalog API](https://earthquake.usgs.gov/fdsnws/event/1/)
- [NOAA nowCOAST NEXRAD WMS Server](https://nowcoast.noaa.gov/arcgis/services/nowcoast/radar_meteo_imagery_nexrad_time/MapServer/WMSServer?request=GetCapabilities&service=WMS)
- [Iowa State Mesonet NEXRAD WMS (IEM)](https://mesonet.agron.iastate.edu/ogc/)
- [ADS-B Exchange REST API Information](https://www.adsbexchange.com/data/rest-api-samples/)
- [ADSB.lol — Unfiltered Flight Tracking API](https://adsb.lol/)
- [ADSB One API (ADSBExchange v2-compatible)](https://github.com/ADSB-One/api)
- [GPSJam GPS/GNSS Interference Map](https://gpsjam.org/)
- [GPSJam FAQ — Data methodology](https://gpsjam.org/faq)
- [GPSJam — Bellingcat OSINT Toolkit](https://bellingcat.gitbook.io/toolkit/more/all-tools/gpsjam)
- [AISHub Free AIS Data Exchange](https://www.aishub.net/)
- [NGA MGRS-JS Library (MIT License)](https://github.com/ngageoint/mgrs-js)
- [Proj4js MGRS Utility](https://github.com/proj4js/mgrs)
- [Flightradar24 GPS Jamming Map](https://www.flightradar24.com/data/gps-jamming)

---

*Feature research for: Intelligence Globe v2.0 WorldView Parity*
*Researched: 2026-03-11*
