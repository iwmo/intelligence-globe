# Feature Research: v3.0 UI Refinement

**Domain:** Geospatial Intelligence Globe — UI Refinement (Radar Aesthetic, Panel Layout, Globe Interaction)
**Researched:** 2026-03-12
**Confidence:** HIGH (CesiumJS APIs verified), MEDIUM (radar UI conventions from community patterns), HIGH (collapsible panel patterns)

---

## Scope

This document covers ONLY the 5 new v3.0 feature areas. All v1.0/v2.0 features (globe, layers, presets, HUD, replay, OSINT) are already built and are not re-researched here.

The existing architecture that these features must integrate with:
- **CesiumJS Primitive API** (not Entity API) — BillboardCollection primitives used for all entity icons
- **React + TypeScript** frontend with Vite
- **LeftSidebar.tsx** — hamburger toggle sidebar containing layer toggles, SearchBar, FilterPanel
- **RightDrawer.tsx** — visual presets and PostProcessPanel
- **PlaybackBar.tsx** at bottom — timeline scrubber, LIVE/PLAYBACK toggle
- **GlobeView.tsx** — CesiumJS Viewer root, owns camera and ScreenSpaceEventHandler

---

## Feature Landscape

### Table Stakes (Users Expect These in a Polished v3 UI)

Features that any serious v3 UI upgrade must deliver. Missing them makes the refinement feel cosmetic-only, not architectural.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Collapsible sidebar sections** | Every modern data-dense UI (VSCode, Figma, geospatial tools) groups controls into expandable sections. A flat list of toggles breaks down when more than ~6 layers exist. | LOW-MEDIUM | CSS height transition from `0` to `auto` is the standard pattern, but `height: auto` cannot be animated directly in CSS. Use `max-height` trick (0 to a clamped max) or measure element height with ResizeObserver then set explicit px height. Framer Motion `AnimatePresence` with `initial={false}` is the cleanest React solution — avoids the max-height clamping artifacts. Section header acts as the toggle trigger. Chevron icon rotates 90deg on expand/collapse. |
| **No panel overlap** | Current sidebar and right drawer likely have z-index conflicts at certain viewport sizes. Any professional UI must handle this. | LOW | Define clear z-index stacking context. Sidebar (z: 80), RightDrawer (z: 80), PlaybackBar (z: 70), CinematicHUD (z: 90), SearchBar (z: 95). Panels must not overlap each other's interactive regions. |
| **Entity icons that read at all zoom levels** | At ISS orbital altitude (~400km), a 1px dot is invisible. At street level (~2km), a 32px icon is enormous and occludes terrain. Users need icons that remain legible throughout the zoom range. | MEDIUM | CesiumJS BillboardCollection supports `scaleByDistance: new Cesium.NearFarScalar(nearDist, nearScale, farDist, farScale)`. This is the canonical API. Applies per-billboard. Since existing code uses Primitive API (BillboardCollection), this is a property addition to each billboard's config object, not an architectural change. `distanceDisplayCondition` can hide icons beyond a threshold. Example values: `new Cesium.NearFarScalar(1.5e3, 1.5, 1.5e8, 0.4)` scales from 1.5× at 1500m to 0.4× at 150Mm. |
| **Double-click zoom toward cursor** | This is the universal expectation from Google Earth, FlightRadar24 3D, and Bing Maps 3D. Single-click already selects entities; double-click should zoom. Users naturally double-click on areas of interest expecting zoom behavior. | MEDIUM | CesiumJS since v1.11 (July 2015) provides `camera.getPickRay(position)` to get the ray from camera through screen position, then `camera.move(direction, amount)` along that ray. The scene pick ray approach: `const ray = viewer.camera.getPickRay(event.position); const point = viewer.scene.globe.pick(ray, viewer.scene);` then `viewer.camera.flyTo({ destination: Cartesian3 at 50% distance toward picked point })`. Must override default double-click using `viewer.screenSpaceEventHandler.setInputAction(() => {}, Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK)` first to disable the default entity-focus behavior. |
| **Zoom in/out control buttons** | On-screen +/- buttons are standard in all map UIs (Google Maps, Mapbox, Leaflet, OpenLayers). Users on touchpads or non-scroll-wheel input expect them. | LOW | CesiumJS has no built-in zoom buttons. Implement as React component absolutely positioned top-right or bottom-right of globe. Calls `viewer.camera.zoomIn(zoomAmount)` and `viewer.camera.zoomOut(zoomAmount)`. Amount should scale with current altitude to feel consistent (zoom 10% of current altitude). |
| **Tilt/pitch control** | Standard in Google Earth (the tilt slider), HERE WeGo (tilt toggle), and every 3D map tool. Users expect a way to switch between top-down (2D map feel) and oblique (3D perspective) views. | LOW-MEDIUM | CesiumJS camera pitch is set via `viewer.camera.setView({ orientation: { pitch: Cesium.Math.toRadians(degrees) } })` or animated via `viewer.camera.flyTo({ orientation: { pitch } })`. Standard UX is a vertical slider or discrete buttons: Top-down (90°), 45° oblique, Horizon (0°). A persistent indicator showing current tilt angle is the Mapbox pattern. React state tracks current pitch, buttons trigger flyTo with same position but new pitch. |

