# Phase 4: Controls and Polish - Research

**Researched:** 2026-03-11
**Domain:** CesiumJS camera control, React search/filter UI, Zustand state extension, FastAPI query params, Tailwind responsive layout
**Confidence:** HIGH

---

## Summary

Phase 4 adds the full control surface to a working globe that already renders 5,000+ satellites and hundreds of live aircraft. The existing Zustand store (`useAppStore`), TanStack Query hooks, Primitive API layers, and BottomStatusBar are in place. The work is additive — extend what exists rather than replace it.

The two search flows (satellite and aircraft) follow the same pattern: filter the client-side data that is already loaded in TanStack Query cache, select the matched object by writing to Zustand, and trigger a CesiumJS `camera.flyTo()` to the position. No new backend endpoints are required for search because the full dataset is already client-resident.

Filters (constellation, altitude band for satellites; bounding box, altitude range for aircraft) are pure client-side transforms on the cached data — they control which Primitive points are visible each frame via `show = false` on individual `PointPrimitive` objects. The BottomStatusBar already shows TLE freshness; it needs to be extended to show aircraft freshness per active layer. Layer toggles are already stubbed in Zustand (`layers: { satellites: boolean; aircraft: boolean }`) — they simply need to be wired up to show/hide the Primitive collections.

**Primary recommendation:** Implement search and filter as client-side operations on already-cached data. Use `viewer.camera.flyTo()` for globe navigation. Extend the existing Zustand store with filter slices. Toggle layer visibility by setting `show` on each point in the Primitive collection.

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| GLOB-03 | User sees a data freshness indicator showing last update time per active layer | `/api/satellites/freshness` and `/api/aircraft/freshness` endpoints exist; BottomStatusBar already shows TLE freshness; extend to show aircraft freshness per visible layer |
| SAT-03 | User can search satellites by name or NORAD ID and fly to result | Full satellite list already in TanStack Query cache as `satellites.data`; filter by `object_name` ILIKE or `norad_cat_id == N`; fly with `camera.flyTo()` using propagated ECEF position |
| SAT-04 | User can filter satellites by constellation or altitude band and scene updates | `constellation` field exists on every satellite; altitude derived from `mean_motion`; filter is `show` toggle on PointPrimitive in SatelliteLayer |
| AIR-03 | User can search aircraft by callsign or ICAO24 and fly to result | Full aircraft list in TanStack Query cache as `aircraft.data`; filter by `callsign.trim()` or `icao24`; position is `latitude/longitude` already loaded |
| AIR-04 | User can filter aircraft by region (bounding box) or altitude range and scene updates | Lat/lon and `baro_altitude` are in every aircraft record in cache; bounding box is lat/lon range check; `show` toggle on PointPrimitive |
| INT-03 | User can toggle each data layer on/off independently | `layers: { satellites, aircraft }` already in Zustand; SatelliteLayer/AircraftLayer need to read this flag and set `show` on the collection or skip rendering |
| INT-04 | UI is responsive and usable on desktop and tablet viewports | All UI chrome uses `position: fixed/absolute` with px widths; needs Tailwind breakpoints to collapse panels and sidebar on tablet |
</phase_requirements>

---

## Standard Stack

### Core (already installed — no new packages required)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| cesium | ^1.139.1 | Globe camera control (`flyTo`, `flyToBoundingSphere`) | Already in use; camera API is stable |
| zustand | ^5.0.11 | Filter and search state | Already used for all app state |
| @tanstack/react-query | ^5.90.21 | Cached satellite/aircraft data for search/filter | Already fetching full datasets |
| tailwindcss | ^3.4.19 | Responsive layout breakpoints | Already configured (v3 pattern) |
| react | ^19.2.0 | Search input component, filter panel | Already in use |

### Supporting (already installed)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| lucide-react | ^0.577.0 | Search icon, close button, layer toggle icons | Available, use for UI controls |
| shadcn (button, sheet) | ^4.0.5 | Button and Sheet components already present | sheet.tsx and button.tsx in `/components/ui/` |
| clsx + tailwind-merge | in deps | Conditional class names | Use in any new UI component |

### No New Packages Needed
All required capabilities are in the existing dependency tree. Do NOT add `react-select`, `downshift`, `fuse.js`, or other search libraries — the dataset is small enough for native JS `Array.filter()`.

### Installation
```bash
# Nothing to install — all dependencies already present
```

---

## Architecture Patterns

