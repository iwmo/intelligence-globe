# Phase 7: Visual Engine + Navigation — Research

**Researched:** 2026-03-11
**Domain:** CesiumJS post-processing pipeline, GLSL fragment shaders, cinematic HUD overlay, camera navigation
**Confidence:** HIGH

---

## Summary

Phase 7 is a pure frontend phase — zero backend changes required. It adds five capabilities to the existing CesiumJS/React stack: switchable visual style presets (NVG, CRT, FLIR, Noir, Normal), real-time post-processing sliders, a persistent cinematic HUD overlay with live MGRS coordinates, a Clean UI mode, and a city/landmark quick-jump system with keyboard shortcuts.

All post-processing in CesiumJS operates on the final composited framebuffer via `scene.postProcessStages` — a `PostProcessStageCollection`. This means every visual preset affects the entire scene, including ESRI World Imagery, satellite points, aircraft trails, and atmosphere. The critical architectural constraint is that all preset stages must be created once at init time and toggled with `stage.enabled`, never created/destroyed on preset switch (GLSL shader recompilation causes 50–200ms frame stalls on each swap). A singleton `PostProcessEngine` component must own the entire post-processing lifecycle.

The city quick-jump (NAV-01) requires a geocoder to convert city names to lat/lon. The Nominatim OSM API is the correct free solution. Landmark navigation (NAV-02/03) is a static JSON file bundled with the frontend — no API call, no backend. The existing `flyToPosition()` function in `viewerRegistry.ts` already handles CesiumJS camera flyTo; it needs a duration calculation proportional to distance for the preset shortcuts.

**Primary recommendation:** Build `PostProcessEngine` singleton first. All other Phase 7 work depends on the post-processing infrastructure being stable before sliders and presets are tested.

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| VIS-01 | User can switch between visual style presets (Normal, NVG, CRT, FLIR, Noir) applied to the full globe scene | CesiumJS `PostProcessStageLibrary.createNightVisionStage()` (NVG), `createBlackAndWhiteStage()` (Noir), custom GLSL `PostProcessStage` (CRT, FLIR). All stages created at init, toggled by `stage.enabled`. |
| VIS-02 | User can adjust post-processing parameters via real-time sliders (Bloom, Sharpen, Gain, Scanlines, Pixelation) | Built-in `scene.postProcessStages.bloom` uniforms; custom stages for Sharpen/Gain/Scanlines/Pixelation. Uniforms MUST be function-style (read from ref per-frame) not constant-style. |
| VIS-03 | User sees a cinematic HUD overlay showing classification markings, MGRS coordinates, satellite ORB/PASS telemetry, GSD/ALT/SUN/EL readouts, and REC timestamp | React absolute-positioned overlay, `pointer-events: none` on container. `mgrs` npm package for MGRS conversion. Camera position from `viewer.camera.positionCartographic`. |
| VIS-04 | User can toggle Clean UI mode to hide all sidebar chrome for content creation and screenshots | New `cleanUI: boolean` flag in Zustand store. All sidebar components (`LeftSidebar`, `BottomStatusBar`, `RightDrawer`) conditionally render based on `cleanUI`. HUD stays visible. |
| NAV-01 | User can jump to a city (including Doha) via a quick-jump bar at the bottom of the globe | Nominatim OSM geocoding API (`https://nominatim.openstreetmap.org/search?q={city}&format=json&limit=1`). No auth. Returns lat/lon bbox. Camera flyTo with distance-proportional duration. |
| NAV-02 | User can fly to curated landmarks within a city with precise camera centering using OSM bounding box data | Static `landmarks.json` bundled with frontend. OSM bounding box data used to compute camera altitude from bbox extent. No runtime API call for preset landmarks. |
| NAV-03 | User can cycle through landmarks via keyboard shortcuts (Q/W/E/R/T) | `useKeyboardShortcuts.ts` hook: `keydown` event listener mapping Q/W/E/R/T to landmark IDs. Calls `viewer.camera.flyTo()` via `viewerRegistry`. Must cancel in-flight flyTo before starting new one. |
</phase_requirements>

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| CesiumJS PostProcessStageCollection | built-in cesium@1.139.1 | Stage lifecycle management | `viewer.scene.postProcessStages` is the only correct integration point; no third-party alternatives within a CesiumJS scene |
| CesiumJS PostProcessStageLibrary | built-in cesium@1.139.1 | Built-in NVG and Noir shader factories | `createNightVisionStage()` and `createBlackAndWhiteStage()` are verified built-ins; no GLSL authoring required for these two presets |
| CesiumJS PostProcessStage | built-in cesium@1.139.1 | Custom GLSL stages for CRT, FLIR, Gain, Sharpen, Scanlines, Pixelation | Standard CesiumJS API for custom fragment shaders; uniforms system handles per-frame value reads |
| mgrs | 2.1.0 | Convert [lon, lat] to NATO MGRS grid reference string | MIT, zero runtime deps, ships TypeScript types, NGA-origin standard |
| Zustand | 5.0.11 (installed) | State management for visual preset, uniforms, cleanUI flag | Already in use; extend existing store |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Nominatim OSM API | REST (no client library) | Geocode city name to lat/lon for NAV-01 quick-jump bar | Only for the city search input (not preset landmarks). Free, no auth. Rate limit: 1 req/s — add debounce. |
| lucide-react | 0.577.0 (installed) | Icons for preset buttons and HUD controls | Already installed |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Custom GLSL FLIR stage | Three.js EffectComposer | Three.js requires a second WebGL renderer; incompatible with CesiumJS pipeline; extremely expensive. Never use. |
| Nominatim for city search | Mapbox Geocoding API | Mapbox requires API key (billable); unnecessary for simple city lookup |
| `mgrs` npm package | Custom MGRS math | MGRS conversion has complex zone edge cases (polar regions, Norway exceptions). Never hand-roll. |