### Differentiators (Competitive Advantage for v3)

Features that elevate this beyond a map tool with a dark theme.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Radar-style UI visual language** | No open-source geospatial tool uses authentic radar/SIGINT terminal aesthetics — angular corner brackets, scan animation on active panels, pulsing active indicators. This is the visual signature that makes the tool feel operational, not hobbyist. | MEDIUM | The pattern: panel borders replaced with CSS corner-only bracket decorations (4 `::before`/`::after` pseudo-elements, or 4 absolutely-positioned `<span>` divs). Angular clip-path on panel headers (`clip-path: polygon(0 0, calc(100% - 12px) 0, 100% 12px, 100% 100%, 0 100%)`). Pulsing dot via CSS keyframe animation on `box-shadow`. Scan line sweep via `@keyframes` on a linear-gradient overlay `transform: translateY(-100%)` to `translateY(100%)`. Color palette: `#00d4ff` (primary cyan), `#00ff88` (active/green), `#ff4444` (alert/red), `#ffaa00` (warning/amber) on near-black backgrounds. All these are pure CSS — zero JavaScript, zero performance impact. |
| **Custom SVG billboard icons per entity type** | Generic dots or built-in CesiumJS pin markers do not convey entity type at a glance. Custom SVG icons (satellite with solar panels, aircraft silhouette, ship outline, military diamond) are the FlightRadar24 standard. | MEDIUM | SVGs can be rendered to a Canvas at runtime and passed as CesiumJS billboard image via `canvas.toDataURL()` or a data URL. Alternatively, bake icons as PNG sprites at 2–3 sizes and select by zoom level. CesiumJS BillboardCollection `image` property accepts a data URL or canvas. For 5,000+ satellites this matters for performance: generate icon canvas once per entity type (not per entity), reuse the same image reference across all billboards of that type. 4 icon types = 4 canvases. Color variants per type (military amber vs commercial blue) = 8 total canvases. |
| **Animated expand/collapse with section identity** | Collapsible panels with labeled section headers (LAYERS, FILTERS, SEARCH, NAVIGATION) that show item counts when collapsed ("LAYERS ▸ 6 active") communicate state without requiring the panel to be open. | MEDIUM | Section count badge: reduce layer toggle states to active count in collapsed header. Use `useMemo` for the count. Framer Motion layout animation on section container so adjacent sections smoothly reflow when one collapses (avoids jarring jump). |
| **Persistent panel state** | Remembering which sidebar sections were open/closed across page loads feels like a complete product detail, not a prototype. | LOW | `localStorage.setItem('sidebarSections', JSON.stringify(openSections))` on change. Read on mount with fallback defaults. Single useEffect hook. |

