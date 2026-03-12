# Phase 12: OSINT Event Correlation - Research

**Researched:** 2026-03-12
**Domain:** SGP4 overpass computation, OSINT event persistence, category tag filtering, CesiumJS arc-line rendering
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| REP-05 | User sees satellite overpass lines connecting overhead satellites to areas of interest during replay, based on real SGP4 overpass computation for the replayed timestamp | `propagation.worker.ts` already runs `satellite.propagate(satrec, new Date(timestamp))` for any timestamp; adding a `COMPUTE_OVERPASS` message type lets the worker return which NORADs are above the horizon for a given lat/lon at `replayTs`; CesiumJS `PolylineCollection` + `ArcType.GEODESIC` renders curved arc lines from satellite ECEF position to surface point; TLE age gate enforces the 7-day quality check using `Satellite.updated_at` from the DB |
| REP-06 | User can filter displayed events and layers by category tag during replay | Extend Zustand store with `activeCategories: Set<OsintCategory>` (or `string[]`); new `OsintEventPanel` component writes events to a `osint_events` backend table; `PlaybackBar` reads `osint_events` API (or DB-injected events) instead of the empty `OSINT_EVENTS` static array; category chip toggle updates store; all layer components and event markers gate visibility on `activeCategories` membership |
</phase_requirements>

---

## Summary

Phase 12 has two distinct, loosely-coupled sub-problems that can be planned as parallel tracks.

**Track A — Satellite Overpass Lines (REP-05):** The propagation worker already knows how to SGP4-propagate any satellite to any timestamp. The missing piece is an elevation-angle query: for a given ground point (lat/lon) and a given `replayTs`, find all satellites whose elevation above the local horizon exceeds a threshold (typically >= 0 degrees, optionally >= 10 degrees). The worker computes satellite geodetic position, derives azimuth/elevation from the ground point using `satellite.ecfToLookAngles()`, and returns matching NORAD IDs with their ECEF positions. The frontend then draws `Polyline` arcs in `PolylineCollection` from each overhead satellite's Cartesian3 to the area-of-interest's surface Cartesian3. The TLE age gate is a backend concern: `GET /api/satellites/freshness` already returns the most recent `updated_at`; if `Date.now() - freshness > 7 days`, the frontend suppresses overpass lines and shows a visible warning banner.

**Track B — OSINT Event Entry and Category Filtering (REP-06):** Phase 11 left `OSINT_EVENTS` as an empty static array and noted that Phase 12 would replace it with database-driven events. The work is: (1) a `osint_events` PostgreSQL table + Alembic migration + `POST /api/osint-events` route for event entry; (2) an `OsintEventPanel` React component (form with location picker, timestamp, category select, source URL field); (3) a `GET /api/osint-events` route consumed by a new `useOsintEvents` hook that feeds the `PlaybackBar`; (4) category chip toggle in `PlaybackBar` that gates which event markers render and which globe layers are active. The category set in Phase 12 (`KINETIC`, `AIRSPACE`, `MARITIME`, `SEISMIC`, `JAMMING`) differs slightly from Phase 11's hardcoded enum — `BLACKOUT` is replaced by `SEISMIC`. The `OsintEvent` TypeScript interface in `osintEvents.ts` must be extended.

**Primary recommendation:** Plan Track A (overpass) and Track B (event entry + filtering) as separate plan groups within the same phase. Track A requires extending the propagation worker; Track B requires a new backend table + API + frontend panel. Both converge in `PlaybackBar` (overpass draws when `replayMode === 'playback'` and an area of interest is selected; category chips control event and layer visibility).

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| satellite.js | ^5.0.0 (installed) | SGP4 propagation + `ecfToLookAngles()` for elevation angle | Already used in `propagation.worker.ts`; `ecfToLookAngles` takes a ground point ECF and satellite ECF, returns `{azimuth, elevation, rangeSat}` in radians |
| cesium | ^1.139.1 (installed) | `PolylineCollection` + `ArcType.GEODESIC` for arc lines from satellite to surface | Already used in `SatelliteLayer.tsx` for orbit/ground track polylines; same primitive pattern |
| zustand | ^5.0.11 (installed) | `activeCategories` slice for category tag filter state | Established project state manager; all layer toggle state already lives here |
| @tanstack/react-query | ^5.90.21 (installed) | `useOsintEvents` hook consuming `GET /api/osint-events` | All project data hooks use this pattern; `refetchInterval` pause in playback mode is established |
| FastAPI | (installed) | `POST /api/osint-events` + `GET /api/osint-events` routes | All project routes use FastAPI; same `APIRouter` + `AsyncSession` pattern |
| SQLAlchemy | (installed) | `OsintEvent` ORM model for `osint_events` table | All project models use SQLAlchemy mapped_column pattern |
| Alembic | (installed) | Migration for `osint_events` table | Every new table has had an Alembic migration in this project |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| React `useRef` + rAF | built-in | Overpass computation throttling — don't re-query the worker on every rAF frame | Throttle to once per second or on `replayTs` change with a debounce; overpass lines do not need sub-second refresh |
| HTML `<dialog>` or inline panel | built-in | `OsintEventPanel` modal/drawer for event entry | Consistent with project pattern of inline fixed-position panels (PostProcessPanel, SatelliteDetailPanel etc.) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Worker `COMPUTE_OVERPASS` message | Backend `/api/satellites/overpass` route | Worker approach avoids HTTP round-trip per scrubber frame; backend approach avoids porting look-angle math; worker is better here because overpass must update continuously during playback |
| `osint_events` PostgreSQL table | Static JSON file or localStorage | DB enables server-side persistence and future multi-session use; for a homelab single-user tool, either works but DB is consistent with project conventions |
| `ArcType.GEODESIC` polylines | `ArcType.NONE` straight ECEF lines | `GEODESIC` curves the line along the Earth surface, which is visually correct for a satellite-to-ground connection; `NONE` is used for orbital paths (correct for orbit) but would appear to clip through the globe for surface-to-orbit arcs |

