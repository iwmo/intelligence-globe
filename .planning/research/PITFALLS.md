# Pitfalls Research

**Domain:** CesiumJS/React geospatial intelligence platform — v3.0 UI Refinement additions to existing Primitive API renderer
**Researched:** 2026-03-12
**Confidence:** HIGH (CesiumJS rendering pipeline, ScreenSpaceEventHandler behavior, CSS animation performance), MEDIUM (billboard selection pick behavior with mixed collection types), LOW (tilt widget z-index conflicts — no authoritative CesiumJS documentation found for custom widget positioning guarantees)

---

## Critical Pitfalls

### Pitfall 1: PointPrimitive-to-Billboard Migration Breaks Existing Unified Click Handler

**What goes wrong:**
The existing `AircraftLayer.tsx` implements a single unified `ScreenSpaceEventHandler` on `LEFT_CLICK` that dispatches across all entity types (satellites, aircraft, military, ships) by inspecting the `picked.id` string prefix (`mmsi:`, `mil:`, bare ICAO24, numeric NORAD). When `PointPrimitiveCollection` entries are replaced with `BillboardCollection` entries, `scene.pick()` returns a different object shape. For `PointPrimitive`, `picked.id` is a bare string or number. For `Billboard`, the same `id` field is returned — but the pick result also includes a `primitive` property pointing to the `Billboard` instance rather than the `PointPrimitive`. Code that pattern-matches on `typeof picked.id === 'number'` for satellites or `picked.id.startsWith('mmsi:')` for ships continues working because billboard `.id` is set identically. However, if any billboard shares an id with any point in a partially-migrated scene (during incremental migration where some layers are points and some are billboards), two primitives with the same `id` value will cause the wrong detail panel to open on click.

The more dangerous failure: if the new `BillboardCollection` is added to `viewer.scene.primitives` but the old `PointPrimitiveCollection` for the same layer is not removed, both will be visible and both will be pickable. A click on a co-located ship position will hit the topmost primitive (billboard), but the old point is still underneath and may be picked during drillPick operations or in edge-case overlay situations.

**Why it happens:**
Billboard migration is done incrementally — one layer at a time. The old collection is not immediately removed because developers want a visual comparison. The unified handler in `AircraftLayer.tsx` was written to handle point-only primitives and is not tested against mixed collections.

**How to avoid:**
- Remove the `PointPrimitiveCollection` from `viewer.scene.primitives` in the same effect that adds the `BillboardCollection`. Never let both exist simultaneously for the same layer.
- After adding billboard support, verify the unified click handler in `AircraftLayer.tsx` against all four id schemes (`mmsi:`, `mil:`, bare ICAO24, numeric NORAD) using billboards — not just points.
- Use the existing id-prefix convention unchanged. Billboard `.id` should be set to exactly the same string as the point `.id` it replaces.
- Add a guard: if `collectionRef.current instanceof PointPrimitiveCollection`, destroy it before creating `BillboardCollection`. Do not store both in the same ref.

**Warning signs:**
- Clicking an aircraft opens a ship detail panel, or vice versa.
- Clicking an entity opens no panel despite the click landing visibly on an icon.
- `viewer.scene.primitives.length` unexpectedly doubles after the migration step.
- Two icons are visible at the same lat/lon for the same entity during the transition.

**Phase to address:** Custom SVG Billboard Icons (ICONS-01 through ICONS-04). Each layer migration must be a single atomic commit that removes the old collection and adds the new one. Migration must not be left in a "both exist" state across commits.

---

### Pitfall 2: BillboardCollection Texture Atlas Exceeds GPU Limit When SVG Images Are Unique Per Entity

**What goes wrong:**
CesiumJS `BillboardCollection` maintains a single shared `TextureAtlas` that packs all billboard images into one GPU texture. The atlas grows as unique images are added. If each billboard uses a different SVG (e.g., SVGs that embed the aircraft callsign as text, or SVGs that change color per entity), the atlas accumulates one unique entry per entity and never reclaims space for removed billboards. With 5,000+ satellites or 2,000+ ships, the atlas exceeds the maximum texture size (16,384 pixels wide on most WebGL implementations) and CesiumJS throws `DeveloperError: Width must be less than or equal to the maximum texture size`, causing all billboards to stop rendering.