**Installation (Phase 7 new dependencies only):**
```bash
cd frontend
npm install mgrs
```
All other Phase 7 functionality uses already-installed packages.

---

## Architecture Patterns

### Recommended Project Structure (Phase 7 additions)

```
frontend/src/
├── components/
│   ├── PostProcessEngine.tsx     # NEW — singleton stage lifecycle manager
│   ├── PostProcessPanel.tsx      # NEW — preset selector + sliders UI
│   ├── CinematicHUD.tsx          # NEW — tactical overlay container
│   ├── MGRSReadout.tsx           # NEW — MGRS/lat-lon from camera position
│   ├── TelemetryPanel.tsx        # NEW — satellite ORB/PASS readout
│   ├── LandmarkNav.tsx           # NEW — quick-jump bar + landmark preset buttons
│   └── __tests__/
│       ├── PostProcessEngine.test.tsx  # Stage count stability tests
│       └── LandmarkNav.test.tsx        # Keyboard shortcut mapping tests
├── hooks/
│   └── useKeyboardShortcuts.ts   # NEW — Q/W/E/R/T → landmark flyTo
├── data/
│   └── landmarks.json            # NEW — curated landmark coordinates
├── store/
│   └── useAppStore.ts            # MODIFIED — add visualPreset, postProcessUniforms, cleanUI
└── lib/
    └── viewerRegistry.ts         # MODIFIED — add flyToLandmark() with distance-based duration
```

### Pattern 1: PostProcessEngine Singleton

**What:** A React component that mounts once, creates all preset stages on init, and exposes `setPreset()` via effect watching Zustand store. Never creates or destroys stages after init.

**When to use:** Any time visual preset changes or slider values change.

**Critical constraint:** Create all stages in a single `useEffect(() => { ... }, [])` (no deps). Guard with `useRef` to prevent double-creation in React StrictMode. Store stages in refs, not state.

```typescript
// Source: CesiumJS PostProcessStage docs + v1.0 codebase patterns
// Pattern: create-once-toggle pattern
const stagesRef = useRef<Record<string, PostProcessStage | PostProcessStageComposite>>({});

useEffect(() => {
  if (!viewer || stagesRef.current.nvg) return; // guard against double-init

  stagesRef.current.nvg = PostProcessStageLibrary.createNightVisionStage();
  stagesRef.current.noir = PostProcessStageLibrary.createBlackAndWhiteStage();
  stagesRef.current.crt = buildCrtComposite(); // custom GLSL
  stagesRef.current.flir = buildFlirStage();   // custom GLSL

  // Add all stages to collection, all disabled initially
  Object.values(stagesRef.current).forEach(stage => {
    stage.enabled = false;
    viewer.scene.postProcessStages.add(stage);
  });
}, [viewer]);
```

