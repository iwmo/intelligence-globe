# Project Research Summary

**Project:** Intelligence Globe v3.0 UI Refinement
**Domain:** CesiumJS/React 3D Geospatial Intelligence Platform — Radar Aesthetic + Globe Interaction
**Researched:** 2026-03-12
**Confidence:** HIGH

## Executive Summary

Intelligence Globe v3.0 is a UI refinement milestone layered on top of a fully validated v1.0/v2.0 stack (CesiumJS 1.139, React 19, TypeScript 5.9, FastAPI, PostGIS, Redis). The milestone delivers five feature areas: radar-style panel aesthetics, collapsible sidebar sections, custom SVG billboard icons for entity types, altitude-based icon scaling, and globe navigation controls (double-click zoom toward cursor, tilt/pitch widget, zoom buttons). Critically, no new dependencies are required — every feature is achievable with the existing technology set. The stack is already production-grade, so this milestone is purely an integration and UI engineering effort.

The recommended approach is an incremental, low-regression build order: start with pure CSS and React changes (radar styling, sidebar sections), then add the camera control widget, then introduce the double-click zoom handler, and finally migrate entity layers from `PointPrimitiveCollection` to `BillboardCollection` one layer at a time. The satellite layer must remain as `PointPrimitiveCollection` — migrating 5,000+ satellite entities to billboards measurably degrades frame rate on integrated GPU hardware. Billboards are appropriate only for the lower-count layers (aircraft, military, ships). This is the single most important architectural constraint of the milestone.

The key risks are CesiumJS-specific and well-documented: the built-in `LEFT_DOUBLE_CLICK` entity-tracking handler must be explicitly removed before adding the custom zoom handler; `BillboardCollection` TextureAtlas overflow occurs when per-entity SVG strings are generated dynamically; and CSS height animations using `scrollHeight` cause synchronous layout reflow that degrades CesiumJS frame rate during sidebar animation. All three risks have clear, confirmed mitigations. The pitfalls research is unusually comprehensive for this domain, providing specific CesiumJS GitHub issue references and prevention code patterns for each failure mode.

---

## Key Findings

### Recommended Stack

The base stack is frozen and validated. No `npm install` is needed for v3.0. All feature areas use existing dependencies: CesiumJS `BillboardCollection` and `NearFarScalar` for icon rendering, `ScreenSpaceEventHandler` for double-click zoom, Tailwind CSS `@keyframes` in the existing `globe.css` for radar animations, `tw-animate-css` `animate-ping` for pulsing indicators, `lucide-react` for widget icons, and the `viewerRegistry` singleton for imperative camera calls.

The one potential action item is confirming `tw-animate-css` is registered in `tailwind.config.js` plugins — it is already installed but may not be active.

**Core technologies (integration points that change for v3.0):**
- **CesiumJS BillboardCollection**: Replaces `PointPrimitiveCollection` for aircraft, military, and ship layers — enables custom SVG icons with per-entity color tinting via `billboard.color` at zero extra GPU cost
- **CesiumJS NearFarScalar**: Added as `scaleByDistance` property on each billboard — enables altitude-proportional icon sizing; evaluated by the GPU shader per-frame, zero CPU cost
- **CesiumJS ScreenSpaceEventHandler + LEFT_DOUBLE_CLICK**: Extends existing event handler pattern in `GlobeView.tsx` — enables cursor-directed double-click zoom
- **CesiumJS camera.flyTo / pitchBy / zoomStep**: Called from new `viewerRegistry` helpers — enables smooth tilt/zoom widget without prop drilling
- **Tailwind CSS @keyframes in globe.css**: Adds radar scan sweep and pulse animations — pure CSS, zero JavaScript runtime cost
- **CSS grid-template-rows transition**: The correct mechanism for sidebar collapse animation — avoids layout reflow that would degrade CesiumJS frame rate

### Expected Features

