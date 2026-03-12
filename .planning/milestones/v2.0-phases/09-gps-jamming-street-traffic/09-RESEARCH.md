# Phase 9: GPS Jamming + Street Traffic — Research

**Researched:** 2026-03-12
**Domain:** CesiumJS GroundPrimitive polygon rendering, H3 hexagonal indexing, Overpass API OSM road fetch, ADS-B NIC/NACp jamming inference, particle simulation
**Confidence:** HIGH (core stack), MEDIUM (particle road-following pattern)

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| LAY-02 | GPS jamming heatmap as H3 hexagons derived from ADS-B NIC/NACp position accuracy fields, aggregated in PostGIS | H3 Python library (h3 4.4.2 via pip) for backend aggregation; h3-js 4.4.0 for frontend cell-to-boundary; GroundPrimitive batch rendering for color-coded hexagons; airplanes.live /v2/mil already polled every 300s and exposes `nic` + `nac_p` fields |
| LAY-04 | Street traffic as particle simulation (moving dots on OSM road network), zoom-dependent density, viewport-scoped road fetch | Overpass API bbox query for highway ways; PointPrimitiveCollection moving particles; viewer.camera.positionCartographic.height for altitude gate; viewer.camera.moveEnd event + camera.computeViewRectangle() for viewport-scoped fetch |
</phase_requirements>

---

## Summary

Phase 9 requires two independent but co-deployed layers: a GPS degradation heatmap using H3 hexagons and an OSM-based street traffic particle simulation. Both are substantially more complex than Phase 8's point layers but follow established CesiumJS patterns.

**GPS Jamming layer (LAY-02):** The airplanes.live `/v2/mil` endpoint — already polled every 300s — exposes `nic` and `nac_p` fields on every aircraft record. The backend aggregation task reads these fields, buckets aircraft positions into H3 hexagons (resolution 5, ~252 km² per cell), computes a bad-aircraft ratio, and writes the result to a `gps_jamming_cells` table. The FastAPI route serves this as a flat JSON array. The frontend uses `h3-js` to convert H3 indexes to boundary coordinates for CesiumJS `GroundPrimitive` batch rendering. No h3-pg PostgreSQL extension is needed — Python `h3` library handles the indexing on the ingest worker side.

**Street traffic layer (LAY-04):** Overpass API provides OSM highway geometry as GeoJSON within a bounding box. Particles are represented as `PointPrimitive` instances that advance along road segment coordinates in a `requestAnimationFrame` loop. The layer is gated to `viewer.camera.positionCartographic.height < 500_000` metres and fetches road geometry only when the camera altitude crosses into urban range, scoped to the current viewport bbox.

**Primary recommendation:** Use `h3` Python library for backend aggregation (no DB extension needed), batch all hex polygons into a single `GroundPrimitive` for performance, gate particle layer at 500 km altitude via `viewer.camera.positionCartographic.height`, and use Overpass API bbox highway query for road data.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| h3 (Python) | 4.4.2 | Backend H3 cell indexing — `latlng_to_cell(lat, lng, res)` | Official Uber H3 Python bindings, pure Python, no DB extension required |
| h3-js (JavaScript) | 4.4.0 | Frontend H3 boundary rendering — `cellToBoundary(h3index)` | Official JS bindings, compiled from C via emscripten, v4 API aligned with Python |
| CesiumJS GroundPrimitive | 1.139.1 (already installed) | Batch-render H3 polygon hexagons as ground-clamped geometry | PROJECT DECISION: GPS jamming rendered as GroundPrimitive (not ImageryLayer) to avoid WebGL texture sampler limit |
| Overpass API | Public endpoint | Fetch OSM highway ways by bbox | Free, no auth, OSINT-only requirement, fair use at <10k queries/day |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| osmtogeojson | 3.0.0 | Convert Overpass JSON to GeoJSON LineString segments | Use in frontend fetch helper to normalize Overpass response to drawable geometry |
| ColorGeometryInstanceAttribute | CesiumJS built-in | Per-instance color on batched GroundPrimitive hexagons | Needed for green/yellow/red severity coloring in single-primitive batch |
| PerInstanceColorAppearance | CesiumJS built-in | Appearance for per-instance colored GroundPrimitive | Only appearance supported with GroundPrimitive for color-per-hex |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Python `h3` library | `h3-pg` PostgreSQL extension | h3-pg not in `postgis/postgis:16-3.5` image; requires custom Dockerfile or apt install at build time; Python library avoids Docker complexity entirely |
| Overpass public endpoint | Mapbox roads API | Mapbox is proprietary; Overpass is OSINT-only compliant |
| GroundPrimitive batch | Entity polygon per hex | Entity API is O(n) per update; GroundPrimitive batches all hexagons into one GPU draw call |
| osmtogeojson | Manual JSON parsing | osmtogeojson handles all edge cases in Overpass JSON → GeoJSON conversion |

