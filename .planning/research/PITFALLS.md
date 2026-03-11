# Pitfalls Research

**Domain:** CesiumJS/FastAPI geospatial intelligence platform — v2.0 WorldView Parity feature additions to an existing system
**Researched:** 2026-03-11
**Confidence:** HIGH (CesiumJS rendering pipeline, PostgreSQL partitioning, AIS/USGS APIs), MEDIUM (ADSB Exchange auth change, gpsjam.org data access method), LOW (NOAA nowcoast rate limits — no published SLA found)

---

## Critical Pitfalls

### Pitfall 1: Post-Processing Stages Apply to the Entire Scene — Including All Existing v1.0 Primitives

**What goes wrong:**
CesiumJS post-processing (`PostProcessStageCollection`) operates on the final composited frame texture — not on individual layers or primitives. Adding an NVG green-tint or CRT scanline stage immediately desaturates or tints the entire scene: ESRI World Imagery, satellite points, aircraft trails, atmosphere, and the skybox all get the same effect. There is no built-in mechanism to apply a post-process stage to a subset of the scene. The `selected` array on `PostProcessStage` has documented limitations and partial implementation in the official GitHub tracker.

Additionally, CesiumJS 1.121 (September 2024) changed the default tonemapper from ACES to PBR Neutral Tonemap and enabled 4x MSAA by default. If the project bundles an older CesiumJS version, enabling HDR stages will interact with the old ACES tonemapper and produce incorrect luminance. If the project is already on 1.121+, the new tonemapper interacts with custom bloom in ways that override the `exposure` property unless it is explicitly re-set.

**Why it happens:**
Developers assume post-processing can be scoped per-layer or per-layer-type. It cannot. The v1.0 codebase never needed post-processing, so there is no abstraction layer for it in `GlobeView.tsx`.

**How to avoid:**
- Build a `PostProcessManager` singleton before writing any preset code. It owns all stage instances and exposes `setPreset(name)` as the only public interface.
- Implement each preset as a `PostProcessStageComposite` with named uniform functions evaluated per-frame (not stale closures). Swap presets atomically by enabling one composite and disabling the others.
- Explicitly query and store the viewer's pre-existing HDR/tonemapper state on init and restore it when switching to the "Normal" preset.
- Disable the built-in FXAA (`viewer.scene.postProcessStages.fxaa.enabled = false`) before enabling custom anti-aliasing to prevent double-pass aliasing.
- Test every preset on the live v1.0 scene (5,000+ satellites + aircraft + ESRI imagery) — not on an empty sandcastle demo.

**Warning signs:**
- Globe imagery appears monochromatic or tinted after adding any preset (scope bleed).
- Satellite points lose their color accent (BlendOption.OPAQUE interaction with color-matrix stages).
- Frame rate drops from 60 to 30 immediately on preset switch (too many concurrent active stages).
- Switching presets in quick succession leaves orphan stages visible.

**Phase to address:** Visual Style Presets (VIS-01 to VIS-05). This must be the first v2.0 feature phase so all subsequent layers are built and tested within an established post-processing context.

---

### Pitfall 2: Post-Processing Uniform Functions Capture Stale State

**What goes wrong:**
CesiumJS evaluates `PostProcessStage` `uniforms` as either a constant value or a function called once per frame. If the uniform is set as a direct property value (not a function), it captures the value at the time of stage creation and does not reflect slider changes. The effect appears in place but is permanently frozen at the initial value, making all sliders non-functional despite correct React state updates.

**Why it happens:**
The CesiumJS documentation shows both constant and function-style uniforms. Developers naturally write `uniforms: { intensity: sliderValue }` where `sliderValue` is a variable, not realizing this is evaluated once at object creation, not per-frame.

**How to avoid:**
Uniforms for controllable effects must be functions that read from a shared mutable ref or store at call time:
```
uniforms: {
  intensity: () => storeRef.current.bloomIntensity,
}
```
Keep a single `uniformsRef` object per stage and update its properties directly — do not recreate the stage when slider values change.

**Warning signs:**
- Slider moves in UI but visual effect does not change.
- The effect changes once on first slider move, then stops responding.
- `uniforms` is assigned with a non-function value that reads a React state variable.

**Phase to address:** Post-Processing Parameter Sliders (VIS-05).

---

### Pitfall 3: Snapshot Storage for 4D Replay Grows Unboundedly and Kills the PostgreSQL Instance

**What goes wrong:**
A naive replay implementation stores one row per tracked entity per polling cycle. With satellites (5,000+), aircraft (hundreds), ships (thousands in coastal AIS coverage zones), earthquakes, and weather polling at 10–300 second intervals, the snapshot table can accumulate 100M+ rows within 1–2 weeks on a homelab VPS. A single un-partitioned `snapshots` table causes sequential scans on replay queries ("give me all entities at time T"), autovacuum falls behind on dead-tuple cleanup from continuous upserts, and the entire PostgreSQL instance eventually becomes unresponsive.