### Anti-Features (Do Not Build)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| **Animated radar sweep circle on globe** | "Radar" aesthetic often prompts adding a rotating sweep animation projected onto the globe surface | A globe-projected animated sweep requires a GroundPrimitive with per-frame geometry updates, or a full-screen shader pass. At 5,000+ entities, additional shader complexity risks dropping below 60 FPS. Looks gimmicky on a globe — radar sweeps are flat-plane tools. | Apply radar aesthetic to UI panels only (corner brackets, scan lines on panel headers). Keep the globe surface clean of UI chrome. |
| **Smooth continuous zoom (not jump-based) on double click** | "Smooth" zoom feels more natural | Continuous camera fly animations during double-click create motion sickness on 3D globes because of the extreme depth change. Google Earth uses a discrete "zoom level" jump, not a slow fly. | Use `camera.flyTo()` with a short `duration: 0.4` for perceived smoothness without the disorientation of a long pan. |
| **Icon labels always visible** | "I want to know the plane callsign without clicking" | At 5,000+ entities, always-on labels are unreadable overlapping text. This is the reason we're using the Primitive API — Entity API tried to solve this with automatic LOD and failed at scale. | Show labels only on hover (mouseover) or selection. Use `distanceDisplayCondition` on labels to only show them close-up. |
| **CSS animations on every entity icon** | Pulsing / blinking icons for active entities look impressive in demos | Per-icon CSS animations are applied as DOM elements only in Entity API. With Primitive API (BillboardCollection), icons are rendered as GPU sprites — there is no per-icon CSS. Applying canvas-level animation would require re-uploading canvas textures every frame for all entities. | Animate selected entity only (single selection marker / ring drawn via CesiumJS Primitive). Animate UI panels (scan lines, pulsing dot indicators), not the globe layer icons. |
| **Resizable/draggable panels** | Power users want to arrange the UI | Drag-resize state management conflicts with the fixed positioning of CesiumJS canvas, causes z-index issues, requires substantial React drag state or a library (react-resizable-panels). Far higher complexity than the v3 scope warrants. | Collapsible sections address the space problem. Defer draggable panels to v4 if specifically requested. |
| **Mouse-wheel zoom speed override** | Feels like an easy improvement | CesiumJS `ScreenSpaceCameraController.zoomEventTypes` and `wheelZoomWeightModifier` can be adjusted, but the default is already well-tuned for globe distances. Over-tuning breaks the feel at polar orbits vs street level (the altitude range is 7 orders of magnitude). | Leave scroll-wheel zoom at default. The +/- buttons are the fix for users who want discrete control. |
| **Right-click context menu on globe** | Seems natural for "what is at this point" | Right-click on CesiumJS globe conflicts with the existing right-drag-tilt camera behavior. Disambiguating tap vs drag vs hold requires stateful timer logic that is error-prone. | Double-click for zoom is the standard interaction. Context info comes from click-to-inspect panels, which already exist. |

---

## Feature Dependencies

```
[CesiumJS BillboardCollection (already exists in all layer components)]
    ├──add-property──> scaleByDistance (NearFarScalar) per billboard
    │                      └──enables──> Zoom-scalable entity icons (ICONS-05)
    └──replace-image──> Custom SVG/canvas icons
                           └──enables──> Custom entity type icons (ICONS-01 to 04)

[CesiumJS ScreenSpaceEventHandler (already exists in GlobeView.tsx)]
    └──override-double-click──> Custom double-click handler
                                    └──uses──> camera.getPickRay() + globe.pick() + camera.flyTo()
                                    └──enables──> Double-click zoom toward cursor (NAV-01)

[React component tree / LeftSidebar.tsx]
    └──refactor-structure──> Section group components with AnimatePresence
                                 ├──enables──> Collapsible sidebar sections (LAYOUT-01)
                                 └──enables──> Logical panel grouping (LAYOUT-02)

[React absolute-positioned overlay (new component)]
    ├──enables──> Zoom +/- buttons (NAV-03)
    └──enables──> Tilt/pitch control widget (NAV-02)
                      └──uses──> viewer.camera.flyTo({ orientation: { pitch } })

[CSS custom properties / global stylesheet]
    └──enables──> Radar visual language (STYLE-01, STYLE-02)
                      └──isolated──> Pure CSS, no JavaScript runtime cost
                      └──applies-to──> All panels (LeftSidebar, RightDrawer, PlaybackBar, SearchBar, HUD)
```

### Dependency Notes