### Installation

```bash
# Frontend
npm install h3-js osmtogeojson

# Backend (add to requirements.txt)
h3>=4.4.2
```

---

## Architecture Patterns

### Recommended Project Structure

```
backend/app/
├── tasks/
│   └── ingest_gps_jamming.py    # RQ task: reads military_aircraft NIC/NACp, aggregates to H3 cells, upserts gps_jamming_cells
├── models/
│   └── gps_jamming.py           # GpsJammingCell SQLAlchemy model
├── api/
│   └── routes_gps_jamming.py    # GET /api/gps-jamming returns H3 cell array
└── alembic/versions/
    └── XXXX_add_gps_jamming_cells_table.py

frontend/src/
├── components/
│   ├── GpsJammingLayer.tsx       # CesiumJS GroundPrimitive layer (null-render pattern)
│   └── StreetTrafficLayer.tsx    # Viewport-gated particle layer (null-render pattern)
├── hooks/
│   ├── useGpsJamming.ts          # React Query hook polling /api/gps-jamming
│   └── useStreetTraffic.ts       # Hook fetching Overpass roads on camera moveEnd
└── __tests__/
    ├── GpsJammingLayer.test.tsx  # Smoke test: renders null, no crash
    └── StreetTrafficLayer.test.tsx
```

### Pattern 1: H3 Backend Aggregation (NIC/NACp → hex cells)

**What:** RQ task reads all aircraft from `military_aircraft` table with valid NIC/NACp, assigns each to H3 cell, computes bad-aircraft ratio, upserts to `gps_jamming_cells` table. Runs once daily at midnight UTC.

**NIC/NACp thresholds (from research):**
- Normal: NIC >= 7 AND nac_p >= 8 (DO-260B compliant)
- "bad" aircraft: NIC < 7 OR nac_p < 8
- bad ratio = `(num_bad - 1) / (num_good + num_bad)` — the `-1` reduces false positives in sparse areas (gpsjam.org formula)

**H3 resolution:** 5 (~252 km² per cell, ~9.85 km edge length) — matches gpsjam.org visual granularity

**Example:**
```python
# Source: h3-py v4 API — https://uber.github.io/h3-py/api_quick.html
import h3

def classify_aircraft(nic: int | None, nac_p: int | None) -> bool:
    """Return True if aircraft indicates GPS degradation."""
    if nic is None or nac_p is None:
        return False  # missing fields = no data, not jamming
    return nic < 7 or nac_p < 8

def assign_to_cell(lat: float, lon: float, resolution: int = 5) -> str:
    return h3.latlng_to_cell(lat, lon, resolution)
```

**Severity bands (for frontend color coding):**
- GREEN: bad_ratio < 0.1 (< 10% bad aircraft)
- YELLOW: 0.1 <= bad_ratio < 0.3
- RED: bad_ratio >= 0.3

**Update frequency:** Daily. RQ task self-re-enqueues every 86400 seconds.

### Pattern 2: GroundPrimitive Batch Hex Rendering

**What:** Frontend `GpsJammingLayer` fetches hex cells from API, converts each H3 index to boundary coordinates via `h3-js`, batches all into one `GroundPrimitive` with `PerInstanceColorAppearance`.

**Critical:** GroundPrimitive cannot update geometry after creation. When data refreshes (daily), remove the old primitive and create a new one.

