# Phase 14: Entity Icons and Altitude Scaling - Research

**Researched:** 2026-03-12
**Domain:** CesiumJS BillboardCollection, NearFarScalar, SVG canvas textures, PointPrimitive.scaleByDistance
**Confidence:** HIGH

---

## Summary

Phase 14 migrates three existing `PointPrimitiveCollection` layers (aircraft, military, ships) from plain dot primitives to `BillboardCollection` entries carrying SVG-derived canvas icons, and adds `scaleByDistance` via `NearFarScalar` to both the new billboard layers and the existing satellite `PointPrimitive` layer. The satellite layer is deliberately excluded from the billboard migration due to the confirmed GPU TextureAtlas size limit when 5,000+ unique textures are added; that constraint is a locked project decision.

The critical performance constraint for the billboard migration is that all three entity types (aircraft, military, ship) must share exactly **one canvas texture per entity type** — three textures total per `BillboardCollection`. This is achievable by pre-rendering an `HTMLCanvasElement` per type once at module scope and passing the same canvas reference as the `image` property to every `collection.add()` call. CesiumJS internally deduplicates texture atlas entries when the same canvas object reference or same string ID is provided. The rAF lerp loop used by `AircraftLayer.tsx` must update `billboard.position` (same API as `point.position`) so no structural changes are needed there.

The `PointPrimitive.scaleByDistance` property exists and accepts a `NearFarScalar` identical to `Billboard.scaleByDistance`. Adding it to the satellite layer is an additive one-line change per primitive; the starting NearFarScalar values require in-browser tuning with a continuous zoom test from 20,000 km to 500 m altitude.

**Primary recommendation:** Pre-render three canvas icons at module scope before any React render, migrate to `BillboardCollection` per layer atomically (add new collection, remove old), set `billboard.rotation` using `CesiumMath.toRadians(heading)` for aircraft/military/ships, and add `scaleByDistance` to both billboard and satellite point primitives.

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| ICONS-01 | Commercial aircraft displayed as airplane-shaped SVG billboard icons | BillboardCollection + canvas pre-render; `true_track` field available on `AircraftRecord` for rotation |
| ICONS-02 | Military flights displayed as distinct military aircraft SVG billboard icon | BillboardCollection + separate canvas shape; `track` field available on `MilitaryAircraftRecord` |
| ICONS-03 | Ships displayed as vessel-shaped SVG billboard icons | BillboardCollection + hull canvas shape; `heading` field (511=unavailable) available on `ShipRecord` |
| ICONS-04 | Satellites displayed as improved orbital-cross markers (PointPrimitive, not billboard) | Existing PointPrimitiveCollection kept; `scaleByDistance` added to each `PointPrimitive` via `NearFarScalar` |
| ICONS-05 | Aircraft, military, ship icons scale proportionally with camera altitude | `Billboard.scaleByDistance = new NearFarScalar(near, nearValue, far, farValue)` on each billboard |
</phase_requirements>

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| cesium | ^1.139.1 | BillboardCollection, NearFarScalar, PointPrimitive | Already installed; all APIs needed are present |
| TypeScript | ~5.9.3 | Type-safe billboard/point refs | Already in project |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| HTMLCanvasElement (browser native) | — | SVG icon rasterization at module scope | Pre-render aircraft/military/ship icons before React mounts |
| CesiumMath | bundled with cesium | `toRadians()` for heading conversion | Convert degrees heading to billboard `rotation` property |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Canvas pre-render | PNG file URL | PNG requires extra asset bundling; canvas is zero-dependency and identical result |
| Canvas pre-render | Per-entity SVG string via `setImage()` | DeveloperError at >5,000 TextureAtlas entries; pre-render is mandatory for safety |
| BillboardCollection for satellites | Keep as PointPrimitiveCollection | BillboardCollection at 5,000+ entities degrades GPU; PointPrimitive is the correct choice (locked constraint) |

**Installation:** No new packages required. All capabilities are in the already-installed `cesium` package.

---

## Architecture Patterns

### Canvas Pre-Render (Module Scope)

SVG icon canvases are created once per layer file at module scope — outside any React component or hook. This ensures they are created exactly once and never recreated on re-render.

