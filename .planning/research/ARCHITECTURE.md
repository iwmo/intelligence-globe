# Architecture Research

**Domain:** 3D Geospatial Intelligence Globe — UI Refinement (v3.0)
**Researched:** 2026-03-12
**Confidence:** HIGH — based on direct codebase analysis + verified CesiumJS API documentation

---

## Standard Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         React DOM Layer (fixed positioned)               │
├─────────────────────────────────────────────────────────────────────────┤
│  ┌──────────┐  ┌──────────┐  ┌────────────┐  ┌──────────────────────┐  │
│  │LeftSidebar│ │RightDrawer│ │  PlaybackBar│  │  CinematicHUD / LNav │  │
│  │ z:50-85  │ │  z:100   │ │   z:79      │  │      z:80-90         │  │
│  └──────────┘  └──────────┘  └────────────┘  └──────────────────────┘  │
│  ┌──────────────────┐   ┌────────────────────────────────────────────┐  │
│  │  PostProcessPanel │   │  NEW: CameraControlWidget  z:82  right     │  │
│  │      z:75        │   └────────────────────────────────────────────┘  │
│  └──────────────────┘                                                   │
├─────────────────────────────────────────────────────────────────────────┤
│                       CesiumJS Viewer (canvas fills 100vw/100vh)         │
├─────────────────────────────────────────────────────────────────────────┤
│  Primitives API (scene.primitives stack — render order = add order)      │
│                                                                         │
│  ┌─────────────────────┐  ┌────────────────────────────────────────┐   │
│  │ PointPrimitiveColls │  │ BillboardCollections (NEW, per layer)   │   │
│  │  (existing — hidden │  │ Satellites: ~5,000 billboards           │   │
│  │   during transition)│  │ Aircraft:   ~few hundred billboards     │   │
│  │  Satellites         │  │ Military:   ~few hundred billboards     │   │
│  │  Aircraft           │  │ Ships:      ~few thousand billboards    │   │
│  │  Military           │  └────────────────────────────────────────┘   │
│  │  Ships              │                                               │
│  └─────────────────────┘                                               │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ PolylineCollections (orbits, trails, overpass arcs) — unchanged   │  │
│  │ GroundPrimitive (GPS jamming H3) — unchanged                      │  │
│  │ PointPrimitiveCollection (AOI marker) — unchanged                 │  │
│  └──────────────────────────────────────────────────────────────────┘  │
├─────────────────────────────────────────────────────────────────────────┤
│                     ScreenSpaceEventHandler layer                        │
│  Existing: LEFT_CLICK (AircraftLayer) + RIGHT_CLICK (SatelliteLayer)    │
│  NEW:      LEFT_DOUBLE_CLICK (GlobeView)                                │
├─────────────────────────────────────────────────────────────────────────┤
│                   Zustand Store (useAppStore)                            │
│  Existing slices: layers, selected*, replay, visualPreset, cleanUI      │
│  NEW slice: sidebarSections (collapse state per section)                 │
└─────────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Status for v3.0 |
|-----------|----------------|-----------------|
| `GlobeView.tsx` | CesiumJS viewer init, wheel zoom handler | EXISTS — add LEFT_DOUBLE_CLICK here |
| `AircraftLayer.tsx` | LEFT_CLICK unified dispatcher for all entity types | EXISTS — add billboard collection, extend lerp loop |
| `SatelliteLayer.tsx` | PointPrimitiveCollection for satellites + RIGHT_CLICK AOI | EXISTS — add billboard collection, update POSITIONS handler |
| `ShipLayer.tsx` | PointPrimitiveCollection for ships | EXISTS — add billboard collection (simplest start) |
| `MilitaryAircraftLayer.tsx` | PointPrimitiveCollection for military | EXISTS — add billboard collection |
| `LeftSidebar.tsx` | Hamburger + layer toggles + sliding panel | EXISTS — add collapsible sections + radar styling |
| `PostProcessPanel.tsx` | Visual preset buttons and sliders | EXISTS — add radar styling |
| `CinematicHUD.tsx` | MGRS + classification + REC timestamp | EXISTS — radar styling only |
| `LandmarkNav.tsx` | Quick-jump buttons + search, zIndex 90 right side | EXISTS — unchanged |
| `PlaybackBar.tsx` | LIVE/PLAYBACK timeline scrubber | EXISTS — unchanged |
| `RightDrawer.tsx` | Entity detail panel, zIndex 100, right at top:120px | EXISTS — radar styling |
| `useAppStore.ts` | Zustand global state | EXISTS — add sidebarSections slice |
| `viewerRegistry.ts` | Singleton viewer ref + flyTo helpers | EXISTS — add pitchBy, zoomStep helpers |
| `CameraControlWidget.tsx` | Tilt/pitch buttons + zoom buttons | NEW component |