**Installation:** No new packages needed. All dependencies are already installed.

---

## Architecture Patterns

### Recommended Project Structure
```
frontend/src/
├── workers/
│   └── propagation.worker.ts       # extend: add COMPUTE_OVERPASS message type
├── components/
│   ├── SatelliteLayer.tsx          # extend: handle OVERPASS_RESULT message; manage overpass PolylineCollection
│   ├── PlaybackBar.tsx             # extend: render category chips; pass dynamic osint events; trigger overpass on AOI
│   └── OsintEventPanel.tsx         # new: form panel for event entry (location, ts, category, source URL)
├── hooks/
│   └── useOsintEvents.ts           # new: GET /api/osint-events; pause refetch in playback
├── data/
│   └── osintEvents.ts              # extend: add SEISMIC to OsintEvent category union; add EVENT_COLORS.SEISMIC
├── store/
│   └── useAppStore.ts              # extend: activeCategories, areaOfInterest (lat/lon for overpass)
└── components/__tests__/
    └── OsintEventPanel.test.tsx    # smoke test: form renders; submit dispatches POST

backend/app/
├── models/
│   └── osint_event.py              # new: OsintEvent SQLAlchemy model
├── api/
│   └── routes_osint.py             # new: GET /api/osint-events, POST /api/osint-events
├── alembic/versions/
│   └── XXXX_add_osint_events.py    # new: Alembic migration
└── tests/
    └── test_osint.py               # new: TDD tests for osint routes (RED → GREEN)
```

### Pattern 1: Worker COMPUTE_OVERPASS Message (SGP4 Elevation Scan)

**What:** Add a new message type to `propagation.worker.ts`. When the frontend sends `{type: 'COMPUTE_OVERPASS', payload: {lat, lon, timestamp, elevationThresholdDeg}}`, the worker iterates all loaded satrecs, propagates each to `timestamp`, converts to geodetic, computes look angles from `(lat, lon)` using `satellite.ecfToLookAngles()`, and returns the list of NORAD IDs + ECEF positions for satellites above the threshold.

**When to use:** Called from `SatelliteLayer` (or a dedicated hook) whenever `replayMode === 'playback'` and an area-of-interest lat/lon is set in the store. Throttled to fire at most once per second to avoid worker saturation.

**Key satellite.js API — `ecfToLookAngles`:**
```typescript
// Source: satellite.js documentation / existing propagation.worker.ts patterns
// The function signature (from satellite.js source):
// satellite.ecfToLookAngles(
//   observerGd: { longitude: number; latitude: number; height: number },  // radians
//   positionEcf: { x: number; y: number; z: number },  // km
// ): { azimuth: number; elevation: number; rangeSat: number }

// In the worker, after propagating a satellite to a timestamp:
const pv = satellite.propagate(satrec, new Date(timestamp));
if (pv === null || typeof pv.position === 'boolean') continue;
const gmst = satellite.gstime(new Date(timestamp));
const ecf = satellite.eciToEcf(pv.position, gmst);
const observerGd = {
  longitude: lonRad,   // observer longitude in radians
  latitude: latRad,    // observer latitude in radians
  height: 0,           // observer altitude (km above sea level; 0 for ground level)
};
const lookAngles = satellite.ecfToLookAngles(observerGd, ecf);
if (lookAngles.elevation * 180 / Math.PI >= elevationThresholdDeg) {
  // satellite is overhead — include in result
  overhead.push({
    norad: satrecs[i].norad,
    ecf: { x: ecf.x * 1000, y: ecf.y * 1000, z: ecf.z * 1000 },  // km → m for Cesium
  });
}
```

**Worker message types to add:**
```typescript
interface ComputeOverpassMessage {
  type: 'COMPUTE_OVERPASS';
  payload: {
    lat: number;         // degrees
    lon: number;         // degrees
    timestamp: number;   // ms epoch
    elevationThresholdDeg: number;  // typically 0 or 10
  };
}

interface OverpassResultMessage {
  type: 'OVERPASS_RESULT';
  overhead: Array<{ norad: number; ecf: { x: number; y: number; z: number } }>;
  timestamp: number;   // echo back — discard stale results if replayTs has moved
}
```

### Pattern 2: CesiumJS Overpass Arc Lines (SatelliteLayer extension)

**What:** `SatelliteLayer` gains a module-level `overpassCollectionRef` (separate from `orbitCollectionRef`). When an `OVERPASS_RESULT` worker message arrives, the existing collection is removed and a new `PolylineCollection` is built — one `Polyline` per overhead satellite, drawn from the satellite's ECEF Cartesian3 to the surface point's Cartesian3.