- **Icon scaling (ICONS-05) is a property addition, not a refactor.** `scaleByDistance` is added to each billboard's config in the existing BillboardCollection `add()` calls. One property per billboard. No architectural change to the Primitive renderer.
- **Custom SVG icons (ICONS-01–04) require a canvas generation utility.** Because all layer components use BillboardCollection and share the same `image:` field pattern, a shared `generateIconCanvas(type, color)` utility can be created once and imported by all four layer components. No per-component duplication.
- **Double-click zoom (NAV-01) must disable the CesiumJS default LEFT_DOUBLE_CLICK.** The default behavior zooms to and focuses on any clicked entity (sets `viewer.trackedEntity`). This must be removed and replaced with the custom globe.pick() + flyTo() handler. Disabling it is a one-liner; adding the custom handler is ~20 lines.
- **Radar CSS language (STYLE-01/02) is purely additive.** No existing component needs to be rewritten. Corner brackets can be added as child `<span>` elements or CSS pseudo-elements in existing component JSX. Scan-line animation is a CSS keyframe on a pseudo-element overlay. The existing `rgba(0,212,255,0.25)` border color palette already matches radar aesthetics — this is a refinement, not a retheme.
- **Collapsible sections (LAYOUT-01) require the most React refactoring.** LeftSidebar currently renders layer toggles as a flat fixed-position strip separate from the sidebar panel. The v3 design consolidates them inside the sidebar in named sections. This requires restructuring LeftSidebar's JSX and moving the bottom layer strip into the sidebar body — a structural change, not just a style change.
- **Tilt widget and zoom buttons (NAV-02, NAV-03) are new React components.** They must be positioned in the CesiumJS canvas area without interfering with click-through. Use `pointer-events: none` on wrappers, `pointer-events: auto` on button elements only.

---

## MVP Definition for v3.0

### Launch With (v3.0)

Minimum viable refinement — what's needed to deliver the v3 capability tier.

- [ ] **Radar corner brackets and panel header styling** (STYLE-01) — The visual signature. Pure CSS. High impact, low risk.
- [ ] **Collapsible sidebar sections with grouping** (LAYOUT-01, LAYOUT-02) — Solves the practical problem of too many controls for a small panel.
- [ ] **Panel overlap elimination** (LAYOUT-03) — Fix any existing z-index / layout conflicts between sidebar, right drawer, playback bar.
- [ ] **Custom SVG billboard icons for all 4 entity types** (ICONS-01–04) — Replaces generic markers with recognizable entity silhouettes.
- [ ] **Icon scale with camera altitude** (ICONS-05) — One `scaleByDistance` property added to each billboard. Proportional icons at all zoom levels.
- [ ] **Double-click zoom toward cursor** (NAV-01) — Override default behavior, implement globe.pick() + flyTo(). ~30 lines of code but requires testing edge cases.
- [ ] **Tilt control buttons and zoom +/- overlay** (NAV-02, NAV-03) — New React component, absolutely positioned, camera API calls.

### Add After Validation (v3.1)

- [ ] **Pulsing active indicator on panels** (STYLE-02) — CSS keyframe animation on active layer badges. Add once v3.0 layout is stable to avoid thrash.
- [ ] **Scan-line sweep animation on panel headers** — CSS `@keyframes` translateY sweep. Aesthetic detail, defer until core layout is locked.
- [ ] **Persistent sidebar section state** (localStorage) — Quality of life, add once section structure is finalized.
- [ ] **Earthquake layer** (LAY-05) — Was deferred from v2.0, natural addition once layer UI grouping is solid.
- [ ] **Weather radar overlay** (LAY-06) — Same deferral. Layer group structure makes adding new layers easier.

### Future Consideration (v3.x+)