```typescript
// Source: CesiumJS official docs — Billboard.image accepts HTMLCanvasElement
// Pre-render once at module scope — before any React render
function drawAircraftIcon(): HTMLCanvasElement {
  const SIZE = 32;
  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#FF8C00'; // matches existing aircraft orange
  // Simple airplane silhouette path — nose up, wings mid
  ctx.beginPath();
  ctx.moveTo(SIZE / 2, 2);               // nose
  ctx.lineTo(SIZE * 0.85, SIZE * 0.65);  // starboard wingtip
  ctx.lineTo(SIZE / 2, SIZE * 0.55);     // fuselage-wing junction starboard
  ctx.lineTo(SIZE / 2 + 4, SIZE - 4);   // starboard tail
  ctx.lineTo(SIZE / 2, SIZE - 8);       // tail center
  ctx.lineTo(SIZE / 2 - 4, SIZE - 4);   // port tail
  ctx.lineTo(SIZE / 2, SIZE * 0.55);    // fuselage-wing junction port
  ctx.lineTo(SIZE * 0.15, SIZE * 0.65); // port wingtip
  ctx.closePath();
  ctx.fill();
  return canvas;
}

// Called once at module load — exported const is reused for every billboard
const AIRCRAFT_ICON = drawAircraftIcon();
```

Note: The exact SVG path coordinates for each icon type are implementation details to be tuned visually during Plan 01 (14-01). The above pattern is the mechanism; the aesthetics are determined by the implementer.

### BillboardCollection Migration Pattern

Migration from `PointPrimitiveCollection` to `BillboardCollection` follows the project's established atomic two-step rule: add new collection, remove old collection in the same effect cleanup. No parallel operation period.

```typescript
// Source: CesiumJS BillboardCollection official docs
import {
  BillboardCollection,
  NearFarScalar,
  Cartesian3,
  BlendOption,
  Math as CesiumMath,
} from 'cesium';

// In useEffect initialization:
const billboards = viewer.scene.primitives.add(
  new BillboardCollection({ blendOption: BlendOption.OPAQUE })
);

// Adding a billboard — image is the pre-rendered canvas (same object = same texture)
const bb = billboards.add({
  position: Cartesian3.fromDegrees(lon, lat, alt),
  image: AIRCRAFT_ICON,         // HTMLCanvasElement reference — shared across all aircraft billboards
  width: 24,                    // pixels
  height: 24,
  rotation: CesiumMath.toRadians(-(true_track ?? 0)),  // heading → rotation (note: negative for north-up convention)
  alignedAxis: Cartesian3.ZERO, // screen-aligned rotation
  id: icao24,                   // same id scheme as existing PointPrimitive — click handler unchanged
  scaleByDistance: new NearFarScalar(1e4, 1.5, 5e6, 0.4),
});
```

### PointPrimitive.scaleByDistance (Satellite Layer)

Additive change only — no collection rebuild needed. Applied to each `PointPrimitive` after it is created via `collection.add()`:

```typescript
// Source: CesiumJS PointPrimitive official docs
// https://cesium.com/learn/cesiumjs/ref-doc/PointPrimitive.html
const pt = collection.add({
  position: Cartesian3.ZERO,
  pixelSize: 3,
  color: Color.fromCssColorString('#00D4FF'),
  id: satData[i].norad_cat_id,
});
pt.scaleByDistance = new NearFarScalar(5e5, 1.5, 5e7, 0.3);
```

The `scaleByDistance` multiplies `pixelSize`, so a satellite with `pixelSize: 3` and `nearValue: 1.5` renders at `4.5px` when at near distance. Values are starting estimates — tuning required.

### rAF Lerp Loop Update for Aircraft Billboards

The existing lerp loop in `AircraftLayer.tsx` writes to `point.position`. After migration to billboards, the map type changes from `PointPrimitive` to `Billboard` but the position update API is identical:

```typescript
// Before (PointPrimitive):
point.position = Cartesian3.lerp(prev, curr, alpha, scratchLerp);

// After (Billboard) — API is identical:
billboard.position = Cartesian3.lerp(prev, curr, alpha, scratchLerp);
```

The module-scope map `pointsByIcao24` is renamed to `billboardsByIcao24` for clarity. No logic change.

### Heading Rotation Convention

CesiumJS `Billboard.rotation` is in **radians**, positive = counter-clockwise from the canvas's "up" direction. Aircraft heading from OpenSky is `true_track` in degrees measured clockwise from north. The conversion:

```typescript
// heading: degrees clockwise from north → billboard rotation: radians CCW from up
billboard.rotation = CesiumMath.toRadians(-(heading ?? 0));
```

Ships: `ShipRecord.heading` is in degrees; value `511` means "not available" — use `cog` (course over ground) as fallback: `heading === 511 ? (cog ?? 0) : heading`.

Military: `MilitaryAircraftRecord.track` is in degrees, same conversion applies.

### Recommended Project Structure (No Change)