**CesiumJS `ArcType.GEODESIC` for arc appearance:**
```typescript
// Source: existing SatelliteLayer.tsx orbit polyline pattern (ArcType.NONE)
// For overpass lines, use ArcType.GEODESIC (curves along Earth surface)
import { ArcType, Material, Color, PolylineCollection, Cartesian3 } from 'cesium';

const overpassCollection = viewer.scene.primitives.add(new PolylineCollection());
overpassCollection.add({
  positions: [
    new Cartesian3(satEcf.x, satEcf.y, satEcf.z),   // satellite position (m)
    Cartesian3.fromDegrees(aoiLon, aoiLat, 0),        // surface point
  ],
  width: 1.5,
  material: Material.fromType('Color', {
    color: Color.fromCssColorString('#00D4FF').withAlpha(0.6),
  }),
  arcType: ArcType.GEODESIC,
});
```

**TLE age gate — frontend enforcement:**
```typescript
// In SatelliteLayer or a helper hook:
// GET /api/satellites/freshness already returns { last_updated: ISO | null }
// Compare to Date.now():
const tleAge = Date.now() - new Date(tleLastUpdated).getTime();
const TLE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;  // 7 days

if (tleAge > TLE_MAX_AGE_MS) {
  // Suppress overpass lines entirely
  // Show visible warning: "TLE data older than 7 days — overpass accuracy degraded"
  return;
}
// else: proceed with COMPUTE_OVERPASS
```

The `tleLastUpdated` string is already in the Zustand store as `tleLastUpdated` (set by `useSatellites` hook via `/api/satellites/freshness` in the existing codebase — confirmed in `useAppStore.ts`).

### Pattern 3: Area-of-Interest Selection

**What:** The user needs to designate a lat/lon point on the globe as the "area of interest" for overpass computation. The most natural interaction: right-click or long-press on the globe sets the AOI marker. Alternatively, the `OsintEventPanel` location field sets the AOI when an event is being reviewed.

**Store extension:**
```typescript
// New slice in useAppStore.ts
areaOfInterest: { lat: number; lon: number } | null;
setAreaOfInterest: (aoi: { lat: number; lon: number } | null) => void;
```

**Globe click handler in SatelliteLayer (or AircraftLayer which already owns click dispatch):**
```typescript
// In existing screen-space event handler (AircraftLayer.tsx owns the unified handler)
// Right-click (ScreenSpaceEventType.RIGHT_CLICK) sets AOI:
handler.setInputAction((click: { position: Cartesian2 }) => {
  const earthPos = viewer.scene.pickPosition(click.position);
  if (!earthPos) return;
  const carto = Ellipsoid.WGS84.cartesianToCartographic(earthPos);
  useAppStore.getState().setAreaOfInterest({
    lat: CesiumMath.toDegrees(carto.latitude),
    lon: CesiumMath.toDegrees(carto.longitude),
  });
}, ScreenSpaceEventType.RIGHT_CLICK);
```

Note: The existing `AircraftLayer.tsx` owns the unified CesiumJS `ScreenSpaceEventHandler`. The right-click AOI handler should be added there or delegated to `SatelliteLayer` which already has a `handlerRef` (currently null). Either location works; `AircraftLayer` is the cleaner consolidation point since it already has the event handler infrastructure.

### Pattern 4: OsintEvent Backend (Table + Routes)

**What:** A new `osint_events` PostgreSQL table stores user-entered events. The FastAPI backend exposes `GET /api/osint-events` (returns all events, optionally filtered by category) and `POST /api/osint-events` (creates a new event). The frontend `useOsintEvents` hook fetches events in live mode; in playback mode, events are already loaded and filtered by `activeCategories`.

**SQLAlchemy model:**
```python
# backend/app/models/osint_event.py
from sqlalchemy import Integer, String, Float, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column
from app.db import Base

class OsintEvent(Base):
    __tablename__ = "osint_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    ts: Mapped[object] = mapped_column(DateTime(timezone=True), nullable=False)
    category: Mapped[str] = mapped_column(String, nullable=False)  # KINETIC|AIRSPACE|MARITIME|SEISMIC|JAMMING
    label: Mapped[str] = mapped_column(String, nullable=False)
    latitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    longitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    source_url: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[object] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
```

**API routes contract:**
```python
# GET /api/osint-events → { events: [{id, ts, category, label, lat, lon, source_url}] }
# POST /api/osint-events body: { ts: ISO, category: str, label: str, lat?: float, lon?: float, source_url?: str }
# → { id: int, ...event fields }
```

**Router registration in main.py:**
```python
# Add to main.py (same pattern as all other routers):
from app.api.routes_osint import router as osint_router
app.include_router(osint_router, prefix="/api/osint-events")
```

### Pattern 5: Category Filtering (Store + PlaybackBar + Layers)

**What:** A new `activeCategories` field in the Zustand store holds a `string[]` (or `Set<string>`) of currently active category tags. When `activeCategories` is empty or all categories are selected, everything is shown (default state). When one or more chips are activated, only matching events and correlated layers are shown.

**Store extension:**
```typescript
// Categories that match Phase 12 success criteria:
// KINETIC, AIRSPACE, MARITIME, SEISMIC, JAMMING
// Note: BLACKOUT from Phase 11 spec is replaced by SEISMIC in Phase 12 spec.
// osintEvents.ts OsintEvent.category union must be updated accordingly.

activeCategories: string[];  // empty = show all
setActiveCategories: (cats: string[]) => void;
toggleCategory: (cat: string) => void;  // adds if absent, removes if present
```