- [ ] **Draggable/resizable panels** — Significant complexity, not warranted until user feedback confirms the need.
- [ ] **Globe-surface radar sweep animation** — Only if GPU headroom confirmed at full scene load.
- [ ] **Custom icon per entity instance** (e.g., per airline livery) — Not differentiated enough to warrant per-entity canvas overhead.

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Radar corner bracket styling | HIGH | LOW | P1 |
| Collapsible sidebar sections | HIGH | MEDIUM | P1 |
| Custom SVG entity icons | HIGH | MEDIUM | P1 |
| Icon scale with zoom | HIGH | LOW | P1 |
| Double-click zoom toward cursor | HIGH | MEDIUM | P1 |
| Panel overlap fix | MEDIUM | LOW | P1 |
| Tilt control widget | MEDIUM | LOW | P1 |
| Zoom +/- buttons | MEDIUM | LOW | P1 |
| Pulsing active indicators | MEDIUM | LOW | P2 |
| Panel scan-line animation | LOW | LOW | P2 |
| Persistent section state | MEDIUM | LOW | P2 |
| Earthquake / weather layers | MEDIUM | LOW | P3 (v3.1) |

**Priority key:**
- P1: Required for v3.0 milestone — defines the refinement tier
- P2: Ship in v3.1 once layout is stable
- P3: Future milestone

---

## Competitor Feature Analysis

| Feature | FlightRadar24 3D | Google Earth | WorldWind | Our Approach |
|---------|-----------------|--------------|-----------|--------------|
| Double-click zoom | Zooms camera toward clicked terrain point (smooth fly) | Zooms to clicked point one level at a time | Varies by config | `camera.getPickRay()` + `globe.pick()` + `camera.flyTo({ duration: 0.4 })` |
| Zoom buttons | +/- overlay top-right | Slider bottom-right | +/- top-right | +/- buttons, absolute-positioned React component, calls `camera.zoomIn/Out()` |
| Tilt control | None (hold right-click to tilt) | Vertical slider bottom-right (0°–90°) | Not prominent | Discrete preset buttons: Top-down / 45° / Horizon — easier than continuous slider on globe |
| Panel collapse | No sidebar panels | Layers panel with expand/collapse tree | Varies | Framer Motion animated collapse with chevron icon and section item counts |
| Entity icons | Aircraft silhouette SVG by airline type | KML icon set | Custom | Per-type SVG rendered to canvas, shared across all entities of same type |
| Radar aesthetics | None | None | None (plain) | Angular corner brackets, scan header animation, pulsing active badge — differentiator |

---

## Implementation Notes by Feature

### STYLE-01: Radar Corner Brackets

CSS approach using 4 child `<span>` elements (reliable cross-browser vs `::before`/`::after` which are limited per element):

```
Position: absolute at panel corners. Width/height ~12px, border 1–2px solid cyan.
Corner spans: top-left (border-top + border-left), top-right (border-top + border-right),
bottom-left (border-bottom + border-left), bottom-right (border-bottom + border-right).
Remove full panel border. Add corner spans. Background rgba(0,8,20,0.92).
```

Apply to: LeftSidebar panel, RightDrawer, SearchBar dropdown, DetailPanel modals, PlaybackBar.
Do not apply to: the CesiumJS attribution bar, browser scrollbars, anything not React-owned.

### STYLE-02: Pulsing Active Indicator

CSS `@keyframes` on `box-shadow`:
```
@keyframes radar-pulse {
  0%   { box-shadow: 0 0 0 0 rgba(0, 212, 255, 0.6); }
  70%  { box-shadow: 0 0 0 6px rgba(0, 212, 255, 0); }
  100% { box-shadow: 0 0 0 0 rgba(0, 212, 255, 0); }
}
```
Apply to the active layer indicator dot (the small colored status dot next to toggle labels).
Animation duration: 2s, infinite. Only play when layer is active (conditional class application).

### LAYOUT-01: Collapsible Section Structure

Proposed section grouping for LeftSidebar:

```
LAYERS           (SAT / AIR / MIL / SHIP / JAM / TRAFFIC)
FILTERS          (existing FilterPanel contents)
SEARCH           (existing SearchBar)
NAVIGATION       (landmark quick-jump buttons)
```

State: `openSections: Set<string>` in local React state (or localStorage-persisted).
Toggle: click section header chevron. Chevron rotates 90° via CSS transform transition.
Framer Motion `AnimatePresence` wraps section content with `initial={false}` to avoid mount animation.
Motion `variants: { open: { height: 'auto', opacity: 1 }, closed: { height: 0, opacity: 0 } }`.

