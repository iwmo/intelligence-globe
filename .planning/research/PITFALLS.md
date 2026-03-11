# Pitfalls Research

**Domain:** Browser-based 3D geospatial intelligence platform (CesiumJS + satellite/aircraft tracking)
**Researched:** 2026-03-11
**Confidence:** HIGH (CesiumJS community forums, official docs, OpenSky API docs, satellite.js GitHub)

---

## Critical Pitfalls

### Pitfall 1: Using the Entity API for 5,000+ Satellites

**What goes wrong:**
The CesiumJS Entity API is a high-level, data-driven abstraction. It is convenient but carries significant per-entity overhead. At 5,000+ satellites — each with a billboard, label, and orbit path polyline — frame rate drops to single digits or the browser tab becomes unresponsive. The Cesium community has documented this ceiling repeatedly, with reports of serious degradation starting at ~10,000 entities and complete failure patterns at 20,000.

**Why it happens:**
Developers start with the Entity API because the tutorials use it and it maps cleanly to data-driven thinking. The API hides the underlying draw calls, geometry buffers, and GPU state changes. Performance feels acceptable during development with 50–100 test satellites, then collapses when loading the full TLE catalog.

**How to avoid:**
Use the Primitive API (`PointPrimitiveCollection`, `BillboardCollection`, `PolylineCollection`) for all satellite points and trail lines. The Entity API is acceptable for the detail panel of a single selected entity. Orbit paths should be pre-computed polyline segments, not `PathGraphics` driven by real-time propagation. Implement LOD: at global zoom show `PointPrimitiveCollection` only; only show labels and orbit arcs on zoom-in or selection.

**Warning signs:**
- Frame rate below 30 FPS with fewer than 500 satellites loaded
- `viewer.scene.primitives` array growing on every TLE reload without cleanup
- GPU memory climbing steadily without stabilizing

**Phase to address:**
Phase 1 (Globe foundation) — architecture decision must be made before any satellite rendering code is written. Retrofitting the Primitive API after building on the Entity API requires a full rewrite of the satellite layer.

---

### Pitfall 2: Rendering Orbit Paths for All Satellites Simultaneously

**What goes wrong:**
Generating orbit path polylines for every visible satellite creates thousands of WebGL draw calls per frame. Even with the Primitive API, an orbit arc sampled at 60 points × 5,000 satellites = 300,000 position evaluations per render cycle. The result is GPU saturation and browser jank.

**Why it happens:**
It seems natural to show orbits as a primary feature. Demo screenshots in CesiumJS docs show orbits. But those demos use 1–3 satellites.

**How to avoid:**
Orbit paths are a detail feature, not a bulk feature. Only render orbit arcs for: (a) selected satellites, (b) satellites within the current viewport with zoom level below a threshold (e.g., fewer than 20 visible at current camera distance). Pre-compute and cache orbit paths as static polyline geometries updated on TLE refresh, not every animation frame. Fade orbit paths beyond a configurable altitude camera distance threshold.

**Warning signs:**
- `PathGraphics` assigned to every entity object
- Orbit path computation happening inside the render loop rather than as a scheduled background task
- No zoom-level gating on path visibility

**Phase to address:**
Phase 2 (Satellite tracking layer) — design the orbit path system with LOD from the start.

---

### Pitfall 3: Propagating All Satellite Positions on the Main Thread

**What goes wrong:**
Calling `satellite.propagate()` for 5,000+ satellites every animation frame (60 Hz) on the main thread blocks the JavaScript event loop. The globe stutter is severe, UI interactions become unresponsive, and real-time updates lag behind clock time.

**Why it happens:**
Tutorials show satellite propagation inline with the render loop. At tutorial scale (1–3 satellites) this is imperceptible.

**How to avoid:**
Move all bulk propagation to a Web Worker. The worker receives the full TLE/satrec list, runs propagation on a configurable tick (e.g., 1 Hz for bulk positions, 10 Hz for selected satellite), and posts position arrays back to the main thread via `postMessage`. The main thread only updates the `PointPrimitiveCollection` positions from the received array — a fast typed-array operation. Use `SharedArrayBuffer` + `Atomics` if sub-100ms latency is required; plain `postMessage` with Float64Array is sufficient for 1 Hz bulk updates.