**Must have (table stakes for v3.0 — P1):**
- Collapsible sidebar sections (LAYERS, FILTERS, SEARCH, VISUAL ENGINE) — data-dense UIs require grouped expandable controls; a flat list breaks down beyond 6 items
- Custom SVG billboard icons for all 4 entity types (satellite, aircraft, military, ship) — distinguishable silhouettes are the FlightRadar24 standard; generic dots do not convey entity type at a glance
- Icon altitude scaling via `scaleByDistance` — icons must remain legible from ISS orbital altitude to street level across 7 orders of magnitude of altitude range
- Double-click zoom toward cursor — universal expectation from Google Earth and FlightRadar24 3D
- Zoom +/- overlay buttons — essential for non-scroll-wheel input (touchpad users)
- Tilt/pitch control widget — standard 3D map control; enables top-down and oblique perspectives
- Radar corner bracket CSS styling (STYLE-01) — the visual signature that makes the tool feel operational, not hobbyist
- Panel overlap elimination (z-index audit, LAYOUT-03) — baseline correctness

**Should have (competitive differentiators — P2, ship in v3.1):**
- Pulsing active indicator on enabled-layer badges (STYLE-02) — `animate-ping` pattern; defer until layout is stable to avoid churn
- Scan-line sweep animation on panel headers — CSS keyframe, purely decorative; defer once layout is locked
- Persistent sidebar section state via localStorage — quality-of-life detail; add once section structure is finalized

**Defer to v3.x+:**
- Draggable/resizable panels — significant complexity, not warranted without user feedback
- Globe-surface radar sweep animation — requires GroundPrimitive per-frame updates; risks frame rate at full scene load
- Per-entity instance custom icons (per airline livery, per vessel flag) — per-entity canvas generation breaks TextureAtlas at scale; never acceptable
- Earthquake layer (LAY-05), Weather radar overlay (LAY-06) — natural v3.1 additions once layer group UI is solid

### Architecture Approach

The v3.0 architecture is additive — no existing system is replaced, only extended. The dominant pattern is the parallel collection strategy: add a new `BillboardCollection` alongside the existing `PointPrimitiveCollection` for each entity layer, set points to `show = false`, and validate before removing the old collection in a separate atomic step. The same entity `id` values are reused on billboards so the unified `LEFT_CLICK` dispatcher in `AircraftLayer.tsx` requires zero changes. A new `CameraControlWidget` component accesses the viewer via `viewerRegistry` (the established pattern from `LandmarkNav`), requiring no prop drilling. Sidebar collapse state moves from local `useState` to a new `sidebarSections` Zustand slice to survive sidebar open/close cycles.

**Major components and their v3.0 roles:**
1. **GlobeView.tsx** — Add `LEFT_DOUBLE_CLICK` handler in `initViewer()`; register alongside existing wheel handler; register in existing `_cleanup` pattern
2. **SatelliteLayer.tsx** — Stays as `PointPrimitiveCollection`; `scaleByDistance` added to point config only; never migrated to billboards
3. **AircraftLayer.tsx / MilitaryAircraftLayer.tsx / ShipLayer.tsx** — Add parallel `BillboardCollection`; hide old points; validate click dispatch before removing points in a second atomic commit
4. **LeftSidebar.tsx** — Restructure to named collapsible sections (LAYERS, FILTERS, SEARCH, VISUAL ENGINE); consolidate bottom layer strip into sidebar body; add radar corner bracket styling
5. **CameraControlWidget.tsx** (new) — Fixed-position overlay at z:82 right side; calls `pitchBy()` / `zoomStep()` from `viewerRegistry`; `pointer-events: none` on container, `pointer-events: auto` on buttons
6. **viewerRegistry.ts** — Add `pitchBy(deltaDeg)` and `zoomStep(factor)` helper functions; follows existing `flyToLandmark` pattern
7. **useAppStore.ts** — Add `sidebarSections` slice with per-section booleans; must be Zustand (not local useState) to persist across sidebar open/close cycles

### Critical Pitfalls

1. **Satellite layer migrated to BillboardCollection** — Keep SatelliteLayer on `PointPrimitiveCollection`. At 5,000+ entities, billboards measurably degrade frame rate on integrated GPU hardware. Points with `pixelSize`, `color`, and `outlineColor` are the correct approach for the satellite layer. This is a hard constraint, not a performance preference.

2. **Both PointPrimitiveCollection and BillboardCollection active simultaneously for the same layer** — Causes doubled draw calls, double-pickable entities, and potential click handler dispatch to wrong panel. Remove the old collection atomically in the same commit that adds the new `BillboardCollection`. Never leave both enabled simultaneously across commits. If parallel comparison is needed during dev, use a local branch only.