The failure mode is insidious: the app works fine for the first few days of development, then replay queries start timing out at week two, then the whole DB becomes sluggish. Retroactively partitioning a live production table requires taking the app offline.

**Why it happens:**
Each new data layer added multiplies snapshot row generation. A schema designed for one layer does not account for five simultaneous ones. Developers focus on getting data flowing first and defer storage architecture decisions.

**How to avoid:**
- Use **range-partitioned tables** by `snapshot_time` with daily partitions from the start. Dropping a partition (`DROP TABLE snapshots_2026_03_10`) is instant and lock-free versus deleting millions of rows.
- Implement a **retention RQ job** that drops partitions older than a configurable number of days per layer (earthquake data has different useful life than aircraft position data).
- Store **layer-specific snapshot tables** (`snapshots_aircraft`, `snapshots_ships`, etc.) rather than a polymorphic `snapshots` table — simpler queries, independent retention, and smaller per-layer indexes.
- Use **delta snapshots** for high-frequency entities: only write changed fields between cycles, not full state.
- Index on `(entity_id, snapshot_time)` and `(snapshot_time)` separately; avoid composite indexes that prevent partition pruning.

**Warning signs:**
- `pg_database_size()` growing faster than 500 MB/day.
- `SELECT count(*) FROM snapshots` takes more than 200ms.
- `autovacuum_count` on the snapshots table is consistently high in `pg_stat_user_tables`.
- Replay query "what was at T" takes more than 1 second.

**Phase to address:** 4D Historical Replay (REP-01). Partition schema must be designed before any snapshot data starts flowing — retrofitting is painful and requires downtime.

---

### Pitfall 4: ADSB Exchange Is Now Fully Paid via RapidAPI With a Tight Monthly Request Budget

**What goes wrong:**
ADS-B Exchange discontinued its freemium RapidAPI service in March 2025. Access now requires a paid RapidAPI subscription: the Basic plan is $10/month with 10,000 requests/month (approximately 333/day or one request every 4.3 minutes maximum). The authentication pattern is an `X-RapidAPI-Key` header with a UUID — entirely different from the existing OpenSky OAuth2 Bearer token pattern already in the v1.0 codebase. Any test code that makes rapid debugging requests or polls at less than 5-minute intervals will exhaust the monthly budget within days of development.

Additionally, the old "ADSBx Flight Sim Traffic API" endpoint referenced in pre-2025 community posts and gists is discontinued. Code using those endpoint URLs will receive 404 or redirect responses.

**Why it happens:**
Pre-2025 GitHub examples and forum posts reference the old free endpoint. The RapidAPI migration happened during active development of other v1.0 features. The different auth pattern surprises developers expecting OpenSky-style OAuth2.

**How to avoid:**
- Register for RapidAPI and obtain the key before writing any ADSB Exchange code.
- Build a `MilitaryFlightSource` abstraction in the backend (separate from `AircraftSource`) so the data source can be swapped without touching the scheduler.
- Cache all ADSB Exchange responses in Redis with a minimum 300-second TTL (5 minutes).
- Log the daily request count in the poller. Emit a warning when within 50 requests of the daily budget.
- Keep ADSB Exchange credentials in `ADSB_EXCHANGE_API_KEY` env var, never in application code.

**Warning signs:**
- HTTP 429 responses from `adsbexchange-com1.p.rapidapi.com`.
- "ADSBx Flight Sim Traffic API" in any URL string in the codebase.
- Daily request count exceeds 280.
- Auth code uses Bearer token format instead of `X-RapidAPI-Key` header.

**Phase to address:** Military Flights layer (LAY-01).

---

### Pitfall 5: gpsjam.org Has No Public API — The Heatmap Must Be Independently Replicated

**What goes wrong:**
There is no public API or data download from gpsjam.org. The site updates once per day (shortly after midnight UTC) and is intended for human viewing only. Developers who plan to "integrate the gpsjam.org feed" will find nothing to integrate. Scraping the site returns HTML with no machine-readable data embedded.

gpsjam.org itself derives its hexagonal heatmap from the ADS-B Exchange dataset by reading per-aircraft `nic` (Navigation Integrity Category) and `nacp` (Navigation Accuracy Category for Position) fields. GPS degradation appears as anomalously low NIC/NACp values across a geographic cluster of aircraft.

**Why it happens:**
The project requirements list "GPS Jamming heatmap (gpsjam.org data)" implying gpsjam.org is a data source. It is a visual product, not a data API.