**Warning signs:**
- `propagate()` or `eciToEcf()` calls visible in the main thread render loop
- `requestAnimationFrame` callback duration exceeding 16ms with satellites loaded
- Long task warnings in Chrome DevTools Performance panel

**Phase to address:**
Phase 2 (Satellite tracking layer) — Worker architecture must be established before adding any satellite to the render loop.

---

### Pitfall 4: Stale TLEs Causing Silent Position Drift

**What goes wrong:**
TLE accuracy degrades over time. A TLE is accurate to ~1 km at epoch and degrades rapidly. CelesTrak updates its catalog approximately 3 times per day. Using TLEs cached at app startup and never refreshed causes satellite positions to drift perceptibly within hours, especially for LEO objects with atmospheric drag (Starlink, ISS).

**Why it happens:**
TLE files are fetched once at startup and stored. The app appears to work. The drift is invisible unless the user knows where a satellite should be.

**How to avoid:**
Implement a backend TLE refresh scheduler (Redis TTL + background FastAPI task) that fetches from CelesTrak every 4–6 hours. Store the epoch timestamp alongside each TLE record in PostgreSQL. Expose a "TLE age" indicator in the UI (warning if any TLE is older than 24 hours). Log and alert on CelesTrak fetch failures so stale data doesn't persist silently.

**Warning signs:**
- No TTL or scheduled task for TLE cache invalidation
- TLE records stored without an `epoch` or `fetched_at` column
- No user-visible freshness indicator

**Phase to address:**
Phase 2 (Satellite tracking layer) — backend TLE pipeline design.

---

### Pitfall 5: OpenSky Network Auth Migration Breaking Aircraft Layer

**What goes wrong:**
OpenSky Network deprecated HTTP Basic Auth on March 18, 2026 (confirmed in official API docs). Applications using `username:password` in the `Authorization` header will receive 401 errors. The aircraft layer silently stops populating, or the app crashes on startup.

**Why it happens:**
Most tutorials and open-source trackers (written before 2026) use Basic Auth. The migration to OAuth2 client credentials flow is undocumented in older resources.

**How to avoid:**
Implement the OpenSky client using OAuth2 client credentials (`/api/login/oauth/token` endpoint for token exchange) from day one. Store client ID and secret as Docker secrets or environment variables (never hardcoded). Implement token refresh logic. The anonymous tier (400 credits/day, 10-second resolution) is usable for development, but authenticated access (8,000 credits/day, 5-second resolution) should be implemented before production. Note: anonymous users cannot use the `time` parameter — position history requires authentication.

**Warning signs:**
- HTTP Basic Auth credentials in the OpenSky client code
- No OAuth2 token refresh logic
- `401 Unauthorized` responses from OpenSky at deployment

**Phase to address:**
Phase 3 (Aircraft tracking layer) — API client design.

---

### Pitfall 6: ECI vs ECEF Coordinate Frame Confusion

**What goes wrong:**
The SGP4 algorithm (used by satellite.js) outputs positions in the TEME (True Equator Mean Equinox) inertial frame — a variant of ECI. CesiumJS renders in ECEF (Earth-Centered Earth-Fixed). Plotting TEME coordinates directly in CesiumJS places satellites at completely wrong positions that rotate around the globe, making orbits appear to spiral or drift. This is not a subtle offset — it is a visually catastrophic error.

**Why it happens:**
satellite.js's `eciToEcf()` function exists but is easy to skip if the developer is not familiar with orbital mechanics. Some tutorials omit the frame conversion step. The mistake is especially easy to make when sampling orbit paths, where developers call `propagate()` in a loop and collect Cartesian3 positions without converting.

**How to avoid:**
Always convert satellite.js output through `satellite.eciToEcf(positionEci, gmst)` before constructing a `Cartesian3` for CesiumJS. Compute `gmst` from `satellite.gstime(date)` using the exact propagation timestamp. Validate by confirming the ISS tracks over the correct ground track visible at https://celestrak.org/SOCRATES/. Add a unit test that propagates a known TLE and checks the ECEF output against a reference position from a trusted source.