**Category chip rendering in PlaybackBar:**
```tsx
// Chips rendered below or alongside the scrubber in playback mode:
const CATEGORY_CHIPS = ['KINETIC', 'AIRSPACE', 'MARITIME', 'SEISMIC', 'JAMMING'];

{replayMode === 'playback' && (
  <div style={{ display: 'flex', gap: '4px' }}>
    {CATEGORY_CHIPS.map(cat => (
      <button
        key={cat}
        onClick={() => toggleCategory(cat)}
        style={{
          background: activeCategories.includes(cat) || activeCategories.length === 0
            ? EVENT_COLORS[cat]
            : 'rgba(255,255,255,0.05)',
          color: '#fff',
          border: '1px solid rgba(255,255,255,0.2)',
          padding: '2px 6px',
          borderRadius: '2px',
          cursor: 'pointer',
          fontFamily: 'monospace',
          fontSize: '9px',
          fontWeight: 700,
          opacity: activeCategories.length === 0 || activeCategories.includes(cat) ? 1 : 0.35,
        }}
      >
        {cat}
      </button>
    ))}
  </div>
)}
```

**Layer filtering behavior:**
- `activeCategories.length === 0` → show all event markers + all globe layers (default)
- `activeCategories` contains `'MARITIME'` only → show MARITIME event markers, show Ship layer, hide others
- Category-to-layer mapping: `AIRSPACE` → aircraft + military, `MARITIME` → ships, `JAMMING` → gpsJamming, `KINETIC`/`SEISMIC` → no specific layer gate (show event markers only)

The layer gating is additive: if `AIRSPACE` is active, aircraft and military layers remain visible even if the user has toggled them off via the sidebar — OR, more consistent with the project's existing toggle architecture, the category filter adjusts `show` on each PointPrimitive directly rather than toggling `layers.*` in the store (to avoid conflicting with the user's explicit layer toggles).

### Pattern 6: OsintEvent Category Change (`BLACKOUT` → `SEISMIC`)

**What:** Phase 11's `OsintEvent` type uses `'KINETIC' | 'AIRSPACE' | 'MARITIME' | 'JAMMING' | 'BLACKOUT'`. Phase 12's success criteria use `'KINETIC' | 'AIRSPACE' | 'MARITIME' | 'SEISMIC' | 'JAMMING'`. The `BLACKOUT` category is replaced by `SEISMIC`.

**Files to update:**
- `frontend/src/data/osintEvents.ts`: update category union, add `SEISMIC: '#ffff00'` color, remove `BLACKOUT` (or keep as deprecated if backward compatibility is needed)
- `frontend/src/components/PlaybackBar.tsx`: update `CATEGORY_CHIPS` constant
- `backend/app/models/osint_event.py`: validation list for the `category` string field

### Anti-Patterns to Avoid

- **Running COMPUTE_OVERPASS on every rAF frame:** The worker is already doing PROPAGATE at 1 Hz. A COMPUTE_OVERPASS call loops over all ~6000+ satrecs for a single ground point — this is CPU-intensive in the worker thread. Throttle to fire at most once per second or on explicit `replayTs` change with a `useEffect` debounce.
- **Drawing overpass lines in live mode:** Overpass lines are only meaningful in playback mode (the requirement says "during replay"). In live mode, suppress COMPUTE_OVERPASS calls and hide the overpass collection.
- **Using `viewer.entities` for overpass lines:** Consistent with established project architecture — all layer primitives use `PointPrimitiveCollection` / `PolylineCollection`. `viewer.entities` is explicitly avoided (see deferred-items.md for the GpsJammingLayer issue). Use `viewer.scene.primitives.add(new PolylineCollection())`.
- **Storing `activeCategories` as a `Set<string>` in Zustand:** Sets are not serializable and break Zustand's shallow equality check. Store as `string[]` and use `.includes()` for membership test.
- **Category filter toggling `layers.*` in the store:** The `layers` store controls user-visible toggles (the SAT/AIR/MIL/SHIP/JAM/TFC buttons). Category filtering should adjust layer visibility at the primitive level (`.show` on PointPrimitive items) rather than overwriting `layers.*`, which would cause confusion when the user re-enables a toggle after filtering.
- **Forgetting to clean up overpass PolylineCollection on mode switch:** When `replayMode` returns to `'live'`, remove the overpass collection from `viewer.scene.primitives` in the cleanup path of the overpass effect.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Satellite elevation angle from ground | Custom trig for azimuth/elevation | `satellite.ecfToLookAngles(observerGd, positionEcf)` | Handles coordinate frame transforms correctly; rolling your own risks sign errors in azimuth quadrant resolution |
| Arc line from satellite to ground | Canvas overlay or custom WebGL | CesiumJS `PolylineCollection` with `ArcType.GEODESIC` | Already used for orbit/ground track in `SatelliteLayer.tsx`; handles globe-surface curve correctly |
| OSINT event form validation | Custom validation logic | HTML5 `required`, `type="url"`, `type="datetime-local"` attributes | Browser-native; consistent with project's minimal-dependency approach |
| TLE age computation | Custom time diff logic | Compare `tleLastUpdated` from store (already set by `useSatellites` hook) to `Date.now()` with a 7-day constant | The value is already in the store; no new API needed |
| Debounce for overpass recompute | Custom timer | `useEffect` with a `setTimeout`/`clearTimeout` debounce pattern | Standard React debounce; avoids worker message storm on scrubber drag |

**Key insight:** The hardest part of REP-05 (SGP4 elevation scan) is already solved — `satellite.js` `ecfToLookAngles` exists and the worker already loads all satrecs. The work is wiring a new message type and handling the result.

---

## Common Pitfalls