**Example:**
```typescript
// Source: CesiumJS docs — https://cesium.com/learn/cesiumjs/ref-doc/GroundPrimitive.html
// Source: h3-js README — https://github.com/uber/h3-js
import { cellToBoundary } from 'h3-js';
import {
  GroundPrimitive, GeometryInstance, PolygonGeometry,
  PolygonHierarchy, Cartesian3, ColorGeometryInstanceAttribute,
  PerInstanceColorAppearance, Color,
} from 'cesium';

function buildHexPrimitive(cells: Array<{ h3index: string; severity: 'green' | 'yellow' | 'red' }>) {
  const instances = cells.map(({ h3index, severity }) => {
    // cellToBoundary returns [[lat, lng], ...] pairs
    const boundary = cellToBoundary(h3index);
    const positions = Cartesian3.fromDegreesArray(
      boundary.flatMap(([lat, lng]) => [lng, lat]) // Cesium wants lon first
    );
    const color = severity === 'red'
      ? Color.RED.withAlpha(0.55)
      : severity === 'yellow'
        ? Color.YELLOW.withAlpha(0.45)
        : Color.GREEN.withAlpha(0.35);

    return new GeometryInstance({
      geometry: new PolygonGeometry({
        polygonHierarchy: new PolygonHierarchy(positions),
      }),
      id: h3index,
      attributes: {
        color: ColorGeometryInstanceAttribute.fromColor(color),
      },
    });
  });

  return new GroundPrimitive({
    geometryInstances: instances,
    appearance: new PerInstanceColorAppearance({ flat: true }),
    asynchronous: true,
  });
}
```

### Pattern 3: Altitude-Gated Particle Layer

**What:** `StreetTrafficLayer` component subscribes to `viewer.camera.moveEnd`. On each moveEnd, check altitude. If below 500 km, fetch Overpass roads for viewport bbox. Animate particle positions in rAF loop.

**Camera altitude check:**
```typescript
// Source: CesiumJS community — https://community.cesium.com/t/how-to-get-the-camera-altitude/41
const altitudeMeters = viewer.camera.positionCartographic.height;
const SHOW_THRESHOLD = 500_000; // 500 km in meters (matches STATE.md decision)
```

**Viewport bbox:**
```typescript
// Source: CesiumJS community — https://community.cesium.com/t/get-camera-bounding-box/3662
// camera.computeViewRectangle() works in 3D mode (the only mode used in this app)
import { Rectangle, Math as CesiumMath } from 'cesium';
const rect = viewer.camera.computeViewRectangle();
if (rect) {
  const west = CesiumMath.toDegrees(rect.west);
  const south = CesiumMath.toDegrees(rect.south);
  const east = CesiumMath.toDegrees(rect.east);
  const north = CesiumMath.toDegrees(rect.north);
}
```

**Overpass query for roads:**
```
[out:json][timeout:25];
way["highway"~"^(motorway|trunk|primary|secondary|tertiary|residential)$"](south,west,north,east);
out geom;
```

Endpoint: `https://overpass-api.de/api/interpreter`
Method: POST (body = query string)
Response: Overpass JSON → osmtogeojson → GeoJSON LineStrings

**Particle movement:**
- Each particle has: current road segment index, position along segment (0.0–1.0), speed
- rAF loop advances `t` by `speed * dt` along segment; at `t >= 1.0` advance to next segment or recycle particle
- Position updated via `PointPrimitive.position = Cartesian3.fromDegrees(lon, lat, 10)`

### Anti-Patterns to Avoid

- **Updating GroundPrimitive geometry post-creation:** CesiumJS GroundPrimitive geometry is immutable after first render. Use `getGeometryInstanceAttributes()` to update colors only; fully recreate the primitive when cell data refreshes (daily — acceptable cost).
- **Entity API for hex polygons:** The `viewer.entities.add({ polygon: ... })` API does individual GPU uploads per entity — catastrophic for 100+ hexagons. Always use batched GroundPrimitive.
- **Camera.computeViewRectangle() in 2D mode:** Known CesiumJS bug — returns incorrect values in 2D/Columbus View. App uses only 3D globe mode so this is safe.
- **Global Overpass fetch:** Never query Overpass without a tight bbox — global road queries exceed response size limits. Always gate on camera altitude and use current viewport rect.
- **PointPrimitive clamping:** CesiumJS PointPrimitiveCollection does NOT support `heightReference: CLAMP_TO_GROUND` — confirmed broken in community discussions. Set altitude to constant low value (10m) instead.
- **h3-js lat/lng coordinate order:** `cellToBoundary` returns `[lat, lng]` pairs. CesiumJS `Cartesian3.fromDegreesArray` expects `[lng, lat, lng, lat, ...]`. Must swap.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| H3 cell index computation | Custom hexbin math | `h3` Python lib + `h3-js` | H3 handles polar pentagon edge cases, anti-meridian crossing, and all 16 resolutions correctly |
| Overpass JSON → drawable geometry | Manual way node parsing | `osmtogeojson` | OSM ways reference node IDs; osmtogeojson resolves references and outputs clean GeoJSON LineStrings |
| GPS jamming detection formula | Custom NIC/NACp logic | gpsjam.org formula: `(num_bad - 1) / (num_good + num_bad)` | Proven formula specifically tuned to reduce false positives in sparse ADS-B coverage areas |
| PostgreSQL H3 bindings | `h3-pg` Docker extension install | Python `h3` library in worker | h3-pg not preinstalled in `postgis/postgis:16-3.5`; Python library is zero-infrastructure-cost |