### Pattern 2: Uniform Functions (not values)

**What:** All controllable uniforms must be function-style, reading from a mutable ref at render time.

**When to use:** Any `PostProcessStage` uniform that corresponds to a UI slider.

```typescript
// Source: CesiumJS PostProcessStage uniform docs
// WRONG (stale capture):
uniforms: { intensity: sliderValue }

// CORRECT (per-frame read from ref):
const uniformsRef = useRef({ bloomIntensity: 0.5, gainAmount: 1.0 });

// In stage definition:
uniforms: {
  intensity: () => uniformsRef.current.bloomIntensity,
}

// On slider change, update ref only — no stage recreation:
uniformsRef.current.bloomIntensity = newValue;
```

### Pattern 3: CinematicHUD Overlay

**What:** Absolute-positioned React div layered over CesiumJS canvas. `pointer-events: none` on the root container; selectively re-enabled on interactive elements only.

**When to use:** All HUD content (classification banner, MGRS readout, telemetry, REC timestamp).

```typescript
// Source: v1.0 overlay pattern (LeftSidebar, BottomStatusBar)
// HUD root — blocks zero canvas events
<div style={{
  position: 'fixed', inset: 0, zIndex: 80,
  pointerEvents: 'none',
  fontFamily: 'monospace',
}}>
  {/* Corner elements only — minimize overlap with globe center */}
  <ClassificationBanner /> {/* top: 0, full-width */}
  <MGRSReadout />          {/* top-right corner */}
  <TelemetryPanel />       {/* bottom-right, above BottomStatusBar */}
  <RecTimestamp />         {/* top-left, below hamburger */}
</div>
```

**MGRS update pattern:**
```typescript
// Source: CesiumJS Camera docs
useEffect(() => {
  if (!viewer) return;
  const handler = () => {
    const cart = viewer.camera.positionCartographic;
    const lon = CesiumMath.toDegrees(cart.longitude);
    const lat = CesiumMath.toDegrees(cart.latitude);
    setMgrs(forward([lon, lat], 4)); // mgrs@2.1.0 API
    setAltKm((cart.height / 1000).toFixed(0));
  };
  viewer.camera.moveEnd.addEventListener(handler);
  return () => viewer.camera.moveEnd.removeEventListener(handler);
}, [viewer]);
```

### Pattern 4: Landmark Navigation with Distance-Proportional Duration

**What:** Fly to a landmark using `viewer.camera.flyTo()` with duration computed from angular distance between current camera and target.

**When to use:** Q/W/E/R/T keyboard shortcuts and landmark button clicks.

**Critical:** Cancel in-flight flyTo before starting a new one to avoid "camera was changed during flyTo" CesiumJS errors.

```typescript
// Source: CesiumJS Camera.flyTo docs + viewerRegistry.ts pattern
function flyToLandmark(landmark: Landmark): void {
  const viewer = getViewer();
  if (!viewer || viewer.isDestroyed()) return;

  viewer.camera.cancelFlight(); // cancel any in-progress flyTo

  const current = viewer.camera.positionCartographic;
  const targetCart = Cartographic.fromDegrees(landmark.lon, landmark.lat);
  const angularDist = Cartographic.distanceToBoundingSphere(current, ...);

  // Clamp duration: 0.5s (local nav) to 3.5s (global jump)
  const duration = Math.max(0.5, Math.min(3.5, angularDist / 5_000_000));

  viewer.camera.flyTo({
    destination: Cartesian3.fromDegrees(landmark.lon, landmark.lat, landmark.altMeters),
    duration,
    orientation: landmark.heading ? {
      heading: CesiumMath.toRadians(landmark.heading),
      pitch: CesiumMath.toRadians(-30),
      roll: 0,
    } : undefined,
  });
}
```

### Pattern 5: Nominatim City Quick-Jump