The existing structure is retained. Each layer gets its own file. Canvas pre-renders live as module-scope constants in the same file as their layer component.

```
frontend/src/components/
├── AircraftLayer.tsx         # migrated: PointPrimitiveCollection → BillboardCollection + canvas
├── MilitaryAircraftLayer.tsx # migrated: PointPrimitiveCollection → BillboardCollection + canvas
├── ShipLayer.tsx             # migrated: PointPrimitiveCollection → BillboardCollection + canvas
└── SatelliteLayer.tsx        # additive: scaleByDistance on each PointPrimitive only
```

### Anti-Patterns to Avoid

- **Creating a canvas per entity:** Each `collection.add()` call with a unique canvas object creates a new TextureAtlas entry. With hundreds of aircraft, this exhausts the GPU texture budget. Use one canvas constant per entity type.
- **Updating `billboard.image` after initial add:** Re-assigning `image` adds a new TextureAtlas entry; old entry is never reclaimed. The icon shape is constant (not rotation-based) — do not update `image` after creation.
- **Running PointPrimitiveCollection and BillboardCollection in parallel:** The project decision requires atomic migration. Two collections for the same entity type causes doubled draw calls and doubled pickable primitives (click handler would fire for both).
- **Setting `billboard.alignedAxis` to `Cartesian3.UNIT_Z`:** This makes the billboard z-axis-aligned (faces camera but locked to globe up). For a screen-space rotation (heading arrow), `alignedAxis: Cartesian3.ZERO` (screen-aligned) is correct and simpler.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Altitude-based icon scaling | Custom camera distance listener + resize logic | `Billboard.scaleByDistance = new NearFarScalar(...)` | Built into GPU shader — zero JS overhead; handles all zoom levels including tilt |
| Satellite distance scaling | Custom pixelSize adjustment in rAF loop | `PointPrimitive.scaleByDistance = new NearFarScalar(...)` | Same GPU path — no per-frame JS calculation |
| Icon canvas texture deduplication | Manual cache/LRU for canvas textures | Pass same canvas reference to every `collection.add({ image: CANVAS_CONST })` | CesiumJS TextureAtlas automatically shares textures when same object reference is used |
| Rotation conversion | Custom trig for heading to screen-space | `CesiumMath.toRadians(-heading)` with `alignedAxis: Cartesian3.ZERO` | Standard Cesium pattern |

---

## Common Pitfalls

### Pitfall 1: TextureAtlas DeveloperError at Scale
**What goes wrong:** `DeveloperError: Width must be less than or equal to the maximum texture size` crash when many entities with unique canvas objects are added.
**Why it happens:** Each distinct canvas object or image URL creates a new slot in the TextureAtlas GPU texture. The atlas grows until it exceeds the hardware maximum (4096–16384 depending on GPU).
**How to avoid:** Use exactly one module-scope canvas constant per entity type. All 500+ aircraft billboards reference the same `AIRCRAFT_ICON` canvas object.
**Warning signs:** Console DeveloperError mentioning TextureAtlas or texture width on initial load.

### Pitfall 2: Billboard.rotation vs alignedAxis Confusion
**What goes wrong:** Icon points in the wrong direction or rotates incorrectly as camera tilts/orbits.
**Why it happens:** Two rotation systems interact: `alignedAxis` defines which axis the billboard is aligned to, and `rotation` is an offset from that alignment. `UNIT_Z` makes rotation relative to north; `Cartesian3.ZERO` makes rotation screen-space only.
**How to avoid:** Use `alignedAxis: Cartesian3.ZERO` (default) with `rotation: CesiumMath.toRadians(-heading)` for screen-space heading arrows. Do not set `alignedAxis: Cartesian3.UNIT_Z` unless you specifically want globe-north-relative rotation.
**Warning signs:** Icon appears to rotate as you orbit the camera even when the aircraft isn't moving.

### Pitfall 3: Ship heading === 511 (not available)
**What goes wrong:** Billboard renders pointing north (rotation: 0) for all stationary ships.
**Why it happens:** AIS spec uses `511` as the "heading not available" sentinel for the `heading` field. Passing `511` to `toRadians()` produces nonsensical rotation.
**How to avoid:** `const rot = ship.heading !== null && ship.heading !== 511 ? ship.heading : (ship.cog ?? 0); billboard.rotation = CesiumMath.toRadians(-rot);`
**Warning signs:** Ships all appear pointing the same direction; ships show random heading values.