**How to avoid:**
- Query the ADSB Exchange API for NIC and NACp values per aircraft position.
- Aggregate degraded-accuracy reports (NIC < 7 or NACp < 7) into H3 or hex-bin cells over the current viewport.
- Render the resulting grid as a heatmap using a `GroundPrimitive` with a Fabric `ColorMaterialProperty` rather than an `ImageryLayer` (avoids texture sampler budget pressure).
- Label the layer clearly: "GPS Degradation Heatmap — inferred from aircraft navigation accuracy reports. Not a precise jammer location."
- The heatmap can only be as fresh as the ADSB Exchange polling interval (5 minutes minimum given rate limits).

**Warning signs:**
- Any code attempting to fetch from `gpsjam.org` programmatically.
- Plans to scrape the gpsjam.org map image.
- Assumptions that gpsjam.org updates in real-time.

**Phase to address:** GPS Jamming Heatmap (LAY-02). The approach must be documented as NIC/NACp aggregation from ADSB Exchange, not a data feed.

---

### Pitfall 6: AISstream.io Is Beta, Disconnects Every 2 Minutes, and Has No SLA

**What goes wrong:**
aisstream.io — the most accessible free global AIS WebSocket feed — is explicitly BETA with no uptime guarantees. It sends server-initiated disconnect messages approximately every 2 minutes. It also requires the subscription filter message to be sent within 3 seconds of WebSocket connection establishment or forcibly closes the connection. A backend AIS consumer written as a simple `async for message in ws` loop without reconnection logic will silently stop updating after the first disconnect. The maritime layer will then freeze indefinitely with no error visible to the user.

Additionally, aisstream.io uses terrestrial AIS stations only — no satellite AIS coverage. Coverage is reliable in ports and coastal waters but drops to zero beyond 50–75 nautical miles offshore. Displaying ship icons in open ocean implies global real-time coverage that does not exist.

**Why it happens:**
WebSocket consumer code written for stable server connections does not handle server-initiated disconnects. The 3-second subscription window requirement is not prominently documented and only surfaces during connection drop recovery.

**How to avoid:**
- Implement exponential backoff reconnection with a maximum 30-second retry delay in the AIS consumer.
- Send the subscription message immediately on `open` — before awaiting any messages.
- Cache the last known position of each vessel in Redis with a `stale_at` timestamp. Serve stale positions to the frontend rather than no positions during reconnect.
- Add an AIS connection status indicator to the bottom status bar (connected / reconnecting / offline).
- Cap the number of tracked MMSIs per bounding box subscription to avoid backpressure that triggers forced disconnects.
- Add a UI tooltip explaining terrestrial-only AIS coverage with a link to the coverage map.

**Warning signs:**
- Maritime layer freezes for more than 5 minutes with no error surfaced.
- Backend logs show no AIS messages received but no reconnect attempt.
- `connection closed` in WebSocket consumer logs not followed by a reconnect log line.

**Phase to address:** Maritime Traffic layer (LAY-03).

---

### Pitfall 7: React HUD Overlay Blocks CesiumJS Canvas Pointer Events

**What goes wrong:**
The cinematic HUD is a React DOM element positioned `absolute` over the CesiumJS `<div>` container. Any element with a non-`none` `pointer-events` CSS value that overlaps the canvas will intercept mouse and touch events that CesiumJS uses for camera control (pan, zoom, click-pick). The existing v1.0 codebase attaches a wheel event listener directly to the canvas container for zoom control; HUD elements sized to overlap the canvas edges will intercept this. On mobile, HTML overlays with higher `z-index` values intercept touch events, potentially breaking pan and pinch-zoom entirely.

CesiumJS also has its own `ScreenSpaceEventHandler` for entity/primitive picking. A HUD element covering the center of the screen will cause all click-picks to return `undefined`.

**Why it happens:**
React component authors set positioning and sizing purely for layout appearance without considering that the CesiumJS canvas handles its own input capture at the DOM level. The issue only manifests in specific screen regions where HUD elements overlap the interactive globe area.

**How to avoid:**
- Apply `pointer-events: none` as the default to the HUD root container element.
- Selectively re-enable `pointer-events: auto` only on interactive sub-elements (buttons, sliders, close icons).
- Keep non-interactive HUD elements (classification markings, MGRS readout, telemetry text) in the screen corners (< 120px from edges), minimizing overlap with the central globe interaction zone.
- After adding each HUD element, manually verify camera pan, scroll-zoom, and a click-pick all work correctly.

**Warning signs:**
- Camera panning stops working when cursor is near the top of the screen.
- Scroll-to-zoom stops in regions covered by HUD labels or classification text.
- Click-pick returns `undefined` when HUD element covers the clicked area.

**Phase to address:** Cinematic HUD Overlay (VIS-06).

---

### Pitfall 8: Multiple Simultaneous ImageryLayers Hit WebGL Fragment Shader Texture Sampler Limits