### Pitfall 1: Stale Overpass Result After Scrubber Drag

**What goes wrong:** User drags scrubber rapidly. Worker receives multiple COMPUTE_OVERPASS messages. Results arrive out of order. The last result drawn does not correspond to the current `replayTs`.

**Why it happens:** Worker message queue is FIFO but computation time varies by satellite count. Slower machines see more out-of-order arrivals.

**How to avoid:** Echo `timestamp` back in `OVERPASS_RESULT`. In the `onmessage` handler, compare `msg.timestamp` to `useAppStore.getState().replayTs`. If the difference is greater than 2 seconds, discard the result as stale. Only draw overpass lines for results within 2 seconds of current `replayTs`.

**Warning signs:** Overpass lines don't update when scrubbing slowly, but flicker when scrubbing fast.

### Pitfall 2: `ecfToLookAngles` Requires Radians, Not Degrees

**What goes wrong:** Observer `lat`/`lon` are passed as degrees instead of radians. Elevation angles are wildly wrong. All satellites appear above or below the horizon incorrectly.

**Why it happens:** The store and API return degrees; `satellite.js` requires radians for the observer geodetic struct.

**How to avoid:** Convert explicitly in the worker:
```typescript
const observerGd = {
  longitude: payload.lon * Math.PI / 180,
  latitude: payload.lat * Math.PI / 180,
  height: 0,
};
```
The `ecf` position from `satellite.eciToEcf()` is in km — pass it directly (no km→m conversion needed for `ecfToLookAngles`).

**Warning signs:** In a test at a known location (e.g., lat 0, lon 0), all 6000 satellites appear overhead, or none do.

### Pitfall 3: Overpass Line Destination Must Be Surface Cartesian3

**What goes wrong:** Overpass line destination is set to `Cartesian3.fromDegrees(lon, lat, altitude)` with a non-zero altitude, causing the line to end above the ground.

**Why it happens:** AOI point may have altitude from `scene.pickPosition()` which returns the actual terrain elevation.

**How to avoid:** Force altitude to 0 for the surface endpoint: `Cartesian3.fromDegrees(aoi.lon, aoi.lat, 0)`. The visual difference is negligible for intelligence analysis purposes.

### Pitfall 4: SEISMIC Category Not in `EVENT_COLORS`

**What goes wrong:** `PlaybackBar` renders category chips; `SEISMIC` chip has no color entry in `EVENT_COLORS`, appears `undefined`-colored (transparent or error).

**Why it happens:** `osintEvents.ts` currently defines colors for `KINETIC`, `AIRSPACE`, `MARITIME`, `JAMMING`, `BLACKOUT`. `SEISMIC` is not in Phase 11's spec.

**How to avoid:** Update `EVENT_COLORS` in `osintEvents.ts` to add `SEISMIC: '#ffff00'` (yellow, visually distinct from existing colors). Do this in Wave 0 alongside the type union update.

### Pitfall 5: `POST /api/osint-events` CORS — Only GET Is Allowed

**What goes wrong:** Posting an OSINT event from the frontend returns a CORS error. The backend `CORSMiddleware` only allows `["GET", "POST"]` per `main.py` — so POST is actually allowed. But this is worth verifying at integration time.

**Why it happens:** Non-issue per current `main.py`: `allow_methods=["GET", "POST"]`. POST is explicitly allowed.

**How to avoid:** Verify during Wave 0 backend tests. The existing CORS config is sufficient. No change needed to `main.py`.

### Pitfall 6: Category Filtering Interferes with User Layer Toggles

**What goes wrong:** User has SAT layer toggled off. User activates `AIRSPACE` category. The category filter re-enables aircraft layer. User then disables aircraft layer again. State becomes inconsistent.

**Why it happens:** If category filter writes to `layers.*` in the store, it conflicts with the user's explicit toggle actions.

**How to avoid:** Category filter MUST NOT write to `layers.*`. It should gate at the rendering level: inside each layer component's render loop, check both `layers.xxx` (user toggle) AND whether `activeCategories` includes a matching category. Both conditions must be met for the layer to show. An `activeCategories.length === 0` means "no filter applied — show all" (default state). This preserves user toggle intent.

### Pitfall 7: Overpass Worker Iteration Performance with 6000+ Satellites

**What goes wrong:** `COMPUTE_OVERPASS` iterates all satrecs in the worker. At 6000+ satellites, this takes 50–200ms on lower-end hardware, blocking other worker messages (PROPAGATE) while running.

**Why it happens:** Worker is single-threaded. A slow COMPUTE_OVERPASS blocks the PROPAGATE that drives the live satellite position loop.

**How to avoid:** Only trigger COMPUTE_OVERPASS in `playback` mode (never in live mode). Use a `useEffect` with `replayTs` dependency, debounced to fire at most once per second. Since playback mode pauses the live PROPAGATE loop (live updates are frozen in playback), there is no contention. Confirm the live PROPAGATE loop is stopped when `replayMode === 'playback'` in `SatelliteLayer` (currently the loop always runs — this must be addressed).

---

## Code Examples

### satellite.js `ecfToLookAngles` Usage Pattern