**Warning signs:**
- Satellites appear to orbit in unexpected directions or drift eastward over time
- Orbit paths do not close (spiral instead of repeating)
- No `eciToEcf` or `gmst` in the satellite rendering code path

**Phase to address:**
Phase 2 (Satellite tracking layer) — must be correct from first render.

---

### Pitfall 7: CesiumJS Viewer Not Destroyed on React Unmount

**What goes wrong:**
CesiumJS creates a WebGL context, allocates GPU memory for terrain, imagery, and primitives, and registers global event listeners. If `viewer.destroy()` is not called when the React component unmounts (e.g., during dev hot-reload, route changes, or Strict Mode double-mount), GPU memory is leaked. In React 18 Strict Mode, effects are mounted/unmounted/remounted in development, causing duplicate Cesium instances and eventual GPU exhaustion.

**Why it happens:**
The Cesium viewer is initialized in a `useEffect`, but cleanup is omitted. React 18 Strict Mode deliberately double-mounts effects to expose this class of bug.

**How to avoid:**
Return a cleanup function from `useEffect` that calls `viewer.destroy()` and nullifies the ref. Guard against double-initialization by checking `if (viewer.current) return` at the top of the effect. Test with React Strict Mode enabled — if two globes flash on initial render, the cleanup is incomplete. Use a stable ref pattern rather than state to hold the viewer instance.

**Warning signs:**
- `viewer.destroy()` absent from the `useEffect` cleanup
- Browser GPU memory (visible in Chrome Task Manager) growing on page refresh without reload
- Two Cesium canvases momentarily visible on first mount in development

**Phase to address:**
Phase 1 (Globe foundation) — React integration pattern must be correct before building on top of it.

---

### Pitfall 8: Hardcoding Cesium Ion Token in Frontend Build

**What goes wrong:**
The Cesium Ion access token required for terrain, imagery, and 3D Tiles assets is embedded in the frontend JavaScript bundle. When the bundle is served, the token is readable by any visitor, can be extracted, and used to exhaust the developer's Ion credits or access their Ion assets. Docker build arguments baked into the image compound this — the token ends up in image layers and `docker history`.

**Why it happens:**
The quickest path is `Cesium.Ion.defaultAccessToken = "yourtoken"` directly in source code. CI/CD tutorials that use `VITE_CESIUM_ION_TOKEN` environment variables at build time bake the value into the bundle.

**How to avoid:**
For a homelab/personal deployment, the risk is lower, but best practice is to restrict the Ion token to specific allowed domains (set in the Cesium Ion dashboard) and use minimal scopes. For Docker Compose, inject the token as a Docker secret or `.env` file excluded from version control. If self-hosted terrain and imagery are used (e.g., Cesium World Terrain replaced with a free alternative), the Ion token dependency can be eliminated entirely — prefer open alternatives (ArcGIS Basemap, OpenStreetMap imagery, Cesium World Terrain via Ion free tier with domain-locked token).

**Warning signs:**
- `CESIUM_ION_TOKEN` value committed to the git repository
- Token string visible in the compiled bundle (check via `grep` on the dist output)
- No domain restriction on the Ion token in the Cesium Ion dashboard

**Phase to address:**
Phase 1 (Globe foundation) and deployment phase.

---

### Pitfall 9: Aircraft Positions Jumping Instead of Interpolating

**What goes wrong:**
OpenSky state vectors arrive at 5–10 second intervals. If aircraft positions are updated by directly replacing the entity position on each API response, aircraft appear to teleport across the globe. At typical commercial aircraft speeds (~250 m/s), a 10-second gap without interpolation produces jumps of ~2.5 km on the globe — visually jarring and operationally misleading.

**Why it happens:**
The simplest implementation is to update position on API response. Interpolation is an additional step that requires holding previous and current positions plus a timestamp.