Even with a fixed set of 4 icon types (satellite, aircraft, military, ship), if SVG strings are generated dynamically per entity (e.g., `billboard.image = buildSvg(entity.callsign)` called on every data refresh), the atlas accumulates new entries on every update cycle because the image URL or data URI string is treated as a new unique entry on each refresh.

**Why it happens:**
Developers write per-entity SVG generation thinking it provides rich entity-specific icons. The TextureAtlas caches by image identifier (the string passed to `billboard.image`). A new string = a new atlas entry, even if the rendered SVG looks identical to a previous one.

**How to avoid:**
- Use a small, fixed set of icon types (4 icons maximum: satellite, aircraft, military, ship). Pre-load these as named image IDs before adding any billboards. Do not generate per-entity SVG strings.
- Set `billboard.image` once at creation time to a stable URL or data URI (e.g., `'icons/satellite.svg'`). Never update `billboard.image` on data refresh — only update `billboard.position`, `billboard.show`, and `billboard.scale`.
- If icon states differ (selected vs. unselected), use `billboard.color` tinting with a fixed base image rather than switching to a different image.
- Use `billboard.id` for identity, not `billboard.image`. The image must be stable.
- If icon variants are unavoidable, pre-register all variants with `billboardCollection._textureAtlas` before adding any billboards.

**Warning signs:**
- `DeveloperError: Width must be less than or equal to the maximum texture size` in the browser console.
- Memory usage growing continuously as the app runs.
- `billboard.image` is being set in any code path that runs more than once per billboard lifetime.
- SVG string construction in a data-refresh `useEffect`.

**Phase to address:** Custom SVG Billboard Icons (ICONS-01 through ICONS-04). Icon design must be finalized as a static set before implementation starts. No per-entity SVG generation.

---

### Pitfall 3: Double-Click Zoom Fires the Existing LEFT_CLICK Entity Selection Handler

**What goes wrong:**
CesiumJS fires both `LEFT_CLICK` and `LEFT_DOUBLE_CLICK` events when a user double-clicks. The existing unified click handler in `AircraftLayer.tsx` is registered on `ScreenSpaceEventType.LEFT_CLICK`. When the user double-clicks to trigger the new "zoom toward cursor" behavior (NAV-01), the `LEFT_CLICK` handler fires first (selecting whatever entity is under the cursor), then `LEFT_DOUBLE_CLICK` fires for the zoom action. The result: double-clicking the globe to zoom also opens a ship/aircraft/satellite detail panel for whatever is under the cursor.

This is a confirmed CesiumJS behavior documented in GitHub issue #1171. It is not a bug that will be fixed — it is an intentional design where double-click is composed of two single clicks at the platform event level.

Additionally, CesiumJS has a built-in default `LEFT_DOUBLE_CLICK` handler registered on `viewer.cesiumWidget.screenSpaceEventHandler` that calls `viewer.zoomTo()` on the picked entity if one exists. If a custom `LEFT_DOUBLE_CLICK` handler is added to a separate `ScreenSpaceEventHandler`, both will fire — the custom zoom and the built-in entity-tracking zoom. The camera will animate in two conflicting directions.

**Why it happens:**
CesiumJS `ScreenSpaceEventHandler.setInputAction` can only register one handler per event type per handler instance. Developers create a second handler for `LEFT_DOUBLE_CLICK` without removing the built-in one on `viewer.cesiumWidget.screenSpaceEventHandler`. The LEFT_CLICK/LEFT_DOUBLE_CLICK co-firing is a platform-level behavior that persists regardless of how many handlers are added.

**How to avoid:**
- Remove the built-in double-click handler before adding a custom one:
  `viewer.cesiumWidget.screenSpaceEventHandler.removeInputAction(ScreenSpaceEventType.LEFT_DOUBLE_CLICK);`
- To prevent LEFT_CLICK from firing during a double-click: implement a debounce/delay on the LEFT_CLICK handler. A 200–250ms delay before acting on a single click is long enough to detect if a second click arrives (converting to double-click). If a second click arrives within the delay, cancel the single-click action.
- Alternatively, track a `lastClickTime` timestamp in a ref and skip single-click action if it was within 250ms of the previous click.
- The debounce introduces a 200ms single-click latency — acceptable for entity selection (selection is not time-critical), unacceptable for rapid rapid successive selections. Choose the tradeoff explicitly.