### Recommended Project Structure (additions only)
```
frontend/src/
├── components/
│   ├── LeftSidebar.tsx        # EXTEND: add SearchBar + FilterPanel + LayerToggles
│   ├── BottomStatusBar.tsx    # EXTEND: add per-layer freshness display
│   ├── SatelliteLayer.tsx     # EXTEND: read filter state, set point.show
│   ├── AircraftLayer.tsx      # EXTEND: read filter state, set point.show
│   └── SearchBar.tsx          # NEW: unified search input for satellites + aircraft
├── store/
│   └── useAppStore.ts         # EXTEND: add filter slices + searchFlyTo action
```

### Pattern 1: Client-Side Search + Camera Fly-To

**What:** User types a query; the hook filters the already-cached TanStack Query data; the matching object's Zustand ID is set (triggering the existing detail panel); then `camera.flyTo()` flies to the position.

**When to use:** Both SAT-03 and AIR-03 follow this pattern.

**How to pass the viewer to the search action:**
The `viewer` instance lives in `App.tsx` state (`const [cesiumViewer, setCesiumViewer]`). Pass it down as a prop to `LeftSidebar`, or expose it via a ref stored in Zustand as a non-serializable value. The cleanest pattern (avoids prop-drilling) is a module-level `viewerRegistry` singleton used only for camera calls:

```typescript
// frontend/src/lib/viewerRegistry.ts
// Source: CesiumJS docs — camera.flyTo is called imperatively, not through React state

let _viewer: import('cesium').Viewer | null = null;

export function registerViewer(v: import('cesium').Viewer) {
  _viewer = v;
}

export function flyToPosition(lon: number, lat: number, altMeters: number) {
  if (!_viewer || _viewer.isDestroyed()) return;
  _viewer.camera.flyTo({
    destination: Cartesian3.fromDegrees(lon, lat, altMeters + 2_000_000),
    duration: 2.0,
  });
}

export function flyToCartesian(position: import('cesium').Cartesian3) {
  if (!_viewer || _viewer.isDestroyed()) return;
  _viewer.camera.flyTo({
    destination: position,
    duration: 2.0,
  });
}
```

**Satellite search flow:**
```typescript
// In SearchBar: query against satellites.data from useSatellites() hook
const query = searchInput.trim().toLowerCase();
const match = satellites.data?.find(s =>
  String(s.norad_cat_id) === query ||
  (s.omm as any).OBJECT_NAME?.toLowerCase().includes(query)
);
if (match) {
  useAppStore.getState().setSelectedSatelliteId(match.norad_cat_id);
  // Position comes from the propagation worker — use current point position
  // OR fly to last-known ECEF from the collectionRef via a shared ref
}
```

**Aircraft search flow:**
```typescript
const match = aircraft.data?.find(ac =>
  ac.icao24 === query ||
  ac.callsign?.trim().toLowerCase().includes(query)
);
if (match && match.latitude != null && match.longitude != null) {
  useAppStore.getState().setSelectedAircraftId(match.icao24);
  flyToPosition(match.longitude, match.latitude, match.baro_altitude ?? 10_000);
}
```

**Satellite fly-to challenge:** Satellite positions are computed in the Web Worker and live in the `PointPrimitiveCollection`. To fly the camera to a satellite, the cleanest approach is to request the current position from the worker via a new message type `GET_POSITION` that returns the last-propagated ECEF for a given NORAD ID, then call `flyToCartesian()`. Alternatively, re-propagate on the main thread for just that one satellite (acceptable for single-object lookup).

### Pattern 2: Primitive Visibility Filtering

**What:** Satellite/aircraft points are filtered by setting `point.show = false` on each `PointPrimitive` in the collection. This is O(N) per filter change but only ~5,000 items — fast enough.

**When to use:** SAT-04, AIR-04, INT-03

**Satellite filter implementation:**
```typescript
// In SatelliteLayer — Effect watching filterState from Zustand
const satelliteFilter = useAppStore(s => s.satelliteFilter);

useEffect(() => {
  if (!collectionRef.current || collectionRef.current.isDestroyed()) return;
  const collection = collectionRef.current;
  const satData = satellites.data ?? [];
  for (let i = 0; i < collection.length; i++) {
    const pt = collection.get(i);
    const sat = satData[i];
    if (!sat) continue;
    pt.show = matchesSatelliteFilter(sat, satelliteFilter);
  }
}, [satelliteFilter, satellites.data]);
```

