# Phase 15: Camera Navigation Controls - Research

**Researched:** 2026-03-13
**Domain:** CesiumJS camera API, ScreenSpaceEventHandler, React widget composition
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| NAV-01 | Double-clicking the globe zooms the camera smoothly toward the clicked point | CesiumJS LEFT_DOUBLE_CLICK + scene.pickPosition + camera.flyTo — documented below |
| NAV-02 | Tilt/pitch control widget visible on globe with Top-down / 45° Oblique / Horizon presets | camera.setView with orientation.pitch in radians — documented below |
| NAV-03 | On-screen +/− zoom buttons as alternative to scroll wheel | camera.zoomIn / camera.zoomOut with altitude-proportional step — same pattern already used in GlobeView.tsx wheel handler |
</phase_requirements>

---

## Summary

Phase 15 adds three camera navigation features to the existing CesiumJS globe. The codebase already has the core infrastructure in place: `viewerRegistry.ts` exposes the viewer globally, `GlobeView.tsx` already implements altitude-proportional zoom via a wheel handler, and `AircraftLayer.tsx` already owns a `ScreenSpaceEventHandler` for `LEFT_CLICK`. The challenge is integrating double-click zoom without conflicting with the existing unified click handler, and placing on-screen controls that don't overlap existing fixed-position UI elements.