**Warning signs:**
- Double-clicking the globe zooms in but also opens a detail panel.
- Double-clicking near an entity triggers both zoom and panel open.
- Camera zooms to entity and camera zooms toward cursor both animate simultaneously.
- `viewer.cesiumWidget.screenSpaceEventHandler` has an active `LEFT_DOUBLE_CLICK` action alongside a custom handler.

**Phase to address:** Double-Click Zoom (NAV-01). The LEFT_CLICK debounce and the removal of the built-in double-click handler must be implemented as a single unit. Do not add LEFT_DOUBLE_CLICK without addressing the co-fire.

---

### Pitfall 4: Billboard scaleByDistance NearFarScalar Causes Visible Size Jump at Altitude Boundaries

**What goes wrong:**
CesiumJS `Billboard.scaleByDistance` accepts a `NearFarScalar(nearDistance, nearValue, farDistance, farValue)`. The billboard scale is clamped to `nearValue` for distances below `nearDistance` and clamped to `farValue` for distances above `farDistance`. When the camera altitude crosses either boundary during continuous zoom, the billboard scale snaps discontinuously — a visible "pop" in icon size rather than a smooth transition. This is documented in GitHub issue #8196 and #10522; the interpolation is not linear, and the clamping behavior at boundaries is abrupt.

With 5,000+ satellites all using the same `scaleByDistance`, every entity simultaneously pops at the same altitude. The visual effect is a whole-scene size flash that appears broken to the user.

**Why it happens:**
The `NearFarScalar` near/far boundaries are set as absolute camera distances in meters. Developers set these based on intuition or small test scenes without testing continuous zoom from 20,000 km (full globe) down to 500 km (regional). The abrupt clamp is not visible in sandcastle demos that don't zoom continuously.

**How to avoid:**
- Set `nearDistance` and `farDistance` to span the full practical altitude range in one smooth region (e.g., `nearDistance: 1e5` at 100 km, `farDistance: 2e7` at 20,000 km). Avoid a narrow transition band that the camera crosses quickly during normal zoom gestures.
- Use `nearValue` and `farValue` that are close in ratio (e.g., `1.0` to `0.3`) rather than extreme ranges (e.g., `2.0` to `0.05`) to minimize the visual impact when boundaries are crossed.
- As an alternative, compute scale as a JavaScript function in the per-frame loop using `viewer.camera.positionCartographic.height` rather than relying on the built-in `scaleByDistance`. This gives full control over the interpolation curve and eliminates clamping artifacts.
- Test zoom from maximum globe altitude (20,000 km) to minimum street-level altitude (500 m) in a single continuous gesture before finalizing scale parameters.

**Warning signs:**
- Visible "pop" or flash when zooming through specific altitude thresholds.
- All icons simultaneously resize instead of gradually changing.
- `nearDistance` and `farDistance` span less than one order of magnitude in camera altitude.
- `scaleByDistance` using extreme ratio between near and far values.

**Phase to address:** Entity Icon Altitude Scaling (ICONS-05). Scale parameters must be validated against continuous zoom tests before the phase is marked complete.

---

### Pitfall 5: CSS Height Animation on Sidebar Sections Triggers Layout Reflow Every Frame

**What goes wrong:**
The planned collapsible sidebar sections (LAYOUT-01) need expand/collapse animation. The intuitive implementation is transitioning `height` from `0` to `auto` with CSS `transition: height 300ms ease`. This does not work: CSS cannot interpolate to `height: auto` — the element snaps to full height immediately with no animation. The common workaround is transitioning `max-height` from `0` to an estimated maximum value (e.g., `max-height: 0` to `max-height: 500px`). This does animate, but animates at an irregular rate because the visible content height changes quickly while the `max-height` changes slowly at first (the easing starts from 0, not from the content height), creating a "curtain delay" before the content appears.

The alternative of animating `height` with a JavaScript-calculated pixel value (reading `scrollHeight` on each frame) causes forced synchronous layout reflow every animation frame. `element.scrollHeight` forces the browser to recalculate layout before returning a value. If called inside a `requestAnimationFrame` loop alongside CesiumJS's own render loop, this creates two forced layouts per frame, cutting frame rate in half (30 FPS from 60 FPS) for the duration of the animation.

**Why it happens:**
Developers use `element.scrollHeight` because it solves the `height: auto` problem. The layout reflow cost is invisible in small apps without a heavy concurrent render loop, but becomes critical when CesiumJS is rendering 5,000+ primitives at 60 FPS on the same thread.