**How to avoid:**
Maintain for each aircraft: `previousPosition`, `currentPosition`, `previousTimestamp`, `currentTimestamp`. Use linear interpolation weighted by elapsed time in the render loop to produce smooth continuous movement. CesiumJS's `SampledPositionProperty` can handle this natively if using the Entity API for aircraft (acceptable since aircraft counts are typically in the hundreds to low thousands, not tens of thousands). For the Primitive API, implement interpolation in the Web Worker position update path.

**Warning signs:**
- Aircraft visually jump every polling interval
- Position update code directly assigns `position.setValue()` without time-weighted interpolation
- No `previousPosition` or timestamp tracking in the aircraft state model

**Phase to address:**
Phase 3 (Aircraft tracking layer).

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Entity API for all satellites | Fast to implement, readable code | Unusable performance at 5,000+ sats, full rewrite required | Never — use Primitive API from day one |
| Main-thread propagation | Simple loop, no Worker complexity | Jank at scale, unresponsive UI | Only during initial prototype with <10 satellites |
| Polling OpenSky every 5 seconds | Fresh data | Rate limit exhaustion (400 credits/day anonymous), ban risk | Use 10-second minimum interval; authenticate for 5-second |
| No TLE refresh scheduler | Simpler deploy | Silent position drift after 12+ hours, hard to debug | Never for production |
| Fetching full TLE catalog on every client load | Simple frontend | Celestrak rate limits, slow cold start, bandwidth waste | Cache on backend, serve from PostgreSQL |
| Skipping `viewer.destroy()` cleanup | One fewer line of code | GPU memory leak, duplicate viewers, dev hot-reload instability | Never |
| Storing Cesium Ion token in source | Zero config | Token exposure in git history, bundle, Docker layers | Never |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| OpenSky Network API | Using deprecated HTTP Basic Auth (username:password) | OAuth2 client credentials flow from March 2026 onwards |
| OpenSky Network API | Passing `time` parameter as anonymous user | Only authenticated users can query historical state vectors |
| OpenSky Network API | Not tracking `X-Rate-Limit-Remaining` header | Monitor header; back off when credits are low |
| CelesTrak API | Fetching the full GP catalog (`gp.php?GROUP=active&FORMAT=json`) on every request | Cache on backend with 4–6 hour TTL; CelesTrak blocks abusive clients |
| CelesTrak API | Parsing legacy TLE text format instead of JSON OMM | satellite.js v6+ supports `json2satrec` from OMM JSON — use JSON format for reliability |
| CesiumJS terrain | Not disabling Ion terrain request when using self-hosted terrain | Viewer attempts Ion terrain fetch and throws CORS/auth errors in console |
| CesiumJS terrain | Serving terrain tiles without CORS headers | Browser blocks tile fetches silently; globe renders flat |
| PostGIS | Using `GEOMETRY` type instead of `GEOGRAPHY` for global coordinate data | Distance/area calculations wrong at poles and antimeridian |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Re-creating PointPrimitiveCollection on every TLE update | Flicker + allocation spike every 4-6 hours | Mutate positions in-place on existing collection; only recreate on structural change | At first TLE refresh cycle |
| Storing all aircraft state vectors in PostgreSQL without TTL | DB size grows unbounded | Keep rolling 2-hour window; archive older to cold storage or drop | After ~1 week of continuous collection |
| Using PostGIS `ST_Distance` in a tight polling loop without spatial index | API response times degrade with data volume | Add `GIST` index on all geometry columns; use `ST_DWithin` for proximity queries | At ~100k rows |
| Querying full satellite catalog from PostgreSQL on each client connect | Cold start latency; DB lock contention | Cache full catalog in Redis; invalidate on TLE refresh | Immediately with multiple browser tabs |
| Subscribing to CesiumJS `scene.preRender` for per-frame position updates | Redundant propagation, CPU overload | Decouple: propagate on timer, apply to scene on preRender only if new data available | With >100 entities using preRender |
| Drawing orbit path with 360-point polyline at full constellation scale | GPU overload | Cap orbit path resolution: 60 points for high-priority, off for bulk | When enabling orbit paths for >20 satellites |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Cesium Ion token in git repository or Docker build arg | Token abuse, credit exhaustion | Docker secrets / env file excluded from VCS; domain-lock in Ion dashboard |
| OpenSky OAuth2 client secret in frontend bundle | Secret exposure, API access by third parties | OpenSky credentials are backend-only; frontend never touches them |
| GNSS anomaly layer presented as confirmed intelligence | Misleads users into treating inference as fact | Label anomaly layer explicitly as "estimated / inferred — not confirmed"; include confidence score |
| Exposing PostGIS/PostgreSQL port in Docker Compose without network isolation | Database accessible from host network | Keep DB on internal Docker network; no published ports for DB service |
| Logging raw aircraft positions with PII metadata (callsign, operator) to long-lived logs | Privacy / legal issues depending on jurisdiction | Log only aggregate metrics; strip PII from debug output |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Displaying 5,000 satellite labels by default | Globe unreadable, performance collapse | Labels off by default; show on hover or selection only |
| No loading indicator during TLE fetch (takes 1–3 seconds for full catalog) | User thinks app is broken | Show "Loading satellites..." progress state with count |
| Globe loading before terrain and imagery tiles arrive | Jarring white/gray sphere flash | Set a dark base color (match theme) so globe looks intentional before tiles load |
| Satellite/aircraft click target same size as rendered point | Tiny click targets, frustrating on non-touch screens | Inflate hit area via `ScreenSpaceEventHandler` and billboard pixel offset |
| GNSS anomaly regions shown with hard boundaries | Implies precise geolocation capability the app does not have | Use gradient/fuzzy circle primitives with opacity falloff; always label as estimated radius |
| No "what is this?" explanation for anomaly layer | Users misunderstand as confirmed jammer position | Include info tooltip/modal explaining inference methodology and limitations |
| Layer toggle switches visible but no satellite data loaded yet | User toggles layers before data arrives, sees nothing | Disable layer toggles until their data source has completed initial load |

