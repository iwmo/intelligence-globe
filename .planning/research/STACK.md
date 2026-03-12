# Stack Research

**Domain:** Geospatial intelligence UI refinement — radar-style CSS panels, collapsible sidebar animations, CesiumJS SVG billboard icons with altitude-based scaling, double-click camera zoom, tilt/pitch control widget
**Researched:** 2026-03-12
**Confidence:** HIGH (CesiumJS APIs verified via official docs), HIGH (CSS approach — no new library warranted), MEDIUM (canvas SVG texture pattern — community-confirmed workaround for CesiumJS 1.43+ breakage)

> **Scope note:** This file covers ONLY what is NEW or changes for v3.0 UI Refinement.
> The base stack (CesiumJS 1.139, React 19, Vite 7, TypeScript 5.9, FastAPI, PostgreSQL + PostGIS, Redis, RQ, Docker Compose)
> is validated, deployed, and documented from v1.0/v2.0. Do not re-research or reinstall the base stack.

---

## Recommended Stack

### New Libraries Required

**None.** All four v3.0 feature areas are achievable with the existing dependency set. No `npm install` step is needed for this milestone.

### Core Technologies — Integration Points That Change for v3.0

| Technology | Version (current) | v3.0 Integration Change | Why This Matters |
|------------|------------------|------------------------|-----------------|
| CesiumJS | 1.139.1 | `BillboardCollection` replaces `PointPrimitiveCollection` in entity layers | Billboard has `image`, `scaleByDistance`, `color` properties; Point does not support arbitrary icons |
| CesiumJS | 1.139.1 | `ScreenSpaceEventHandler` + `LEFT_DOUBLE_CLICK` for camera zoom | Existing layers already use this handler pattern — extend, do not duplicate |
| CesiumJS | 1.139.1 | `camera.flyTo`, `camera.setView`, `camera.zoomIn/zoomOut` for nav widget | Camera API is well-established; `flyTo` is the only way to zoom toward cursor position |
| CesiumJS | 1.139.1 | `NearFarScalar` for altitude-based icon scaling | Built-in CesiumJS type, no external math library needed |
| Tailwind CSS | 3.4.19 | Custom `@keyframes` in `globe.css` for radar scan/pulse animations | The existing `globe.css` is the correct global stylesheet; no new CSS file needed |
| tw-animate-css | 1.4.0 | `animate-ping` for active panel pulsing indicators | Already installed; confirm it is in `tailwind.config.js` plugins array |
| lucide-react | 0.577.0 | Tilt/pitch chevron icons and zoom +/- button icons | Already installed; no new icon library needed |
| zustand | 5.0.11 | No new slices needed for camera state | Subscribe to `viewer.camera.changed` locally in nav widget component instead |

### Supporting Libraries — Confirm Already Present

| Library | Version | v3.0 Purpose | Condition |
|---------|---------|-------------|-----------|
| clsx + tailwind-merge | current | Compose panel section toggle states (open/closed class variants) | Already installed |
| tw-animate-css | 1.4.0 | `animate-ping` on active layer badges inside radar panels | Confirm in `tailwind.config.js` plugins array; add if missing |

---

## Installation

No new packages to install for v3.0.

```bash
# Nothing to add — all features use existing dependencies
```

The only potential addition is confirming `tw-animate-css` is active in Tailwind config:

```js
// tailwind.config.js — verify this line is present
plugins: [require('tw-animate-css')],
// If missing, no npm install needed — just add the plugin line
```

---

## Implementation Approach Per Feature Area

### Feature 1: Radar-Style Panel CSS (STYLE-01, STYLE-02)

**Approach:** Pure CSS `@keyframes` in `frontend/src/styles/globe.css` plus Tailwind utility classes.

Radar aesthetics consist of four independent visual elements:

**Angular bracket corners** — CSS pseudo-elements only, no library:
```css
.panel-radar {
  position: relative;
}
.panel-radar::before,
.panel-radar::after {
  content: '';
  position: absolute;
  width: 10px;
  height: 10px;
  pointer-events: none;
}
.panel-radar::before {
  top: 0; left: 0;
  border-top: 1px solid rgba(0,212,255,0.7);
  border-left: 1px solid rgba(0,212,255,0.7);
}
.panel-radar::after {
  bottom: 0; right: 0;
  border-bottom: 1px solid rgba(0,212,255,0.7);
  border-right: 1px solid rgba(0,212,255,0.7);
}
```
Two-corner decoration uses one `::before` + one `::after`. Four corners requires wrapping span elements — each can carry its own pseudo-elements.