**How to avoid:**
- Use CSS `grid-template-rows` transition: animate from `grid-template-rows: 0fr` to `grid-template-rows: 1fr`. The grid item's overflow is hidden when `0fr` and natural when `1fr`. This is hardware-accelerated and does not trigger layout reflow.
- Alternatively, animate `transform: scaleY(0)` to `transform: scaleY(1)` on the container with a counter-scale on the content to prevent content compression. Only `transform` and `opacity` are guaranteed compositor-only (no layout, no paint).
- Do not read `scrollHeight` or any layout property inside any animation loop.
- Avoid animating `height`, `max-height`, `width`, `padding`, or `margin` — all trigger layout.

**Warning signs:**
- `element.scrollHeight` read inside a `requestAnimationFrame` callback or `useEffect` with animation dependency.
- `max-height` transitioning between `0` and a large pixel value.
- Frame rate drops to 30 FPS during sidebar open/close animation.
- Layout thrashing visible in Chrome DevTools Performance panel (purple "Recalculate Style" blocks during animation).

**Phase to address:** Collapsible Sidebar Sections (LAYOUT-01). Animation implementation must be reviewed for layout property transitions before the phase is merged.

---

### Pitfall 6: Tilt Control Widget Overlaps Bottom-Left Layer Toggle Strip

**What goes wrong:**
The existing `LeftSidebar.tsx` places a persistent layer toggle strip at `position: fixed; bottom: 40px; left: 12px` with `zIndex: 60`. The planned tilt/pitch control widget and on-screen zoom buttons (NAV-02, NAV-03) are natural candidates for placement in the bottom-right corner. However, the `BottomStatusBar.tsx` component occupies the bottom of the screen. If the tilt widget is placed at `bottom: 40px; right: 12px`, it will be visually clear. But if it is instead placed in the bottom-left area (to be near zoom controls), it will overlap the layer toggle strip.

The deeper pitfall: CesiumJS renders its own UI elements (the credit display) in the bottom-right corner of the canvas container. Custom React widgets placed at `bottom: 0; right: 0` will overlap the CesiumJS credit attribution text, creating a legal/ToS issue with ESRI World Imagery attribution.

Additionally, the `CinematicHUD.tsx` and `PostProcessPanel.tsx` use absolute/fixed positioning throughout. Adding a tilt widget to the DOM without auditing all existing `zIndex` values risks the widget appearing behind other panels.

**Why it happens:**
Each component in the existing codebase uses independent `zIndex` values (60, 75, 85, etc.) without a shared z-index scale. A new widget added without consulting the full layout will use an arbitrary z-index that may render behind or in front of unintended elements.

**How to avoid:**
- Before placing the tilt widget, document all existing fixed-position elements and their z-index values. This project currently uses: layer toggles (60), sidebar panel (50), hamburger button (85), HUD elements (various). Use a higher z-index than 85 only if the tilt widget must appear above the sidebar.
- Place navigation controls (tilt/zoom) in the bottom-right, not bottom-left, to avoid the layer toggle strip.
- Preserve a minimum 32px margin above the bottom status bar and a minimum 64px clearance from the CesiumJS credit display (bottom-right).
- Apply `pointer-events: none` to the widget container element, `pointer-events: auto` to individual buttons only. This prevents the widget frame from intercepting globe clicks in unused areas.

**Warning signs:**
- Tilt widget visually overlapping the layer toggle strip.
- CesiumJS credit attribution text obscured.
- Globe pan stops working in the region where the widget container is positioned (pointer-events not set to none on container).
- Widget appears behind the sidebar panel when the sidebar is open.

**Phase to address:** Tilt Widget and Zoom Buttons (NAV-02, NAV-03). Layout audit of existing fixed-position elements must precede widget placement decisions.

---

### Pitfall 7: BillboardCollection Performance Is Significantly Worse Than PointPrimitiveCollection for 5000+ Entities