---

## Recommended Project Structure

```
frontend/src/
├── components/
│   ├── GlobeView.tsx              # Add LEFT_DOUBLE_CLICK handler in initViewer()
│   ├── LeftSidebar.tsx            # Collapsible sections + radar styling refactor
│   ├── CameraControlWidget.tsx    # NEW — tilt/pitch/zoom overlay widget
│   ├── SatelliteLayer.tsx         # Add parallel BillboardCollection + scaleByDistance
│   ├── AircraftLayer.tsx          # Add parallel BillboardCollection + update lerp loop
│   ├── MilitaryAircraftLayer.tsx  # Add parallel BillboardCollection
│   ├── ShipLayer.tsx              # Add parallel BillboardCollection (start here)
│   └── ... (all others unchanged structurally)
├── lib/
│   └── viewerRegistry.ts          # Add pitchBy(), zoomStep()
├── store/
│   └── useAppStore.ts             # Add sidebarSections slice
└── assets/icons/                  # NEW — SVG source strings per entity type
    ├── satellite.svg
    ├── aircraft.svg
    ├── military.svg
    └── ship.svg
```

### Structure Rationale

- **assets/icons/**: Centralized SVG icon definitions. Rendered to HTMLCanvasElement once at layer mount time. The canvas is passed as the `image` property to every billboard in the collection — CesiumJS shares the GPU texture for identical canvas references.
- **CameraControlWidget.tsx**: Standalone fixed-position overlay. Does not receive viewer as a prop — calls pitchBy()/zoomStep() from viewerRegistry, consistent with LandmarkNav pattern.
- **GlobeView.tsx for double-click**: GlobeView owns viewer creation and already owns the custom wheel handler. It is the correct boundary for all non-entity navigation input.

---

## Architectural Patterns

### Pattern 1: BillboardCollection as Parallel to PointPrimitiveCollection

**What:** For each existing *Layer.tsx that owns a PointPrimitiveCollection, initialize a parallel BillboardCollection in the same Effect 1. The existing point primitives are hidden (point.show = false) after billboards are added, not removed. This preserves the existing ID system and all pick dispatch logic without change.

**When to use:** All four entity layer components (SatelliteLayer, AircraftLayer, MilitaryAircraftLayer, ShipLayer).

**Trade-offs:**
- Two collections per layer exist in memory simultaneously during the transition phase. At v3.0 entity counts (5,000 satellites, ~1,000 aircraft, ~1,000 ships, ~few hundred military) this is within CesiumJS safe performance range. The Cesium performance blog confirms problems begin at 50,000+ billboards; 5,000 is fine.
- The same `id` value is used on each billboard as on the original point primitive. The unified LEFT_CLICK dispatcher in AircraftLayer.tsx reads `picked.id` — since billboard and point share the same id, the dispatcher requires zero changes.
- Keep PointPrimitiveCollection until all billboard layers are validated. This gives a hard rollback path — flip show flags to revert.

**Key implementation:**
```typescript
// In *Layer.tsx Effect 1 — initialize alongside existing collection
const billboardColl = viewer.scene.primitives.add(new BillboardCollection());
billboardCollRef.current = billboardColl;

// When adding a billboard (same id as existing point primitive):
billboardColl.add({
  position: pos,
  image: iconCanvas,           // shared canvas, pre-rendered once
  id: `mmsi:${ship.mmsi}`,     // identical to existing point id — pick dispatcher unchanged
  scaleByDistance: new NearFarScalar(1.5e4, 1.5, 8.0e6, 0.3),
  show: layerVisible,
});
// Hide corresponding point
shipPointsByMmsi.get(ship.mmsi).show = false;
```

### Pattern 2: SVG to Canvas Pre-rendering at Layer Init

**What:** SVG icon strings are converted to HTMLCanvasElement once when each layer mounts. The resulting canvas element is stored in a module-level const (not recreated on re-renders) and passed as the `image` property to BillboardCollection.add(). Because all billboards in a collection share the same canvas reference, CesiumJS creates one TextureAtlas entry for the entire layer.

**When to use:** Always. Never pass SVG strings or SVG data URLs directly to billboard.image — CesiumJS has a known bug with embedded `<image>` tags in SVG (GitHub issue #8002), and creating a new canvas per entity exhausts TextureAtlas limits at scale.

**Trade-offs:** One async init step at layer mount (imperceptible). Requires using a Promise to wait for the canvas to be drawn before adding billboards.

**Key implementation:**
```typescript
// Module-level — computed once, stable reference
let iconCanvas: HTMLCanvasElement | null = null;

async function getIconCanvas(svgString: string, size: number): Promise<HTMLCanvasElement> {
  if (iconCanvas) return iconCanvas;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const blob = new Blob([svgString], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  await new Promise<void>((resolve) => {
    const img = new Image();
    img.onload = () => { ctx.drawImage(img, 0, 0, size, size); URL.revokeObjectURL(url); resolve(); };
    img.src = url;
  });
  iconCanvas = canvas;
  return canvas;
}
```

### Pattern 3: LEFT_DOUBLE_CLICK Override in GlobeView

**What:** CesiumJS has a built-in LEFT_DOUBLE_CLICK handler that locks the camera to a picked entity. Override it by registering a new ScreenSpaceEventHandler on the canvas with LEFT_DOUBLE_CLICK inside GlobeView's `initViewer()` function. The override fires instead of the default because it sets `viewer.trackedEntity = undefined` first.

**When to use:** The double-click zoom must live in GlobeView because:
1. GlobeView owns the viewer lifecycle and already registers the custom wheel handler.
2. Navigation-level input (not entity selection) belongs at the viewer-init boundary, not in layer components.
3. Timing is guaranteed — the handler registers after the viewer is fully constructed, inside the same async function.

**Critical pitfall:** `scene.pickPosition()` returns undefined on sky clicks and may return imprecise results at very low camera altitude. Guard with `Cesium.defined(earthPos)`.

**Key implementation:**
```typescript
// Inside initViewer() in GlobeView.tsx, after viewer is constructed:
const dblClickHandler = new ScreenSpaceEventHandler(viewer.scene.canvas);
dblClickHandler.setInputAction((click: { position: Cartesian2 }) => {
  viewer.trackedEntity = undefined;  // cancel default entity-lock behavior
  const earthPos = viewer.scene.pickPosition(click.position);
  if (!defined(earthPos)) return;
  const currentHeight = viewer.camera.positionCartographic.height;
  const targetHeight = currentHeight * 0.4;  // zoom ~60% closer each double-click
  viewer.camera.flyTo({
    destination: new Cartesian3(earthPos.x, earthPos.y, earthPos.z * (targetHeight / currentHeight)),
    duration: 0.6,
  });
}, ScreenSpaceEventType.LEFT_DOUBLE_CLICK);

// Register in _cleanup alongside wheel handler
(viewer as unknown as { _cleanup?: () => void })._cleanup = () => {
  container.removeEventListener('wheel', onWheel);
  dblClickHandler.destroy();
  cancelAnimationFrame(rafId);
};
```

### Pattern 4: CameraControlWidget — Pure React, viewerRegistry Bridge

**What:** CameraControlWidget is a fixed-position React overlay with tilt step buttons (+15°/-15°), a top-down reset, and zoom in/out buttons. It calls imperative camera functions from viewerRegistry on button click — no Cesium state is read reactively, no viewer prop is passed.

**When to use:** Any camera control that is purely imperative (fire-and-forget, no reactive feedback). This matches the existing LandmarkNav pattern which calls flyToLandmark() from viewerRegistry without a viewer prop.

**Trade-offs:** No live pitch/heading readout in the widget (non-reactive). Acceptable for v3.0. Add requestAnimationFrame-based readback in v3.1 if live angle display is needed.

**viewerRegistry additions:**
```typescript
export function pitchBy(deltaDeg: number): void {
  const v = getViewer();
  if (!v || v.isDestroyed()) return;
  const newPitch = Math.max(
    CesiumMath.toRadians(-90),
    Math.min(0, v.camera.pitch + CesiumMath.toRadians(deltaDeg))
  );
  v.camera.setView({
    orientation: { heading: v.camera.heading, pitch: newPitch, roll: v.camera.roll },
  });
}

export function zoomStep(factor: number): void {
  const v = getViewer();
  if (!v || v.isDestroyed()) return;
  const h = v.camera.positionCartographic.height;
  if (factor < 1) v.camera.zoomIn(h * (1 - factor));
  else v.camera.zoomOut(h * (factor - 1));
}
```

### Pattern 5: Collapsible Sidebar Sections — Zustand Slice (Not Local State)

**What:** Each section in LeftSidebar (SEARCH, FILTERS, LAYERS, VISUAL ENGINE) gets its own expanded/collapsed boolean in a new `sidebarSections` slice in useAppStore.

**When to use:** Always for sidebar section state. The key reason for Zustand over useState: when `sidebarOpen` becomes false (sidebar slides closed) and then true again, local state resets — all sections re-expand. Zustand persists across open/close cycles.

**Trade-offs:** Minor increase in store surface area. Completely worth avoiding the disorienting re-expand behavior.

**Store slice:**
```typescript
sidebarSections: {
  search: true,
  filters: true,
  layers: true,
  visual: false,  // collapsed by default — advanced/secondary feature
};
setSidebarSection: (section: keyof AppState['sidebarSections'], open: boolean) => void;
```

---

## Data Flow

### Billboard Integration Flow

```
Layer mounts
    ↓
getIconCanvas(svgString) — async, one canvas per entity type
    ↓
BillboardCollection.add({ image: canvas, id: entityId, scaleByDistance: NearFarScalar })
    ↓ (data update)
Update billboard.position (same as existing point.position update — same code path)
    ↓ (pick event — LEFT_CLICK)
viewer.scene.pick() → picked.id (same string/number as before billboard introduction)
    ↓
AircraftLayer unified LEFT_CLICK dispatcher (ZERO changes required)
    ↓
useAppStore.setSelected*() (unchanged)
```

### Double-Click Zoom Flow

```
User double-clicks globe canvas
    ↓
GlobeView ScreenSpaceEventHandler (LEFT_DOUBLE_CLICK)
    ↓
viewer.trackedEntity = undefined  (cancel CesiumJS default entity-lock)
    ↓
viewer.scene.pickPosition(click.position) → Cartesian3 | undefined
    ↓ (if defined)
viewer.camera.flyTo({ destination: zoomedPos, duration: 0.6 })
```

### Camera Tilt Widget Flow

```
User clicks tilt/zoom button in CameraControlWidget
    ↓
pitchBy(±15) or zoomStep(0.5) from viewerRegistry
    ↓
viewer.camera.setView({ orientation: ... }) / zoomIn() / zoomOut()
    (purely imperative — no React state change, no re-render)
```

### Sidebar Collapse Flow

```
User clicks section header in LeftSidebar
    ↓
useAppStore.setSidebarSection(section, !current)
    ↓
Zustand update → LeftSidebar re-renders
    ↓
Section content collapses (height: 0) or expands (height: auto)
    (CSS transition on maxHeight for animation)
```

---

## Integration Points

### BillboardCollection Alongside Existing PointPrimitiveCollections

| Boundary | Communication | Impact |
|----------|---------------|--------|
| Billboard ↔ pick dispatcher | Same `id` on billboard as on point | AircraftLayer dispatcher: ZERO changes |
| Billboard ↔ replay interpolation | Set `billboard.position` same as `point.position` | Existing replay effects work without modification |
| Billboard ↔ layer visibility | `billboard.show = layerVisible` (identical pattern) | No store changes |
| Billboard ↔ filter effects | Set per-billboard `show` flag in same filter useEffect | Billboard loop replaces point loop — one-for-one |

### Event Handler Coexistence

| Handler | Owner | Event Type | Canvas |
|---------|-------|------------|--------|
| Unified entity click | AircraftLayer.tsx | LEFT_CLICK | viewer.scene.canvas |
| AOI setter | SatelliteLayer.tsx | RIGHT_CLICK | viewer.scene.canvas |
| Double-click zoom (NEW) | GlobeView.tsx | LEFT_DOUBLE_CLICK | viewer.scene.canvas |

Multiple ScreenSpaceEventHandler instances on the same canvas are explicitly supported by CesiumJS. Each handler only fires for its registered event type. LEFT_DOUBLE_CLICK and LEFT_CLICK are distinct — no interference. The CesiumJS default LEFT_DOUBLE_CLICK entity-tracking behavior is neutralized by setting `viewer.trackedEntity = undefined` at the start of the new handler.

### CameraControlWidget ↔ viewerRegistry

| Function | Adds To | Used By |
|----------|---------|---------|
| `pitchBy(deltaDeg)` | viewerRegistry.ts | CameraControlWidget.tsx |
| `zoomStep(factor)` | viewerRegistry.ts | CameraControlWidget.tsx |
| `flyToLandmark()` (existing) | viewerRegistry.ts | LandmarkNav.tsx |
| `flyToCartesian()` (existing) | viewerRegistry.ts | SatelliteLayer.tsx |

No prop drilling required — CameraControlWidget is a leaf component that uses the module singleton.

### Z-Index Allocation

| Component | Z-Index | Position |
|-----------|---------|----------|
| CesiumJS canvas | 0 (implicit) | full viewport |
| Sidebar panel | 50 | fixed left:0 top:0 |
| Layer toggle strip | 60 | fixed bottom-left |
| PostProcessPanel | 75 | fixed top:84 left:12 |
| PlaybackBar | 79 | fixed bottom |
| CinematicHUD | 80 | fixed top |
| TLE stale warning | 80 | fixed bottom-center |
| **NEW: CameraControlWidget** | **82** | **fixed right:12 top:~200px** |
| Hamburger button | 85 | fixed top:32 left:12 |
| LandmarkNav | 90 | fixed top right |
| OsintEventPanel | 90 | fixed right |
| RightDrawer | 100 | fixed top:120 right:12 |
| Error overlay | 999 | fixed inset:0 |

CameraControlWidget at z:82 sits above HUD (80) and below LandmarkNav (90). Positioning at right:12px, top:~200px avoids overlap with RightDrawer (top:120px, 240px wide, height auto max 320px) and LandmarkNav (which is also on the right at top:~70px based on its structure).

### LeftSidebar ↔ useAppStore Changes

| Existing Slice | v3.0 Addition |
|----------------|---------------|
| `sidebarOpen: boolean` | `sidebarSections: { search: boolean; filters: boolean; layers: boolean; visual: boolean }` |
| `setSidebarOpen()` | `setSidebarSection(key, value)` |

---

## Build Order for Minimal Regression Risk

Each step either adds net-new components or makes isolated modifications to one existing file. Steps that touch the most-critical files (AircraftLayer.tsx contains the unified click dispatcher, useAppStore.ts is consumed everywhere) are kept late when patterns are proven.

### Step 1 — Radar Styling + Collapsible Sidebar (CSS/React Only)

**Files:** LeftSidebar.tsx (collapsible sections + radar brackets), useAppStore.ts (add sidebarSections slice), RightDrawer.tsx (radar styling), CinematicHUD.tsx (angular decorations), PostProcessPanel.tsx (styling)
**Risk:** LOW. Purely visual/layout changes. useAppStore addition is additive — existing slices untouched.
**Regression surface:** Visual rendering only. No CesiumJS primitives touched. No event handlers touched.

### Step 2 — CameraControlWidget + viewerRegistry Helpers

**Files:** viewerRegistry.ts (add pitchBy, zoomStep), new CameraControlWidget.tsx, App.tsx (mount in !cleanUI block)
**Risk:** LOW. viewerRegistry additions are purely additive functions. CameraControlWidget is a new leaf component. App.tsx change is one mount line inside existing !cleanUI block at an unoccupied z-index slot.
**Regression surface:** Camera movement only. No primitives, no event handlers, no store changes.

### Step 3 — Double-Click Zoom in GlobeView

**Files:** GlobeView.tsx only
**Risk:** LOW-MEDIUM. Modifies a critical init file but change is additive — registers a new ScreenSpaceEventHandler after viewer construction, inside the same initViewer() async closure. Follows the established _cleanup pattern for the wheel handler. LEFT_DOUBLE_CLICK is a distinct event type and does not fire on single-click entity picks.
**Regression surface:** Camera navigation. Verify no conflict with LEFT_CLICK entity selection (different event type).

### Step 4 — BillboardCollection for Ships

**Files:** ShipLayer.tsx only
**Risk:** MEDIUM. First BillboardCollection introduction. Ships are the simplest layer: no lerp, no worker, no trail, slow-moving. Validate: billboards appear, pick IDs match, layer toggle works, replay interpolation works.
**Strategy:** Parallel collections — keep PointPrimitiveCollection with show=false. Rollback = flip show flags.
**Regression surface:** Ship click → detail panel → replay.

### Step 5 — BillboardCollection for Military Aircraft

**Files:** MilitaryAircraftLayer.tsx only
**Risk:** MEDIUM. Identical pattern to Step 4 (no lerp, no trail). Pattern now validated from Step 4.
**Regression surface:** Military click → detail panel → replay.

### Step 6 — BillboardCollection for Aircraft

**Files:** AircraftLayer.tsx only
**Risk:** MEDIUM-HIGH. Most complex layer: lerp animation loop, trail polyline, replay interpolation, AND the unified LEFT_CLICK dispatcher. Billboard position must be updated inside the rAF lerp loop (same frame as point.position).
**Strategy:** Update both point.position and billboard.position in the lerp loop simultaneously until validated. After validation, remove point updates. The click dispatcher is not touched — it reads picked.id which is the same for both billboard and point.
**Regression surface:** Lerp animation smoothness, trail rendering, aircraft click → detail panel, replay interpolation. The click dispatcher — the riskiest component in the codebase.

### Step 7 — BillboardCollection for Satellites

**Files:** SatelliteLayer.tsx only
**Risk:** MEDIUM. Largest entity count (~5,000). The POSITIONS worker message handler writes to every point per frame — must also write to every billboard per frame. scaleByDistance is most important here (satellites are viewed from very high altitude). At 5,000 entities BillboardCollection is safe (Cesium docs confirm problems begin at 50,000+).
**Regression surface:** Satellite rendering at full load, filter effects, orbit display, overpass arcs, replay.

### Step 8 — Remove PointPrimitiveCollections

**Files:** All four *Layer.tsx files
**Risk:** LOW (at this point). After all billboard layers are validated across all regression checks, remove the now-hidden PointPrimitiveCollections and their update loops. Clean build, single collection per layer.
**Regression surface:** Full layer regression.

---

## Anti-Patterns

### Anti-Pattern 1: Registering Double-Click in AircraftLayer

**What people do:** Add LEFT_DOUBLE_CLICK to the existing ScreenSpaceEventHandler in AircraftLayer because it already handles all clicks.
**Why it's wrong:** AircraftLayer is a render-null component with a `viewer` prop dependency. Navigation input (zoom toward cursor) is viewer-level, not entity-selection-level. Mixing navigation and entity selection in the same handler conflates two distinct concerns. GlobeView already owns the custom wheel handler — double-click belongs alongside it.
**Do this instead:** Add double-click handler in GlobeView.tsx initViewer() alongside the wheel handler.

### Anti-Pattern 2: One Canvas Per Billboard

**What people do:** Generate a new `document.createElement('canvas')` or `URL.createObjectURL(blob)` per entity on each data update.
**Why it's wrong:** BillboardCollection shares GPU textures only for billboards with identical `image` references. A new canvas per entity forces a new TextureAtlas entry per entity — at 5,000 satellites this exhausts the TextureAtlas size limit, causing GPU allocation failures.
**Do this instead:** Create one canvas per entity type at layer mount time in a module-scope variable. Pass the same canvas reference to every billboard.add() call.

### Anti-Pattern 3: Removing PointPrimitiveCollections Before Billboard Validation

**What people do:** Remove PointPrimitiveCollection in the same commit as adding BillboardCollection.
**Why it's wrong:** If billboard rendering, picking, or replay has a bug, there is no rollback path without reverting commits. The PointPrimitiveCollection removal is irreversible within a running session.
**Do this instead:** Keep both collections in parallel with points hidden. Validate fully across all regression scenarios. Remove points in a separate step.

### Anti-Pattern 4: Viewer Prop on CameraControlWidget

**What people do:** `<CameraControlWidget viewer={cesiumViewer} />` because cesiumViewer state lives in App.tsx.
**Why it's wrong:** The codebase already has a standard pattern for components that make imperative camera calls: use viewerRegistry. LandmarkNav calls flyToLandmark() without a viewer prop. Inconsistency confuses future developers about which pattern to follow.
**Do this instead:** CameraControlWidget calls pitchBy()/zoomStep() from viewerRegistry — no prop required.

### Anti-Pattern 5: Sidebar Section State as Local useState

**What people do:** Track section collapse state with `useState` inside LeftSidebar.
**Why it's wrong:** When `sidebarOpen` becomes false (sidebar closes) and then true again, local state resets — all sections re-expand. Users who collapsed FILTERS will see it forcibly re-expanded on every sidebar toggle.
**Do this instead:** Put sidebarSections in useAppStore. Collapsed state persists across sidebar open/close cycles.

### Anti-Pattern 6: Using setView() on Camera Without Preserving Position

**What people do:** `camera.setView({ orientation: { heading, pitch, roll } })` expecting it only rotates the camera.
**Why it's wrong:** `setView()` without a `destination` moves the camera to `undefined` behavior — it can relocate the camera to the origin or to the last set destination.
**Do this instead:** In pitchBy(), explicitly pass the current camera position as destination along with the new orientation, or use `camera.rotate*` methods that modify orientation without changing position.

---

## Scaling Considerations

| Scenario | Architecture Adjustment |
|----------|------------------------|
| Current counts (5K sats, 1K aircraft) | BillboardCollection fully viable; one canvas per type avoids TextureAtlas overflow |
| Satellite count grows to 50K | Switch satellites back to PointPrimitiveCollection for that layer; keep billboards for aircraft/ships/military |
| Complex SVG icons needed | Keep SVGs simple — no `<image>` tags, no `<filter>` elements (CesiumJS bug #8002 affects embedded images); use Canvas 2D paths as fallback |
| Mobile/tablet viewport | CameraControlWidget and collapsible sidebar sizing already uses `min(280px, calc(100vw - 24px))` pattern from LeftSidebar — follow same responsive approach |

---

## Sources

- [CesiumJS Billboard API](https://cesium.com/learn/cesiumjs/ref-doc/Billboard.html) — image property accepts canvas, scaleByDistance/NearFarScalar confirmed (HIGH confidence)
- [CesiumJS BillboardCollection API](https://cesium.com/downloads/cesiumjs/releases/1.115/Build/Documentation/BillboardCollection.html) — texture sharing, performance guidance (HIGH confidence)
- [CesiumJS Performance Tips for Points](https://cesium.com/blog/2016/03/02/performance-tips-for-points/) — PointPrimitive vs BillboardCollection benchmarks: BillboardCollection problems begin at ~50K entities (MEDIUM confidence — 2016, still referenced as authoritative)
- [CesiumJS Camera API](https://cesium.com/learn/cesiumjs/ref-doc/Camera.html) — pitch/heading/roll via setView, camera.pitch readable property, rotateUp/Down methods (HIGH confidence)
- [CesiumJS ScreenSpaceEventHandler](https://cesium.com/learn/cesiumjs/ref-doc/ScreenSpaceEventHandler.html) — setInputAction, LEFT_DOUBLE_CLICK override pattern (HIGH confidence)
- [CesiumJS community: double-click zoom like Google Earth](https://community.cesium.com/t/zoom-in-on-left-double-click-like-google-earth/7111) — pickPosition + flyTo pattern, trackedEntity = undefined override (MEDIUM confidence)
- [CesiumJS SVG billboard bug #8002](https://github.com/CesiumGS/cesium/issues/8002) — embedded image tags in SVG fail silently (HIGH confidence)
- Direct codebase analysis: GlobeView.tsx, AircraftLayer.tsx, SatelliteLayer.tsx, ShipLayer.tsx, MilitaryAircraftLayer.tsx, LeftSidebar.tsx, App.tsx, useAppStore.ts, viewerRegistry.ts (HIGH confidence — authoritative)

---

*Architecture research for: Intelligence Globe v3.0 UI Refinement*
*Researched: 2026-03-12*