**What:** Debounced search input that calls Nominatim geocoder and flies camera to result.

**When to use:** NAV-01 city quick-jump bar.

```typescript
// Source: Nominatim OSM API (https://nominatim.openstreetmap.org)
// Rate limit: 1 req/s — must debounce
async function geocodeCity(query: string): Promise<{lat: number, lon: number} | null> {
  const params = new URLSearchParams({
    q: query,
    format: 'json',
    limit: '1',
  });
  const res = await fetch(
    `https://nominatim.openstreetmap.org/search?${params}`,
    { headers: { 'Accept-Language': 'en' } }
  );
  const results = await res.json();
  if (!results.length) return null;
  return { lat: parseFloat(results[0].lat), lon: parseFloat(results[0].lon) };
}
```

**Camera altitude for city jump:** Use `boundingbox` field from Nominatim response to compute a sensible viewing altitude. Bbox extent → `Math.max(latSpan, lonSpan) * 111_000m` → clamp to [100_000m, 3_000_000m].

### Pattern 6: Clean UI Mode

**What:** A boolean Zustand flag `cleanUI` that causes all sidebar chrome to conditionally render null, leaving only the globe and HUD.

**When to use:** VIS-04 — screenshot/content-creation mode.

```typescript
// Extend useAppStore with:
cleanUI: boolean;
setCleanUI: (v: boolean) => void;