**Key insight:** The H3 binaries from `postgis/postgis:16-3.5` would require either a custom Docker image build or `apt-get` at container startup — both fragile. The Python `h3` library installed via pip achieves identical results in the RQ worker with zero Docker changes.

---

## Common Pitfalls

### Pitfall 1: GroundPrimitive Asynchronous Tessellation
**What goes wrong:** GroundPrimitive creates geometry on a web worker asynchronously. If you remove and re-add the primitive before tessellation completes (e.g., on fast data refresh), you get console errors and possibly blank hexagons on first render.
**Why it happens:** `asynchronous: true` (default) defers CPU-intensive polygon tessellation to avoid blocking the render thread.
**How to avoid:** Check `primitive.ready` before removing old primitive. Alternatively use `asynchronous: false` with `GroundPrimitive.initializeTerrainHeights()` called first, but this blocks the main thread briefly.
**Warning signs:** Hexagons appear blank on first load for 1-2 frames, or console shows tessellation errors on rapid refresh.

### Pitfall 2: h3-js Coordinate Order Inversion
**What goes wrong:** `cellToBoundary(h3index)` returns `[[lat, lng], ...]`. Passing these directly to `Cartesian3.fromDegreesArray` swaps lat/lon, placing hexagons in wrong hemisphere.
**Why it happens:** h3-js uses lat/lng order (geographic convention). CesiumJS uses lng/lat order (GeoJSON convention).
**How to avoid:** Always `.flatMap(([lat, lng]) => [lng, lat])` when converting to CesiumJS coordinates.
**Warning signs:** All hexagons appear in the ocean or at mirrored positions.

### Pitfall 3: Overpass API Timeout on Large Viewports
**What goes wrong:** At moderate zoom (e.g., country-level view), viewport bbox covers too many roads and Overpass returns a timeout error or 429.
**Why it happens:** Overpass `[timeout:25]` — 25 second query budget. Dense urban areas at country-level produce millions of ways.
**How to avoid:** Only trigger Overpass fetch when altitude < 100 km (not 500 km) — the 500 km threshold gates layer visibility but road geometry only loads at much tighter zoom. Add a 5 km side-length maximum bbox clamp on the query.
**Warning signs:** 429 responses from overpass-api.de, or long pauses before roads appear.

### Pitfall 4: Particle Performance on Low-End GPU
**What goes wrong:** 1000+ PointPrimitive instances each getting position updates every rAF (60fps) causes CPU→GPU upload bottleneck.
**Why it happens:** Each `.position =` assignment queues a CPU→GPU data transfer for the next `PointPrimitiveCollection.update()` call.
**How to avoid:** Keep particle count <= 500. Scale particle count to zoom level (fewer at higher altitude within the gate). Use a single `PointPrimitiveCollection` for all particles (not individual collections per road).
**Warning signs:** Frame rate drops when zoomed into dense city with particles visible.

### Pitfall 5: OpenSky /states/all Does NOT Expose NIC/NACp
**What goes wrong:** Attempting to use existing OpenSky `aircraft` table for GPS jamming aggregation — the OpenSky `/states/all` state vector has 18 fields but NIC and NACp are NOT among them.
**Why it happens:** OpenSky REST API strips NIC/NACp from the processed state vector output.
**How to avoid:** Use the `military_aircraft` table (airplanes.live `/v2/mil`) which DOES expose `nic` and `nac_p` fields. This is a smaller fleet (~300-400 aircraft globally at any time) but sufficient for jamming inference by area.
**Warning signs:** GPS jamming aggregation always returns 0 cells or all cells show 0% bad aircraft.