### ICONS-01–04: Custom SVG Entity Icons

Icon specifications (SVG viewBox 32×32, exported to canvas at 32px for normal, 64px for high-DPI):

- **Satellite (ICONS-01):** Rectangular body with two solar panel wings, small antenna nub. Color: `#00d4ff` (cyan) standard, `#00ff88` (green) active/selected.
- **Aircraft (ICONS-02):** Top-down aircraft silhouette — narrow fuselage, swept wings, tail fin. Color: `#aaaacc` (grey-blue) commercial, selected state: `#ffffff`.
- **Military Aircraft (ICONS-03):** Top-down fighter silhouette — delta wing, wider body. Color: `#ffaa00` (amber). Different shape from commercial is critical for quick visual identification.
- **Ship (ICONS-04):** Top-down vessel silhouette — elongated hull with bow shape. Color by vessel type: cargo `#00aaff`, tanker `#ff4444`, military `#ffaa00`, passenger `#ffffff`.

All icons generated via `<canvas>` element at mount time in a `useGlobeIcons` hook. The canvas `toDataURL()` result is passed as the `image:` field to BillboardCollection. Generate once per color variant, not per entity.

### ICONS-05: scaleByDistance

Add to every billboard in every layer component's `billboards.add({})` call:

```
scaleByDistance: new Cesium.NearFarScalar(
  1.5e3,  // near distance: 1500m
  1.8,    // near scale: 1.8x (enlarged close-up)
  1.5e8,  // far distance: 150,000km (ISS orbital altitude range)
  0.35    // far scale: 0.35x (small dot at high altitude)
)
```

These values need empirical tuning during implementation. Start with these and adjust. The key insight from research: `scaleByDistance` is set per billboard object in the BillboardCollection config — it is NOT a collection-wide setting. It must be added to each `billboards.add({...})` call in SatelliteLayer.tsx, AircraftLayer.tsx, MilitaryAircraftLayer.tsx, and ShipLayer.tsx.

Note on performance: `scaleByDistance` is evaluated on the GPU per-frame by the shader that renders BillboardCollection sprites. There is no CPU cost per entity. It is a uniform value stored with each billboard's vertex buffer entry.

### NAV-01: Double-Click Zoom Toward Cursor

The implementation pattern (MEDIUM confidence — verified from CesiumJS community and API docs):

```
Step 1: Remove default double-click behavior
  viewer.screenSpaceEventHandler.setInputAction(
    () => {},
    Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK
  );

Step 2: Add custom handler
  handler.setInputAction((event) => {
    const ray = viewer.camera.getPickRay(event.position);
    if (!ray) return;
    const intersection = viewer.scene.globe.pick(ray, viewer.scene);
    if (!Cesium.defined(intersection)) return;

    // Fly to a point 40% closer along camera→intersection vector
    const cameraPos = viewer.camera.position;
    const newDest = Cesium.Cartesian3.lerp(
      cameraPos,
      intersection,
      0.4,   // 40% of the way toward the terrain point
      new Cesium.Cartesian3()
    );
    viewer.camera.flyTo({
      destination: newDest,
      duration: 0.4,
      easingFunction: Cesium.EasingFunction.CUBIC_IN_OUT,
    });
  }, Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK);
```

Edge cases to handle:
- Double-clicking an entity (picked entity, not globe) — should still zoom, not open entity panel
- Double-clicking sky/space (no globe intersection) — do nothing or zoom to screen center
- Double-clicking very close to surface — clamp minimum altitude to ~100m

### NAV-02: Tilt Control Widget

React component `<TiltControl>`, absolutely positioned bottom-right (above zoom buttons).
Three discrete buttons: `[⊤]` Top-down (pitch: -90°), `[◩]` Oblique (pitch: -45°), `[▬]` Horizon (pitch: -15°).
Current tilt shown as small readout "TILT 45°" between buttons.
Camera animation: `viewer.camera.flyTo({ destination: currentPos, orientation: { heading: currentHeading, pitch: Cesium.Math.toRadians(targetPitch), roll: 0.0 }, duration: 0.6 })`.
Note: CesiumJS pitch convention is negative for "looking down" — 0° is looking at the horizon, -90° is straight down. This is inverted from the Mapbox convention. Document this in code.