// In App.tsx render:
{!cleanUI && <LeftSidebar workerRef={satWorkerRef} />}
{!cleanUI && <RightDrawer />}
{!cleanUI && <BottomStatusBar />}
{/* CinematicHUD always visible — it's part of the cinematic aesthetic */}
<CinematicHUD />
```

### Anti-Patterns to Avoid

- **Creating stages on preset switch:** GLSL shader recompilation causes a 50–200ms frame stall. Create all stages once at init.
- **Constant-value uniforms for sliders:** Uniforms captured at creation time, never update. Use function-style uniforms that read from a ref.
- **`pointer-events` on HUD root:** Will block camera pan, zoom, and click-pick. Set `pointer-events: none` on the root; `pointer-events: auto` only on buttons/sliders.
- **No `cancelFlight()` before new flyTo:** Rapid Q/W/E/R/T keypresses will cause CesiumJS "camera was changed during flyTo" errors and jittery behavior.
- **Landmark altitudes hardcoded to 2,000,000m (current viewerRegistry default):** Local landmark navigation at 2M meters altitude shows the entire region. Compute altitude from landmark bbox or use explicit per-landmark altitude in `landmarks.json`.
- **Calling Nominatim on every keystroke:** Rate limit is 1 req/s. Debounce at minimum 400ms.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| MGRS coordinate conversion | Custom MGRS math | `mgrs@2.1.0` (`forward([lon,lat], 4)`) | MGRS has NATO zone exceptions (Norway/Svalbard), polar zone handling, 100km square ID edge cases at zone boundaries. Custom implementations silently produce wrong grid refs near zone edges. |
| NVG green-tint shader | Custom GLSL | `PostProcessStageLibrary.createNightVisionStage()` | Built-in, tested, GLSL already optimized for CesiumJS framebuffer read pattern |
| Noir/B&W shader | Custom GLSL | `PostProcessStageLibrary.createBlackAndWhiteStage()` | Built-in; save authoring time for the presets that don't have built-in equivalents (CRT, FLIR) |
| City geocoding | Hardcoded city list or custom geocoder | Nominatim OSM API | 100M+ named places, free, no auth, OSM-based, returns bbox for altitude calculation |

**Key insight:** Phase 7 has two presets with built-in CesiumJS implementations (NVG, Noir) and two requiring custom GLSL (CRT, FLIR). Write custom GLSL only for the latter two.

---

## Common Pitfalls

### Pitfall 1: Post-Processing Stage Accumulation in React StrictMode

**What goes wrong:** React 18+ StrictMode double-invokes effects in development. If stage creation is not guarded by a ref, two copies of each stage are added to `postProcessStages`. The duplicate stages compound (double NVG green, double scanlines) and `postProcessStages._stages.length` grows on every hot-reload.

**Why it happens:** `useEffect(() => { viewer.scene.postProcessStages.add(stage) }, [viewer])` fires twice in StrictMode. The cleanup function (returned from the first invocation) removes the stage; the second invocation re-adds it. But if there is no cleanup or the cleanup doesn't fully remove, stages accumulate.

**How to avoid:** Guard with a boolean ref: `if (initRef.current) return; initRef.current = true;`. Return a cleanup function from the effect that removes all added stages. Verify in the browser console after hot-reload: `viewer.scene.postProcessStages._stages.length` must remain stable.

**Warning signs:** Globe appears double-tinted; switching to Normal preset doesn't fully clear the effect; frame rate drops below 45 FPS with only Normal preset active.

### Pitfall 2: Post-Processing Uniform Stale Closure

**What goes wrong:** Sliders move in the UI but the visual effect doesn't change. The `PostProcessStage` uniform captured the slider's initial value at creation time.

**Why it happens:** Setting `uniforms: { gain: gainValue }` where `gainValue` is a JavaScript variable evaluates once at object construction. The stage does not re-read the variable on subsequent frames.

**How to avoid:** All slider-driven uniforms must be function-style: `uniforms: { gain: () => uniformsRef.current.gain }`. The function is called per-frame by CesiumJS's render loop.

**Warning signs:** First slider move triggers a visual change; subsequent moves do nothing. Resetting the stage recreates the effect at the new value.

### Pitfall 3: HUD Overlay Blocking Globe Interaction

**What goes wrong:** Camera panning stops working in screen regions where HUD elements are positioned. Click-pick returns `undefined` when the cursor is over a HUD text element.

**Why it happens:** React components have `pointer-events: auto` by default. Any HUD element that overlaps the canvas with default CSS intercepts mouse/touch events before CesiumJS can process them.

**How to avoid:** The HUD root container gets `pointer-events: none`. Only interactive elements (Clean UI toggle button, landmark buttons) set `pointer-events: auto` on their specific element. Verify camera pan works while cursor passes over all HUD text.

**Warning signs:** Pan works on the globe edges but fails in corners where HUD elements are positioned. Console shows no CesiumJS pick events when clicking over HUD text.

### Pitfall 4: Rapid Keyboard Landmark Presses Cause FlyTo Conflicts

**What goes wrong:** Pressing Q then immediately W produces a CesiumJS error "Camera was changed during a flyTo" and the camera freezes in an intermediate position.

**Why it happens:** A second `flyTo()` call while the first animation is still running causes internal CesiumJS state corruption.

**How to avoid:** Always call `viewer.camera.cancelFlight()` before every `flyTo()` call. The existing `flyToPosition()` in `viewerRegistry.ts` must be updated to include `cancelFlight()`.

**Warning signs:** Pressing two shortcut keys in quick succession leaves the camera pointing at an incorrect position with no further response.

### Pitfall 5: CesiumJS 1.121+ PBR Neutral Tonemapper Interaction

**What goes wrong:** Bloom behaves differently than expected: the `exposure` property has no effect; brightness changes seem non-linear. On the Normal preset (no post-processing), the scene looks slightly different than in v1.0 sandcastle examples.

**Why it happens:** CesiumJS 1.121 (September 2024) changed the default tonemapper from ACES to PBR Neutral Tonemap and enabled 4x MSAA by default. The project is on cesium@1.139.1, which uses PBR Neutral. Bloom `brightness` and `contrast` uniforms interact with the PBR tonemapper differently than ACES.

**How to avoid:** On `PostProcessEngine` init, explicitly query and store the current HDR state. When switching to Normal preset, restore the viewer's default tonemapper settings. Test bloom on the actual v1.0 scene (ESRI imagery + 5,000 satellite points), not a sandcastle demo.

**Warning signs:** Bloom intensity looks correct in isolation but washed-out with ESRI imagery active. The Normal preset looks different from v1.0.

### Pitfall 6: Nominatim Rate Limit on Fast Typing

**What goes wrong:** Nominatim returns HTTP 429. City search stops working for the current user's IP. The rate limit is global per IP, so it affects the entire app.

**Why it happens:** Each keystroke triggers an API call without debouncing.

**How to avoid:** Minimum 400ms debounce on the city search input. Show "searching..." only after the debounce fires. Add User-Agent header per Nominatim usage policy.

**Warning signs:** HTTP 429 in network tab. City search stops returning results after rapid typing.

---

## Code Examples

Verified patterns from official sources and existing codebase:

### CesiumJS Built-In NVG Stage
```typescript
// Source: CesiumJS PostProcessStageLibrary docs
import { PostProcessStageLibrary } from 'cesium';