### Pitfall 6: Alembic Migration Chain Integrity
**What goes wrong:** Phase 9 Alembic migration added with wrong `down_revision`, causing dual-head error on `alembic upgrade head`.
**Why it happens:** Existing chain: `a1b2c3d4e5f6 (military) → d4e8f2a1b3c0 (ships)`. New migration must set `down_revision = 'd4e8f2a1b3c0'`.
**How to avoid:** Always verify current head with `alembic heads` before creating migration. New migration: `down_revision = 'd4e8f2a1b3c0'`.
**Warning signs:** `alembic upgrade head` raises `MultipleHeads` error.

---

## Code Examples

### GPS Jamming API Response Shape

```typescript
// GET /api/gps-jamming
// Response: { cells: GpsJammingCell[] }
interface GpsJammingCell {
  h3index: string;        // e.g. "852b9c17fffffff"
  bad_ratio: number;      // 0.0 – 1.0
  severity: 'green' | 'yellow' | 'red';
  aircraft_count: number; // total aircraft sampled in this cell
  updated_at: string;     // ISO8601
}
```

### H3 Aggregation (Backend RQ Task Sketch)

```python
# Source: h3-py v4 API — https://uber.github.io/h3-py/api_quick.html
import h3
from collections import defaultdict

H3_RESOLUTION = 5

def aggregate_jamming_cells(aircraft_records):
    """
    aircraft_records: list of dicts with lat, lon, nic, nac_p
    Returns: list of { h3index, bad_ratio, severity, aircraft_count }
    """
    cells = defaultdict(lambda: {"good": 0, "bad": 0})

    for ac in aircraft_records:
        lat, lon = ac["latitude"], ac["longitude"]
        nic, nac_p = ac.get("nic"), ac.get("nac_p")
        if lat is None or lon is None:
            continue
        cell = h3.latlng_to_cell(lat, lon, H3_RESOLUTION)
        is_bad = (nic is not None and nic < 7) or (nac_p is not None and nac_p < 8)
        if is_bad:
            cells[cell]["bad"] += 1
        else:
            cells[cell]["good"] += 1

    results = []
    for h3index, counts in cells.items():
        good, bad = counts["good"], counts["bad"]
        total = good + bad
        if total == 0:
            continue
        # gpsjam.org formula: subtract 1 from bad to reduce false positives
        ratio = max(0.0, (bad - 1) / total)
        severity = "red" if ratio >= 0.3 else "yellow" if ratio >= 0.1 else "green"
        results.append({
            "h3index": h3index,
            "bad_ratio": round(ratio, 4),
            "severity": severity,
            "aircraft_count": total,
        })
    return results
```

### Overpass Road Fetch (Frontend)

```typescript
// Source: Overpass API docs — https://wiki.openstreetmap.org/wiki/Overpass_API
// Source: osmtogeojson — https://github.com/tyrasd/osmtogeojson
import osmtogeojson from 'osmtogeojson';

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';
const HIGHWAY_TYPES = 'motorway|trunk|primary|secondary|tertiary|residential';

async function fetchRoadsForViewport(
  south: number, west: number, north: number, east: number
): Promise<GeoJSON.FeatureCollection> {
  const query = `
    [out:json][timeout:25];
    way["highway"~"^(${HIGHWAY_TYPES})$"](${south},${west},${north},${east});
    out geom;
  `.trim();

  const resp = await fetch(OVERPASS_URL, {
    method: 'POST',
    body: query,
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });
  if (!resp.ok) throw new Error(`Overpass ${resp.status}`);
  const osm = await resp.json();
  return osmtogeojson(osm) as GeoJSON.FeatureCollection;
}
```

### Altitude Gate + Camera MoveEnd