**Aircraft filter + layer toggle:**
```typescript
// In AircraftLayer — runs after aircraft.data changes or filter changes
for (const [icao24, point] of pointsByIcao24) {
  const ac = aircraft.data?.find(a => a.icao24 === icao24);
  if (!ac) continue;
  point.show = layersVisible.aircraft && matchesAircraftFilter(ac, aircraftFilter);
}
```

**Layer toggle (INT-03):** The `layers` slice already exists in Zustand. Implement by reading `layers.satellites` in SatelliteLayer and calling `collection.show = visible` (collection-level toggle, O(1)) or `pt.show` individually. Collection-level is preferred:

```typescript
// Collection-level show/hide — O(1), preferred over per-point iteration
if (collectionRef.current && !collectionRef.current.isDestroyed()) {
  collectionRef.current.show = layers.satellites;
}
```

### Pattern 3: Zustand Store Extension

**What:** Add filter slices for satellites and aircraft to the existing store.

**New store shape:**
```typescript
// Extend useAppStore.ts — add to AppState interface
satelliteFilter: {
  constellation: string | null;    // null = all
  altitudeBand: [number, number] | null; // [min_km, max_km], null = all
};
setSatelliteFilter: (f: Partial<AppState['satelliteFilter']>) => void;

aircraftFilter: {
  altitudeRange: [number, number] | null;   // [min_m, max_m], null = all
  boundingBox: { minLat: number; maxLat: number; minLon: number; maxLon: number } | null;
};
setAircraftFilter: (f: Partial<AppState['aircraftFilter']>) => void;

searchQuery: string;
setSearchQuery: (q: string) => void;

// Aircraft freshness (mirror of tleLastUpdated for aircraft layer)
aircraftLastUpdated: string | null;
setAircraftLastUpdated: (ts: string | null) => void;
```

### Pattern 4: Altitude Derivation for Satellite Filter

The satellite altitude is not stored directly — it is derived from `mean_motion`. The same formula used in `routes_satellites.py` can be used client-side:

```typescript
function satelliteAltitudeKm(omm: Record<string, unknown>): number {
  const mu = 398600.4418;
  const re = 6371.0;
  const meanMotion = (omm.MEAN_MOTION as number) ?? 14;
  const n = meanMotion * 2 * Math.PI / 86400;  // rad/s
  const a = Math.cbrt(mu / (n * n));            // km
  return a - re;
}
```

**Altitude bands (suggested UI options):**
- LEO: 0–2000 km
- MEO: 2000–35000 km
- GEO: 35000–36500 km
- HEO: >36500 km

### Pattern 5: Data Freshness Indicator Extension (GLOB-03)

BottomStatusBar already shows TLE freshness from `/api/satellites/freshness`. Extend to show aircraft freshness. Both freshness values should update live (poll at their respective layer intervals).

```typescript
// In BottomStatusBar — add aircraft freshness fetch
useEffect(() => {
  const fetchFreshness = () =>
    fetch('/api/aircraft/freshness')
      .then(r => r.json())
      .then((d: { last_updated?: string | null }) =>
        setAircraftLastUpdated(d.last_updated ?? null))
      .catch(() => {});

  fetchFreshness();
  const id = setInterval(fetchFreshness, 90_000); // matches aircraft poll interval
  return () => clearInterval(id);
}, [setAircraftLastUpdated]);
```

Both indicators should only show when the respective layer is active (`layers.satellites` / `layers.aircraft`).

### Pattern 6: Responsive Layout (INT-04)

Current layout uses `position: fixed` with hard-coded px widths. For tablet support (768px+), the LeftSidebar and RightDrawer need to not overlap the globe.

**Key breakpoints:**
- Desktop (≥1024px): LeftSidebar 280px fixed, RightDrawer 300px fixed
- Tablet (768–1023px): LeftSidebar as a Sheet/modal overlay, RightDrawer 260px
- The BottomStatusBar truncates or hides lesser-priority items below 768px

Tailwind v3 approach (matching existing `tailwindcss: ^3.4.19` + `tw-animate-css`):

```tsx
// LeftSidebar: use md: breakpoint to show as a slide-over sheet on small screens
// shadcn Sheet component is already installed (sheet.tsx in /components/ui/)
<Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
  <SheetContent side="left" className="w-[280px] bg-black/90 border-r border-cyan-500/15">
    {/* filter panel content */}
  </SheetContent>
</Sheet>
```