const nvgStage = PostProcessStageLibrary.createNightVisionStage();
nvgStage.enabled = false;
viewer.scene.postProcessStages.add(nvgStage);
```

### CesiumJS Built-In Bloom
```typescript
// Source: CesiumJS PostProcessStageCollection docs
// Bloom is a property on the collection — NOT created via PostProcessStageLibrary
const bloom = viewer.scene.postProcessStages.bloom;
bloom.enabled = true;
bloom.uniforms.contrast = 128;      // range: -255 to 255
bloom.uniforms.brightness = -0.3;   // default
bloom.uniforms.glowOnly = false;
```

### Custom GLSL FLIR Thermal Stage
```typescript
// Source: CesiumJS PostProcessStage custom shader pattern
// FLIR: luminance-to-heat-color mapping
const flirStage = new PostProcessStage({
  fragmentShader: `
    uniform sampler2D colorTexture;
    in vec2 v_textureCoordinates;

    void main() {
      vec4 color = texture(colorTexture, v_textureCoordinates);
      float lum = dot(color.rgb, vec3(0.299, 0.587, 0.114));
      // Iron/rainbow gradient: black -> blue -> red -> yellow -> white
      vec3 heat;
      if (lum < 0.25)      heat = mix(vec3(0,0,0), vec3(0,0,1), lum * 4.0);
      else if (lum < 0.5)  heat = mix(vec3(0,0,1), vec3(1,0,0), (lum-0.25)*4.0);
      else if (lum < 0.75) heat = mix(vec3(1,0,0), vec3(1,1,0), (lum-0.5)*4.0);
      else                 heat = mix(vec3(1,1,0), vec3(1,1,1), (lum-0.75)*4.0);
      out_FragColor = vec4(heat, color.a);
    }
  `,
});
```

### Custom GLSL Gain Stage with Function Uniform
```typescript
// Source: CesiumJS PostProcessStage uniform function pattern
const gainRef = { value: 1.0 }; // mutable ref

const gainStage = new PostProcessStage({
  fragmentShader: `
    uniform sampler2D colorTexture;
    uniform float u_gain;
    in vec2 v_textureCoordinates;
    void main() {
      vec4 color = texture(colorTexture, v_textureCoordinates);
      out_FragColor = vec4(color.rgb * u_gain, color.a);
    }
  `,
  uniforms: {
    u_gain: () => gainRef.value, // function-style: evaluated per-frame
  },
});
```

### MGRS Conversion from Camera
```typescript
// Source: mgrs@2.1.0 API, CesiumJS Camera docs
import { forward } from 'mgrs';
import { Math as CesiumMath } from 'cesium';