```typescript
// Source: CesiumJS community — https://community.cesium.com/t/how-to-get-the-camera-altitude/41
// Source: CesiumJS Camera docs — https://cesium.com/learn/cesiumjs/ref-doc/Camera.html
import { Math as CesiumMath } from 'cesium';

const ALTITUDE_THRESHOLD_M = 500_000; // 500 km

useEffect(() => {
  if (!viewer || viewer.isDestroyed()) return;

  const handler = () => {
    const altM = viewer.camera.positionCartographic.height;
    if (altM > ALTITUDE_THRESHOLD_M) {
      setRoadsVisible(false);
      return;
    }
    const rect = viewer.camera.computeViewRectangle();
    if (!rect) return;
    const bbox = {
      south: CesiumMath.toDegrees(rect.south),
      west:  CesiumMath.toDegrees(rect.west),
      north: CesiumMath.toDegrees(rect.north),
      east:  CesiumMath.toDegrees(rect.east),
    };
    fetchAndSetRoads(bbox);
  };

  viewer.camera.moveEnd.addEventListener(handler);
  return () => viewer.camera.moveEnd.removeEventListener(handler);
}, [viewer]);
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| h3-py v3 `geo_to_h3()` | h3-py v4 `latlng_to_cell()` | H3 v4.0.0 (2022) | Old function names raise AttributeError in v4 |
| h3-js v3 `geoToH3()` | h3-js v4 `latLngToCell()` | H3 v4.0.0 (2022) | All h3 bindings renamed to align with C library |
| OpenSky NIC/NACp | Not available in /states/all | Always missing | Must use airplanes.live for NIC/NACp data |
| gpsjam.org CSV download | Self-derived NIC/NACp aggregation | 2026 — no public API | REQUIREMENTS.md Out of Scope: "gpsjam.org API: No public API exists" |
| GroundPrimitive per-hex | Batch all hexes in single GroundPrimitive | CesiumJS best practice | Orders of magnitude faster; one GPU draw call vs N |

**Deprecated/outdated:**
- `h3.geo_to_h3()` / `h3.h3_to_geo_boundary()`: Removed in h3-py v4. Use `latlng_to_cell()` / `cell_to_boundary()`.
- `h3.geoToH3()` / `h3.h3ToGeoBoundary()`: Removed in h3-js v4. Use `latLngToCell()` / `cellToBoundary()`.
- CesiumJS Entity polygon per hexagon: Functional but 10-100x slower than GroundPrimitive batching for 50+ polygons.

---

## Open Questions

1. **airplanes.live NIC/NACp coverage for global jamming map**
   - What we know: `/v2/mil` returns military aircraft only (~300-400 globally). NIC/NACp fields confirmed present. These are sufficient for initial implementation.
   - What's unclear: Whether the low military aircraft density provides meaningful global coverage, especially outside NATO airspace. Commercial `/v2/all` would give 10,000+ aircraft but may have different rate limits.
   - Recommendation: Use `/v2/mil` for Phase 9 (already polled, confirmed NIC/NACp). Add comment in code noting `/v2/all` endpoint exists for future coverage improvement.

2. **Overpass rate limits at 500 km altitude threshold vs 100 km**
   - What we know: 500 km is the visibility gate per STATE.md decision. At 500 km the viewport covers ~3000 km of terrain — Overpass bbox at that scale would be thousands of km wide.
   - What's unclear: Exact bbox size at 400-500 km altitude above typical cities.
   - Recommendation: Use a tighter altitude gate (100 km) for road geometry fetch, but keep 500 km as the "layer visible" gate. Log a viewport dimension check in the hook.

3. **osmtogeojson bundle size**
   - What we know: npm package exists, widely used for Overpass→GeoJSON conversion.
   - What's unclear: Bundle size impact — not verified.
   - Recommendation: Use `osmtogeojson` but check bundle size with `npx bundlephobia osmtogeojson`. If > 100 KB, consider inline minimal parser for just `way` geometries.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.0.18 |
| Config file | `frontend/vite.config.ts` (test.environment = jsdom) |
| Quick run command | `cd frontend && npx vitest run` |
| Full suite command | `cd frontend && npx vitest run` |

Backend:

| Property | Value |
|----------|-------|
| Framework | pytest (inferred from Phase 8 pattern) |
| Quick run command | `cd backend && python -m pytest tests/ -x -q` |
| Full suite command | `cd backend && python -m pytest tests/` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| LAY-02 | GpsJammingLayer renders null without crash when viewer=null | unit/smoke | `cd frontend && npx vitest run --reporter=verbose src/components/__tests__/GpsJammingLayer.test.tsx` | Wave 0 |
| LAY-02 | aggregate_jamming_cells() returns correct severity bands | unit | `cd backend && python -m pytest tests/test_gps_jamming.py -x` | Wave 0 |
| LAY-02 | GET /api/gps-jamming returns 200 with cells array | integration | `cd backend && python -m pytest tests/test_gps_jamming.py::test_gps_jamming_route -x` | Wave 0 |
| LAY-04 | StreetTrafficLayer renders null without crash when viewer=null | unit/smoke | `cd frontend && npx vitest run --reporter=verbose src/components/__tests__/StreetTrafficLayer.test.tsx` | Wave 0 |
| LAY-04 | Altitude gate hides particles above 500 km threshold | unit | included in StreetTrafficLayer test | Wave 0 |

### Sampling Rate

- **Per task commit:** `cd frontend && npx vitest run`
- **Per wave merge:** `cd frontend && npx vitest run && cd ../backend && python -m pytest tests/ -x -q`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `frontend/src/components/__tests__/GpsJammingLayer.test.tsx` — covers LAY-02 smoke
- [ ] `frontend/src/components/__tests__/StreetTrafficLayer.test.tsx` — covers LAY-04 smoke + altitude gate
- [ ] `backend/tests/test_gps_jamming.py` — covers aggregate logic + API route
- [ ] Backend `tests/` directory may need `conftest.py` update if not already importing new route

*(Existing test infrastructure covers the test runner setup — only new test files needed)*

---

## Data Model

### `gps_jamming_cells` Table

```sql
-- Alembic migration down_revision = 'd4e8f2a1b3c0' (ships table)
CREATE TABLE gps_jamming_cells (
    h3index     VARCHAR PRIMARY KEY,   -- H3 cell index string, resolution 5
    bad_ratio   FLOAT   NOT NULL,      -- 0.0–1.0 per gpsjam.org formula
    severity    VARCHAR NOT NULL,      -- 'green' | 'yellow' | 'red'
    aircraft_count INTEGER NOT NULL,   -- total aircraft sampled in cell
    updated_at  TIMESTAMPTZ DEFAULT now()
);
```

No PostGIS geometry column needed — h3index encodes geography implicitly. The frontend decodes boundaries using h3-js `cellToBoundary()`.

---

## Sources

### Primary (HIGH confidence)

- CesiumJS 1.139.1 docs — `GroundPrimitive`, `GeometryInstance`, `PolygonGeometry`, `PerInstanceColorAppearance`, `ColorGeometryInstanceAttribute`, `camera.positionCartographic`, `camera.moveEnd`, `camera.computeViewRectangle`
  - https://cesium.com/learn/cesiumjs/ref-doc/GroundPrimitive.html
  - https://cesium.com/learn/cesiumjs/ref-doc/Camera.html
- h3-py v4 API — `latlng_to_cell`, `cell_to_boundary`
  - https://uber.github.io/h3-py/api_quick.html
- H3 resolution table — confirmed res 5 = ~252 km², ~9.85 km edge
  - https://h3geo.org/docs/core-library/restable/
- Overpass API official docs — bbox format, highway query, rate limits
  - https://wiki.openstreetmap.org/wiki/Overpass_API
  - https://dev.overpass-api.de/overpass-doc/en/full_data/bbox.html
- airplanes.live field descriptions — `nic` and `nac_p` fields confirmed present
  - https://airplanes.live/rest-api-adsb-data-field-descriptions/
- OpenSky /states/all field list — NIC/NACp confirmed NOT present (18 fields, indices 0-17)
  - https://openskynetwork.github.io/opensky-api/rest.html

### Secondary (MEDIUM confidence)

- gpsjam.org FAQ — confirmed formula `(num_bad - 1) / (num_good + num_bad)` and 24h update cycle
  - https://gpsjam.org/faq
- NIC/NACp thresholds — NIC < 7 OR nac_p < 8 = degraded, from GNSS interference detection research
  - https://www.gnssjamming.com/post/monitoring-gnss-interference-with-ads-b
- h3-pg not preinstalled in `postgis/postgis:16-3.5` — confirmed from Docker Hub and community discussions
  - https://hub.docker.com/r/postgis/postgis

### Tertiary (LOW confidence)

- osmtogeojson as Overpass→GeoJSON bridge — npm package widely referenced, bundle size unverified
- Particle count <= 500 for PointPrimitive performance — derived from CesiumJS community heuristics, not benchmarked for this project's GPU targets

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries verified via official docs; h3-py and h3-js v4 API methods confirmed
- Architecture: HIGH — GroundPrimitive batch pattern confirmed via CesiumJS docs; Overpass bbox query confirmed
- NIC/NACp thresholds: MEDIUM — NIC<7 / nac_p<8 from research literature, gpsjam.org formula verified from FAQ
- Pitfalls: HIGH for GroundPrimitive and h3 coordinate order (official docs); MEDIUM for Overpass timeout thresholds
- Particle simulation: MEDIUM — PointPrimitive pattern confirmed; exact road-following rAF logic is bespoke

**Research date:** 2026-03-12
**Valid until:** 2026-04-12 (30 days — stable libraries; airplanes.live API rate limits may change)
