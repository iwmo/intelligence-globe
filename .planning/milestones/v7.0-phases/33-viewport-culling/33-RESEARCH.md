# Phase 33: Viewport Culling — Load Layers by Visible Globe Region - Research

**Researched:** 2026-03-14
**Domain:** CesiumJS viewport detection, React Query conditional fetching, FastAPI geographic filtering, PostgreSQL bounding box queries
**Confidence:** HIGH

## Summary

Phase 33 introduces viewport-aware data loading: API requests carry `minLat/maxLat/minLon/maxLon` bounding-box query parameters derived from the CesiumJS camera's current view rectangle. The backend filters database rows to only those within the box before returning them. When the camera moves enough to materially change the view, the frontend re-fetches.

The project already contains a complete working precedent in `useStreetTraffic.ts`: `camera.moveEnd` fires, `viewer.camera.computeViewRectangle()` returns a `Rectangle` (west/south/east/north in radians), which is converted to degrees and passed to an external API. Phase 33 generalises this pattern to the three most expensive live-data layers — aircraft, ships, and military aircraft — which currently fetch the entire global dataset on every poll cycle.

Satellites are intentionally excluded: they are orbital bodies with globally distributed positions, computed from TLE data in a Web Worker rather than queried from a position table. Viewport-culling satellites would introduce significant propagation complexity for marginal benefit. GPS jamming (`h3index` cells) is also excluded because it is already a coarse aggregated dataset (24-hour cadence, small row count).

**Primary recommendation:** Use `camera.moveEnd` + `computeViewRectangle()` on the frontend (already proven in `useStreetTraffic`), add optional `bbox` query parameters to `/api/aircraft/`, `/api/ships/`, and `/api/military/`, and filter with plain SQL `BETWEEN` clauses on the existing `latitude`/`longitude` columns (no PostGIS required).

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| CesiumJS | ^1.139.1 (already installed) | Viewport rectangle detection via `camera.computeViewRectangle()` and `camera.moveEnd` | Already in use; these APIs are stable since Cesium 1.x |
| @tanstack/react-query | ^5.90.21 (already installed) | Re-fetch on query key change when bbox changes | Already in use; `queryKey: ['aircraft', bbox]` pattern is idiomatic |
| FastAPI | (already installed) | Accept optional `min_lat`, `max_lat`, `min_lon`, `max_lon` query params | Already in use; `Query(default=None)` for optional params |
| SQLAlchemy async | (already installed) | `WHERE latitude BETWEEN min_lat AND max_lat AND longitude BETWEEN min_lon AND max_lon` | Already in use; no extension needed |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Zustand | ^5.0.11 (already installed) | Store viewport bbox in `useAppStore` so all layers share same derived state | When multiple layers need the same bbox value |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Plain SQL BETWEEN | PostGIS ST_Within / ST_MakeEnvelope | PostGIS gives true spatial queries but requires extension install; plain BETWEEN is sufficient for rectangular lat/lon box and this project does not have PostGIS installed |
| `camera.moveEnd` | `camera.changed` with `percentageChanged` | `camera.changed` fires before the move is complete; `moveEnd` fires once movement stops, same as `useStreetTraffic`; prefer consistency with existing code |
| `computeViewRectangle()` | Corner ray-casting via `camera.pickEllipsoid` at 4 corners | Corner approach handles pitched views more accurately but is significantly more complex; `computeViewRectangle` is adequate for bounding-box data queries (false negatives in edge cases are acceptable — they self-correct on next moveEnd) |

**No new installation required.** All libraries already present.

## Architecture Patterns

### Recommended Project Structure

No new files needed for this pattern. Changes are distributed across existing files:

```
frontend/src/
├── store/
│   └── useAppStore.ts         — add viewportBbox slice
├── hooks/
│   ├── useViewportBbox.ts     — NEW: camera.moveEnd → bbox state
│   ├── useAircraft.ts         — accept bbox param, include in queryKey
│   ├── useShips.ts            — accept bbox param, include in queryKey
│   └── useMilitaryAircraft.ts — accept bbox param, include in queryKey
└── components/
    ├── App.tsx                — pass viewer to useViewportBbox, wire bbox to hooks
    ├── AircraftLayer.tsx      — consume bbox from store or prop
    ├── ShipLayer.tsx          — consume bbox from store or prop
    └── MilitaryAircraftLayer.tsx — consume bbox from store or prop

backend/app/api/
├── routes_aircraft.py         — add optional bbox query params + WHERE filter
├── routes_ships.py            — add optional bbox query params + WHERE filter
└── routes_military.py         — add optional bbox query params + WHERE filter
```

### Pattern 1: Viewport Bbox Hook (useViewportBbox)

**What:** A custom React hook that subscribes to `camera.moveEnd`, computes the view rectangle, converts to degrees, and writes to `useAppStore`. The same pattern as `useStreetTraffic.ts` but generalised.

**When to use:** Called once in `App.tsx` alongside other viewer hooks (`useViewerClock`, etc.).

**Example (derived from `useStreetTraffic.ts` precedent):**
```typescript
// src/hooks/useViewportBbox.ts
import { useEffect, useRef } from 'react';
import { Viewer, Math as CesiumMath } from 'cesium';
import { useAppStore } from '../store/useAppStore';

export interface ViewportBbox {
  minLat: number;
  maxLat: number;
  minLon: number;
  maxLon: number;
}

export function useViewportBbox(viewer: Viewer | null): void {
  const setViewportBbox = useAppStore(s => s.setViewportBbox);
  const handlerRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!viewer || viewer.isDestroyed()) return;

    const handler = () => {
      const rect = viewer.camera.computeViewRectangle();
      if (!rect) return; // camera pointing at sky
      setViewportBbox({
        minLon: CesiumMath.toDegrees(rect.west),
        minLat: CesiumMath.toDegrees(rect.south),
        maxLon: CesiumMath.toDegrees(rect.east),
        maxLat: CesiumMath.toDegrees(rect.north),
      });
    };

    handlerRef.current = handler;
    viewer.camera.moveEnd.addEventListener(handler);
    handler(); // initialise on mount

    return () => {
      viewer.camera.moveEnd.removeEventListener(handler);
    };
  }, [viewer, setViewportBbox]);
}
```

### Pattern 2: React Query bbox queryKey

**What:** Include bbox in the React Query `queryKey`. When bbox changes, React Query automatically re-fetches with the new bounding box as query parameters. The hook signature stays the same; the bbox is read from the store.

**When to use:** In `useAircraft`, `useShips`, `useMilitaryAircraft`.

```typescript
// Illustrative change to useAircraft.ts
export function useAircraft() {
  const replayMode = useAppStore(s => s.replayMode);
  const bbox = useAppStore(s => s.viewportBbox);

  return useQuery<AircraftRecord[]>({
    queryKey: ['aircraft', bbox],  // bbox change triggers new fetch
    queryFn: async () => {
      const params = new URLSearchParams();
      if (bbox) {
        params.set('min_lat', String(bbox.minLat));
        params.set('max_lat', String(bbox.maxLat));
        params.set('min_lon', String(bbox.minLon));
        params.set('max_lon', String(bbox.maxLon));
      }
      const url = `/api/aircraft/${bbox ? '?' + params.toString() : ''}`;
      const res = await fetch(url, { signal: controller.signal });
      // ...
    },
    staleTime: 90_000,
    refetchInterval: replayMode === 'live' ? 90_000 : false,
  });
}
```

### Pattern 3: FastAPI Optional Bbox Query Parameters

**What:** Add four optional `float` query parameters to each list endpoint. When absent (global view or first load), the endpoint returns the full dataset. When present, it filters.

**When to use:** All three list endpoints that are bbox-eligible.