**What goes wrong:**
CesiumJS composites `ImageryLayer` instances per visible globe tile using WebGL texture samplers in a fragment shader. The base ESRI World Imagery layer, a NEXRAD radar overlay, and a GPS degradation grid simultaneously = 3+ active `ImageryLayer` instances. WebGL 1.0 hardware (common on homelab machines with integrated graphics) limits texture samplers to 8–16 per fragment shader draw call. CesiumJS hits this limit during per-tile compositing and either silently renders some tiles as solid black rectangles or throws `WEBGL: INVALID_OPERATION: bindTexture` errors that are not surfaced to the user.

**Why it happens:**
The failure only occurs on integrated GPU hardware that is below the WebGL limits common on discrete GPUs. A developer on a gaming workstation will never see this; a user on an Intel NUC homelab machine or a VPS with software WebGL will.

**How to avoid:**
- Limit simultaneous active `ImageryLayer` instances to 3 (base + 2 overlays) at any time.
- Use `imageryLayer.show = false` to hide layers (rather than removing them) when toggled off — this does not release the GPU texture slot, but avoids costly re-creation on re-enable. Track total active layers in a ref.
- For the GPS degradation heatmap, use a `GroundPrimitive` with a Fabric `ColorMaterialProperty` instead of an `ImageryLayer` — this bypasses the texture sampler budget entirely.
- Explicitly test with all intended layers enabled simultaneously on a machine with integrated Intel/AMD graphics before marking any layer phase complete.

**Warning signs:**
- Black rectangular tile patches visible on the globe at specific zoom levels when multiple layers are enabled.
- `WebGL: INVALID_OPERATION: bindTexture` in the browser console.
- Performance drops significantly when a third overlay is enabled.

**Phase to address:** GPS Jamming Heatmap (LAY-02) and Weather Radar (LAY-05). Both phases must determine their rendering approach (ImageryLayer vs. Primitive) based on the total budget available.

---

### Pitfall 9: Street Traffic Particle Simulation on the Main Thread Collapses Frame Rate

**What goes wrong:**
CesiumJS `ParticleSystem` works well for point-source effects (rocket exhaust, explosions) but is not designed for thousands of simultaneously active road-following particles. Creating one `ParticleSystem` per road segment with even 100 road segments produces 100 separate WebGL draw calls per frame (each ParticleSystem is its own primitive). On a scene already rendering 5,000+ satellites and multiple aircraft, this pushes the frame budget over 16ms. Main-thread CPU for particle position math further compounds the issue.

**Why it happens:**
`ParticleSystem` is the obvious CesiumJS primitive for "particles." Its single-source design is not apparent until scale is attempted.

**How to avoid:**
- Do not use `ParticleSystem` for road traffic. Use a single `BillboardCollection` or `PointPrimitiveCollection` where each particle is one billboard/point.
- Run particle position updates in a Web Worker (the existing `propagation.worker.ts` pattern can be extended or a new `trafficWorker.ts` can be created using the same zero-copy Float32Array transfer approach).
- Limit the simulation to the current viewport extent — fetch OSM road geometry only for the visible bounding box via the Overpass API, not for the whole world.
- Cap the total particle count (e.g., 5,000 particles maximum) and dynamically adjust density based on current zoom level.

**Warning signs:**
- One `ParticleSystem` instance per road segment in the code.
- Particle position calculation running in `requestAnimationFrame` on the main thread.
- Frame rate drops to < 20 FPS when the traffic layer is enabled.
- The Overpass API query requests more road data than the current viewport bbox.

**Phase to address:** Street Traffic Particles (LAY-06).

---

### Pitfall 10: OSM Road Network Data Cannot Be Downloaded Globally for a Homelab System

**What goes wrong:**
The full OpenStreetMap planet extract is approximately 100 GB compressed (2 TB uncompressed). Downloading and processing this on a homelab VPS is infeasible. Routing databases like OSRM or Valhalla that work with the full planet require 128+ GB RAM for processing. Even regional extracts require significant preprocessing pipeline complexity.

Additionally, the Overpass API (the most accessible method for on-demand road queries) has per-query data limits (~512 MB) and will time out on large bounding box requests. Queries for a continent-scale viewport will fail.

**Why it happens:**
OSM is the most-referenced free road data source. Its size constraints for full-planet use are not obvious when looking at it from a "fetch road network" perspective.

**How to avoid:**
- Use the **Overpass API with a viewport bounding box** scoped to the current camera extent. Attach the query to `viewer.camera.moveEnd` events so road data refreshes as the user navigates.
- Limit road network requests to zoom levels where individual roads are meaningful (roughly below ~200 km altitude).
- Cache Overpass responses in Redis by bbox hash with a 24-hour TTL — road networks do not change hourly.
- Gracefully degrade at zoom levels too broad for Overpass: show a "Zoom in to view traffic simulation" message.
- Do not attempt to run a local OSRM or PostGIS routing engine for this use case — the traffic simulation is visual only, not navigational.