```typescript
// Source: satellite.js npm package — verified API signature
// Worker context (propagation.worker.ts extension)
import * as satellite from 'satellite.js';

// After propagating to timestamp:
const pv = satellite.propagate(satrec, new Date(timestamp));
if (pv === null || typeof pv.position === 'boolean' || pv.position === undefined) continue;

const gmst = satellite.gstime(new Date(timestamp));
const ecf = satellite.eciToEcf(pv.position, gmst);  // km

const observerGd = {
  longitude: payload.lon * Math.PI / 180,  // MUST be radians
  latitude:  payload.lat * Math.PI / 180,  // MUST be radians
  height: 0,  // km above sea level
};

const look = satellite.ecfToLookAngles(observerGd, ecf);
const elevationDeg = look.elevation * 180 / Math.PI;

if (elevationDeg >= elevationThresholdDeg) {
  overhead.push({
    norad: satrecs[i].norad,
    ecf: { x: ecf.x * 1000, y: ecf.y * 1000, z: ecf.z * 1000 },  // km → m for Cesium
  });
}
```

### CesiumJS Overpass Polyline (extends SatelliteLayer.tsx pattern)

```typescript
// Source: frontend/src/components/SatelliteLayer.tsx — existing PolylineCollection pattern
import { PolylineCollection, ArcType, Material, Color, Cartesian3 } from 'cesium';

// Module-level ref (outside component, same as indexMapRef pattern):
// overpassCollectionRef: React.MutableRefObject<PolylineCollection | null>

// On OVERPASS_RESULT message:
if (overpassCollectionRef.current && !overpassCollectionRef.current.isDestroyed()) {
  viewer.scene.primitives.remove(overpassCollectionRef.current);
}
const overpassCollection = viewer.scene.primitives.add(new PolylineCollection());
overpassCollectionRef.current = overpassCollection;

const aoiCartesian = Cartesian3.fromDegrees(aoi.lon, aoi.lat, 0);
for (const sat of msg.overhead) {
  overpassCollection.add({
    positions: [new Cartesian3(sat.ecf.x, sat.ecf.y, sat.ecf.z), aoiCartesian],
    width: 1.5,
    material: Material.fromType('Color', {
      color: Color.fromCssColorString('#00D4FF').withAlpha(0.5),
    }),
    arcType: ArcType.GEODESIC,
  });
}
```

### TLE Age Warning (React component snippet)

```tsx
// Inline in PlaybackBar or as a standalone OverpassWarning component
const tleLastUpdated = useAppStore(s => s.tleLastUpdated);
const TLE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const tleAge = tleLastUpdated ? Date.now() - new Date(tleLastUpdated).getTime() : Infinity;
const tleStalenessWarning = tleAge > TLE_MAX_AGE_MS;

{tleStalenessWarning && replayMode === 'playback' && (
  <span style={{ color: '#ff3333', fontSize: '9px', fontFamily: 'monospace' }}>
    WARNING: TLE data &gt;7 days old — overpass lines suppressed
  </span>
)}
```

### Zustand Store Extension for Phase 12

```typescript
// Additions to useAppStore.ts interface and create() call:

// Phase 12 slices
areaOfInterest: { lat: number; lon: number } | null;
setAreaOfInterest: (aoi: { lat: number; lon: number } | null) => void;
activeCategories: string[];   // empty = no filter (show all)
setActiveCategories: (cats: string[]) => void;
toggleCategory: (cat: string) => void;

// Default state:
areaOfInterest: null,
setAreaOfInterest: (aoi) => set({ areaOfInterest: aoi }),
activeCategories: [],
setActiveCategories: (cats) => set({ activeCategories: cats }),
toggleCategory: (cat) => set((s) => ({
  activeCategories: s.activeCategories.includes(cat)
    ? s.activeCategories.filter(c => c !== cat)
    : [...s.activeCategories, cat],
})),
```

### Backend OsintEvent Route (FastAPI pattern)