```python
# Illustrative change to routes_aircraft.py
from fastapi import APIRouter, Depends, Query
from typing import Optional

@router.get("")
@router.get("/")
async def list_aircraft(
    db: AsyncSession = Depends(get_db),
    min_lat: Optional[float] = Query(default=None),
    max_lat: Optional[float] = Query(default=None),
    min_lon: Optional[float] = Query(default=None),
    max_lon: Optional[float] = Query(default=None),
):
    cutoff = stale_cutoff(settings.AIRCRAFT_STALE_SECONDS)
    stmt = select(Aircraft).where(
        Aircraft.is_active == True,
        Aircraft.latitude.is_not(None),
        Aircraft.longitude.is_not(None),
        Aircraft.fetched_at >= cutoff,
    )
    if all(v is not None for v in (min_lat, max_lat, min_lon, max_lon)):
        stmt = stmt.where(
            Aircraft.latitude.between(min_lat, max_lat),
            Aircraft.longitude.between(min_lon, max_lon),
        )
    result = await db.execute(stmt)
    # ...
```

### Pattern 4: Zustand viewportBbox Slice

**What:** A new slice in `useAppStore` that holds the current viewport bounding box. All three layer hooks subscribe to it independently. Setting it triggers re-renders only in components that subscribe.

```typescript
// Addition to useAppStore.ts
viewportBbox: ViewportBbox | null;
setViewportBbox: (bbox: ViewportBbox | null) => void;
```

### Anti-Patterns to Avoid

- **Bbox in component state (useState):** Causes prop-drilling through App.tsx to every layer component. Use the store slice instead.
- **Triggering on every render frame:** Do NOT use `scene.postRender` for bbox updates. `camera.moveEnd` fires only once when motion stops — matches existing `useStreetTraffic` pattern, avoids flooding the backend.
- **Hardcoding altimeter thresholds in viewport hook:** Let the backend decide what to return; the frontend should always send bbox. If the user is zoomed out showing the full globe, `computeViewRectangle` returns `undefined` (hemisphere visible) — fall back to no bbox parameter (global query), not a hardcoded world bbox.
- **Passing viewer into hooks via prop instead of viewerRegistry:** Existing layer hooks receive `viewer` as a prop from `App.tsx`. Follow the same convention.
- **Removing billboards for out-of-view entities:** The billboard collections are already managed as `show = false` for filtered entities. Do not destroy/re-add billboards when bbox changes — continue using the `show` flag.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Bounding box spatial query | Custom geometry intersection logic | SQL `BETWEEN` on lat/lon columns | B-tree index `idx_aircraft_latlon_not_null` already exists; BETWEEN uses it |
| Viewport detection | Custom ray-casting against ellipsoid | `camera.computeViewRectangle()` | Already proven in `useStreetTraffic.ts`; CesiumJS built-in |
| Camera move debounce | Manual `setTimeout` debounce | `camera.moveEnd` event | `moveEnd` fires once motion stops; built-in throttling; consistent with existing code |
| Re-fetch on bbox change | Manual `useEffect` fetch | React Query `queryKey: ['aircraft', bbox]` | React Query caches previous bbox results; avoids re-fetching if user pans back |

**Key insight:** This project already solved the viewport-detection problem in `useStreetTraffic.ts`. Phase 33 is an extension of that solution, not a new one. The critical implementation knowledge is already embedded in the codebase.

## Common Pitfalls

### Pitfall 1: `computeViewRectangle` returns `undefined` when horizon is visible
**What goes wrong:** When the camera is zoomed far out and the globe's horizon is in frame, `computeViewRectangle()` cannot compute a valid rectangle and returns `undefined`. Code that assumes a non-null result will throw.
**Why it happens:** The method requires all four viewport corners to project onto the ellipsoid. At high altitude with tilted camera, some corners hit sky.
**How to avoid:** Always guard: `const rect = viewer.camera.computeViewRectangle(); if (!rect) return;` — see existing `useStreetTraffic.ts` line 96-97.
**Warning signs:** NaN appearing in bbox query params; network errors from FastAPI validation.