**Scan sweep animation** — `@keyframes` conic-gradient rotation:
```css
@keyframes radar-sweep {
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
}
.panel-radar-sweep::after {
  content: '';
  position: absolute; inset: 0;
  background: conic-gradient(
    from 0deg,
    rgba(0,212,255,0.0) 0deg,
    rgba(0,212,255,0.12) 60deg,
    rgba(0,212,255,0.0) 90deg
  );
  border-radius: 50%;
  animation: radar-sweep 4s infinite linear;
  pointer-events: none;
}
```
Apply only to panels that are explicitly "active" — not to every panel. Keep sweep opacity low (~0.12) so it does not compete with data.

**Pulsing active indicators** — Tailwind `animate-ping` (from tw-animate-css):
```tsx
{isActive && (
  <span className="relative flex h-2 w-2">
    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
    <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500" />
  </span>
)}
```
This is the canonical Tailwind ping pattern — no custom keyframe needed.

**Where to add keyframes:** `frontend/src/styles/globe.css` (already imported globally in `GlobeView.tsx`). Do not add CSS animations as inline `style` prop strings — they cannot be themed by visual preset.

### Feature 2: Collapsible Sidebar Sections (LAYOUT-01 through LAYOUT-03)

**Approach:** `useRef` + `scrollHeight` measurement + CSS `max-height` transition. No new animation library.

**Do not add framer-motion.** Decision:
- framer-motion 12.35.2 is React 19 compatible and supports `height: 0 → auto`. However, it is 15–34 KB gzipped for a transition that requires ~20 lines of native React.
- The existing codebase uses inline `style` objects throughout. framer-motion introduces a separate animation API paradigm that is inconsistent with the project's styling approach.
- The project is a single-user operational tool, not a marketing site — animation polish beyond functional expand/collapse is out of scope.

**Do not use modern CSS `interpolate-size: allow-keywords`.** As of March 2026, browser support is Chromium-only (~67% global coverage). For an operational tool where reliability matters, this is not acceptable.

**Recommended pattern:**
```tsx
function SidebarSection({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  const contentRef = useRef<HTMLDivElement>(null);
  const height = open ? (contentRef.current?.scrollHeight ?? 0) : 0;

  return (
    <div>
      <button onClick={() => setOpen(o => !o)}>{title}</button>
      <div
        ref={contentRef}
        style={{
          maxHeight: height,
          overflow: 'hidden',
          transition: 'max-height 220ms ease',
        }}
      >
        {children}
      </div>
    </div>
  );
}
```

**Overflow caveat:** Set `overflow: 'visible'` after transition completes to avoid clipping tooltips or dropdowns inside expanded sections. Use an `onTransitionEnd` handler to toggle overflow state.

**For sections with static-height content** (layer toggle buttons): a fixed `max-height` value avoids the `scrollHeight` measurement entirely. Measure once at design time.

### Feature 3: CesiumJS SVG Billboard Icons with Altitude-Based Scaling (ICONS-01–05)

**Approach:** Replace `PointPrimitiveCollection` with `BillboardCollection` (Primitive API). Render SVG strings to `HTMLCanvasElement`, assign canvas as billboard image. Scale with `NearFarScalar`.

**Primitive API compatibility:** `BillboardCollection` is a Primitive API construct. It is added via `scene.primitives.add(new BillboardCollection())` — the same pattern used for `PointPrimitiveCollection` in every existing layer. This is a drop-in replacement at the collection level. The billboard management loop (add/update/remove per entity) mirrors the existing point management pattern.

**SVG-to-canvas pattern (required workaround):**
Direct SVG URL assignment to `billboard.image` has been broken since CesiumJS 1.43+ in some browsers due to cross-origin restrictions on data: URIs. The community-confirmed stable approach is rendering to an `HTMLCanvasElement`:

```typescript
function svgToCanvas(svgMarkup: string, size = 32): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const blob = new Blob([svgMarkup], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  const img = new Image(size, size);
  img.onload = () => {
    ctx.drawImage(img, 0, 0, size, size);
    URL.revokeObjectURL(url);
  };
  img.src = url;
  return canvas; // assign as billboard.image — Cesium reads it after onload
}
```

Create canvases once at module level per icon type (satellite, aircraft, military, ship) — not per entity. Pass the same canvas instance to every billboard of that type so BillboardCollection deduplicates the GPU texture.

**Per-entity tinting via `billboard.color`:** Once the billboard uses a neutral white/grey SVG shape, `billboard.color` applies a multiplicative tint at zero extra GPU cost. This replaces the per-color PointPrimitive approach used in v1.0/v2.0.

**Altitude-based scaling with NearFarScalar:**
```typescript
import { NearFarScalar } from 'cesium';

// Satellites: orbit (LEO ~500km) to geostationary (~36,000km)
// Camera range (Cesium measures camera-to-surface, not altitude): 500_000m to 50_000_000m
const SAT_SCALE = new NearFarScalar(5e5, 0.5, 5e7, 1.8);

// Aircraft/military: city (~10km) to continent (~5,000km) zoom
const AIR_SCALE = new NearFarScalar(1e4, 0.7, 5e6, 1.3);

// Ships: similar to aircraft but tighter (ships are near-surface)
const SHIP_SCALE = new NearFarScalar(1e4, 0.6, 2e6, 1.2);
```

`NearFarScalar(nearDistance, nearValue, farDistance, farValue)`: scale interpolates linearly between `nearValue` (camera close) and `farValue` (camera far). Outside range, scale is clamped. These starting values should be tuned in-browser.