The critical pitfall is documented directly in `STATE.md`: CesiumJS fires both `LEFT_CLICK` and `LEFT_DOUBLE_CLICK` on a double-click gesture (issue #1171). The solution already decided upon is: (1) remove CesiumJS's built-in entity-tracking `LEFT_DOUBLE_CLICK` handler via `viewer.cesiumWidget.screenSpaceEventHandler.removeInputAction`, (2) register a custom `LEFT_DOUBLE_CLICK` handler, and (3) apply a 200 ms debounce to the existing `LEFT_CLICK` handler so entity panels do not open on zoom gestures. The debounce belongs on the `LEFT_CLICK` callback inside `AircraftLayer.tsx` — that is the only place that owns the unified click handler.

The tilt widget and zoom buttons are pure React components: they call helpers added to `viewerRegistry.ts` (`pitchBy` / `zoomStep`) and are positioned as a fixed overlay, matching the visual style of existing panels (monospace, `rgba(0,212,255,...)` palette, dark backgrounds). Because the widget must always be available (like `CinematicHUD` and `LandmarkNav`), it should be rendered unconditionally in `App.tsx`, not gated by `cleanUI`.

**Primary recommendation:** Add `pitchBy` and `zoomStep` helpers to `viewerRegistry.ts`; register `LEFT_DOUBLE_CLICK` via the widget's own `useEffect` (not inside `AircraftLayer.tsx`) to keep concerns separated; debounce the `LEFT_CLICK` inside `AircraftLayer.tsx`; render `CameraControlWidget` unconditionally in `App.tsx`.

---

## Standard Stack

### Core (all already installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| cesium | ^1.139.1 | Camera API, ScreenSpaceEventHandler, ScreenSpaceEventType | Already the globe renderer — no alternative |
| react | ^19.2.0 | Widget component | Project-wide UI framework |
| lucide-react | ^0.577.0 | Optional icons (+/−, compass) for buttons | Already used in LeftSidebar layer buttons |

### No new npm installs required.

---

## Architecture Patterns

### Recommended Project Structure

```
frontend/src/
├── lib/
│   └── viewerRegistry.ts        # ADD: pitchBy(), zoomStep() helpers
├── components/
│   ├── CameraControlWidget.tsx  # NEW: zoom +/− and tilt preset buttons
│   └── GlobeView.tsx            # MODIFY: register LEFT_DOUBLE_CLICK handler
│   └── AircraftLayer.tsx        # MODIFY: debounce LEFT_CLICK callback 200ms
└── App.tsx                      # MODIFY: render <CameraControlWidget viewer={cesiumViewer} />
```

### Pattern 1: Altitude-Proportional Zoom (already established in GlobeView.tsx)

**What:** Zoom amount scales with current camera altitude so one action always feels consistent regardless of view level.
**When to use:** For all zoom actions — wheel, button, or double-click.
**Example (from existing GlobeView.tsx wheel handler):**
```typescript
// Source: /frontend/src/components/GlobeView.tsx lines 80-88
const altitude = v.camera.positionCartographic.height;
const zoomStep = altitude * 0.12;
if (e.deltaY > 0) v.camera.zoomOut(zoomStep);
else v.camera.zoomIn(zoomStep);
```

The same factor (`0.12`) should be used for button zoom to maintain consistency. Buttons can use a slightly larger factor (e.g., `0.3`) for a more deliberate step.

### Pattern 2: Double-Click Zoom Toward Cursor Point

**What:** On `LEFT_DOUBLE_CLICK`, pick the globe position under the cursor, then fly the camera toward it while reducing altitude.
**When to use:** Double-click zoom (NAV-01).
**Key API:**
```typescript
// Source: CesiumJS official docs + community verified
// 1. Remove built-in entity-tracking double-click FIRST:
viewer.cesiumWidget.screenSpaceEventHandler.removeInputAction(
  ScreenSpaceEventType.LEFT_DOUBLE_CLICK
);

// 2. Register custom handler:
const dblClickHandler = new ScreenSpaceEventHandler(viewer.scene.canvas);
dblClickHandler.setInputAction((event: { position: Cartesian2 }) => {
  // Try to pick a globe position (terrain, water, entity surface)
  const picked = viewer.scene.pickPosition(event.position);
  if (!Cesium.defined(picked)) return; // sky or undefined — do nothing

  const currentAlt = viewer.camera.positionCartographic.height;
  const targetAlt  = currentAlt * 0.4; // zoom ~2.5x each double-click

  // Fly toward picked point at reduced altitude
  const carto = Cesium.Cartographic.fromCartesian(picked);
  viewer.camera.flyTo({
    destination: Cesium.Cartesian3.fromRadians(
      carto.longitude,
      carto.latitude,
      targetAlt,
    ),
    duration: 0.6,
    orientation: {
      heading: viewer.camera.heading,
      pitch:   viewer.camera.pitch,
      roll:    0,
    },
  });
}, ScreenSpaceEventType.LEFT_DOUBLE_CLICK);
```

**Sky guard:** `scene.pickPosition` returns `undefined` when the ray hits nothing (sky). Checking `!Cesium.defined(picked)` is the correct guard — `undefined` means the double-click hit sky and should be ignored (requirement: "double-clicking sky does nothing").

**Minimum altitude guard:** Add `Math.max(500, currentAlt * 0.4)` to prevent infinite zoom into terrain.

### Pattern 3: Pitch / Tilt via setView

**What:** Instantly (or with flyTo) reorient camera pitch to a preset.
**When to use:** Tilt/pitch widget presets (NAV-02).
**Key API:**
```typescript
// Source: CesiumJS Camera API official docs
// pitch is always in RADIANS

// Top-down (pitch = -90 degrees = -Math.PI/2)
viewer.camera.setView({
  orientation: {
    heading: viewer.camera.heading,
    pitch:   CesiumMath.toRadians(-90),
    roll:    0,
  },
});

// 45-degree oblique (pitch = -45 degrees)
viewer.camera.setView({
  orientation: {
    heading: viewer.camera.heading,
    pitch:   CesiumMath.toRadians(-45),
    roll:    0,
  },
});

// Horizon / level (pitch = -10 degrees — near-horizontal, not fully flat
// because pitch=0 looks straight up, pitch=-90 looks straight down)
viewer.camera.setView({
  orientation: {
    heading: viewer.camera.heading,
    pitch:   CesiumMath.toRadians(-10),
    roll:    0,
  },
});
```

**Important:** `camera.pitch` is a read-only property. Mutation requires `setView()` or `flyTo()` with an `orientation` object. `setView()` is immediate; `flyTo()` animates.
`setView()` moves the camera instantaneously — use it for tilt presets for a snappy, responsive feel, consistent with military UI conventions.

### Pattern 4: Debouncing LEFT_CLICK (200 ms)

**What:** Wrap the click callback in a setTimeout(fn, 200) that is cancelled if a double-click fires first.
**When to use:** Any time a LEFT_DOUBLE_CLICK handler co-exists with a LEFT_CLICK handler (CesiumJS fires both).
**Example:**
```typescript
// Source: STATE.md decision + CesiumJS issue #1171

let clickTimer: ReturnType<typeof setTimeout> | null = null;

handler.setInputAction((click: { position: Cartesian2 }) => {
  if (clickTimer !== null) clearTimeout(clickTimer);
  clickTimer = setTimeout(() => {
    clickTimer = null;
    // existing entity pick logic here
    const picked = viewer.scene.pick(click.position);
    // ... dispatch to store
  }, 200);
}, ScreenSpaceEventType.LEFT_CLICK);
```

The 200 ms delay is imperceptible for normal click-to-select usage but large enough to distinguish single click from the first click of a double-click sequence.

### Pattern 5: viewerRegistry Helper Functions

**What:** Add camera helpers to `viewerRegistry.ts` so any component can call them without importing the viewer directly.
**When to use:** `CameraControlWidget.tsx` buttons, and potentially keyboard shortcuts.
**Example following existing pattern:**
```typescript
// Source: existing viewerRegistry.ts pattern (flyToLandmark, flyToPosition)
import { Math as CesiumMath } from 'cesium';

/** Zoom in by reducing altitude by factor (0–1). Default factor=0.3 */
export function zoomStep(direction: 'in' | 'out', factor = 0.3): void {
  if (!_viewer || _viewer.isDestroyed()) return;
  const alt = _viewer.camera.positionCartographic.height;
  const step = alt * factor;
  if (direction === 'in') _viewer.camera.zoomIn(step);
  else _viewer.camera.zoomOut(step);
}

/** Set camera pitch to a preset without changing position or heading. */
export function setPitchPreset(pitchDeg: number): void {
  if (!_viewer || _viewer.isDestroyed()) return;
  _viewer.camera.setView({
    orientation: {
      heading: _viewer.camera.heading,
      pitch:   CesiumMath.toRadians(pitchDeg),
      roll:    0,
    },
  });
}
```

### Anti-Patterns to Avoid

- **Two ScreenSpaceEventHandlers on the same event type:** CesiumJS last-registered handler wins; earlier ones are silently replaced. All handlers for the same event type must be on the same `ScreenSpaceEventHandler` instance, or use different instances on different canvas refs. The existing `AircraftLayer.tsx` owns the `LEFT_CLICK` handler; do NOT create a second handler for `LEFT_CLICK` in `CameraControlWidget`.
- **Skipping removeInputAction before adding LEFT_DOUBLE_CLICK:** The viewer's built-in entity-tracking double-click fires a separate camera animation. If not removed first, two conflicting camera flights fire simultaneously (documented in STATE.md).
- **Using camera.pitch = value directly:** `pitch` is read-only. Always use `setView()` or `flyTo()` with an orientation object.
- **Creating CameraControlWidget inside cleanUI gate:** The widget provides navigation functionality (like LandmarkNav and CinematicHUD) — render it unconditionally, not gated by `cleanUI`.
- **Placing double-click registration inside AircraftLayer.tsx:** The double-click handler concerns camera navigation, not entity selection. Keep it in `GlobeView.tsx` or `CameraControlWidget.tsx` for separation of concerns.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Altitude-proportional zoom step | Custom formula | `altitude * factor` (already validated in wheel handler) | Factor already tuned; consistency matters |
| Camera pitch orientation math | Custom quaternion math | `CesiumMath.toRadians()` + `camera.setView({ orientation })` | CesiumJS handles all ENU frame transforms |
| Smooth double-click zoom animation | CSS transitions or requestAnimationFrame | `camera.flyTo({ duration: 0.6 })` | CesiumJS already implements smooth flight with easing |
| Sky detection on double-click | Raycasting custom code | `scene.pickPosition()` returning `undefined` | CesiumJS internally handles ray-globe intersection |

**Key insight:** The wheel zoom already solved altitude-proportional zoom. The button zoom and double-click zoom should reuse the same pattern, not invent a new one.

---

## Common Pitfalls

### Pitfall 1: LEFT_CLICK fires on every double-click (CesiumJS issue #1171)
**What goes wrong:** Entity detail panel opens every time user double-clicks to zoom.
**Why it happens:** CesiumJS fires `LEFT_CLICK` first, then `LEFT_DOUBLE_CLICK`. The LEFT_CLICK entity dispatch runs before the double-click zoom.
**How to avoid:** 200 ms setTimeout debounce on the LEFT_CLICK callback inside `AircraftLayer.tsx`. Clear the timer when LEFT_DOUBLE_CLICK fires.
**Warning signs:** If clicking an entity works but double-clicking on the globe opens an entity panel, the debounce is missing or wired incorrectly.

### Pitfall 2: Built-in entity-tracking double-click not removed
**What goes wrong:** Two conflicting camera animations fire simultaneously — one from CesiumJS built-in, one from the custom handler. Camera judders or throws a CesiumJS error.
**Why it happens:** `viewer.cesiumWidget.screenSpaceEventHandler` has a default LEFT_DOUBLE_CLICK action for entity tracking. Adding a custom handler does not remove the existing one.
**How to avoid:** Always call `viewer.cesiumWidget.screenSpaceEventHandler.removeInputAction(ScreenSpaceEventType.LEFT_DOUBLE_CLICK)` before registering the custom handler.
**Warning signs:** Stutter or CesiumJS error on double-click; camera briefly snaps to an entity before the zoom takes over.

### Pitfall 3: scene.pickPosition fails on entities / primitives
**What goes wrong:** `scene.pickPosition` returns undefined even on visible primitives (aircraft, ships, satellites) because depth picking is not enabled for those render passes.
**Why it happens:** `pickPosition` requires `scene.pickPositionSupported` and works reliably only on terrain and globe surface, not on screen-space billboard or primitive geometry.
**How to avoid:** Accept that double-clicking an entity will fall back to the entity's approximate screen-space position. If `pickPosition` returns undefined, fall back to `scene.camera.pickEllipsoid(position)` to find the nearest ellipsoid point, then zoom toward that. This ensures double-clicking an aircraft does not silently do nothing.
**Warning signs:** Double-clicking entities never zooms. Test specifically on billboards and points.

### Pitfall 4: Widget overlaps CesiumJS credit attribution
**What goes wrong:** On-screen widget covers the CesiumJS "Cesium ion" / "© Esri" credit text in the bottom-right corner.
**Why it happens:** CesiumJS renders credit text at `bottom: 0, right: 0` with a fixed zIndex.
**How to avoid:** Position the camera control widget at `bottom: 70px` or higher (credits are ~30px tall; BottomStatusBar adds another 32px). The CinematicHUD already accounts for this with `bottom: 40`.
**Warning signs:** Credits invisible or widget partially overlapping them in bottom-right.

### Pitfall 5: `camera.setView` called while a flight is in progress
**What goes wrong:** Calling `setView` mid-flight causes camera jump/stutter.
**Why it happens:** CesiumJS does not auto-cancel in-progress flights before `setView`.
**How to avoid:** Call `viewer.camera.cancelFlight()` before `setView()` in the tilt helper — same pattern used in `flyToLandmark`.
**Warning signs:** Tilt button occasionally causes camera snap when clicked during a landmark fly-to.

---

## Code Examples

### viewerRegistry.ts additions
```typescript
// Source: extending existing viewerRegistry.ts pattern
export function zoomStep(direction: 'in' | 'out', factor = 0.3): void {
  if (!_viewer || _viewer.isDestroyed()) return;
  const alt = _viewer.camera.positionCartographic.height;
  const step = alt * factor;
  if (direction === 'in') _viewer.camera.zoomIn(step);
  else _viewer.camera.zoomOut(step);
}

export function setPitchPreset(pitchDeg: number): void {
  if (!_viewer || _viewer.isDestroyed()) return;
  _viewer.camera.cancelFlight(); // prevent stutter if flight is in progress
  _viewer.camera.setView({
    orientation: {
      heading: _viewer.camera.heading,
      pitch:   CesiumMath.toRadians(pitchDeg),
      roll:    0,
    },
  });
}
```

### CameraControlWidget tilt buttons
```tsx
// Source: pattern from LandmarkNav.tsx landmark buttons + CinematicHUD.tsx overlay style
const TILT_PRESETS = [
  { label: 'TOP', pitchDeg: -90 },
  { label: '45°', pitchDeg: -45 },
  { label: 'HRZ', pitchDeg: -10 },
] as const;

// Widget positioned bottom-right, above CesiumJS credits and BottomStatusBar
// position: 'fixed', bottom: 70, right: 12, zIndex: 85
```

### AircraftLayer.tsx LEFT_CLICK debounce modification
```typescript
// Source: CesiumJS issue #1171 — pattern agreed in STATE.md
let clickTimer: ReturnType<typeof setTimeout> | null = null;

handler.setInputAction((click: { position: Cartesian2 }) => {
  if (clickTimer !== null) clearTimeout(clickTimer);
  clickTimer = setTimeout(() => {
    clickTimer = null;
    const picked = viewer.scene.pick(click.position);
    // ... existing dispatch logic unchanged
  }, 200);
}, ScreenSpaceEventType.LEFT_CLICK);
```

### GlobeView.tsx LEFT_DOUBLE_CLICK handler registration (inside initViewer)
```typescript
// Source: CesiumJS official docs + community pattern
import { ScreenSpaceEventHandler, ScreenSpaceEventType, Cartesian2,
         Cartographic, Cartesian3, Math as CesiumMath, defined } from 'cesium';

// Must run AFTER viewer is created:
viewer.cesiumWidget.screenSpaceEventHandler.removeInputAction(
  ScreenSpaceEventType.LEFT_DOUBLE_CLICK
);

const dblHandler = new ScreenSpaceEventHandler(viewer.scene.canvas);
dblHandler.setInputAction((event: { position: Cartesian2 }) => {
  // Attempt terrain/water pick
  let picked = viewer.scene.pickPosition(event.position);

  // Fallback to ellipsoid if pickPosition returned nothing (entity surface)
  if (!defined(picked)) {
    picked = viewer.scene.camera.pickEllipsoid(event.position) ?? undefined;
  }
  if (!picked) return; // sky — do nothing

  const carto = Cartographic.fromCartesian(picked);
  const currentAlt = viewer.camera.positionCartographic.height;
  const targetAlt  = Math.max(500, currentAlt * 0.4);

  viewer.camera.flyTo({
    destination: Cartesian3.fromRadians(carto.longitude, carto.latitude, targetAlt),
    duration: 0.6,
    orientation: {
      heading: viewer.camera.heading,
      pitch:   viewer.camera.pitch,
      roll:    0,
    },
  });
}, ScreenSpaceEventType.LEFT_DOUBLE_CLICK);

// Store for cleanup:
(viewer as unknown as { _dblHandler?: ScreenSpaceEventHandler })._dblHandler = dblHandler;
```

---

## Screen Real-Estate Map

Existing fixed-position UI elements that the new widget must not overlap:

| Element | Position | zIndex |
|---------|----------|--------|
| PlaybackBar | top: 0, left: 50% (centered) | ~90 |
| CinematicHUD (MGRS) | top: 62, right: 12 | 80 |
| CinematicHUD (telemetry) | bottom: 40, right: 12 | 80 |
| Clean UI toggle | bottom: 40, left: 80 | 80 |
| LandmarkNav | bottom: 32, left: 50% (centered) | 90 |
| BottomStatusBar | bottom: 0 (32px tall) | ~80 |
| DraggablePanel "LAYERS" | default: left: 12, top: 40 | 70 |
| CesiumJS credits | bottom: 0, right: 0 | built-in |

**Safe zone for CameraControlWidget:** `bottom: 70–100px, right: 12px` — sits above CesiumJS credits + BottomStatusBar, below the MGRS/telemetry HUD elements. The telemetry block ends at approximately `bottom: 40 + ~4 lines * 18px = ~112px` from bottom. Place widget at `bottom: 120px, right: 12px` to avoid collision.

**Alternative:** Place widget at `bottom: 70px, left: 50%, transform: translateX(-50%)` near LandmarkNav — but that area is occupied. Right-side column at bottom is the safest gap.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| CesiumJS default double-click entity zoom | Remove built-in + custom `LEFT_DOUBLE_CLICK` → `flyTo` toward picked point | This phase | Cursor-aware zoom instead of entity-locked zoom |
| No on-screen zoom alternative | `zoomIn`/`zoomOut` buttons via registry helper | This phase | Accessibility for touch/trackpad users without scroll wheel |
| No tilt control | `camera.setView({ orientation: { pitch } })` presets | This phase | Operational shortcuts for bird's-eye vs. oblique views |

---

## Open Questions

1. **Double-click zoom factor (0.4)**
   - What we know: `altitude * 0.4` gives ~2.5x zoom per double-click, consistent with Google Earth feel
   - What's unclear: No user testing yet — may need tuning during 15-03 validation
   - Recommendation: Start with 0.4, mark as tunable constant in source comment

2. **Tilt widget always-visible vs. cleanUI-gated**
   - What we know: `LandmarkNav` and `CinematicHUD` are unconditional; `LeftSidebar` is cleanUI-gated
   - What's unclear: Which bucket does a tilt/zoom widget fall into?
   - Recommendation: Treat as navigation infrastructure (unconditional), same as LandmarkNav — camera control is as essential as city jump navigation

3. **Double-click on entity: pick the entity or zoom toward it?**
   - What we know: Requirement says "double-clicking does not open an entity detail panel"; the zoom should still occur toward the entity's general screen position
   - What's unclear: `pickPosition` often returns undefined on billboard primitives; the ellipsoid fallback may land slightly off from the entity
   - Recommendation: Ellipsoid fallback is acceptable for this phase — zoom lands on the globe point beneath the entity, which is close enough

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.x + @testing-library/react 16.x |
| Config file | `frontend/vite.config.ts` (test.environment: jsdom) |
| Quick run command | `cd frontend && npx vitest run src/components/__tests__/CameraControlWidget.test.tsx` |
| Full suite command | `cd frontend && npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| NAV-01 | Double-click zoom fires `flyTo` toward picked point | unit (mocked cesium) | `npx vitest run src/components/__tests__/CameraControlWidget.test.tsx` | ❌ Wave 0 |
| NAV-01 | Double-click on sky (pickPosition=undefined, pickEllipsoid=undefined) does nothing | unit | same | ❌ Wave 0 |
| NAV-01 | LEFT_CLICK debounce: single click still dispatches to store after 200ms | unit | `npx vitest run src/components/__tests__/AircraftLayer.debounce.test.tsx` | ❌ Wave 0 |
| NAV-02 | Tilt widget renders three preset buttons (TOP, 45°, HRZ) | unit | `npx vitest run src/components/__tests__/CameraControlWidget.test.tsx` | ❌ Wave 0 |
| NAV-02 | Clicking TOP button calls setPitchPreset(-90) | unit | same | ❌ Wave 0 |
| NAV-02 | Clicking 45° button calls setPitchPreset(-45) | unit | same | ❌ Wave 0 |
| NAV-02 | Clicking HRZ button calls setPitchPreset(-10) | unit | same | ❌ Wave 0 |
| NAV-03 | + button calls zoomStep('in') | unit | same | ❌ Wave 0 |
| NAV-03 | − button calls zoomStep('out') | unit | same | ❌ Wave 0 |
| NAV-03 | zoomStep helper: calls camera.zoomIn with altitude * factor | unit (mocked viewer) | `npx vitest run src/lib/__tests__/viewerRegistry.nav.test.ts` | ❌ Wave 0 |
| NAV-02 | setPitchPreset helper: calls cancelFlight + setView with correct radians | unit (mocked viewer) | same | ❌ Wave 0 |

**Browser validation (manual, 15-03):** All remaining tests are visual/UX — position does not overlap credit attribution, debounce imperceptible during normal click-to-select, double-click works on terrain/water, sky guard confirmed. These cannot be automated.

### Sampling Rate
- **Per task commit:** `cd frontend && npx vitest run`
- **Per wave merge:** `cd frontend && npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `frontend/src/components/__tests__/CameraControlWidget.test.tsx` — covers NAV-02, NAV-03 widget rendering + button callbacks
- [ ] `frontend/src/components/__tests__/AircraftLayer.debounce.test.tsx` — covers NAV-01 LEFT_CLICK debounce behavior
- [ ] `frontend/src/lib/__tests__/viewerRegistry.nav.test.ts` — covers `zoomStep` and `setPitchPreset` helper logic with mocked viewer

---

## Sources

### Primary (HIGH confidence)
- CesiumJS Camera API official docs — `zoomIn`, `zoomOut`, `flyTo`, `setView`, `pitch`, `heading`, `positionCartographic`
  https://cesium.com/learn/ion-sdk/ref-doc/Camera.html
- CesiumJS ScreenSpaceCameraController reference
  https://cesium.com/learn/cesiumjs/ref-doc/ScreenSpaceCameraController.html
- Project source: `/frontend/src/components/GlobeView.tsx` — existing altitude-proportional wheel zoom pattern (verified)
- Project source: `/frontend/src/components/AircraftLayer.tsx` — existing LEFT_CLICK unified handler (verified)
- Project source: `/frontend/src/lib/viewerRegistry.ts` — helper function pattern (verified)
- Project source: `.planning/STATE.md` — locked decisions: removeInputAction before custom LEFT_DOUBLE_CLICK, 200ms debounce

### Secondary (MEDIUM confidence)
- CesiumJS community: "Zoom in on left double click like google earth" — flyTo pattern with altitude reduction
  https://community.cesium.com/t/zoom-in-on-left-double-click-like-google-earth/7111
- CesiumJS community: "How to disable camera zooming when double click on an entity" — removeInputAction approach
  https://community.cesium.com/t/how-to-disable-camera-zooming-when-double-click-on-an-entity/2859
- Webiks blog: "Remove default double click behavior in Cesium" — `viewer.cesiumWidget.screenSpaceEventHandler.removeInputAction`
  https://blog.webiks.com/remove-default-double-click-behavior-in-cesium/

### Tertiary (LOW confidence — needing validation during 15-03)
- `scene.pickPosition` returns undefined on billboard primitives — needs browser confirmation
- Optimal zoom factor 0.4 for double-click — needs user feel test

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already installed and in use; no new dependencies
- Architecture: HIGH — viewerRegistry pattern is established, DraggablePanel / fixed overlay patterns are established
- CesiumJS API (camera.zoomIn, zoomOut, setView, flyTo): HIGH — verified against official docs
- CesiumJS event handling (removeInputAction, LEFT_DOUBLE_CLICK): HIGH — verified via official docs + community + STATE.md locked decision
- Pitfalls: HIGH — CesiumJS issue #1171 and entity-tracking double-click conflict are documented in STATE.md as pre-researched
- Widget positioning: MEDIUM — exact pixel values need visual validation; safe zone analysis is based on reading existing component code

**Research date:** 2026-03-13
**Valid until:** 2026-04-12 (CesiumJS 1.139 API is stable; unlikely to change in 30 days)