3. **LEFT_DOUBLE_CLICK co-fires with LEFT_CLICK (CesiumJS issue #1171)** — CesiumJS fires both `LEFT_CLICK` and `LEFT_DOUBLE_CLICK` on a double-click. Without mitigation, double-clicking to zoom also opens a detail panel for whatever entity is under the cursor. Solution: debounce the `LEFT_CLICK` handler by 200ms; cancel the pending single-click action when a second click arrives. Also remove the built-in `viewer.cesiumWidget.screenSpaceEventHandler` `LEFT_DOUBLE_CLICK` action before registering the custom handler, or both will fire simultaneously.

4. **Dynamic SVG generation per entity exhausts TextureAtlas** — Setting `billboard.image` to a dynamically-generated SVG string on every data refresh accumulates unique TextureAtlas entries until the GPU texture size limit is exceeded (`DeveloperError: Width must be less than or equal to the maximum texture size`). Set `billboard.image` once at creation from a fixed set of pre-rendered canvases (4 types maximum); use `billboard.color` for per-entity tinting thereafter. Never update `billboard.image` post-creation.

5. **CSS height animation triggering layout reflow** — Reading `element.scrollHeight` inside any animation callback forces synchronous layout recalculation on the same thread as CesiumJS's render loop, halving frame rate during animation. Use `grid-template-rows: 0fr → 1fr` CSS transition or `transform: scaleY` instead. Never animate `height`, `max-height`, or `padding` in a component coexisting with a CesiumJS viewer.

---

## Implications for Roadmap

Based on the combined research, the natural phase structure groups work by risk level and regression surface. Each phase can be validated in isolation before proceeding. The ordering principle: CSS/React-only changes first (zero CesiumJS regression risk), then new camera interaction, then entity layer migration from simplest to most complex.

### Phase 1: Radar Styling and Collapsible Sidebar

**Rationale:** Pure CSS and React changes with no CesiumJS primitive or event handler involvement. This is the lowest-risk first step — visual regressions are immediately obvious and easily reverted. Establishing the radar aesthetic early validates the CSS approach before more complex phases add interactive features on top of the styled panels.

**Delivers:** Angular bracket corner decorations on all panels (LeftSidebar, RightDrawer, CinematicHUD, PostProcessPanel), collapsible LAYERS / FILTERS / SEARCH / VISUAL ENGINE sections in LeftSidebar, z-index audit and panel overlap elimination, `sidebarSections` Zustand slice.

**Addresses features:** STYLE-01, LAYOUT-01, LAYOUT-02, LAYOUT-03

**Avoids:** CSS height animation must use `grid-template-rows: 0fr → 1fr`, not `scrollHeight` or `max-height`, to prevent layout reflow degrading CesiumJS frame rate. Radar decorative pseudo-elements must be outside the animated height container to prevent clipping.

**Research flag:** Standard patterns — no phase research needed. CSS accordion and CesiumJS coexistence is well-documented.

---

### Phase 2: Camera Control Widget

**Rationale:** The `CameraControlWidget` is a new leaf component following the established `viewerRegistry` pattern from `LandmarkNav`. It has no dependency on the billboard migration and adds no regression risk to existing entity layers or click handlers. Building it second validates the `pitchBy()` / `zoomStep()` viewerRegistry helpers before they are stress-tested alongside other changes.

**Delivers:** Fixed-position overlay with tilt preset buttons (top-down / 45° / horizon) and zoom +/- buttons, `pitchBy()` and `zoomStep()` added to `viewerRegistry.ts`, positioned at z:82 right side above BottomStatusBar with `pointer-events: none` on container.

**Addresses features:** NAV-02, NAV-03

**Avoids:** Widget container must have `pointer-events: none`; individual buttons `pointer-events: auto` to prevent the container from intercepting globe pan. Position must not overlap layer toggle strip (bottom-left, z:60) or CesiumJS credit attribution (bottom-right corner). CesiumJS pitch convention is 0° = horizon, -90° = nadir — clamp tilt range to [-90°, -5°] to prevent camera going below ellipsoid.

**Research flag:** Standard patterns — no phase research needed.

---

### Phase 3: Double-Click Zoom Toward Cursor

**Rationale:** Modifies `GlobeView.tsx` which owns the viewer lifecycle. This is isolated from all entity layer work. Implementing and validating the double-click handler before billboard migration means the full regression surface (navigation behavior, no entity interaction) is clean and testable independently.

**Delivers:** Custom `LEFT_DOUBLE_CLICK` handler in `GlobeView.tsx initViewer()` using `scene.pickPosition()` + `camera.flyTo()` with 65% altitude reduction per double-click, removal of CesiumJS built-in entity-tracking double-click handler from `viewer.cesiumWidget.screenSpaceEventHandler`, 200ms debounce on existing `LEFT_CLICK` handler.

**Addresses features:** NAV-01

**Avoids:** Built-in `viewer.cesiumWidget.screenSpaceEventHandler` `LEFT_DOUBLE_CLICK` must be removed first (two conflicting camera animations). LEFT_CLICK debounce is mandatory (CesiumJS issue #1171). `scene.pickPosition()` returns `undefined` on sky clicks — guard with `Cesium.defined()`. Floor minimum zoom altitude at 500m to prevent going underground with `EllipsoidTerrainProvider`.

**Research flag:** Core pattern well-documented. The LEFT_CLICK debounce interaction with the existing unified click handler needs hands-on feel validation during execution — flag as a required manual test step.

---

### Phase 4: Custom SVG Billboard Icons — Ships and Military

**Rationale:** Start with the two simplest entity layers — ships and military aircraft — which have no lerp animation loop and no orbit trail. This validates the complete BillboardCollection migration pattern (parallel collections, SVG-to-canvas pre-rendering, pick dispatch, layer visibility, replay interpolation) at low risk before applying the same pattern to the more complex aircraft layer.

**Delivers:** `BillboardCollection` for `ShipLayer.tsx` and `MilitaryAircraftLayer.tsx`, shared SVG icon canvases (ship hull silhouette, military diamond) pre-rendered at layer mount in module-scope constants, `scaleByDistance` with `NearFarScalar` on all ship and military billboards, old `PointPrimitiveCollection` removed atomically after validation.

**Addresses features:** ICONS-03, ICONS-04, ICONS-05 (partial)

**Avoids:** Old `PointPrimitiveCollection` removed in the same commit (never left in parallel). SVG canvases pre-rendered once at layer mount in module-scope variable (not per-entity, not per-render). `billboard.image` set once at creation — never updated on data refresh. `BlendOption.TRANSLUCENT` on both collections. All four entity type click paths verified after migration.

**Research flag:** Standard patterns. Mandatory: validate on representative hardware (integrated GPU) at full entity counts before marking phase complete.

---

### Phase 5: Custom SVG Billboard Icons — Aircraft

**Rationale:** The aircraft layer is the most complex entity layer — it owns the unified `LEFT_CLICK` dispatcher, a requestAnimationFrame lerp animation loop, polyline trail rendering, and replay interpolation. Treating it as a separate phase ensures the validated pattern from Phase 4 is applied deliberately, and the rAF loop billboard position update is tested in isolation.

**Delivers:** `BillboardCollection` for `AircraftLayer.tsx`, aircraft silhouette SVG icon canvas, billboard positions updated in the existing rAF lerp loop alongside now-hidden point positions, unified click dispatcher verified against billboard pick results for all four entity ID schemes (mmsi:, mil:, bare ICAO24, numeric NORAD), old `PointPrimitiveCollection` removed after full validation.

**Addresses features:** ICONS-01 (satellite stays point), ICONS-02, ICONS-05 (aircraft/military/ships complete)

**Avoids:** Unified LEFT_CLICK dispatcher reads `picked.id` — must verify all four entity ID schemes work when picked from a billboard (not just a point). Billboard position must be updated inside the same rAF frame as the lerp calculation to prevent position desync between trail polyline and icon.

**Research flag:** Standard patterns. The rAF lerp loop billboard update path is a worthwhile hands-on test before the full implementation commit.

---

### Phase 6: Pulsing Indicators and Persistent State

**Rationale:** Deferred from Phase 1 intentionally to avoid churn — these are additive CSS and localStorage features that depend on the sidebar section structure being finalized. Adding after all layout work is complete eliminates risk of redoing animation work if section structure changes during phases 1-5.

**Delivers:** `animate-ping` pulsing dot on active layer badges (STYLE-02), scan-line sweep animation on panel headers, `localStorage` persistence of sidebar section open/closed state, confirmation that `tw-animate-css` is registered in `tailwind.config.js` plugins.

**Addresses features:** STYLE-02, persistent section state

**Avoids:** `animate-ping` must only play when layer is active (conditional class application) — not on every panel unconditionally.

**Research flag:** No research needed — standard Tailwind and localStorage patterns.

---

### Phase Ordering Rationale

- Phases 1-3 (CSS, widget, navigation) have no dependency on each other, but all precede billboard migration because they establish the stable UI surface that billboard rendering builds on top of.
- Phases 4-5 (billboard migration) are ordered by layer complexity — simple layers (ships, military with no lerp loop) first, the complex layer (aircraft with its unified click dispatcher and rAF lerp loop) second.
- Phase 6 (polish) is last by design — these are additive features that depend on preceding layout decisions being frozen.
- The satellite layer intentionally receives no billboard migration phase across the entire v3.0 milestone. It stays on `PointPrimitiveCollection`. `scaleByDistance` via `NearFarScalar` is also a supported property on `PointPrimitive` — satellites can receive altitude-proportional sizing without moving to billboards.

### Research Flags

Phases needing careful hands-on validation during execution (not pre-phase research — patterns are known, but edge cases need test coverage):
- **Phase 3:** LEFT_CLICK debounce interaction with the existing unified click dispatcher — verify 200ms delay is imperceptible for normal selection use while correctly suppressing panel open on double-click zoom gestures
- **Phase 5:** AircraftLayer rAF lerp loop — verify billboard position update is in the same frame as point position to prevent visual desync between trail polyline and icon

Phases with entirely standard patterns (no additional research needed):
- **Phase 1:** CSS accordion + CesiumJS coexistence — well-documented
- **Phase 2:** CameraControlWidget viewerRegistry pattern — identical to existing LandmarkNav
- **Phase 4:** BillboardCollection migration for simple layers — fully specified in research files
- **Phase 6:** Tailwind animate-ping + localStorage — trivial

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All APIs verified against official CesiumJS docs; no new libraries required; base stack is production-validated from v1.0/v2.0 |
| Features | HIGH | Clear P1/P2/P3 prioritization; table stakes vs differentiators well-reasoned; competitor analysis (FlightRadar24, Google Earth) confirms feature expectations; anti-features are explicitly documented with rationale |
| Architecture | HIGH | Based on direct codebase analysis of GlobeView.tsx, AircraftLayer.tsx, SatelliteLayer.tsx, useAppStore.ts, viewerRegistry.ts; build order derived from actual file dependency graph |
| Pitfalls | HIGH | 7 critical pitfalls identified with specific CesiumJS GitHub issue references (#1171, #8002, #8196, #10522); all have concrete prevention strategies and verified recovery paths |

**Overall confidence: HIGH**

The only areas of residual uncertainty are empirical rather than knowledge gaps: the exact `NearFarScalar` values for icon scaling need tuning against real continuous zoom tests, and the LEFT_CLICK 200ms debounce needs hands-on feel validation. Neither requires pre-phase research; both are resolved through implementation testing.

### Gaps to Address

- **NearFarScalar scale values require in-browser tuning**: Research provides starting ranges (satellites: `5e5 → 5e7`, aircraft/ships: `1e4 → 5e6`) but the exact `nearValue`/`farValue` ratios must be validated with a continuous zoom test from 20,000 km to 500 m before Phases 4/5 are marked complete. Flag this as a mandatory verification step in phase plans.
- **LEFT_CLICK debounce UX feel**: 200ms is the correct technical value (prevents co-fire per CesiumJS issue #1171) but the perceptible input latency must be confirmed acceptable during Phase 3. If 200ms feels sluggish, 150ms is the minimum safe value on most hardware.
- **tw-animate-css plugin registration**: Confirm `require('tw-animate-css')` is present in `tailwind.config.js` before Phase 1. If missing, add the plugin line — no npm install needed.
- **PointPrimitive.scaleByDistance signature**: The satellite layer stays on `PointPrimitiveCollection` but `scaleByDistance` is also a supported property on `PointPrimitive`. Research confirms this property exists but it was not used in v1.0/v2.0 — verify the exact `PointPrimitive.scaleByDistance` API signature before Phase 4 to confirm satellites can receive altitude scaling without billboard migration.

---

## Sources

### Primary (HIGH confidence)
- [CesiumJS Billboard API](https://cesium.com/learn/cesiumjs/ref-doc/Billboard.html) — `image`, `scaleByDistance`, `color`, `NearFarScalar` properties confirmed
- [CesiumJS BillboardCollection API](https://cesium.com/learn/cesiumjs/ref-doc/BillboardCollection.html) — Primitive API `scene.primitives.add()`, `BlendOption`, TextureAtlas behavior, performance thresholds
- [CesiumJS Camera API](https://cesium.com/learn/cesiumjs/ref-doc/Camera.html) — `flyTo`, `setView`, `zoomIn/zoomOut`, `positionCartographic`, `pitch`, `changed` event
- [CesiumJS ScreenSpaceEventHandler API](https://cesium.com/learn/cesiumjs/ref-doc/ScreenSpaceEventHandler.html) — `setInputAction`, `LEFT_DOUBLE_CLICK` pattern
- [CesiumJS Performance Tips for Points](https://cesium.com/blog/2016/03/02/performance-tips-for-points/) — PointPrimitive vs BillboardCollection benchmarks; billboard performance degradation at scale
- [CesiumJS GitHub issue #1171](https://github.com/CesiumGS/cesium/issues/1171) — LEFT_CLICK fires on LEFT_DOUBLE_CLICK — confirmed platform behavior, not a bug to be fixed
- [CesiumJS GitHub issue #8196](https://github.com/CesiumGS/cesium/issues/8196) — scaleByDistance unexpected jump near NearFarScalar boundary
- [CesiumJS GitHub issue #10522](https://github.com/CesiumGS/cesium/issues/10522) — Billboard.scaleByDistance non-linear interpolation; mitigation: widen near/far range
- [Chrome for Developers — performant expand/collapse animations](https://developer.chrome.com/blog/performant-expand-and-collapse) — grid-template-rows technique
- [CSS-Tricks — performant expand/collapse with grid-template-rows](https://css-tricks.com/building-performant-expand-collapse-animations/) — animation without layout reflow
- [Paul Irish — What forces layout/reflow](https://gist.github.com/paulirish/5d52fb081b3570c81e3a) — scrollHeight forces synchronous reflow confirmation
- Direct codebase analysis: GlobeView.tsx, AircraftLayer.tsx, SatelliteLayer.tsx, ShipLayer.tsx, MilitaryAircraftLayer.tsx, LeftSidebar.tsx, App.tsx, useAppStore.ts, viewerRegistry.ts — authoritative for all integration decisions

### Secondary (MEDIUM confidence)
- [CesiumJS community: SVG billboards broken since 1.43](https://community.cesium.com/t/svg-as-billboards-src-doesnt-work-since-cesium-1-43/6698) — canvas workaround for SVG image assignment confirmed
- [CesiumJS community: Dynamic SVG TextureAtlas overflow](https://community.cesium.com/t/dynamic-svg-billboard-makes-textureatlas-to-exceed-its-maximumtexturesize-limit/4091) — unique-SVG-per-entity failure mode with recovery steps
- [CesiumJS community: zoom in to mouse point](https://community.cesium.com/t/zoom-in-to-mouse-point/2614) — `pickPosition` + `flyTo` pattern for cursor-directed zoom
- [CesiumJS community: remove default double-click](https://blog.webiks.com/remove-default-double-click-behavior-in-cesium/) — `removeInputAction` on `viewer.cesiumWidget.screenSpaceEventHandler`
- [CesiumJS community: Adding 50K billboards causes Cesium to hang](https://groups.google.com/g/cesium-dev/c/O5IN6ge7VbU) — billboard scale limit context
- [CSS radar scan animation (csswolf.com, Feb 2026)](https://csswolf.com/radar-scanner-animation-effect-in-css-no-js/) — pure CSS `@keyframes` conic-gradient for radar sweep
- [CSS interpolate-size browser support (Josh W. Comeau)](https://www.joshwcomeau.com/snippets/html/interpolate-size/) — Chromium-only ~67% global coverage as of March 2026; confirms why this approach is excluded
- [FlightRadar24 3D view](https://www.flightradar24.com/blog/exploring-the-new-flightradar24-3d-view/) — competitor interaction reference for double-click zoom behavior and entity icons

---
*Research completed: 2026-03-12*
*Ready for roadmap: yes*