---

## "Looks Done But Isn't" Checklist

- [ ] **Satellite positions:** Verify TEME → ECEF conversion is present in every code path that calls `propagate()`. Confirm with ISS ground track cross-check against Heavens-Above or N2YO.
- [ ] **TLE refresh:** Confirm a scheduled task actually runs in production Docker. A background task registered with FastAPI lifespan that never fires in containerized deployments is a common failure.
- [ ] **Orbit paths:** Confirm paths only render for selected/zoomed-in satellites — not for all 5,000 simultaneously. Test at full catalog load.
- [ ] **Aircraft interpolation:** Confirm aircraft move smoothly between API poll responses. A 10-second position freeze followed by a jump is not "working."
- [ ] **OpenSky OAuth2:** Confirm the client uses OAuth2, not Basic Auth. Test by checking network requests in DevTools for `Authorization: Bearer` vs `Authorization: Basic`.
- [ ] **Cesium viewer cleanup:** Confirm `viewer.destroy()` is called on unmount. Test by rapidly hot-reloading in development and checking GPU memory in Chrome Task Manager.
- [ ] **Anomaly labeling:** Confirm no GNSS anomaly, RF event, or spoofing indicator in the UI lacks an "estimated / inference" label. Check every tooltip and panel.
- [ ] **Rate limit handling:** Confirm the app degrades gracefully when OpenSky returns 429 or exhausts daily credits. Simulate by setting a near-zero credit limit in a staging environment.
- [ ] **Docker secrets:** Confirm `grep -r "CESIUM_ION_TOKEN\|OPENSKY" .` finds no hardcoded values outside `.env.example`.

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Entity API used for satellites | HIGH | Rewrite satellite layer using PointPrimitiveCollection + BillboardCollection; no incremental path |
| Main-thread propagation | MEDIUM | Extract propagation to Worker; requires message passing refactor but no data model changes |
| Basic Auth → OAuth2 migration | LOW | Replace auth headers in one OpenSky client module; requires new OAuth2 client registration |
| Stale TLE data in prod | LOW | Trigger manual TLE refresh via admin endpoint; implement scheduled refresh going forward |
| ECI/ECEF coordinate confusion | MEDIUM | Add `eciToEcf` conversion to rendering path; validate all historical cached positions |
| Cesium Ion token exposure | MEDIUM | Rotate token in Ion dashboard immediately; audit git history and Docker layers; implement secrets management |
| No viewer.destroy() cleanup | LOW | Add cleanup function to useEffect; verify with React Strict Mode |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Entity API for satellites | Phase 1: Globe foundation | Render 5,000 test points using PointPrimitiveCollection; confirm >30 FPS |
| Viewer not destroyed on unmount | Phase 1: Globe foundation | React Strict Mode shows no duplicate viewer; GPU memory stable on hot-reload |
| Cesium Ion token hardcoded | Phase 1: Globe foundation | `grep` on dist bundle finds no token string |
| ECI/ECEF frame confusion | Phase 2: Satellite tracking | ISS ground track matches Heavens-Above within 10 km |
| All orbit paths rendered at once | Phase 2: Satellite tracking | Enable orbit paths for 5,000 satellites; confirm FPS does not drop below 30 |
| Main-thread propagation | Phase 2: Satellite tracking | Chrome DevTools Performance shows <4ms main-thread work per frame with full catalog |
| Stale TLE data | Phase 2: Satellite tracking | TLE age indicator shows refresh timestamp; scheduled task visible in container logs |
| OpenSky Basic Auth / OAuth2 | Phase 3: Aircraft tracking | Network panel shows `Authorization: Bearer` token on all OpenSky requests |
| Aircraft position jumping | Phase 3: Aircraft tracking | Visual inspection confirms smooth movement between poll intervals |
| GNSS anomaly mislabeling | Anomaly engine phase | Every anomaly visual element has inference disclaimer in tooltip/panel |