### Pitfall 4: Parallel PointPrimitive + BillboardCollection During Transition
**What goes wrong:** Scene.pick() returns ambiguous results; click handler selects wrong entity; duplicate draw calls.
**Why it happens:** If old PointPrimitiveCollection is not removed atomically when new BillboardCollection is added, both respond to clicks.
**How to avoid:** The migration effect should create the `BillboardCollection`, populate it, and then immediately call `viewer.scene.primitives.remove(oldCollection)`. No frame where both exist.
**Warning signs:** Clicking an entity opens wrong detail panel or opens no panel.

### Pitfall 5: NearFarScalar Values Require In-Browser Tuning
**What goes wrong:** Icons too large at orbital view or too small at street level; icons disappear at intermediate zoom.
**Why it happens:** NearFarScalar `near` and `far` distances are in meters from camera to entity. Aircraft at 10,000m altitude: camera-entity distance is not the same as camera height above ground. Starting values are estimates.
**How to avoid:** After implementation, perform a continuous zoom test from 20,000 km orbital altitude to 500 m street level, adjusting values until icons remain legible at all zoom levels. Aircraft near=1e4/far=5e6 and satellite near=5e5/far=5e7 are starting points only.
**Warning signs:** Icons pop/disappear at certain zoom levels; icons too large to distinguish at orbital view.

---

## Code Examples

Verified patterns from official Cesium documentation:

### NearFarScalar Constructor
```typescript
// Source: https://cesium.com/learn/ion-sdk/ref-doc/NearFarScalar.html
// new NearFarScalar(near, nearValue, far, farValue)
// near: camera distance in meters where nearValue applies
// far: camera distance in meters where farValue applies
// Values clamp outside range
const scale = new NearFarScalar(1.5e2, 1.5, 8.0e6, 0.0);
// → scale 1.5x when camera is 150m away, scale 0 (invisible) at 8,000 km
```

### Billboard Add with All Required Properties
```typescript
// Source: https://cesium.com/learn/ion-sdk/ref-doc/BillboardCollection.html
const billboard = billboards.add({
  position: Cartesian3.fromDegrees(lon, lat, alt),
  image: AIRCRAFT_ICON,                                   // pre-rendered HTMLCanvasElement
  width: 24,
  height: 24,
  rotation: CesiumMath.toRadians(-heading),              // heading → CCW radians
  alignedAxis: Cartesian3.ZERO,                          // screen-space rotation
  id: entityId,                                          // used by scene.pick()
  scaleByDistance: new NearFarScalar(1e4, 1.5, 5e6, 0.4),
  show: layerVisible,
});
```

### PointPrimitive scaleByDistance (Satellite)
```typescript
// Source: https://cesium.com/learn/cesiumjs/ref-doc/PointPrimitive.html
const pt = collection.add({
  position: Cartesian3.ZERO,
  pixelSize: 3,
  color: Color.fromCssColorString('#00D4FF'),
  id: norad_cat_id,
});
// scaleByDistance set after add — multiplies pixelSize
pt.scaleByDistance = new NearFarScalar(5e5, 1.5, 5e7, 0.3);
```

### Unified Click Handler — No Change Needed
The existing `AircraftLayer.tsx` unified LEFT_CLICK handler uses `picked.id` string prefixes (`mmsi:`, `mil:`, bare icao24) to route selection. Billboard primitives return the same `id` from `scene.pick()` as point primitives. No change to click handler logic is required when migrating.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| PointPrimitive dots for all entity types | BillboardCollection with shaped SVG icons for aircraft/military/ships | Phase 14 (this phase) | Visual clarity: entity types distinguishable at a glance |
| No altitude scaling | NearFarScalar on all billboard and point layers | Phase 14 (this phase) | Icons legible from 20,000 km orbital to 500 m street level |
| Satellite as PointPrimitive (no scaling) | Satellite PointPrimitive + scaleByDistance | Phase 14 (this phase) | Satellite dots scale proportionally without GPU texture cost |

**Locked/Out of scope:**
- Satellite billboard icons: Out of scope permanently (GPU TextureAtlas limit — 5,000+ entities). Documented in REQUIREMENTS.md Out of Scope table.
- Per-entity dynamic icon textures (e.g., rotation baked into texture): Don't hand-roll — use `billboard.rotation` property instead.

---

## Open Questions

1. **NearFarScalar exact values for each layer**
   - What we know: Starting ranges — aircraft/ships near=1e4/far=5e6; satellites near=5e5/far=5e7 (from STATE.md blockers note)
   - What's unclear: Whether camera-to-entity distance for aircraft at 10,000m altitude matches "1e4" when camera is at eye-level vs orbital; ships at 100m altitude will have very different near values
   - Recommendation: Plan 04 (14-04) includes a mandatory tuning step with continuous zoom test; starting values are documented above as estimates only