**What goes wrong:**
The v1.0 decision to use `PointPrimitiveCollection` over the Entity API was validated at 5,000+ entities. Billboards are not equivalent in performance to points. CesiumJS documentation explicitly states: "For best performance at scale, prefer PointPrimitive over Billboard when only a colored dot is needed." The difference is material: billboards require texture sampling per fragment during rendering; points are rendered as hardware-accelerated GL_POINTS with a single color uniform. At 5,000 entities, the satellite layer currently achieves 60 FPS with `PointPrimitiveCollection` and `BlendOption.OPAQUE`. Replacing all 5,000 satellite points with billboards — even small SVG icons — will increase fragment shader workload and potentially drop below 60 FPS on the target homelab GPU.

The community has documented cases where 50,000 billboards cause Cesium to hang during rendering. At 5,000 entities the risk is lower but real, especially when multiple billboard collections (satellites + aircraft + military + ships) are active simultaneously.

**Why it happens:**
The requirement is "custom SVG icons for all entity types," which developers read as "replace all points with billboards." The performance regression is not visible during development with small test datasets or on high-end workstations.

**How to avoid:**
- Do not migrate the satellite layer (`SatelliteLayer.tsx`) from points to billboards. With 5,000+ satellites, the point renderer is the correct choice. The satellite visual can be improved with `pixelSize`, `color`, `outlineColor`, and `outlineWidth` — all supported by `PointPrimitive` without moving to `BillboardCollection`.
- Migrate only the lower-count layers to billboards: aircraft (hundreds), military (dozens to hundreds), ships (hundreds in typical AIS window). These have entity counts where billboard overhead is acceptable.
- Set `blendOption: BlendOption.TRANSLUCENT` on billboard collections because SVG icons with transparent backgrounds require alpha blending. Do not set `OPAQUE` — this causes alpha channel areas to render as opaque black or white.
- After migration, run a frame rate comparison with all layers enabled at full entity counts. Target: 60 FPS on a machine with integrated GPU.

**Warning signs:**
- Frame rate drops below 50 FPS when the satellite layer is visible with billboard icons.
- `BillboardCollection` created for the satellite layer with 5,000+ entries.
- `BlendOption.OPAQUE` set on a billboard collection using SVG icons with transparent areas (produces opaque black fill where transparency is expected).
- Performance test run only on developer's high-end workstation, not on target homelab hardware.