**Critical:** The globe `div#cesiumContainer` must remain `width: 100vw; height: 100vh` — the overlay approach (drawers over the globe) is already established and correct. Do not change the globe container layout.

### Anti-Patterns to Avoid

- **Adding a search endpoint to FastAPI:** The full satellite list (~5,000 records) and aircraft list are already loaded in TanStack Query cache. A backend search endpoint adds a round-trip for no benefit. Search on the client.
- **Using `PolylineCollection` or `BillboardCollection` for filtered-out objects:** Set `point.show = false` — don't remove and re-add primitives. Remove/add triggers collection rebuild and GPU reupload, causing frame drops.
- **Using `viewer.entities` for search result highlight:** The codebase uses Primitive API exclusively. Stay in Primitive API. To highlight a selected search result, change `point.color` and `point.pixelSize` on the selected point.
- **Storing viewer in Zustand state:** Zustand state is serializable. Store the viewer in a module-level registry or React ref, not in Zustand state.
- **Debouncing search with `useEffect` on keypress:** Use `onChange` with a simple 300ms `setTimeout` debounce inline, or an `input` event with `debounce()` from the browser — no library needed.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Camera fly-to animation | Custom easing/animation loop | `viewer.camera.flyTo({ duration: 2.0 })` | CesiumJS has built-in smooth flyTo with configurable duration and easing |
| Fuzzy search | Levenshtein distance / trie | `Array.filter` + `String.includes` | ~5,000 satellites, ~500 aircraft — O(N) scan is <1ms |
| Responsive slide-over drawer | Custom CSS animation | `shadcn/ui Sheet` (already installed: `sheet.tsx`) | Sheet is already wired into the shadcn setup |
| Altitude calculation | Custom orbital mechanics | Reuse formula from `routes_satellites.py` | Same vis-viva equation already validated in tests |
| Layer toggle | Custom show/hide DOM | `collection.show = bool` on CesiumJS primitive collection | One property, O(1), no re-render needed |

---

## Common Pitfalls

### Pitfall 1: Satellite Position Not Available for Fly-To
**What goes wrong:** `camera.flyTo()` is called on search but the satellite's current 3D position is only in the Web Worker — not accessible on the main thread.
**Why it happens:** The propagation loop runs inside `propagation.worker.ts` with positions packed into a `Float64Array`; main thread only has point primitives in the collection.
**How to avoid:** Add a `GET_POSITION` message type to the worker that returns the last-computed ECEF `[x, y, z]` for a given NORAD ID. The worker already tracks positions in its internal map. Alternatively, re-propagate the single satellite on the main thread using `satellite.js` (acceptable for one object, not for all 5,000).
**Warning signs:** `camera.flyTo()` called with `Cartesian3.ZERO` — globe snaps to center.

### Pitfall 2: Filter Effect Runs Before Collection Is Populated
**What goes wrong:** The Zustand filter state changes trigger the filter effect before the point collection has been built (before the `LOADED` worker message).
**Why it happens:** Zustand subscriptions run synchronously on state change; the collection population happens asynchronously after the worker sends `LOADED`.
**How to avoid:** Guard the filter effect: `if (!collectionRef.current || collection.length === 0) return;` — or read `collection.length` before iterating.

### Pitfall 3: `collection.show` vs Per-Point `show`
**What goes wrong:** Layer toggle sets `collection.show = false` but filter also sets individual `point.show = false`. When the layer is toggled back on, all previously-filtered-out points reappear because `collection.show = true` overrides per-point `show = false`.
**Why it happens:** CesiumJS `PointPrimitiveCollection.show` is a collection-wide override — it does not interact with per-point `show`.
**How to avoid:** Use EITHER collection-level show for layer toggle OR per-point show for filters, not both. Recommended: use per-point `show` for everything. Layer toggle iterates the collection and sets each point's `show` to `layers.active && matchesFilter(...)`.

### Pitfall 4: RightDrawer Width Breaks on Tablet
**What goes wrong:** `right: isOpen ? 0 : '-320px'` causes the drawer to push off-screen incorrectly on a 768px viewport.
**Why it happens:** Hard-coded `-320px` exceeds the viewport margin assumption on narrow viewports.
**How to avoid:** Use Tailwind responsive classes or CSS `clamp()`. On tablet, set drawer width to `min(300px, 100vw - 48px)`.