**Known CesiumJS issue (GitHub #10522):** `scaleByDistance` interpolation is not perfectly linear near range edges — there is a small jump near the boundary values. Mitigation: widen the near/far range so the camera never sits at the exact boundary during normal use.

**Performance:** Keep one `BillboardCollection` per entity type. Do not create per-entity collections — BillboardCollection batches all billboards into one WebGL draw call. Use `BlendOption.TRANSLUCENT` for SVG icons with alpha channels (all SVG icons will have transparency).

```typescript
import { BillboardCollection, BlendOption } from 'cesium';
const billboards = viewer.scene.primitives.add(
  new BillboardCollection({ blendOption: BlendOption.TRANSLUCENT })
);
```

### Feature 4: Double-Click Camera Zoom Toward Cursor (NAV-01)

**Approach:** `ScreenSpaceEventHandler` with `LEFT_DOUBLE_CLICK`, `scene.pickPosition()` to resolve screen position to world `Cartesian3`, then `camera.flyTo()` with halved altitude. No new library.

**The existing layers already use `ScreenSpaceEventHandler`** (`SatelliteLayer.tsx`, `AircraftLayer.tsx`) — this is an established codebase pattern. The double-click zoom handler belongs in `GlobeView.tsx` during viewer init, not in a layer component, because it is a global navigation behavior.

**Remove default double-click behavior first.** CesiumJS default double-click zooms to a tracked entity. It must be removed before adding the custom handler:
```typescript
// In GlobeView.tsx after Viewer construction
viewer.screenSpaceEventHandler.removeInputAction(
  Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK
);
```
If this line is omitted, both the default and custom handlers fire on double-click.

**Implementation pattern:**
```typescript
import {
  ScreenSpaceEventHandler,
  ScreenSpaceEventType,
  Cartographic,
  Cartesian3,
  Math as CesiumMath,
  EasingFunction,
  defined,
} from 'cesium';

const handler = new ScreenSpaceEventHandler(viewer.scene.canvas);
handler.setInputAction((event: { position: Cesium.Cartesian2 }) => {
  const cartesian = viewer.scene.pickPosition(event.position);
  if (!defined(cartesian)) return; // click on sky — ignore

  const currentHeight = viewer.camera.positionCartographic.height;
  const targetHeight = Math.max(currentHeight * 0.35, 500); // floor at 500m

  const carto = Cartographic.fromCartesian(cartesian);
  viewer.camera.flyTo({
    destination: Cartesian3.fromRadians(
      carto.longitude, carto.latitude, targetHeight
    ),
    duration: 0.75,
    easingFunction: EasingFunction.QUADRATIC_OUT,
  });
}, ScreenSpaceEventType.LEFT_DOUBLE_CLICK);
```

**`scene.pickPosition` reliability:** Requires `scene.globe.depthTestAgainstTerrain = true` for accurate picks on terrain. This project uses `EllipsoidTerrainProvider` (flat ellipsoid), so picks always land on the ellipsoid surface — `pickPosition` is reliable without that flag. If terrain is added in a future milestone, the flag becomes necessary.

**Zoom factor 0.35:** Reduces altitude by ~65% per double-click. Matches FlightRadar24 behavior. Adjust to taste; 0.25–0.5 is the usable range.

### Feature 5: Tilt/Pitch Widget and Zoom Buttons (NAV-02, NAV-03)

**Approach:** Small React component overlay (same `position: fixed` pattern as existing HUD elements), calling CesiumJS camera API directly via `viewerRegistry`. No new library.

**Tilt/pitch control:**
```typescript
// Increment pitch by delta radians
function adjustTilt(viewer: Viewer, deltaPitch: number) {
  const currentPitch = viewer.camera.pitch; // radians; -Math.PI/2 = nadir
  const newPitch = CesiumMath.clamp(
    currentPitch + deltaPitch,
    -Math.PI / 2,   // max nadir (straight down)
    CesiumMath.toRadians(-5) // min tilt (5° below horizon)
  );
  viewer.camera.flyTo({
    destination: viewer.camera.position,
    orientation: {
      heading: viewer.camera.heading,
      pitch: newPitch,
      roll: 0,
    },
    duration: 0.25,
  });
}
```

Use `camera.flyTo` (not `camera.setView`) for the tilt widget to get a smooth 250ms animation. `setView` is instantaneous and feels jarring for a UI button.

**Zoom buttons:**
```typescript
function zoomIn(viewer: Viewer) {
  const step = viewer.camera.positionCartographic.height * 0.3;
  viewer.camera.zoomIn(step);
}
function zoomOut(viewer: Viewer) {
  const step = viewer.camera.positionCartographic.height * 0.3;
  viewer.camera.zoomOut(step);
}
```

Scale `step` by current altitude for consistent apparent zoom speed at all scales. Fixed-meter steps feel too slow at orbit altitude and too violent at street level.

**Widget layout:** Anchor bottom-right, above the `BottomStatusBar`. Use `lucide-react` icons (`ChevronUp`, `ChevronDown` for tilt; `Plus`, `Minus` for zoom). Style with the same inline `style` object pattern used throughout the codebase.

**Camera state in widget:** The tilt indicator (showing current pitch as a gauge) should read `viewer.camera.pitch` on render. Subscribe to `viewer.camera.changed` in a `useEffect` to trigger re-renders when camera moves:
```typescript
useEffect(() => {
  const listener = viewer.camera.changed.addEventListener(() => {
    setPitch(viewer.camera.pitch); // local state, not Zustand
  });
  return () => { viewer.camera.changed.removeEventListener(listener); };
}, [viewer]);
```
Do not put camera pitch in Zustand — it would re-render all subscribers (layer components, sidebar, HUD) on every camera move.

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| CSS `max-height` transition for collapsible sections | framer-motion `AnimatePresence` | Use framer-motion if the project were Next.js/app-router based with complex stagger orchestration across many animated components. Not warranted for sidebar accordion with 6–8 sections. |
| Canvas-rendered SVG → `BillboardCollection` | Entity API `BillboardGraphics` with SVG URL | Entity API is simpler to author but collapses at 5,000+ entities. The project already validated Primitive API as the only acceptable approach (v1.0 key decision). |
| CSS `@keyframes` in `globe.css` | react-spring or CSS-in-JS animation | CSS is already the styling mechanism for the globe. Adding a JS animation runtime for decorative CSS effects is over-engineering. |
| `camera.flyTo` for double-click zoom toward cursor | `camera.zoomIn()` | `zoomIn()` zooms toward canvas center, not the clicked point. For cursor-directed zoom, resolving the click to a world position and flying to it is the only correct approach. |
| `scene.pickPosition` for world coordinate resolution | `scene.pick()` | `scene.pick()` returns the picked object (primitive, feature), not the world position. `pickPosition()` returns the 3D world Cartesian3 needed to construct the `flyTo` destination. |
| CSS-only radar panel decorations | SVG overlay elements | CSS `::before`/`::after` pseudo-elements are sufficient for corner brackets and scan lines. SVG overlays are unnecessary additional DOM for purely decorative elements. |
| `billboard.color` for per-entity tinting | Per-color BillboardCollection instances | Separate collections per color defeats GPU batching. `billboard.color` applies a zero-cost GPU-side tint on a shared texture. |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| **framer-motion / motion for React** | 15–34 KB bundle for a `height: 0 → auto` accordion. Inconsistent with existing inline-style codebase. Not warranted for this feature set. React 19 compatible but unnecessary. | CSS `max-height` transition with `useRef`/`scrollHeight` measurement (~20 lines of native React) |
| **`interpolate-size: allow-keywords` CSS** | Chromium-only as of March 2026 (~67% global coverage). Operational tools require full browser support. | `max-height` transition with JavaScript-measured `scrollHeight` |
| **Direct SVG URL as `billboard.image`** | Broken in multiple browsers since CesiumJS 1.43 due to cross-origin data: URI restrictions. Community confirms unreliable. | Render SVG markup to `HTMLCanvasElement` via Blob URL, assign canvas element as billboard image |
| **One BillboardCollection per entity instance** | Defeats GPU batching. 5,000 satellites = 5,000 draw calls. CesiumJS renders each primitive collection as a separate WebGL draw call setup. | One `BillboardCollection` per entity type (satellites, aircraft, military, ships) — 4 collections total |
| **Entity API `BillboardGraphics`** | Entity API performance collapses at 5,000+ objects — this is a validated v1.0 key decision. `BillboardGraphics` is the Entity API wrapper, not Primitive API. | `BillboardCollection` (Primitive API) |
| **`@base-ui/react` Collapsible component** | Available in existing deps but adds an opaque API surface for a feature implementable in ~20 lines. Harder to style to radar aesthetic. Uses internal animation approach incompatible with the existing inline-style pattern. | Native `useState` + CSS `max-height` transition |
| **Modifying `viewer.screenSpaceEventHandler` without removing default LEFT_DOUBLE_CLICK** | CesiumJS registers a default double-click handler that zooms to tracked entity. If not removed, both the default and custom handlers fire simultaneously. | `viewer.screenSpaceEventHandler.removeInputAction(ScreenSpaceEventType.LEFT_DOUBLE_CLICK)` before registering custom handler |
| **Storing camera pitch/heading in Zustand** | Causes re-renders in all Zustand subscribers (layer components, sidebar, HUD) on every camera move. Camera state is local to the nav widget. | `viewer.camera.changed.addEventListener` in widget `useEffect`, local `useState` |

---

## Stack Patterns by Variant

**If a sidebar section contains dynamic-height content (FilterPanel, search results):**
- Use `scrollHeight`-based `max-height` transition — content height changes as filters are added/removed
- Add `onTransitionEnd` to toggle `overflow: hidden → visible` after expand completes (avoids clipping dropdowns)

**If a sidebar section contains fixed-height content (layer toggles, 6 buttons):**
- Use a fixed `max-height` value measured at design time (e.g. `max-height: 180px`)
- Simpler, avoids `scrollHeight` measurement overhead

**If entity count for a type is below 200 (ships, military flights):**
- Still use `BillboardCollection` for visual consistency — the same icon rendering path for all entity types
- `NearFarScalar` ranges can be narrower for maritime (ships never appear above atmosphere altitude)

**If the user zooms in below 500m altitude (street level):**
- Floor the double-click zoom target at 500m to prevent going underground
- `Math.max(currentHeight * 0.35, 500)` handles this

**If SVG canvas texture rendering causes flicker on first render:**
- Pre-render all icon canvases during app init (before any viewer is shown), not lazily on first billboard add
- Store canvas references in module-level constants — they survive React re-renders

---

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| cesium@1.139.1 | `BillboardCollection` Primitive API | Stable, unchanged API since 1.43+. `scaleByDistance` and `NearFarScalar` confirmed in current Billboard docs. |
| cesium@1.139.1 | `NearFarScalar` | Built-in CesiumJS type. GitHub issue #10522 documents non-linear edge behavior — widen near/far range to mitigate. |
| cesium@1.139.1 | `ScreenSpaceEventType.LEFT_DOUBLE_CLICK` | Stable event type. Default handler exists and must be removed before adding custom handler. |
| cesium@1.139.1 | `camera.flyTo` with `orientation: { pitch }` | Confirmed in Camera docs. `pitch` is in radians. `-Math.PI/2` = straight down (nadir). |
| cesium@1.139.1 | `camera.positionCartographic.height` | Returns meters above ellipsoid. For EllipsoidTerrainProvider (used in this project) this equals altitude above surface. |
| tailwindcss@3.4.19 | tw-animate-css@1.4.0 | Compatible. Confirm plugin registration in `tailwind.config.js`. `animate-ping` used for active panel indicators. |
| react@19.2.0 | framer-motion 12.35.2 | Compatible (NOT recommended for this milestone — documented above). |

---

## Sources

- [CesiumJS Billboard API](https://cesium.com/learn/cesiumjs/ref-doc/Billboard.html) — `scale`, `scaleByDistance`, `image`, `setImage`, `color` properties confirmed (HIGH confidence — official docs)
- [CesiumJS BillboardCollection API](https://cesium.com/learn/cesiumjs/ref-doc/BillboardCollection.html) — Primitive API `scene.primitives.add()` pattern, `add()` signature, `BlendOption`, performance notes confirmed (HIGH confidence — official docs)
- [CesiumJS Camera API](https://cesium.com/learn/cesiumjs/ref-doc/Camera.html) — `flyTo`, `setView`, `positionCartographic`, `zoomIn/zoomOut`, `heading`, `pitch`, `changed` event confirmed (HIGH confidence — official docs)
- [CesiumJS ScreenSpaceEventHandler API](https://cesium.com/learn/cesiumjs/ref-doc/ScreenSpaceEventHandler.html) — `setInputAction(action, type)` signature, `PositionedEvent.position: Cartesian2` confirmed (HIGH confidence — official docs)
- [CesiumJS community: Remove default double-click](https://blog.webiks.com/remove-default-double-click-behavior-in-cesium/) — `removeInputAction` pattern before custom handler confirmed (MEDIUM confidence — community blog)
- [CesiumJS community: zoom in to mouse point](https://community.cesium.com/t/zoom-in-to-mouse-point/2614) — `pickPosition` + `flyTo` pattern for cursor-directed zoom confirmed (MEDIUM confidence — community forum)
- [CesiumJS NearFarScalar non-linear issue #10522](https://github.com/CesiumGS/cesium/issues/10522) — Scale edge behavior warning; mitigation: widen range (MEDIUM confidence — GitHub issue)
- [CesiumJS community: SVG billboards broken since 1.43](https://community.cesium.com/t/svg-as-billboards-src-doesnt-work-since-cesium-1-43/6698) — canvas workaround confirmed (MEDIUM confidence — community forum)
- [CesiumJS community: canvas/SVG dynamic coloring](https://community.cesium.com/t/using-canvas-svg-as-billboards-images-with-dynamic-coloring/2515) — canvas assignment pattern confirmed (MEDIUM confidence — community forum)
- [CSS interpolate-size browser support](https://www.joshwcomeau.com/snippets/html/interpolate-size/) — Chromium-only ~67% global coverage, March 2026 (HIGH confidence — Josh W. Comeau / CSS-Tricks)
- [framer-motion npm — v12.35.2](https://www.npmjs.com/package/framer-motion) — React 19 compatible, 15–34 KB bundle confirmed (HIGH confidence — official npm page)
- [CSS radar scan animation (csswolf.com, Feb 2026)](https://csswolf.com/radar-scanner-animation-effect-in-css-no-js/) — Pure CSS `@keyframes` rotate + conic-gradient confirmed sufficient (MEDIUM confidence — blog source)
- WebSearch: "CSS radar panel angular corner decorations animation" — multiple CodePen/blog sources confirm pure CSS approach for corner brackets and scan lines (MEDIUM confidence — multiple sources agree)

---

*Stack research for: Intelligence Globe v3.0 UI Refinement — no new dependencies, integration points with existing CesiumJS Primitive API only*
*Researched: 2026-03-12*