---

## Sources

- [CesiumJS Community: Performance with 10s of thousands of entities](https://community.cesium.com/t/performance-with-10s-of-thousands-of-entities/3722) — HIGH confidence
- [CesiumJS Community: 15,000+ entity performance](https://community.cesium.com/t/15-000-entity-performance/8451) — HIGH confidence
- [CesiumJS Community: Primitive vs Entity vs DataSource Performance](https://community.cesium.com/t/primitive-vs-entity-vs-datasource-performance/2041) — HIGH confidence
- [CesiumJS Community: Performance problems plotting an orbit](https://community.cesium.com/t/performance-problems-when-plotting-an-orbit-with-cesiumjs/30209) — HIGH confidence
- [CesiumJS Community: CesiumJS in React memory leak](https://community.cesium.com/t/cesiumjs-in-react-cause-memory-leak/6832) — HIGH confidence
- [CesiumJS Community: Visualizing ECI orbits in Cesium](https://community.cesium.com/t/visualizing-eci-orbits-in-cesium/41789) — HIGH confidence
- [CesiumJS Community: Coordinate systems in Cesium](https://community.cesium.com/t/what-are-the-coordinate-systems-in-cesium/2589) — HIGH confidence
- [OpenSky Network REST API documentation](https://openskynetwork.github.io/opensky-api/rest.html) — HIGH confidence (official docs)
- [satellite-js GitHub repository](https://github.com/shashwatak/satellite-js) — HIGH confidence (official source)
- [CelesTrak documentation on TLE epoch and update frequency](http://www.celestrak.com/) — HIGH confidence
- [Cesium ion Access Tokens security guide](https://cesium.com/learn/ion/cesium-ion-access-tokens/) — HIGH confidence (official docs)
- [Using CesiumJS without a Cesium Ion Token](https://blog.banesullivan.com/using-cesiumjs-without-a-cesiumion-token-open-access-tile-providers-a1fa70657319) — MEDIUM confidence
- [satvis: Satellite orbit visualization with CesiumJS](https://github.com/Flowm/satvis) — MEDIUM confidence (reference implementation)

---
*Pitfalls research for: Browser-based 3D geospatial intelligence platform (CesiumJS satellite/aircraft tracking)*
*Researched: 2026-03-11*