2. **PointPrimitive.scaleByDistance — set at add-time vs post-add**
   - What we know: Official docs say "Do not call the constructor directly" for PointPrimitive; all properties set via collection.add() options or post-add assignment
   - What's unclear: Whether `scaleByDistance` can be passed as an option to `collection.add({...})` or must be set as `pt.scaleByDistance = ...` after the call
   - Recommendation: Set post-add (`pt.scaleByDistance = new NearFarScalar(...)`) — confirmed safe from official docs; add-time option may also work but is not confirmed for this specific property

3. **Icon size (width/height in pixels)**
   - What we know: Current points are 3–5 px; billboard base size before scaling needs to be set
   - What's unclear: Optimal base size (24x24 vs 32x32) for recognizability vs visual noise at orbital view
   - Recommendation: Start with 24x24 for aircraft/military, 20x20 for ships; adjust during Plan 04 tuning

---

## Validation Architecture

No automated test framework exists in this project (no vitest/jest config, no test scripts in `package.json`). Phase validation is performed by visual/manual inspection.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | None — no test infrastructure exists |
| Config file | None |
| Quick run command | `cd frontend && npm run build` (TypeScript compile check only) |
| Full suite command | `cd frontend && npm run lint && npm run build` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ICONS-01 | Aircraft billboard visible in scene | manual-only | — | N/A |
| ICONS-02 | Military billboard visually distinct from aircraft | manual-only | — | N/A |
| ICONS-03 | Ship hull icon visible in scene | manual-only | — | N/A |
| ICONS-04 | Satellite uses PointPrimitive (not billboard); no GPU crash at 5,000+ | manual-only | — | N/A |
| ICONS-05 | All icon types remain legible from 20,000 km to 500 m zoom | manual-only | — | N/A |

### Sampling Rate
- **Per task commit:** `npm run build` (TypeScript compile passes)
- **Per wave merge:** `npm run lint && npm run build`
- **Phase gate:** Visual zoom test from orbital to street level + all entity types visible before marking phase complete

### Wave 0 Gaps
None — no test infrastructure needed for visual/rendering changes. TypeScript compile is the mechanically verifiable check.

---

## Sources

### Primary (HIGH confidence)
- `https://cesium.com/learn/ion-sdk/ref-doc/Billboard.html` — `image` property accepts HTMLCanvasElement, `scaleByDistance` type NearFarScalar, `rotation` in radians, `alignedAxis`, texture sharing via same id
- `https://cesium.com/learn/ion-sdk/ref-doc/BillboardCollection.html` — `add()` method signature, texture atlas performance notes
- `https://cesium.com/learn/cesiumjs/ref-doc/PointPrimitive.html` — `scaleByDistance` property confirmed on PointPrimitive, multiplies pixelSize
- `https://cesium.com/learn/ion-sdk/ref-doc/NearFarScalar.html` — constructor: `new NearFarScalar(near, nearValue, far, farValue)`

### Secondary (MEDIUM confidence)
- `https://community.cesium.com/t/dynamic-svg-billboard-makes-textureatlas-to-exceed-its-maximumtexturesize-limit/4091` — TextureAtlas exhaustion pattern confirmed; pre-render solution validated
- `https://community.cesium.com/t/dynamically-updating-billboard-textures-memory-leak/1674` — Re-assigning `billboard.image` leaks TextureAtlas entries; do not update image post-creation
- `https://github.com/CesiumGS/cesium/issues/10522` — Billboard.scaleByDistance non-linear interpolation behavior (does not affect correctness for this use case)
- Project STATE.md — Locked decisions: satellite stays PointPrimitive, billboard migration is per-layer atomic two-step, SVG canvases pre-rendered at module scope

### Tertiary (LOW confidence)
- `https://community.cesium.com/t/how-to-use-alignedaxis-for-a-billboard/1586` — `alignedAxis: Cartesian3.ZERO` for screen-space heading rotation (single community source, but consistent with official docs description)

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — Cesium 1.139.1 already installed; all APIs (`BillboardCollection`, `NearFarScalar`, `PointPrimitive.scaleByDistance`) confirmed in official docs
- Architecture: HIGH — Pre-render pattern, atomic migration, and module-scope canvas confirmed by official docs + project STATE.md decisions
- Pitfalls: HIGH — TextureAtlas limit and heading sentinel (511) are verified against official sources and community reports; NearFarScalar tuning values are MEDIUM (starting estimates only)

**Research date:** 2026-03-12
**Valid until:** 2026-04-12 (stable Cesium APIs — 30 day horizon)