function getCameraGR(viewer: Viewer): string {
  const cart = viewer.camera.positionCartographic;
  const lon = CesiumMath.toDegrees(cart.longitude);
  const lat = CesiumMath.toDegrees(cart.latitude);
  // Clamp lat to MGRS valid range (-80 to +84 degrees)
  if (lat > 84 || lat < -80) return 'UPS'; // polar regions use UPS, not MGRS
  return forward([lon, lat], 4); // precision 4 = 10m resolution
}
```

### landmarks.json Structure
```json
{
  "landmarks": [
    {
      "id": "doha-city",
      "name": "Doha",
      "shortcut": "Q",
      "lat": 25.2854,
      "lon": 51.5310,
      "altMeters": 80000,
      "heading": 0,
      "pitch": -45
    },
    {
      "id": "doha-hamad-airport",
      "name": "Hamad International Airport",
      "shortcut": "W",
      "lat": 25.2731,
      "lon": 51.6082,
      "altMeters": 15000,
      "heading": 0,
      "pitch": -60
    }
  ]
}
```

### Nominatim City Geocoder with User-Agent
```typescript
// Source: Nominatim OSM usage policy (requires User-Agent)
async function nominatimSearch(query: string) {
  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.searchParams.set('q', query);
  url.searchParams.set('format', 'json');
  url.searchParams.set('limit', '5');
  url.searchParams.set('addressdetails', '1');

  const res = await fetch(url.toString(), {
    headers: {
      'User-Agent': 'IntelligenceGlobe/2.0 (homelab OSINT viewer)',
      'Accept-Language': 'en',
    },
  });
  return res.json() as Promise<NominatimResult[]>;
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| CesiumJS ACES tonemapper (default) | PBR Neutral Tonemap (default since 1.121) | September 2024 (cesium 1.121) | Bloom `brightness` and `exposure` behave differently; test on real scene |
| CesiumJS 4x MSAA disabled by default | 4x MSAA enabled by default (cesium 1.121+) | September 2024 (cesium 1.121) | Higher quality aliasing but slightly more GPU cost; interacts with custom post-processing pass ordering |
| `PostProcessStage` `selected` array for per-primitive effects | Not supported — full-scene only | Partial implementation, ongoing | No workaround; post-processing always affects entire scene |

**Deprecated/outdated patterns:**
- Setting `uniforms.intensity = someVariable` as constant: evaluates once, never updates.
- `viewer.scene.postProcessStages.add()` inside React render body: stages accumulate on every render.
- `viewer.camera.flyTo()` without `cancelFlight()` before: causes flyTo conflict errors on rapid input.

---

## Open Questions

1. **CRT barrel distortion GLSL complexity**
   - What we know: CRT preset requires scanlines + barrel distortion + chromatic aberration in a `PostProcessStageComposite` (two or three passes)
   - What's unclear: The resolution-dependent scanline artifact (non-integer scanline spacing at non-native resolution). A 1920x1080 screen with 108 scanlines will show correct equally-spaced lines; a 2560x1440 screen with the same count will show beat-frequency moire.
   - Recommendation: Use a scanline density expressed as a fraction of screen height (e.g., scanline every 3 pixels) not as an absolute count. Test on both 1080p and 1440p.

2. **HUD telemetry: "satellite ORB/PASS" readout source**
   - What we know: VIS-03 requires "satellite telemetry readout" showing ORB/PASS data
   - What's unclear: Whether this means the selected satellite (from `selectedSatelliteId` in store) or a generic display. The REC timestamp is straightforward.
   - Recommendation: Show selected satellite data from the existing `selectedSatelliteId` store slice. If no satellite is selected, show placeholder values (`--`). Use the existing satellite detail panel data as source.

3. **Q/W/E/R/T landmark assignments for Doha preset**
   - What we know: NAV-02 specifies "curated landmarks within a city" with precise centering; requirements mention Doha by name (NAV-01)
   - What's unclear: Which specific Doha landmarks map to Q/W/E/R/T
   - Recommendation: Build the data structure to accept any 5 landmarks configurable in `landmarks.json`. Seed with Doha landmarks (Doha Corniche, Hamad Airport, The Pearl, Lusail, West Bay) as the initial Q–T assignments. Make the JSON easily editable.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.0.18 |
| Config file | `frontend/vite.config.ts` (test block, environment: jsdom) |
| Quick run command | `cd frontend && npx vitest run --reporter=verbose` |
| Full suite command | `cd frontend && npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| VIS-01 | `setPreset('nvg')` enables nvg stage, disables others; `postProcessStages._stages.length` stable after 5 switches | unit | `npx vitest run src/components/__tests__/PostProcessEngine.test.tsx` | ❌ Wave 0 |
| VIS-02 | Slider value change updates `uniformsRef.current` immediately; function-style uniform returns updated value | unit | `npx vitest run src/components/__tests__/PostProcessEngine.test.tsx` | ❌ Wave 0 |
| VIS-03 | `getCameraGR()` returns valid MGRS string for [51.53, 25.28]; returns 'UPS' for lat > 84 | unit | `npx vitest run src/components/__tests__/MGRSReadout.test.ts` | ❌ Wave 0 |
| VIS-04 | `setCleanUI(true)` sets `cleanUI` in store; `setCleanUI(false)` restores it | unit | `npx vitest run src/store/__tests__/useAppStore.test.ts` | ✅ (extend existing) |
| NAV-01 | `nominatimSearch('Doha')` resolves to lat~25.28, lon~51.53 (integration, skip in CI) | integration | manual | ❌ manual-only |
| NAV-02 | `landmarks.json` contains at least 5 entries with valid lat/lon/altMeters | unit | `npx vitest run src/data/__tests__/landmarks.test.ts` | ❌ Wave 0 |
| NAV-03 | `keydown` event for 'q' triggers `flyToLandmark` with landmark id matching first landmark | unit | `npx vitest run src/hooks/__tests__/useKeyboardShortcuts.test.ts` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `cd frontend && npx vitest run --reporter=verbose`
- **Per wave merge:** `cd frontend && npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `frontend/src/components/__tests__/PostProcessEngine.test.tsx` — covers VIS-01, VIS-02 (stage count stability, uniform function pattern). Requires CesiumJS mock for `PostProcessStageCollection`.
- [ ] `frontend/src/components/__tests__/MGRSReadout.test.ts` — covers VIS-03 coordinate conversion
- [ ] `frontend/src/data/__tests__/landmarks.test.ts` — covers NAV-02 (JSON schema validation)
- [ ] `frontend/src/hooks/__tests__/useKeyboardShortcuts.test.ts` — covers NAV-03 (keydown → flyTo dispatch)
- [ ] Extend `frontend/src/store/__tests__/useAppStore.test.ts` to add `cleanUI` and `visualPreset` slice tests — covers VIS-04

*(VIS-01/VIS-02 full integration testing — preset visual correctness — is manual-only: requires a live CesiumJS scene on real WebGL hardware)*

---

## Sources

### Primary (HIGH confidence)
- CesiumJS PostProcessStageCollection docs — `bloom` property, `add()` method, stage ordering
- CesiumJS PostProcessStageLibrary docs — `createNightVisionStage()`, `createBlackAndWhiteStage()` confirmed built-ins
- CesiumJS PostProcessStage docs — `fragmentShader` and `uniforms` API including function-style uniforms
- CesiumJS Camera docs — `flyTo()`, `cancelFlight()`, `positionCartographic`, `moveEnd` event
- CesiumJS 1.121 release blog (September 2024) — PBR Neutral tonemapper, MSAA defaults change
- `mgrs@2.1.0` npm package — `forward([lon, lat], precision)` API, TypeScript types
- Existing v1.0 codebase: `viewerRegistry.ts`, `useAppStore.ts`, `GlobeView.tsx` — established patterns for viewer registry, store structure, overlay positioning
- PITFALLS.md (pre-existing research) — verified pitfall details for post-processing scope, HUD pointer events, flyTo conflict, uniform stale closure

### Secondary (MEDIUM confidence)
- Nominatim OSM API search endpoint — `format=json`, `limit`, `boundingbox` field, 1 req/s rate limit, User-Agent requirement
- CesiumJS community thread: HTML overlay touch gesture / pointer event blocking — `pointer-events: none` pattern
- CesiumJS GitHub issue: postprocessing initially disabled, fails if re-enabled — confirms `enabled` toggle is correct approach

### Tertiary (LOW confidence / requires validation)
- CRT scanline moire artifact at non-native resolution — derived from libretro shader forum discussion; validate empirically on target hardware
- FLIR iron/rainbow gradient specific coefficient values — standard WebGL shader pattern, exact perceptual quality requires visual tuning

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already in use or installed in node_modules; mgrs confirmed via npm; CesiumJS post-processing APIs verified via official docs
- Architecture: HIGH — patterns derived from existing v1.0 codebase + official CesiumJS docs + pre-existing v2.0 research
- Pitfalls: HIGH — critical pitfalls documented in pre-existing PITFALLS.md with source references; StrictMode double-init pitfall derived from React 18 docs

**Research date:** 2026-03-11
**Valid until:** 2026-06-11 (stable APIs; CesiumJS releases every ~2 months but post-processing API is stable)