**Warning signs:**
- Any code that attempts to download a full country or region OSM extract.
- Overpass queries without a bounding box constraint.
- No zoom-level gating on road network fetching.

**Phase to address:** Street Traffic Particles (LAY-06).

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Single polymorphic `snapshots` table for all replay layers | Faster to implement | Table bloat, slow replay queries, downtime required to partition retroactively | Never — partition by layer and time from day one |
| Inline `viewer.scene.postProcessStages.add()` in each component | Simpler component code | Duplicate stages accumulate on React re-renders; frame rate degrades silently | Never — use a singleton `PostProcessManager` |
| Polling USGS earthquake feed every 30 seconds | More "live" feel | USGS caches the feed for 60 seconds; polling faster wastes bandwidth and risks 429 | Poll at 5-minute intervals and respect the `Expires` header |
| Storing AIS ship positions directly in PostgreSQL at stream ingestion rate | Familiar persistence pattern | AIS produces hundreds of messages/second in dense shipping areas; DB becomes a write bottleneck | Buffer in Redis per MMSI; flush to PostgreSQL every 30 seconds |
| Using CesiumJS Entity API for earthquake markers (fastest first pass) | Quick to implement | Entity API degrades at 1,000+ objects; v1.0 already proved Primitive API is mandatory | Never for layers expected to exceed 100 simultaneous objects |
| Fetching full OSM planet extract for road network | No Overpass dependency | 100 GB+ download; unprocessable on homelab VPS; no tooling in current stack | Never — use Overpass API with viewport bbox |
| One CesiumJS `ParticleSystem` per road segment | Maps cleanly to the ParticleSystem abstraction | One draw call per road segment; collapses to < 10 FPS at 200+ segments | Never — use a single batched PointPrimitiveCollection |
| Hardcoding the ADSB Exchange RapidAPI key in env file | Avoids secrets management complexity | Exposed in git history if `.env` is committed; exposed in Docker image layers if used as build arg | Only if `.env` is gitignored and Docker images are private |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| ADSB Exchange (RapidAPI) | Using pre-2025 direct `adsbexchange.com` endpoint URLs | Use `adsbexchange-com1.p.rapidapi.com` with `X-RapidAPI-Key` and `X-RapidAPI-Host` headers |
| ADSB Exchange (RapidAPI) | Treating auth as OpenSky-equivalent OAuth2 Bearer | Entirely different auth: UUID header via RapidAPI gateway, not Bearer token |
| gpsjam.org | Attempting to fetch or scrape gpsjam.org programmatically | No public API exists. Replicate the heatmap by aggregating NIC/NACp fields from ADSB Exchange positions |
| aisstream.io | Sending subscription filter message after receiving the first message | Subscription must be sent within 3 seconds of WebSocket open, before any messages arrive |
| USGS Earthquake Feed | Polling the summary GeoJSON more than once per minute | The feed is cached for 60 seconds; respect the `Expires` response header; poll every 5 minutes at minimum |
| NOAA nowcoast WMS | Adding the NEXRAD layer as a standard `WebMapServiceImageryProvider` without a `TIME` parameter | NEXRAD layer is time-enabled; without `TIME` you get the latest mosaic with no temporal control; pass `TIME=<iso8601>` in GetMap |
| NOAA nowcoast WMS | Assuming the WMS endpoint URL is permanent | NOAA restructures ArcGIS REST endpoints during upgrades; pin the full GetCapabilities URL and verify the layer name on each deployment |
| OpenStreetMap Overpass API | Querying road network for the entire visible globe at all zoom levels | Overpass has ~512 MB per-query limits; gate fetches to zoom levels where individual roads are visible and constrain to viewport bbox |
| CesiumJS PostProcessStage | Calling `viewer.scene.postProcessStages.add()` on each React render | Stages accumulate — create once, then toggle `stage.enabled = true/false` |
| AIS (any source) | Treating offshore absence as "no ships present" | Terrestrial AIS coverage ends at 50–75 nm from shore; offshore gaps are coverage gaps, not empty ocean |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| One CesiumJS `ParticleSystem` per road segment | Frame rate < 15 FPS with traffic layer on; GPU draw calls spike | Use a single `PointPrimitiveCollection`; update positions from Web Worker Float32Array | At ~200 road segments |
| Multiple simultaneous active post-processing stages (5+) | Each stage is a full-screen fragment shader pass; 5 stages = 5× GPU fill cost | Combine into a `PostProcessStageComposite`; never leave disabled stages in the collection (remove, don't disable) | At 4+ concurrent stages on mid-range integrated GPU |
| Snapshot replay loading all layer positions for a time window in a single query | Browser receives 50+ MB JSON; frontend freezes | Paginate by time chunks; stream via Server-Sent Events; limit to entities in current camera frustum | At 10+ minutes of replay data with 5+ layers enabled |
| AIS WebSocket message queue growing without backpressure | RQ worker memory exhausts in high-traffic maritime regions (English Channel, Singapore Strait) | Process only the most recent position per MMSI; discard intermediate messages if ingestion queue depth exceeds threshold | In any major strait or port approach |
| GPS jamming heatmap rendered as GeoJSON FeatureCollection (one polygon per hex cell) | CesiumJS GeoJSON loader freezes for 6–10 seconds loading 10,000+ polygons | Render as a Fabric material on a `GroundPrimitive` or as a raster PNG/WebP overlay; never GeoJSON for dense grids | At > 500 grid cells |
| Satellite overpass lines computed for all 5,000 satellites simultaneously | Propagation for 24 hours × 5,000 satellites blocks main thread or Web Worker for seconds | Compute overpass lines only for selected satellites or those within the current viewport bounding box | Immediately if attempted on main thread |
| React `useEffect` adding new `ImageryLayer` instances on every re-render | Imagery layers silently accumulate; GPU texture memory grows; eventually hits sampler limit | Guard layer creation with a `useRef` flag; move all imagery layer management outside React's render cycle to an imperative manager class | After 3–4 hot-reloads in development StrictMode |
| NOAA WMS tile requests proxied through FastAPI on every client render tick | NOAA server rate-limits the VPS IP; all sessions lose radar overlay simultaneously | Cache WMS tile responses in Redis or on-disk; set cache TTL to match NOAA's 4-minute mosaic update interval | When more than 1–2 browser sessions are active simultaneously |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| ADSB Exchange RapidAPI key in `.env` committed to git | Billing hijacked; monthly budget exhausted by third parties | Verify `.env` is gitignored (already done for v1.0 OpenSky secret); add `ADSB_EXCHANGE_API_KEY` to `.env.example` with placeholder value |
| Serving GPS degradation layer without inference disclaimer | Users treat inferred NIC/NACp anomalies as confirmed jammer coordinates — potentially actionable intelligence that is not accurate | Every GPS jamming cell must be labeled "Inferred from aircraft navigation accuracy reports — not a precise jammer location" per the project's stated honesty constraint |
| Displaying ADSB Exchange "military flights" as confirmed military aircraft | MLAT/ADS-B shows aircraft that broadcast; genuine military combat aircraft suppress their transponders | Label the layer "Unfiltered ADS-B — includes military transport; excludes suppressed/stealth aircraft" with a visible disclaimer |
| Proxying NOAA WMS without caching, exposing the VPS IP to rate limits | NOAA silently rate-limits the IP; all users lose weather radar with no error message | Cache WMS tiles; rotate through a user-agent pool only if absolutely necessary and NOAA's ToS permits |
| Storing ship AIS positions including full MMSI + vessel name logs long-term | Vessel operator tracking data may have privacy/legal implications in some jurisdictions | Log only position aggregates for replay purposes; do not log vessel identity in application logs |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| All new v2.0 layers enabled by default | Globe becomes unreadable at first load; frame rate drops immediately | Default all new layers to OFF; the existing layer toggle pattern from v1.0 should apply to all new layers |
| Post-processing preset switch causes a full-frame black flash | Disorienting; looks like a crash | Cross-fade presets by interpolating uniform values over 300ms rather than atomically swapping stages |
| Timeline scrubber resets to "now" when user stops scrubbing | User loses the historical moment they were studying | Implement `viewer.clock.shouldAnimate = false` while scrubbing so the globe is frozen at the scrubbed time, not drifting back to real-time |
| "Landmark navigation" flyTo has a fixed 2-second duration for all destinations | Pan from San Francisco to Singapore in 2 seconds causes disorienting motion; pan within a city also takes 2 seconds (too slow) | Compute `duration` proportional to camera distance to target; clamp between 0.5s (local) and 3.5s (global) |
| GPS jamming hexagons have no magnitude legend | User cannot distinguish mild navigation accuracy degradation from severe GPS denial | Use a color ramp (green → yellow → red) with a visible legend explaining the NIC/NACp degradation scale |
| Ship positions shown as "live" when stale (AIS stream disconnected or offshore) | User makes incorrect situational awareness judgments | Display data age badge on each ship marker; grey out markers older than 10 minutes |
| Earthquake layer refreshes and all points flicker | Jarring at 5-minute poll interval | Diff incoming events against current collection; only add/remove changed events |

---

## "Looks Done But Isn't" Checklist

- [ ] **NVG/CRT/FLIR presets:** Visually correct on an empty globe — verify the effect looks correct with 5,000 satellite points, aircraft trails, and ESRI World Imagery active simultaneously.
- [ ] **Post-processing sliders:** Slider moves and the effect appears to change — verify the `PostProcessStage` `uniforms` functions return current store values per-frame (not stale captured values from initial creation).
- [ ] **Military flights layer:** Aircraft icons appear on the globe — verify each rendered position has a non-null `lat`/`lon` (MLAT-only aircraft without position are common in ADSB Exchange responses and must be filtered).
- [ ] **GPS jamming heatmap:** Hex cells render — verify the heatmap is derived from current NIC/NACp fields and that stale hex data from the previous polling cycle is replaced (not appended to) on each refresh.
- [ ] **Maritime layer:** Ships appear — verify the WebSocket reconnection logic fires on a server-initiated disconnect, not only on a failed initial connection attempt.
- [ ] **Earthquake layer:** Events render — verify the USGS feed parser uses the `updated` timestamp to skip re-rendering unchanged events on every poll cycle.
- [ ] **NEXRAD weather radar:** Tiles render — verify the `TIME` WMS parameter is included in the GetMap request and that the displayed mosaic matches the correct UTC time window (not a blank or placeholder tile).
- [ ] **Street traffic particles:** Particles are visible and moving — verify particle position updates are running in the Web Worker (check Chrome DevTools Performance panel; main thread CPU must be < 30% with particles active).
- [ ] **Landmark navigation:** Camera flies to the correct city — verify that rapid successive hotkey presses do not produce a "camera was changed during flyTo" CesiumJS error (second flyTo must cancel the first).
- [ ] **4D Replay scrubber:** Scrubbing backward shows historical positions — verify this triggers a database query for the historical state, not rewinding an in-memory buffer that will be empty on page reload.
- [ ] **OSINT event correlation (satellite overpasses):** Overpass lines appear at correct times — verify the overpass computation uses TLEs with a `fetched_at` within 7 days; fail visibly if TLEs are stale (SGP4 position error grows to kilometers beyond 7 days).
- [ ] **Post-processing stage accumulation:** Switching presets N times in React StrictMode — verify `viewer.scene.postProcessStages._stages.length` remains stable and does not grow with each switch.

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Post-processing stages accumulated on re-renders | MEDIUM | Audit `viewer.scene.postProcessStages` in console; manually remove duplicate stages; refactor to `PostProcessManager` singleton before further development |
| Snapshot table bloated before partitioning | HIGH | `pg_dump` the data; recreate table as range-partitioned; re-import. Expect 2–4 hours of downtime on a large table. Cannot be avoided if delayed. |
| ADSB Exchange monthly request budget exhausted during development | LOW | Rate limit resets monthly. Implement Redis cache immediately; reduce polling interval to 10 minutes until reset; consider `adsb.fi` as a free fallback for non-military data |
| AIS layer silently stopped updating | LOW | Restart the AIS consumer RQ job; no data is lost (last known ship positions are in Redis cache) |
| WebGL context lost on low-VRAM homelab machine | MEDIUM | Reduce active simultaneous layers; disable post-processing stages; CesiumJS does not auto-recover from context loss — page reload required. Document minimum GPU VRAM (4 GB) in deployment notes. |
| OSM Overpass API query timeout on large viewport | LOW | Reduce viewport bounding box scope; add zoom-level gating; show "Zoom in to enable traffic simulation" message |
| NOAA WMS endpoint URL changed after a NOAA infrastructure update | LOW | Re-run GetCapabilities against the base `nowcoast.noaa.gov` URL; update the layer name constant in the WMS configuration; NOAA typically maintains old endpoints for 6+ months during transitions |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Post-processing applies to entire scene (scope bleed) | Visual Style Presets (VIS-01 to VIS-05) — first phase | Run v1.0 integration test with each preset; confirm satellite point colors and imagery are preserved |
| Post-processing uniform stale closure | Post-Processing Sliders (VIS-05) | Move each slider full range; confirm visual effect tracks slider position in real-time |
| React HUD blocks CesiumJS pointer events | Cinematic HUD Overlay (VIS-06) | Manual test: pan, zoom, and click-pick while all HUD elements are visible at full scene load |
| ADSB Exchange paid API / wrong auth | Military Flights (LAY-01) | HTTP 200 response rate > 95% over 7 days; daily request count logged and < 280/day |
| gpsjam.org has no API — must replicate via NIC/NACp | GPS Jamming Heatmap (LAY-02) | Heatmap cells match expected degradation regions from a reference gpsjam.org visual check |
| WebGL texture sampler limit with multiple ImageryLayers | GPS Jamming Heatmap (LAY-02) and Weather Radar (LAY-05) | Enable all layers simultaneously on an integrated-GPU machine; assert zero black tile patches |
| AISstream.io disconnects silently | Maritime Traffic (LAY-03) | Simulate WebSocket disconnect in test; assert reconnection fires within 10 seconds and ship positions resume |
| USGS feed over-polling / rate limits | Earthquake Layer (LAY-04) | Confirm polling interval is 5 minutes; verify `Expires` header is respected in the poller |
| NOAA WMS TIME parameter missing | Weather Radar (LAY-05) | Inspect outgoing WMS GetMap request in Network tab; confirm `TIME` parameter is present and correct |
| Particle simulation on main thread | Street Traffic Particles (LAY-06) | Chrome DevTools Performance: main thread CPU < 30% with particles running; worker thread carries the load |
| OSM Overpass global download infeasibility | Street Traffic Particles (LAY-06) | Confirm Overpass queries include a bbox constraint; confirm gating kicks in at zoom levels above the road-visibility threshold |
| Snapshot table unbounded growth | 4D Historical Replay (REP-01) | Run `pg_database_size()` after 48h of all-layers data collection; assert growth rate < 500 MB/day |
| SGP4 overpass accuracy with stale TLEs | OSINT Event Correlation (REP-05, REP-06) | Assert TLE age is checked before overpass computation; test fails visibly if TLE age > 7 days |
| Post-processing stages accumulate on React re-renders | Visual Style Presets (VIS-01 to VIS-05) | In StrictMode, switch presets 5 times; assert `postProcessStages._stages.length` is stable |

---

## Sources

- [CesiumJS PostProcessStageCollection documentation](https://cesium.com/learn/cesiumjs/ref-doc/PostProcessStageCollection.html) — HIGH confidence
- [CesiumJS: Shaders and selected primitives in PostProcessStage](https://community.cesium.com/t/shaders-and-selected-primitives-in-postprocessstage/8904) — HIGH confidence
- [CesiumJS issue: Postprocessing initially disabled, fails if re-enabled](https://github.com/CesiumGS/cesium/issues/9204) — HIGH confidence
- [CesiumJS 1.121 — MSAA default on, PBR Neutral tonemapper (September 2024)](https://cesium.com/blog/2024/09/04/cesium-releases-in-september-2024/) — HIGH confidence
- [CesiumJS issue: Too many ImageryLayer texture samplers](https://github.com/CesiumGS/cesium/issues/3857) — HIGH confidence
- [CesiumJS WebGL context loss — community thread](https://community.cesium.com/t/webgl-context-lost-errors-at-random-times/25674) — HIGH confidence
- [CesiumJS HTML overlay touch gesture / pointer event blocking](https://community.cesium.com/t/html-overlay-touch-gestures-problem/9987) — HIGH confidence
- [CesiumJS ParticleSystem documentation](https://cesium.com/learn/cesiumjs/ref-doc/ParticleSystem.html) — HIGH confidence
- [ADSB Exchange API Lite — RapidAPI subscription and March 2025 change](https://www.adsbexchange.com/api-lite/) — HIGH confidence
- [ADSB Exchange API Lite forum — discontinued flight sim API](https://adsbx.discourse.group/t/api-lite-information/984) — HIGH confidence
- [gpsjam.org FAQ — derived from ADSB Exchange NIC/NACp; no public API](https://gpsjam.org/faq) — HIGH confidence
- [aisstream.io — free global AIS WebSocket, beta status, no SLA](https://aisstream.io/) — HIGH confidence
- [aisstream.io GitHub — 3-second subscription window, disconnect behavior](https://github.com/aisstream/aisstream) — HIGH confidence
- [AISHub API — 1-minute minimum polling interval policy](https://www.aishub.net/api) — HIGH confidence
- [USGS Earthquake Feed — 60-second cache, 429 rate limiting policy](https://geohazards.usgs.gov/pipermail/realtime-feeds/2022-January/000028.html) — HIGH confidence
- [NOAA nowcoast NEXRAD WMS — time-enabled service GetCapabilities](https://nowcoast.noaa.gov/arcgis/services/nowcoast/radar_meteo_imagery_nexrad_time/MapServer/WMSServer?request=GetCapabilities&service=WMS) — MEDIUM confidence (endpoint verified; rate limit policy not published)
- [OpenStreetMap download limitations — 100 GB planet, Overpass API constraints](https://wiki.openstreetmap.org/wiki/Downloading_data) — HIGH confidence
- [PostgreSQL snapshot table partitioning case study](https://medium.com/@mbhatt2018/how-we-supercharged-our-snapshot-table-with-postgresql-partitioning-saved-big-on-infrastructure-2d9c10d23254) — MEDIUM confidence
- [SGP4 accuracy degradation with TLE age](https://github.com/skyfielders/python-skyfield/discussions/929) — MEDIUM confidence
- [FastAPI async memory fragmentation under concurrent load](https://build.betterup.com/chasing-a-memory-leak-in-our-async-fastapi-service-how-jemalloc-fixed-our-rss-creep/) — MEDIUM confidence
- [CRT scanline shader resolution dependence and non-integer scaling artifacts](https://forums.libretro.com/t/crt-shaders-unwanted-scanlines-when-scaling-an-image/48445) — MEDIUM confidence

---
*Pitfalls research for: CesiumJS/FastAPI geospatial intelligence platform — v2.0 WorldView Parity additions to existing system*
*Researched: 2026-03-11*