```python
# Source: matches pattern of routes_ships.py, routes_military.py
# backend/app/api/routes_osint.py
from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.db import get_db
from app.models.osint_event import OsintEvent
from datetime import datetime
from pydantic import BaseModel

router = APIRouter()

VALID_CATEGORIES = {"KINETIC", "AIRSPACE", "MARITIME", "SEISMIC", "JAMMING"}

class OsintEventCreate(BaseModel):
    ts: datetime
    category: str
    label: str
    latitude: float | None = None
    longitude: float | None = None
    source_url: str | None = None

@router.get("")
async def list_osint_events(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(OsintEvent).order_by(OsintEvent.ts))
    rows = result.scalars().all()
    return {"events": [
        {"id": r.id, "ts": r.ts.isoformat(), "category": r.category,
         "label": r.label, "latitude": r.latitude, "longitude": r.longitude,
         "source_url": r.source_url}
        for r in rows
    ]}

@router.post("")
async def create_osint_event(body: OsintEventCreate, db: AsyncSession = Depends(get_db)):
    if body.category not in VALID_CATEGORIES:
        from fastapi import HTTPException
        raise HTTPException(status_code=422, detail=f"Invalid category: {body.category}")
    event = OsintEvent(ts=body.ts, category=body.category, label=body.label,
                       latitude=body.latitude, longitude=body.longitude,
                       source_url=body.source_url)
    db.add(event)
    await db.commit()
    await db.refresh(event)
    return {"id": event.id, "ts": event.ts.isoformat(), "category": event.category,
            "label": event.label, "latitude": event.latitude, "longitude": event.longitude,
            "source_url": event.source_url}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| OSINT events as static `[]` array in `osintEvents.ts` | `osint_events` DB table + `GET/POST /api/osint-events` | Phase 12 (this phase) | Events survive browser refresh; multiple events can be entered during a session |
| `OsintEvent.category` includes `BLACKOUT` | Category set is `KINETIC | AIRSPACE | MARITIME | SEISMIC | JAMMING` | Phase 12 spec change | `SEISMIC` replaces `BLACKOUT`; `osintEvents.ts` type union must be updated |
| Satellite positions propagated at `Date.now()` only | Satellite positions propagated at `replayTs` for overpass computation | Phase 12 | Worker already accepts arbitrary `timestamp` in `PROPAGATE`; overpass computation reuses this |
| All globe layers visible in playback | Globe layers optionally gated by `activeCategories` | Phase 12 | Category chips give the user a focused intelligence view |

**Deprecated/outdated:**
- `OSINT_EVENTS` static const in `osintEvents.ts`: Replace with dynamic data from `useOsintEvents` hook. Keep the file but clear `OSINT_EVENTS = []` and export the hook separately (or inline in `PlaybackBar`).
- `BLACKOUT` category: Remove from the `OsintEvent` category union when implementing Phase 12. If any seed data references it, migrate to a suitable replacement (none of the existing events are in the DB yet, so no migration concern).

---

## Open Questions

1. **SatelliteLayer PROPAGATE loop in playback mode**
   - What we know: `SatelliteLayer`'s rAF loop sends `{type: 'PROPAGATE', payload: {timestamp: Date.now()}}` at 1 Hz. In playback mode, this continues running — satellites update to live positions even as the user scrubs through history.
   - What's unclear: Should the live PROPAGATE loop be paused in playback mode? Or should satellites continue showing live positions while overpass lines are computed for `replayTs`?
   - Recommendation: In playback mode, change the PROPAGATE timestamp from `Date.now()` to `replayTs` so the satellite dots also reflect the historical timestamp. This is consistent with the "replay as structured intelligence analysis" goal. Add a `useEffect` in `SatelliteLayer` that reads `replayMode` and `replayTs` from the store, and adjusts the PROPAGATE payload accordingly. This is a small change to `SatelliteLayer` but has a meaningful visual impact.

2. **Area of Interest UX — right-click vs. explicit form field**
   - What we know: The success criteria say "overhead satellites to an active area of interest" but don't specify how the user designates the AOI. The `OsintEventPanel` has a location field.
   - What's unclear: Should the AOI be set by clicking the globe, by entering coordinates in the event panel, or both?
   - Recommendation: AOI is set by right-clicking the globe (most intuitive for a globe-first tool). When a OSINT event is selected/reviewed, the event's `latitude`/`longitude` automatically becomes the AOI. Both paths write to `store.areaOfInterest`. A small persistent marker (e.g., a crosshair icon) at the AOI point on the globe provides feedback.

3. **Elevation threshold for overpass lines**
   - What we know: SGP4 accuracy degrades at low elevation angles due to atmospheric refraction. The threshold of 0° (any satellite above horizon) produces many lines; 10° is a common operational threshold.
   - What's unclear: The requirements don't specify a threshold.
   - Recommendation: Default to 10° elevation threshold (standard for satellite communications). Make it a configurable constant in the worker (`DEFAULT_ELEVATION_THRESHOLD_DEG = 10`). This reduces visual noise — at 0°, there can be 200+ satellites overhead simultaneously.

4. **AOI marker on the globe**
   - What we know: A visual indicator of the AOI position would improve usability. The project uses `PointPrimitive` for entity dots and `Polyline` for orbit tracks.
   - Recommendation: Add a single `PointPrimitive` or a small crosshair polyline at `Cartesian3.fromDegrees(aoi.lon, aoi.lat, 0)` with a distinct color (e.g., white or magenta). Managed by `SatelliteLayer` since it already owns the overpass collection.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 4.x (frontend) + pytest 8.x (backend) |
| Config file | `frontend/vite.config.ts` (`test.environment: 'jsdom'`) / `backend/pytest.ini` (`asyncio_mode = auto`) |
| Quick run command | `cd frontend && npx vitest run src/components/__tests__/OsintEventPanel.test.tsx src/hooks/__tests__/useOsintEvents.test.ts` |
| Full suite command | `cd frontend && npx vitest run` and `cd backend && python -m pytest -x -q` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| REP-05 | Worker `COMPUTE_OVERPASS` returns `overhead[]` array for known lat/lon at known timestamp | unit | `cd frontend && npx vitest run src/workers/__tests__/propagation.worker.test.ts` | Wave 0 gap |
| REP-05 | `ecfToLookAngles` elevation gate: satellite below horizon not included in `overhead` | unit | same as above | Wave 0 gap |
| REP-05 | TLE age > 7 days: overpass lines suppressed + warning shown | smoke | `cd frontend && npx vitest run src/components/__tests__/SatelliteLayer.overpass.test.tsx` | Wave 0 gap |
| REP-06 | `GET /api/osint-events` returns 200 with `events` key | integration | `cd backend && python -m pytest tests/test_osint.py::test_list_events -x` | Wave 0 gap |
| REP-06 | `POST /api/osint-events` with valid body returns 201 or 200 with `id` key | integration | `cd backend && python -m pytest tests/test_osint.py::test_create_event -x` | Wave 0 gap |
| REP-06 | `POST /api/osint-events` with invalid category returns 422 | integration | `cd backend && python -m pytest tests/test_osint.py::test_invalid_category -x` | Wave 0 gap |
| REP-06 | `OsintEventPanel` renders form fields (label, timestamp, category, source URL) | smoke | `cd frontend && npx vitest run src/components/__tests__/OsintEventPanel.test.tsx` | Wave 0 gap |
| REP-06 | Category chip toggle: `activeCategories` updates in store | unit | `cd frontend && npx vitest run src/store/__tests__/useAppStore.test.ts` | Wave 0 gap (extend existing) |
| REP-06 | Event markers filter: only matching category events shown when `activeCategories` is non-empty | smoke | `cd frontend && npx vitest run src/components/__tests__/PlaybackBar.category.test.tsx` | Wave 0 gap |

### Sampling Rate
- **Per task commit:** Quick run command for the task's specific test file(s)
- **Per wave merge:** `cd frontend && npx vitest run` and `cd backend && python -m pytest -x -q`
- **Phase gate:** Full frontend + backend suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `backend/tests/test_osint.py` — covers REP-06: `test_list_events`, `test_create_event`, `test_invalid_category`
- [ ] `frontend/src/components/__tests__/OsintEventPanel.test.tsx` — smoke test for event entry form rendering
- [ ] `frontend/src/components/__tests__/PlaybackBar.category.test.tsx` — category chip rendering + filter behavior
- [ ] `frontend/src/components/__tests__/SatelliteLayer.overpass.test.tsx` — TLE age warning smoke test
- [ ] `frontend/src/workers/__tests__/propagation.worker.test.ts` — unit test for `COMPUTE_OVERPASS` message type (note: worker tests require careful mocking; may need a pure-function extraction for elevation logic)
- [ ] Extend `frontend/src/store/__tests__/useAppStore.test.ts` — add `activeCategories` initial state and `toggleCategory` behavior assertions
- [ ] Extend `frontend/src/hooks/__tests__/useOsintEvents.test.ts` — unit test for `useOsintEvents` hook (disabled state, event array shape)

*(Framework already installed — vitest 4.x in devDependencies, pytest in requirements-dev.txt. No new packages needed.)*

---

## Sources

### Primary (HIGH confidence)
- `frontend/src/workers/propagation.worker.ts` — confirms `satellite.js` is installed and `satellite.propagate`, `satellite.eciToEcf`, `satellite.gstime` are in use; `ecfToLookAngles` is a peer function in the same library
- `frontend/src/components/SatelliteLayer.tsx` — confirms `PolylineCollection`, `ArcType.NONE`, `Material.fromType('Color')` pattern; `ArcType.GEODESIC` is the appropriate variant for surface-to-orbit arcs
- `frontend/src/store/useAppStore.ts` — confirms `tleLastUpdated` already exists in store; confirms Zustand slice extension pattern
- `frontend/src/data/osintEvents.ts` — confirms current category set includes `BLACKOUT`; Phase 12 must add `SEISMIC` and remove `BLACKOUT`
- `frontend/src/components/PlaybackBar.tsx` — confirms how `OSINT_EVENTS` is currently consumed; confirms injection point for dynamic events
- `backend/app/api/routes_replay.py` — confirms API router pattern (empty string path, `AsyncSession` injection, Pydantic-free response shape)
- `backend/app/models/satellite.py` — confirms `updated_at` column is the TLE age source; `Satellite.updated_at` is `DateTime(timezone=True)`
- `backend/app/main.py` — confirms `allow_methods=["GET", "POST"]`; POST is already permitted for the new `routes_osint` router
- `.planning/STATE.md` — locked decision: "TLE age > 7 days triggers visible overpass warning"
- `.planning/REQUIREMENTS.md` — REP-05/06 exact text; `SEISMIC` appears in Phase 12 success criteria (replaces `BLACKOUT`)

### Secondary (MEDIUM confidence)
- `satellite.js` npm documentation: `ecfToLookAngles(observerGd, positionEcf)` returns `{azimuth, elevation, rangeSat}` — function exists in satellite.js and is the standard tool for this computation; version ^5.0.0 installed per package.json
- CesiumJS `ArcType.GEODESIC` documentation: draws line segments along the WGS84 ellipsoid surface — confirmed in CesiumJS API; used in project for ground tracks with `ArcType.NONE` (orbital), `ArcType.GEODESIC` is the correct type for surface-to-orbit appearance

### Tertiary (LOW confidence)
- Elevation threshold of 10° as standard operational value — widely referenced in satellite communications and OSINT literature; not verified in project-specific requirements (requirements do not specify a threshold)
- Worker performance estimate for COMPUTE_OVERPASS (50–200ms on lower-end hardware) — estimated from general knowledge of SGP4 propagation throughput; not benchmarked

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already installed; patterns verified against existing project code
- Architecture (overpass): HIGH — `ecfToLookAngles` confirmed in satellite.js; `PolylineCollection` + `ArcType.GEODESIC` confirmed in CesiumJS; worker message pattern established in `propagation.worker.ts`
- Architecture (event entry + filtering): HIGH — backend pattern (model, Alembic, FastAPI route) is identical to every previous phase; Zustand slice extension pattern established
- Pitfalls: HIGH for stale overpass result and units confusion (verified against `ecfToLookAngles` API); MEDIUM for worker performance (estimated, not measured)
- Category change (`BLACKOUT` → `SEISMIC`): HIGH — verified against Phase 12 success criteria text in REQUIREMENTS.md/ROADMAP.md vs. Phase 11 `osintEvents.ts` source

**Research date:** 2026-03-12
**Valid until:** 2026-04-12 (stable stack; satellite.js 5.x, CesiumJS 1.x, and Zustand 5.x have no planned breaking changes in this window)