### Pitfall 5: BottomStatusBar Overflow on Narrow Viewports
**What goes wrong:** The status bar has two data points on a single row. On tablet, the row overflows and the second item is cut off.
**Why it happens:** The bar uses `justifyContent: space-between` with no overflow handling.
**How to avoid:** Wrap the freshness indicators in a flex container that uses `flex-wrap: wrap` and hides the lesser-priority item with `hidden md:flex` Tailwind classes.

### Pitfall 6: TanStack Query Cache and Filter Interaction
**What goes wrong:** `aircraft.data` is filtered in the component; when TanStack Query refetches (every 90s), the filter is not re-applied because the effect dependency array doesn't include `aircraft.data`.
**Why it happens:** The filter effect only re-runs when the filter slice changes, not when the underlying data updates.
**How to avoid:** Include `aircraft.data` (or `satellites.data`) in the filter effect's dependency array. This is the correct pattern — re-running the filter on every data refresh is cheap.

---

## Code Examples

### CesiumJS camera.flyTo
```typescript
// Source: CesiumJS Camera docs — https://cesium.com/learn/cesiumjs/ref-doc/Camera.html
viewer.camera.flyTo({
  destination: Cartesian3.fromDegrees(longitude, latitude, altitudeMeters),
  duration: 2.0,            // seconds
  // Optional: orientation at destination
  orientation: {
    heading: CesiumMath.toRadians(0),
    pitch: CesiumMath.toRadians(-45),
    roll: 0.0,
  },
});
```

### CesiumJS PointPrimitive show toggle
```typescript
// Source: CesiumJS PointPrimitive docs
// Per-point show — O(N) but only at filter-change time, not every frame
for (let i = 0; i < collection.length; i++) {
  const pt = collection.get(i);
  pt.show = matchesFilter(pt.id);
}
```

### Satellite altitude filter (client-side)
```typescript
// Source: same vis-viva formula as routes_satellites.py
function satelliteAltitudeKm(meanMotionRevDay: number): number {
  const mu = 398600.4418;  // km³/s²
  const re = 6371.0;       // km
  const n = meanMotionRevDay * 2 * Math.PI / 86400;
  const a = Math.cbrt(mu / (n * n));
  return a - re;
}
```