**Phase to address:** Custom SVG Billboard Icons (ICONS-01 through ICONS-04). Satellite layer must explicitly remain `PointPrimitiveCollection`. Performance must be validated on representative hardware before any billboard collection is marked complete.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Per-entity SVG generation (embedding callsign, color in SVG string) | Rich, unique icons per entity | TextureAtlas accumulates one entry per unique SVG string; atlas hits GPU texture size limit; all billboards crash | Never — use a fixed icon set with `billboard.color` tinting for variants |
| Leaving both PointPrimitiveCollection and BillboardCollection for the same layer during migration | Visual comparison during dev | Two pickable primitives per entity; click handler selects wrong entity; frame rate regression | Never — remove the old collection atomically when adding the new one |
| Using `max-height` transition for sidebar collapse animation | Works visually, easy to implement | Easing curve is relative to max-height, not content height; the visible delay before content appears feels broken | Only as a temporary placeholder; replace with grid-row or transform before shipping |
| Registering LEFT_DOUBLE_CLICK without removing the built-in CesiumJS double-click handler | Avoids touching `viewer.cesiumWidget` internals | Built-in and custom handlers both fire; camera zooms in two conflicting directions simultaneously | Never — always remove `viewer.cesiumWidget.screenSpaceEventHandler`'s `LEFT_DOUBLE_CLICK` first |
| Migrating satellite layer to billboards to match the other layers | Uniform code pattern | Frame rate regression at 5,000+ satellites; billboards are slower than points per fragment | Never — satellite layer stays as PointPrimitiveCollection |
| Using `element.scrollHeight` in a rAF loop for height animation | Solves `height: auto` transition | Forces synchronous layout reflow every frame; halves frame rate during animation on a CesiumJS page | Never — use `grid-template-rows` or `transform: scaleY` instead |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| CesiumJS ScreenSpaceEventHandler | Adding LEFT_DOUBLE_CLICK on a new handler while built-in handler on `viewer.cesiumWidget.screenSpaceEventHandler` still active | Remove built-in: `viewer.cesiumWidget.screenSpaceEventHandler.removeInputAction(ScreenSpaceEventType.LEFT_DOUBLE_CLICK)` before adding custom |
| CesiumJS ScreenSpaceEventHandler | Registering two handlers for LEFT_CLICK (existing unified handler + new double-click debounce) | `setInputAction` replaces the previous action on the same handler instance; use a single handler instance that routes all click types |
| CesiumJS BillboardCollection | Setting `billboard.image` to a dynamically generated SVG string on every data refresh | Set `billboard.image` once at creation; use `billboard.color` for per-entity tinting; never update the image after creation |
| CesiumJS camera.zoomIn/zoomOut | Calling `camera.zoomIn(amount)` for double-click zoom toward cursor — this zooms toward the camera center, not the cursor | Pick the globe surface at cursor position using `scene.globe.pick` or `camera.pickEllipsoid`, then use `camera.flyTo` with the picked position as destination |
| React + CesiumJS z-index | Adding fixed-position React widgets without auditing existing z-index values | Document all z-index values before adding any new widget; use a shared constants file for z-index values |
| CesiumJS BlendOption on BillboardCollection | Using `BlendOption.OPAQUE` for SVG icons with transparent backgrounds | SVG billboards require `BlendOption.TRANSLUCENT`; OPAQUE renders transparent areas as solid opaque color |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Satellite layer migrated to BillboardCollection | Frame rate drops from 60 to 30–40 FPS at full satellite count | Keep SatelliteLayer on PointPrimitiveCollection; only migrate aircraft/military/ship | At 3,000+ billboard entities on integrated GPU |
| Unique SVG per entity accumulating in TextureAtlas | `DeveloperError: Width must be less than or equal to maximum texture size`; all billboards disappear | Use fixed icon set; never set `billboard.image` post-creation | After ~1,000 unique SVG strings (exact limit depends on SVG pixel dimensions) |
| `element.scrollHeight` read during animation loop | Frame rate drops 40–50% during sidebar animate; CesiumJS frame budget exceeded | Use `grid-template-rows: 0fr → 1fr` or `transform: scaleY` for collapse | Immediately — any `scrollHeight` read in rAF is a reflow |
| Mixed PointPrimitive and Billboard collections for same layer | Doubled draw calls; entity picked at wrong type | Remove old collection before adding new one atomically | Immediately on any layer with both collection types active |
| LEFT_DOUBLE_CLICK + LEFT_CLICK both firing on double-click | Entity panel opens on zoom gesture; detail panels open unexpectedly | Debounce LEFT_CLICK handler (200ms delay); remove built-in double-click entity-track handler | Every double-click if not addressed |
| Tilt widget container without `pointer-events: none` | Globe pan stops working in widget area even between buttons | Set `pointer-events: none` on container div; `pointer-events: auto` on buttons only | Immediately in any region the container element occupies |

---

## Security Mistakes

No new security surface is introduced by UI Refinement features (no new external API calls, no new auth patterns, no new data stored). The existing security model from v2.0 applies. No new entries required.

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Double-click zoom opens detail panel AND zooms | User tries to zoom in, accidentally selects an entity they didn't intend to inspect | Debounce single-click by 200ms; on double-click cancel the pending single-click action before acting |
| Sidebar collapse animation using `max-height` with large value | Content appears to fade in from the bottom up with a delay, then snap to full height | Use `grid-template-rows: 0fr → 1fr` which animates relative to actual content height |
| All sidebar sections expanded by default after adding collapsible sections | Sidebar is taller than the screen; sections scroll off; user can't see filters | Default sections to collapsed except the most commonly used one (Search); persist collapse state to localStorage |
| Billboard icon size too large at high zoom levels | Icons overlap neighboring entities at city scale; impossible to click specific entity | Validate `scaleByDistance` parameters at street-level altitude (< 50 km) as well as global altitude |
| Billboard icon size too small at low zoom levels (global view) | Icons are smaller than 2px and invisible; pointless to show; confuses users who expect to see aircraft | Set `minification_filter` or use `translucencyByDistance` to hide entities below a minimum visible threshold rather than rendering sub-pixel icons |
| Tilt widget allows pitching to below-horizon camera angles | Globe disappears from view; scene shows only the underside of the terrain; disorienting | Clamp pitch control to the range `[0°, 85°]` — never allow a camera pitch that would result in looking upward from below the ellipsoid |
| Radar aesthetic brackets and decorations added with CSS `::before`/`::after` on panels | These elements are positioned relative to the panel and move/clip during collapse animation | Apply decorative elements as non-collapsing wrappers outside the animated content element to prevent clipping |