### Pitfall 2: Antimeridian crossing (IDL) breaks BETWEEN query
**What goes wrong:** If the viewport straddles the antimeridian (lon 180/-180), `rect.west > rect.east`. A SQL `longitude BETWEEN -170 AND 170` query would be incorrect; it should be two ranges: `lon >= -180 AND lon <= -170 OR lon >= 170`.
**Why it happens:** `computeViewRectangle` is documented to have IDL issues (GitHub issue #3717 and #7913).
**How to avoid:** Detect IDL crossing: `if (bbox.minLon > bbox.maxLon)` — either skip bbox filtering for that request (return global dataset) or split into two queries. The simplest safe option: if `west > east`, send no bbox params (fallback to global). Document this as a known limitation.
**Warning signs:** Empty layer when panning over Pacific Ocean.

### Pitfall 3: Bbox triggers excessive re-fetches from React Query
**What goes wrong:** Every tiny camera movement fires `moveEnd`, updating the bbox slice, which triggers a React Query re-fetch on every pan/zoom stop.
**Why it happens:** React Query `queryKey` deep-equality check — a new object reference with the same values triggers a re-fetch.
**How to avoid:** Round bbox values to ~1 decimal place (≈11 km precision) before storing in the slice. `Math.round(deg * 10) / 10` reduces unique bbox combinations. React Query deduplicates by value equality on primitive queryKey elements.
**Warning signs:** Network tab shows `/api/aircraft/` firing on every single camera stop.

### Pitfall 4: Playback mode sends bbox and receives wrong data
**What goes wrong:** In `replayMode === 'playback'`, the replay engine loads snapshot data for the full replay window. If bbox is active, it would request aircraft only in the current viewport — but the user may pan to a different region, losing snapshot data.
**Why it happens:** Bbox filtering conflicts with snapshot-based playback (snapshots cover arbitrary time+space).
**How to avoid:** Disable bbox filtering during playback: `const bbox = replayMode === 'live' ? viewportBbox : null`. This follows the same pattern as `refetchInterval: replayMode === 'live' ? 90_000 : false` already in `useAircraft.ts`.
**Warning signs:** Aircraft disappear during replay when user pans.

### Pitfall 5: Billboard visibility conflict with bbox-based filtering
**What goes wrong:** AircraftLayer already has a `bb.show = layerVisible && matchesAircraftFilter(ac, aircraftFilter)` effect. If bbox is also applied client-side on top of a bbox-filtered API response, correct entities may be hidden.
**Why it happens:** Double-filtering: backend already excludes out-of-bbox entities, client-side filter then checks bbox again.
**How to avoid:** The existing `aircraftFilter.boundingBox` in the store is a user-facing filter (manual bounding box input from UI). The new viewport bbox is a different concept — it controls what the API fetches. They should not conflict. Keep `matchesAircraftFilter` as-is; the API bbox reduces the set of entities that ever enter `billboardsByIcao24`.

## Code Examples

### Verified pattern: computeViewRectangle + moveEnd (from existing codebase)
```typescript
// Source: frontend/src/hooks/useStreetTraffic.ts (lines 96-113) — proven in production
const rect = viewer.camera.computeViewRectangle();
if (!rect) return;

const west = CesiumMath.toDegrees(rect.west);
const south = CesiumMath.toDegrees(rect.south);
const east = CesiumMath.toDegrees(rect.east);
const north = CesiumMath.toDegrees(rect.north);
```

### Verified pattern: FastAPI optional query param with default=None
```python
# Source: FastAPI docs pattern; consistent with existing routes using Query()
from fastapi import Query
from typing import Optional

async def list_aircraft(
    min_lat: Optional[float] = Query(default=None),
    max_lat: Optional[float] = Query(default=None),
    min_lon: Optional[float] = Query(default=None),
    max_lon: Optional[float] = Query(default=None),
):
```

### Verified pattern: SQLAlchemy BETWEEN filter (plain float columns)
```python
# Source: existing index migration c5795b11a549 confirms lat/lon are Float columns
# with index idx_aircraft_latlon_not_null — BETWEEN uses this index
if all(v is not None for v in (min_lat, max_lat, min_lon, max_lon)):
    stmt = stmt.where(
        Aircraft.latitude.between(min_lat, max_lat),
        Aircraft.longitude.between(min_lon, max_lon),
    )
```

### Verified pattern: camera.moveEnd addEventListener (from existing codebase)
```typescript
// Source: frontend/src/hooks/useStreetTraffic.ts (lines 139-154)
const moveEndEvent = viewer.camera.moveEnd;
moveEndEvent.addEventListener(handleMoveEnd);

return () => {
  moveEndEvent.removeEventListener(handleMoveEnd);
};
```

### Verified pattern: React Query queryKey with bbox
```typescript
// Source: React Query v5 docs — array queryKey, objects supported
// bbox in key ensures refetch when viewport changes
queryKey: ['aircraft', bbox],  // bbox is null | ViewportBbox
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Global fetch (no bbox) | Bbox-filtered fetch via optional query params | Phase 33 | Reduces payload size proportionally to zoom level — at city level, 1-5% of global aircraft dataset |
| No viewport state in store | `viewportBbox` slice in `useAppStore` | Phase 33 | Single source of truth; all layers share same bbox without prop drilling |
| `aircraftFilter.boundingBox` (manual UI filter) | `viewportBbox` (automatic camera-derived) | Phase 33 | These are distinct concepts; UI filter remains for manual override |

**Deprecated/outdated:**
- None. This phase adds new capability without replacing existing systems.

## Open Questions

1. **Altitude-based bbox disabling**
   - What we know: At very high altitude, `computeViewRectangle` returns `undefined` (camera covers too much of globe). Backend call without bbox falls back to global dataset.
   - What's unclear: Should there be an explicit altitude threshold above which bbox is never sent? `useStreetTraffic` uses 500km threshold but for a different reason (road data doesn't exist at that scale).
   - Recommendation: Use `computeViewRectangle` returning `undefined` as the natural gate — no explicit altitude check needed. The undefined guard is already the correct behaviour.

2. **Antimeridian edge case handling**
   - What we know: `computeViewRectangle` has documented issues with IDL crossing (GitHub issues #3717 and #7913).
   - What's unclear: Exact frequency of user encountering this in practice (homelab use with Pacific focus vs. Atlantic focus).
   - Recommendation: Implement simple IDL detection (`if (bbox.minLon > bbox.maxLon) return;` — send no bbox, fall back to global). Document as known limitation. Do not split into two queries (complexity not justified for homelab tool).

3. **Bbox precision / re-fetch rate**
   - What we know: Rounding to 1 decimal place (≈11 km) reduces queryKey changes significantly.
   - What's unclear: Optimal rounding precision — too coarse misses entities near bbox edge; too fine causes many re-fetches.
   - Recommendation: Round to 1 decimal place for aircraft (large objects, fast-moving). Test during implementation and adjust if needed.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.x + jsdom (frontend), pytest (backend) |
| Config file | `frontend/vite.config.ts` (test section), `backend/pytest.ini` |
| Quick run command | `cd frontend && npx vitest run src/hooks/__tests__/useViewportBbox.test.ts` (frontend); `cd backend && python -m pytest tests/test_routes_aircraft.py -x` (backend) |
| Full suite command | `cd frontend && npx vitest run` / `cd backend && python -m pytest` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| VPC-01 | `useViewportBbox` writes bbox to store on `moveEnd` | unit | `npx vitest run src/hooks/__tests__/useViewportBbox.test.ts` | ❌ Wave 0 |
| VPC-02 | `useViewportBbox` writes `null` when `computeViewRectangle` returns `undefined` | unit | same | ❌ Wave 0 |
| VPC-03 | `/api/aircraft/` without bbox params returns full dataset | unit | `pytest tests/test_routes_aircraft.py::test_list_aircraft_no_bbox -x` | ❌ Wave 0 |
| VPC-04 | `/api/aircraft/?min_lat=...` returns only in-bbox aircraft | unit | `pytest tests/test_routes_aircraft.py::test_list_aircraft_bbox -x` | ❌ Wave 0 |
| VPC-05 | `/api/ships/` with bbox params filters correctly | unit | `pytest tests/test_routes_ships.py::test_list_ships_bbox -x` | ❌ Wave 0 |
| VPC-06 | `/api/military/` with bbox params filters correctly | unit | `pytest tests/test_routes_military.py::test_list_military_bbox -x` | ❌ Wave 0 |
| VPC-07 | IDL case (minLon > maxLon) falls back to global query | unit | `npx vitest run src/hooks/__tests__/useViewportBbox.test.ts` | ❌ Wave 0 |
| VPC-08 | Playback mode sends no bbox to API | unit | `npx vitest run src/hooks/__tests__/useAircraft.bbox.test.ts` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `cd frontend && npx vitest run src/hooks/__tests__/useViewportBbox.test.ts`
- **Per wave merge:** `cd frontend && npx vitest run && cd ../backend && python -m pytest`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `frontend/src/hooks/__tests__/useViewportBbox.test.ts` — covers VPC-01, VPC-02, VPC-07
- [ ] `frontend/src/hooks/__tests__/useAircraft.bbox.test.ts` — covers VPC-08
- [ ] `backend/tests/test_routes_aircraft.py` — may already exist; extend with VPC-03, VPC-04 test cases
- [ ] `backend/tests/test_routes_ships.py` — extend with VPC-05
- [ ] `backend/tests/test_routes_military.py` — extend with VPC-06

*(Existing backend test files may already cover the no-bbox case; only bbox-specific cases are Wave 0 gaps)*

## Sources

### Primary (HIGH confidence)
- `frontend/src/hooks/useStreetTraffic.ts` — complete working implementation of `camera.moveEnd` + `computeViewRectangle()` + debounced fetch; this is the definitive pattern for this project
- `frontend/src/store/useAppStore.ts` — existing store structure; bbox slice follows established conventions
- `backend/app/api/routes_aircraft.py` — existing endpoint structure that bbox params will extend
- `backend/alembic/versions/c5795b11a549_add_aircraft_latlon_index.py` — confirms B-tree index on `(latitude, longitude)` exists for aircraft; BETWEEN queries will use it
- [CesiumJS Camera documentation](https://cesium.com/learn/cesiumjs/ref-doc/Camera.html) — `computeViewRectangle(ellipsoid, result)` signature and `camera.changed` / `moveEnd` events confirmed

### Secondary (MEDIUM confidence)
- [Cesium Community: Camera changed event](https://community.cesium.com/t/camera-changed-event/5535) — `moveEnd` preferred over `changed` for "after motion stops" semantics
- [Cesium Community: Computing camera extents](https://community.cesium.com/t/computing-camera-extents-in-2d-and-3d/10826) — tile-union workaround documented; `computeViewRectangle` known to be imprecise at poles and tilted angles

### Tertiary (LOW confidence — needs validation during implementation)
- [CesiumJS GitHub issue #3717](https://github.com/CesiumGS/cesium/issues/3717) — IDL crossing bug in `computeViewRectangle` (older issue, status may have changed in v1.139)
- [CesiumJS GitHub issue #7913](https://github.com/CesiumGS/cesium/issues/7913) — `computeViewRectangle` incorrect values in specific cases

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new libraries; all tools already in the project
- Architecture: HIGH — `useStreetTraffic.ts` is a proven, tested in-codebase implementation of exactly this pattern
- Pitfalls: HIGH for pitfalls 1 and 4 (documented in existing code); MEDIUM for pitfalls 2 and 3 (IDL and re-fetch rate — require empirical tuning)

**Research date:** 2026-03-14
**Valid until:** 2026-04-14 (CesiumJS and FastAPI are stable; viewport APIs have not changed across many versions)