### NAV-03: Zoom Buttons

React component `<ZoomControls>`, absolutely positioned right side of globe (or bottom-right corner).
Two buttons: `[+]` and `[-]`.
Amount should scale with current altitude:
```
const altitude = Cesium.Cartographic.fromCartesian(viewer.camera.position).height;
const zoomAmount = altitude * 0.15; // zoom by 15% of current altitude
viewer.camera.zoomIn(zoomAmount);  // or zoomOut
```
This maintains consistent feel across the full altitude range (orbit → street level).

---

## Complexity Ranking

### LOW Complexity (< 1 day each)

- Radar corner bracket CSS (STYLE-01) — Pure CSS, zero JS
- Panel overlap z-index fix (LAYOUT-03) — CSS specificity audit
- Zoom +/- buttons (NAV-03) — ~50 lines React component
- Pulsing active indicator CSS (STYLE-02) — CSS keyframes
- `scaleByDistance` on existing billboards (ICONS-05) — One property added per layer component
- Persistent sidebar section state — Single useEffect + localStorage

### MEDIUM Complexity (1–3 days each)

- Collapsible sidebar sections with Framer Motion (LAYOUT-01, LAYOUT-02) — Requires restructuring LeftSidebar JSX and consolidating the bottom layer strip into the sidebar body
- Custom SVG billboard icons (ICONS-01–04) — Canvas generation utility + integration into 4 layer components + selection state visual variants
- Double-click zoom toward cursor (NAV-01) — Camera API usage is straightforward but edge cases need testing
- Tilt control widget (NAV-02) — Simple React component, but CesiumJS pitch convention is counter-intuitive (requires careful testing)

### HIGH Complexity (Not in v3.0 scope)

- Draggable/resizable panels — Defer
- Globe-surface radar sweep — Defer
- Per-instance custom icons (per airline livery, per vessel flag) — Defer

---

## Sources

- [CesiumJS Billboard API — scaleByDistance, distanceDisplayCondition](https://cesium.com/learn/cesiumjs/ref-doc/Billboard.html)
- [CesiumJS BillboardCollection API](https://cesium.com/learn/cesiumjs/ref-doc/BillboardCollection.html)
- [CesiumJS Camera API — getPickRay, flyTo, zoomIn, zoomOut](https://cesium.com/learn/cesiumjs/ref-doc/Camera.html)
- [CesiumJS ScreenSpaceCameraController — zoom configuration](https://cesium.com/learn/cesiumjs/ref-doc/ScreenSpaceCameraController.html)
- [CesiumJS Billboard display based on zoom level — Community discussion](https://community.cesium.com/t/billboard-display-based-on-zoomlevel/21042)
- [CesiumJS zoom in to mouse point — Community implementation pattern](https://community.cesium.com/t/zoom-in-to-mouse-point/2614)
- [CesiumJS implement zoom controls — Custom button approach](https://community.cesium.com/t/implement-zoom-controls/8231)
- [CesiumJS Tilt control — Community discussion](https://community.cesium.com/t/tilt-control-over-globe/471)
- [CesiumJS Tilt how-to — Community](https://community.cesium.com/t/how-to-control-the-tilt-in-cesium/6197)
- [Framer Motion — AnimatePresence and height animation for collapsible panels](https://www.react-magic-motion.com/applications/collapsible-sidebar)
- [Collapsible panel with smooth animation — React pattern](https://medium.com/@igorroch_/how-to-create-a-collapsible-panel-with-smooth-animation-in-react-89e95bf1b31a)
- [Radar/HUD UI patterns — CSS implementation examples (CodePen)](https://codepen.io/sasscoding/pen/xbbzgLp)
- [NearFarScalar scaleByDistance not linear — Issue context](https://github.com/CesiumGS/cesium/issues/10522)
- [FlightRadar24 3D view — zoom and interaction reference](https://www.flightradar24.com/blog/exploring-the-new-flightradar24-3d-view/)

---

*Feature research for: Intelligence Globe v3.0 UI Refinement*
*Researched: 2026-03-12*