---

## "Looks Done But Isn't" Checklist

- [ ] **Billboard migration:** Icons appear on the globe — verify the old `PointPrimitiveCollection` for that layer has been removed from `viewer.scene.primitives` and its reference cleared.
- [ ] **Billboard click selection:** Clicking a billboard icon opens the correct detail panel — verify all four entity types (satellite, aircraft, military, ship) are still selectable via the unified click handler after migration.
- [ ] **Billboard icon image stability:** Icons display correctly — verify `billboard.image` is never updated in any `useEffect` that runs on data refresh (only position, show, and scale should update after creation).
- [ ] **Double-click zoom:** Camera zooms toward cursor on double-click — verify that the built-in `viewer.cesiumWidget.screenSpaceEventHandler` `LEFT_DOUBLE_CLICK` action has been removed.
- [ ] **Double-click zoom:** Camera zooms toward cursor — verify the zoom destination is the globe surface point under the cursor, not the camera center (use `scene.globe.pick` or `camera.pickEllipsoid` for the destination).
- [ ] **Single-click after double-click:** Double-clicking does not open a detail panel — verify the LEFT_CLICK debounce cancels the pending single-click action when a second click arrives within 250ms.
- [ ] **Sidebar collapse animation:** Sections animate smoothly — verify no `scrollHeight` read inside any animation callback; verify `grid-template-rows` or `transform: scaleY` is the animation mechanism.
- [ ] **Sidebar collapse animation:** Frame rate remains 60 FPS during open/close — profile in Chrome DevTools with the full scene loaded; assert no layout reflow in the Performance trace during animation.
- [ ] **Icon altitude scaling:** Icons scale smoothly — zoom continuously from 20,000 km to 500 m altitude and verify no visible size pop at any altitude boundary.
- [ ] **Tilt widget placement:** Widget is visible and clickable — verify the widget container has `pointer-events: none` and globe pan works in the region the widget occupies.
- [ ] **Tilt widget placement:** Widget does not overlap the layer toggle strip (bottom-left, z-index 60) or CesiumJS credit display (bottom-right).
- [ ] **Radar aesthetic decorations:** Angular brackets and scan decorations do not clip during panel collapse animation — verify decorative pseudo-elements are not children of the animated height container.
- [ ] **Performance with all billboard layers active:** Frame rate is 60 FPS with satellites (points), aircraft (billboards), military (billboards), and ships (billboards) all visible simultaneously — test on integrated GPU hardware.

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Old PointPrimitiveCollection not removed after billboard migration | LOW | `viewer.scene.primitives.remove(oldCollection)` from browser console; refactor affected layer to remove in same effect that adds billboard collection |
| TextureAtlas overflow from dynamic SVG generation | MEDIUM | Replace per-entity SVG with fixed icon set; recreate `BillboardCollection` (required to reset the atlas — it cannot be cleared in-place); reload page |
| Double-click fires both zoom and entity selection | LOW | Add 200ms debounce to LEFT_CLICK handler; remove built-in LEFT_DOUBLE_CLICK from `viewer.cesiumWidget.screenSpaceEventHandler` |
| Sidebar animation causing layout reflow + frame drop | LOW | Replace `scrollHeight`-based or `max-height`-based animation with `grid-template-rows: 0fr → 1fr` transition |
| Icon size pop at altitude boundary | LOW | Widen the NearFarScalar transition range to span two orders of magnitude in altitude; re-test continuous zoom |
| Tilt widget blocking globe interaction | LOW | Add `pointer-events: none` to widget container element; re-test globe pan in all screen regions |
| Billboard performance regression on satellite layer | MEDIUM | Revert satellite layer to `PointPrimitiveCollection`; satellite points do not need icon shapes — color + outline is sufficient |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Billboard migration breaks unified click handler | ICONS-01 to ICONS-04 (each layer) | After each layer migration: click-test all four entity types open correct panels |
| TextureAtlas overflow from unique SVG per entity | ICONS-01 (icon design finalization) | Run for 30 minutes with all billboard layers active; assert no DeveloperError in console |
| Double-click fires LEFT_CLICK handler | NAV-01 (Double-click zoom) | Double-click globe 10 times; assert zero detail panels open during zoom gestures |
| Built-in CesiumJS double-click entity-track conflict | NAV-01 (Double-click zoom) | Verify `viewer.cesiumWidget.screenSpaceEventHandler` has no `LEFT_DOUBLE_CLICK` action after implementation |
| scaleByDistance altitude boundary pop | ICONS-05 (altitude scaling) | Continuous zoom test from 20,000 km to 500 m; assert no visible size flash |
| CSS height animation reflow | LAYOUT-01 (collapsible sidebar) | Chrome DevTools Performance trace during open/close; assert no layout recalculation in rAF |
| Tilt widget overlapping existing UI | NAV-02/NAV-03 (tilt widget, zoom buttons) | Visual audit with sidebar open; verify layer toggles and globe pan are unobstructed |
| Satellite billboard performance regression | ICONS-01 to ICONS-04 | Frame rate test with all layers at full entity count on integrated GPU; assert 60 FPS |
| BlendOption.OPAQUE on SVG billboards | ICONS-01 to ICONS-04 | Visual check for opaque black fill where icon transparency is expected |