### Zustand store extension pattern
```typescript
// Source: Zustand v5 docs — set((s) => ({...})) for partial updates
setAircraftFilter: (f) =>
  set((s) => ({ aircraftFilter: { ...s.aircraftFilter, ...f } })),
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| CesiumJS Entity API | Primitive API (PointPrimitiveCollection) | Phase 2 decision | Entity API collapses at 5,000+ objects — keep Primitive API |
| TanStack Query v4 | v5 (breaking API changes in `useQuery`) | Dependency already at v5.90 | `isLoading` / `isPending` distinction; `enabled` flag; all patterns already in codebase |
| Zustand v4 | v5 (breaking: `create` import path changed) | Already at v5.0.11 | `useAppStore.getState()` pattern used in click handler — correct v5 pattern |

---

## Open Questions

1. **Satellite fly-to position source**
   - What we know: The propagation worker computes ECEF positions but does not expose them back to the main thread per individual request.
   - What's unclear: Whether to add a `GET_POSITION` worker message or re-propagate on main thread for single-object lookup.
   - Recommendation: Add `GET_POSITION` message to the worker — it already has the data, the response is fast, and it avoids duplicating satellite.js logic on the main thread.

2. **Bounding box filter UX**
   - What we know: AIR-04 requires bounding box filtering. The aircraft lat/lon are in the cached data.
   - What's unclear: Whether the bounding box is entered as text coordinates or drawn interactively on the globe.
   - Recommendation: Start with four text inputs (min/max lat, min/max lon) — interactive drawing on the Cesium canvas is a Phase 5+ feature. The requirement text says "bounding box" without specifying the interaction model.

3. **Layer toggle button placement**
   - What we know: `LeftSidebar` is currently an empty stub (renders `null` when `sidebarOpen: false`). Layer toggles must be accessible.
   - What's unclear: Whether to put toggles in the sidebar (requires clicking a hamburger) or as persistent overlay buttons on the globe.
   - Recommendation: Add a persistent layer toggle strip in the bottom-left corner of the globe overlay — always visible, one button per layer. The sidebar can hold the more detailed filters.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | pytest + pytest-asyncio (existing in backend/tests/) |
| Config file | `backend/pytest.ini` or `pyproject.toml` (check backend root) |
| Quick run command | `cd backend && python3.11 -m pytest tests/ -x -q` |
| Full suite command | `cd backend && python3.11 -m pytest tests/ -v` |

### Phase Requirements → Test Map

Phase 4 requirements are predominantly frontend UI behaviors. Backend additions are limited to query parameter support on existing endpoints. Tests focus on backend filter parameters.

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SAT-03 | Search satellite by NORAD ID returns correct record | unit (API) | `python3.11 -m pytest tests/test_satellites.py::test_satellite_detail_returns_metadata -x` | ✅ existing |
| SAT-04 | Filter satellites by constellation via query param | unit (API) | `python3.11 -m pytest tests/test_satellites.py::test_satellite_list_filter_constellation -x` | ❌ Wave 0 |
| SAT-04 | Filter satellites by altitude band via query param | unit (API) | `python3.11 -m pytest tests/test_satellites.py::test_satellite_list_filter_altitude -x` | ❌ Wave 0 |
| AIR-03 | Search aircraft by ICAO24 returns correct record | unit (API) | `python3.11 -m pytest tests/test_aircraft.py::test_aircraft_detail_returns_metadata -x` | ✅ existing |
| AIR-04 | Filter aircraft by altitude range via query param | unit (API) | `python3.11 -m pytest tests/test_aircraft.py::test_aircraft_list_filter_altitude -x` | ❌ Wave 0 |
| AIR-04 | Filter aircraft by bounding box via query param | unit (API) | `python3.11 -m pytest tests/test_aircraft.py::test_aircraft_list_filter_bbox -x` | ❌ Wave 0 |
| INT-03 | Layer visibility toggle: satellites hidden | manual-only | Visual verification on globe | N/A |
| INT-04 | Layout at 768px viewport has no overflow | manual-only | Browser devtools responsive mode | N/A |
| GLOB-03 | Freshness endpoint returns ISO timestamp | unit (API) | `python3.11 -m pytest tests/test_satellites.py::test_freshness_endpoint -x` | ✅ existing |

**Note on backend filter params:** The current list endpoints do not accept query parameters (they return the full dataset for client-side filtering). Phase 4 can keep client-side filtering without any backend changes. Adding server-side filter params to `/api/satellites/` and `/api/aircraft/` is optional and would only matter at Phase 5 performance targets. Recommendation: keep client-side filtering in Phase 4; add backend query params only if Phase 5 reveals a bottleneck.

### Sampling Rate
- **Per task commit:** `cd backend && python3.11 -m pytest tests/ -x -q`
- **Per wave merge:** `cd backend && python3.11 -m pytest tests/ -v`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `backend/tests/test_satellites.py` — add `test_satellite_list_filter_constellation`, `test_satellite_list_filter_altitude`
- [ ] `backend/tests/test_aircraft.py` — add `test_aircraft_list_filter_altitude`, `test_aircraft_list_filter_bbox`

*(Only if backend query params are added. If filtering stays client-side, these gaps do not apply.)*

---

## Sources

### Primary (HIGH confidence)
- CesiumJS Camera API — `viewer.camera.flyTo()`, `PointPrimitive.show` documented at https://cesium.com/learn/cesiumjs/ref-doc/Camera.html
- Codebase analysis — `useAppStore.ts`, `SatelliteLayer.tsx`, `AircraftLayer.tsx`, `routes_satellites.py`, `routes_aircraft.py`, `package.json` — all read directly
- Zustand v5 docs — `create`, `getState()` patterns confirmed in existing codebase usage

### Secondary (MEDIUM confidence)
- shadcn/ui Sheet component — `sheet.tsx` already installed; slide-over pattern documented at https://ui.shadcn.com/docs/components/sheet
- Tailwind v3 responsive breakpoints — `md:` = 768px, `lg:` = 1024px — confirmed against installed version `^3.4.19`

### Tertiary (LOW confidence — not needed for implementation)
- Alternative: Fuse.js fuzzy search — not needed given dataset size and `String.includes` sufficiency

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already in use; no new dependencies
- Architecture: HIGH — patterns derived directly from reading the existing layer implementations
- Pitfalls: HIGH — collection.show vs point.show interaction is a documented CesiumJS behavior; others derived from existing code patterns
- Fly-to position source: MEDIUM — `GET_POSITION` worker message pattern is standard but exact implementation is a design decision

**Research date:** 2026-03-11
**Valid until:** 2026-06-11 (CesiumJS API is stable; Zustand/TanStack Query APIs unlikely to break within 90 days)