---

## Sources

- [CesiumJS ScreenSpaceEventHandler documentation — setInputAction replaces previous](https://cesium.com/learn/cesiumjs/ref-doc/ScreenSpaceEventHandler.html) — HIGH confidence
- [CesiumJS GitHub issue #1171 — double click generates click (LEFT_CLICK fires on LEFT_DOUBLE_CLICK)](https://github.com/CesiumGS/cesium/issues/1171) — HIGH confidence
- [CesiumJS community — how to register multiple handlers for same ScreenSpaceEventHandler](https://community.cesium.com/t/how-to-register-multiple-handlers-for-same-screenspaceeventhandler/4967) — HIGH confidence
- [CesiumJS community — remove default double click behavior](https://blog.webiks.com/remove-default-double-click-behavior-in-cesium/) — HIGH confidence
- [CesiumJS community — disable camera zooming on double-click entity](https://community.cesium.com/t/how-to-disable-camera-zooming-when-double-click-on-an-entity/2859) — HIGH confidence
- [CesiumJS GitHub issue #8196 — scaleByDistance unexpected jump near edge of NearFarScalar range](https://github.com/CesiumGS/cesium/issues/8196) — HIGH confidence
- [CesiumJS GitHub issue #10522 — Billboard.scaleByDistance does not scale linearly](https://github.com/CesiumGS/cesium/issues/10522) — HIGH confidence
- [CesiumJS community — Dynamic SVG Billboard makes TextureAtlas exceed maximumTextureSize](https://community.cesium.com/t/dynamic-svg-billboard-makes-textureatlas-to-exceed-its-maximumtexturesize-limit/4091) — HIGH confidence
- [CesiumJS community — Dynamically updating Billboard textures memory leak](https://community.cesium.com/t/dynamically-updating-billboard-textures-memory-leak/1674) — HIGH confidence
- [CesiumJS Performance Tips for Visualizing Lots of Points — points vs billboards at scale](https://cesium.com/blog/2016/03/02/performance-tips-for-points/) — HIGH confidence
- [CesiumJS community — Adding 50,000 Billboards causes Cesium to hang](https://groups.google.com/g/cesium-dev/c/O5IN6ge7VbU) — MEDIUM confidence
- [CesiumJS BillboardCollection documentation — BlendOption performance impact](https://cesium.com/learn/cesiumjs/ref-doc/BillboardCollection.html) — HIGH confidence
- [Chrome for Developers — Building performant expand/collapse animations](https://developer.chrome.com/blog/performant-expand-and-collapse) — HIGH confidence
- [web.dev — Avoid large, complex layouts and layout thrashing](https://web.dev/articles/avoid-large-complex-layouts-and-layout-thrashing) — HIGH confidence
- [CSS-Tricks — Building performant expand/collapse animations (grid-template-rows technique)](https://css-tricks.com/building-performant-expand-collapse-animations/) — HIGH confidence
- [Paul Irish — What forces layout/reflow (scrollHeight reference)](https://gist.github.com/paulirish/5d52fb081b3570c81e3a) — HIGH confidence
- [CesiumJS community — zoom in to mouse point (pickEllipsoid pattern)](https://community.cesium.com/t/zoom-in-to-mouse-point/2614) — MEDIUM confidence

---
*Pitfalls research for: CesiumJS/React geospatial intelligence platform — v3.0 UI Refinement additions to existing Primitive API renderer*
*Researched: 2026-03-12*
