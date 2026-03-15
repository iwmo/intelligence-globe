# Phase 2: Satellite Layer - Research

**Researched:** 2026-03-11
**Domain:** satellite.js SGP4 propagation + CelesTrak OMM/GP JSON + CesiumJS PointPrimitiveCollection + Vite Web Workers + FastAPI/RQ background ingestion
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| SAT-01 | User sees 5,000+ real-time satellites rendered on the globe from CelesTrak TLE/GP data | CelesTrak `GROUP=active&FORMAT=json` returns ~10,000 active objects; satellite.js `json2satrec()` + SGP4 propagation in Web Worker; CesiumJS `PointPrimitiveCollection` handles 64,800+ points at 60 FPS |
| SAT-02 | User sees orbit path polylines and ground tracks for selected satellites | Pre-compute ~90 min of positions (one orbital period) at 30-second steps in Web Worker; render as `PolylineCollection` in CesiumJS with Cartesian3 arrays; ground track uses `eciToGeodetic` → `Cartesian3.fromRadians` |
| INT-01 | User can click any satellite to inspect metadata (NORAD ID, altitude, velocity, TLE epoch, constellation) | CesiumJS pick ray (`scene.pick`) on PointPrimitive returns primitive ID mapped to NORAD_CAT_ID; backend `/api/satellites/{norad_id}` returns full metadata; altitude and velocity derived server-side via SGP4 at current epoch |
</phase_requirements>

---

## Summary

Phase 2 connects three systems: (1) a backend ingestion pipeline that fetches CelesTrak OMM/GP JSON and stores it in PostgreSQL, (2) a background scheduler (RQ with `--with-scheduler`) that re-fetches TLE data every 2 hours to keep orbital elements fresh, and (3) a React frontend that pulls all satellite records, propagates ECI positions in a Web Worker using satellite.js, and renders 5,000+ glowing points on the CesiumJS globe via `PointPrimitiveCollection`.

The architectural decision already locked in STATE.md is critical: **satellite.js runs in a Web Worker** so SGP4 propagation for thousands of objects does not block the main thread and degrade frame rate. The Entity API must not be used — the Primitive API (`PointPrimitiveCollection`, `PolylineCollection`) is the only path that scales. CelesTrak OMM/GP JSON is used instead of legacy TLE text because 5-digit NORAD catalog numbers will overflow (~2026-07-20), and satellite.js 6.x `json2satrec()` natively parses this format.

Click-to-inspect (INT-01) is implemented via `scene.pick()` returning a primitive with an attached `id` property (the NORAD_CAT_ID), which triggers a TanStack Query fetch to the backend's `/api/satellites/{norad_id}` endpoint. Altitude and velocity shown in the metadata panel are computed server-side from the stored OMM record at the time of the request.

**Primary recommendation:** Web Worker for propagation with `postMessage` transferring a `Float64Array` of positions back to the main thread; single `PointPrimitiveCollection` with fixed indices (never `removeAll` each frame); update each point's `.position` property in a `requestAnimationFrame` loop; add/remove only the selected orbit polyline on demand.

---

## Standard Stack

### Core (Phase 2 additions to the existing Phase 1 stack)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| satellite.js | ^6.0.2 | SGP4/SDP4 orbit propagation, OMM parsing | Only mature JS library for SGP4; 6.x adds TypeScript + `json2satrec()` for OMM |
| httpx | ^0.27 | Async HTTP client for fetching CelesTrak GP data | Already in requirements-dev; needed in production for backend ingestion |
| rq | ^1.16+ | Background job queue backed by Redis | Pre-decided in STATE.md over Celery; already have Redis service |
| redis (python) | ^5.0 | RQ connection; already in requirements.txt | Already present |

### No New Backend Deps Required
The existing backend already has: FastAPI, SQLAlchemy 2 async, asyncpg, PostgreSQL+PostGIS, Redis, Pydantic, Alembic.

`httpx` must move from `requirements-dev.txt` to `requirements.txt` for production backend ingestion.

### Frontend (additions to existing)

| Library | Version | Purpose | Why |
|---------|---------|---------|-----|
| satellite.js | ^6.0.2 | SGP4 propagation in Web Worker | Runs off-main-thread; no UI impact |

**Installation:**
```bash
# Frontend
cd frontend && npm install satellite.js

# Backend — httpx moves to production requirements
pip install httpx rq
```

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| satellite.js `json2satrec` | Parse legacy TLE text | TLE format sunsets for 6-digit NORAD IDs ~2026-07-20; OMM JSON is the forward-compatible path |
| Web Worker (off-thread) | Main thread propagation | Main thread at 5,000+ satellites causes visible jank; pre-decided in STATE.md |
| PointPrimitiveCollection | Entity API / Billboard | Entity API collapses frame rate at 5,000+ objects; pre-decided in STATE.md |
| RQ with `--with-scheduler` | rq-scheduler package | rq >= 1.16 has built-in scheduling via `Repeat` class; no extra package needed |
| RQ | APScheduler | RQ integrates naturally with existing Redis service; APScheduler requires its own thread model |

---

## Architecture Patterns

### Recommended File Structure (Phase 2 additions)

```
backend/
├── app/
│   ├── models/
│   │   └── satellite.py          # Satellite SQLAlchemy model (OMM fields + derived)
│   ├── api/
│   │   ├── routes_satellites.py  # GET /api/satellites, GET /api/satellites/{norad_id}
│   │   └── routes_health.py      # Existing — add TLE freshness field
│   ├── tasks/
│   │   └── ingest_satellites.py  # RQ job: fetch CelesTrak, upsert to DB
│   └── worker.py                 # RQ Worker entry point (run with --with-scheduler)
│
frontend/src/
├── workers/
│   └── propagation.worker.ts     # Web Worker: satellite.js SGP4 propagation
├── components/
│   ├── SatelliteLayer.tsx        # Manages PointPrimitiveCollection lifecycle
│   ├── OrbitPath.tsx             # Renders orbit polyline for selected satellite
│   └── SatelliteDetailPanel.tsx  # Right drawer content for selected satellite
├── hooks/
│   └── useSatellites.ts          # TanStack Query hook for /api/satellites
└── store/
    └── useAppStore.ts            # Add: selectedSatelliteId, tleLastUpdated
```

### Pattern 1: CelesTrak OMM/GP JSON Fetch and Upsert

**What:** Background job fetches the full active satellite catalog as OMM JSON and upserts all records into PostgreSQL. Uses `ON CONFLICT (norad_cat_id) DO UPDATE` for idempotent refresh.

**CelesTrak URL:**
```
https://celestrak.org/NORAD/elements/gp.php?GROUP=active&FORMAT=json
```
Returns ~10,000 objects as a JSON array. Each object is an OMM record.

**When to use:** Runs on backend startup (first-time seed) and every 2 hours via RQ scheduler.

**Example:**
```python
# backend/app/tasks/ingest_satellites.py
import httpx
from sqlalchemy.dialects.postgresql import insert
from app.db import AsyncSessionLocal
from app.models.satellite import Satellite

CELESTRAK_URL = "https://celestrak.org/NORAD/elements/gp.php?GROUP=active&FORMAT=json"

async def fetch_and_upsert_satellites():
    """Fetch CelesTrak GP JSON and upsert all records. Called by RQ worker."""
    async with httpx.AsyncClient(timeout=60.0) as client:
        resp = await client.get(CELESTRAK_URL)
        resp.raise_for_status()
        records = resp.json()  # List of OMM dicts

    async with AsyncSessionLocal() as session:
        for rec in records:
            stmt = insert(Satellite).values(
                norad_cat_id=rec["NORAD_CAT_ID"],
                object_name=rec["OBJECT_NAME"],
                epoch=rec["EPOCH"],
                mean_motion=rec["MEAN_MOTION"],
                eccentricity=rec["ECCENTRICITY"],
                inclination=rec["INCLINATION"],
                ra_of_asc_node=rec["RA_OF_ASC_NODE"],
                arg_of_pericenter=rec["ARG_OF_PERICENTER"],
                mean_anomaly=rec["MEAN_ANOMALY"],
                bstar=rec["BSTAR"],
                mean_motion_dot=rec.get("MEAN_MOTION_DOT", 0.0),
                mean_motion_ddot=rec.get("MEAN_MOTION_DDOT", 0.0),
                raw_omm=rec,
            ).on_conflict_do_update(
                index_elements=["norad_cat_id"],
                set_=dict(
                    object_name=rec["OBJECT_NAME"],
                    epoch=rec["EPOCH"],
                    mean_motion=rec["MEAN_MOTION"],
                    eccentricity=rec["ECCENTRICITY"],
                    inclination=rec["INCLINATION"],
                    ra_of_asc_node=rec["RA_OF_ASC_NODE"],
                    arg_of_pericenter=rec["ARG_OF_PERICENTER"],
                    mean_anomaly=rec["MEAN_ANOMALY"],
                    bstar=rec["BSTAR"],
                    mean_motion_dot=rec.get("MEAN_MOTION_DOT", 0.0),
                    mean_motion_ddot=rec.get("MEAN_MOTION_DDOT", 0.0),
                    raw_omm=rec,
                    updated_at=func.now(),
                )
            )
            await session.execute(stmt)
        await session.commit()
```

### Pattern 2: SQLAlchemy Satellite Model

**What:** Stores the OMM orbital elements and raw JSON blob. `constellation` is derived at ingest time from `OBJECT_NAME` prefix.

**Example:**
```python
# backend/app/models/satellite.py
from sqlalchemy import Column, Integer, String, Float, DateTime, func
from sqlalchemy.dialects.postgresql import JSONB
from app.db import Base

class Satellite(Base):
    __tablename__ = "satellites"

    id = Column(Integer, primary_key=True)
    norad_cat_id = Column(Integer, unique=True, nullable=False, index=True)
    object_name = Column(String, nullable=False)
    constellation = Column(String, nullable=True)  # derived: "STARLINK", "GPS", etc.
    epoch = Column(String, nullable=False)          # ISO8601 string from OMM
    mean_motion = Column(Float, nullable=False)
    eccentricity = Column(Float, nullable=False)
    inclination = Column(Float, nullable=False)
    ra_of_asc_node = Column(Float, nullable=False)
    arg_of_pericenter = Column(Float, nullable=False)
    mean_anomaly = Column(Float, nullable=False)
    bstar = Column(Float, nullable=False)
    mean_motion_dot = Column(Float, nullable=False, default=0.0)
    mean_motion_ddot = Column(Float, nullable=False, default=0.0)
    raw_omm = Column(JSONB, nullable=False)  # full OMM record for json2satrec
    updated_at = Column(DateTime(timezone=True), server_default=func.now(),
                        onupdate=func.now())
```

**Constellation derivation:**
```python
# Derive from OBJECT_NAME prefix (no external lookup needed)
CONSTELLATION_MAP = {
    "STARLINK": "Starlink",
    "ONEWEB": "OneWeb",
    "GPS": "GPS",
    "GLONASS": "GLONASS",
    "GALILEO": "Galileo",
    "BEIDOU": "Beidou",
    "ISS": "ISS",
    "IRIDIUM": "Iridium",
    "GLOBALSTAR": "Globalstar",
}

def derive_constellation(object_name: str) -> str | None:
    upper = object_name.upper()
    for prefix, name in CONSTELLATION_MAP.items():
        if upper.startswith(prefix):
            return name
    return None
```

### Pattern 3: RQ Scheduler — Periodic TLE Refresh

**What:** RQ >= 1.16 has built-in job scheduling via the `Repeat` class. The worker runs with `--with-scheduler`. On backend startup, the first ingest is enqueued immediately; subsequent runs repeat every 7200 seconds.

**When to use:** `worker.py` is a separate Docker Compose service that connects to Redis and processes the `default` queue.

**Example:**
```python
# backend/app/worker.py
import os
from redis import Redis
from rq import Worker, Queue, Repeat

redis_url = os.getenv("REDIS_URL", "redis://redis:6379/0")
conn = Redis.from_url(redis_url)
queue = Queue(connection=conn)

def main():
    # Enqueue the first ingest immediately, then repeat every 2 hours
    queue.enqueue(
        "app.tasks.ingest_satellites.fetch_and_upsert_satellites",
        repeat=Repeat(times=-1, interval=7200),  # times=-1 = infinite
    )
    worker = Worker([queue], connection=conn)
    worker.work(with_scheduler=True)

if __name__ == "__main__":
    main()
```

**Note on `times=-1`:** Verify against RQ docs whether infinite repeat uses `-1` or a large number. If `-1` is not supported, use `rq-scheduler` package as fallback.

**docker-compose.yml addition:**
```yaml
  worker:
    build: ./backend
    command: python -m app.worker
    depends_on:
      redis:
        condition: service_healthy
      postgres:
        condition: service_healthy
    environment:
      DATABASE_URL: postgresql+asyncpg://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}
      REDIS_URL: redis://redis:6379/0
```

### Pattern 4: FastAPI Satellite Endpoints

**What:** Two endpoints — one bulk endpoint returning all satellites as lightweight OMM records for the frontend to propagate, one detail endpoint with derived altitude/velocity.

**Example:**
```python
# backend/app/api/routes_satellites.py
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.db import get_db
from app.models.satellite import Satellite
from datetime import datetime, timezone
import math

router = APIRouter(prefix="/api/satellites", tags=["satellites"])

@router.get("/")
async def list_satellites(db: AsyncSession = Depends(get_db)):
    """Return all satellite OMM records for frontend propagation.
    Returns raw_omm blobs — frontend passes directly to json2satrec()."""
    result = await db.execute(select(Satellite.norad_cat_id, Satellite.raw_omm))
    rows = result.all()
    return [{"norad_cat_id": r.norad_cat_id, "omm": r.raw_omm} for r in rows]

@router.get("/freshness")
async def tle_freshness(db: AsyncSession = Depends(get_db)):
    """Return most recent updated_at timestamp for TLE freshness indicator."""
    result = await db.execute(select(func.max(Satellite.updated_at)))
    latest = result.scalar()
    return {"last_updated": latest.isoformat() if latest else None}

@router.get("/{norad_cat_id}")
async def get_satellite(norad_cat_id: int, db: AsyncSession = Depends(get_db)):
    """Return full metadata for a selected satellite."""
    result = await db.execute(
        select(Satellite).where(Satellite.norad_cat_id == norad_cat_id)
    )
    sat = result.scalar_one_or_none()
    if sat is None:
        raise HTTPException(status_code=404, detail="Satellite not found")

    # Derive current altitude (km) and velocity (km/s) from orbital elements
    # mean_motion in revs/day → orbital radius via vis-viva
    mu = 398600.4418  # km³/s²
    re = 6371.0       # Earth radius km
    n_rad_s = sat.mean_motion * 2 * math.pi / 86400  # rad/s
    a = (mu / n_rad_s**2) ** (1/3)                   # semi-major axis km
    altitude_km = a - re
    velocity_km_s = math.sqrt(mu / a)

    return {
        "norad_cat_id": sat.norad_cat_id,
        "object_name": sat.object_name,
        "constellation": sat.constellation,
        "epoch": sat.epoch,
        "altitude_km": round(altitude_km, 1),
        "velocity_km_s": round(velocity_km_s, 3),
        "inclination": sat.inclination,
        "eccentricity": sat.eccentricity,
        "tle_updated_at": sat.updated_at.isoformat() if sat.updated_at else None,
    }
```

### Pattern 5: Web Worker — SGP4 Propagation Off Main Thread

**What:** Vite-native Web Worker using `new URL('./worker.ts', import.meta.url)` syntax. Worker receives OMM records, runs `json2satrec` + `propagate` for all satellites at the current time, and returns a `Float64Array` of `[x, y, z, norad_id, ...]` values via transferable object.

**When to use:** Instantiated once in `SatelliteLayer.tsx`. Main thread sends a `{ type: 'PROPAGATE', timestamp: Date.now() }` message every animation frame (or throttled to ~1 Hz for position updates). Worker responds with packed positions.

**Example — Worker file:**
```typescript
// frontend/src/workers/propagation.worker.ts
import * as satellite from 'satellite.js';

// Cached satrec objects — rebuilt only when OMM records change
let satrecs: Array<{ satrec: satellite.SatRec; norad: number }> = [];

self.onmessage = (e: MessageEvent) => {
  const { type, payload } = e.data;

  if (type === 'LOAD_OMM') {
    // payload: Array<{ norad_cat_id: number; omm: object }>
    satrecs = payload
      .map((item: { norad_cat_id: number; omm: object }) => {
        try {
          const satrec = satellite.json2satrec(item.omm as satellite.OMMJsonObject);
          return { satrec, norad: item.norad_cat_id };
        } catch {
          return null;
        }
      })
      .filter(Boolean);

    self.postMessage({ type: 'LOADED', count: satrecs.length });
    return;
  }

  if (type === 'PROPAGATE') {
    // payload: { timestamp: number } — ms since epoch
    const now = new Date(payload.timestamp);
    const gmst = satellite.gstime(now);

    // Pack [x_km, y_km, z_km, norad_id] per satellite
    const buf = new Float64Array(satrecs.length * 4);
    let idx = 0;

    for (const { satrec, norad } of satrecs) {
      const pv = satellite.propagate(satrec, now);
      if (!pv || !pv.position || typeof pv.position === 'boolean') {
        // Propagation error — write NaN sentinel
        buf[idx++] = NaN;
        buf[idx++] = NaN;
        buf[idx++] = NaN;
        buf[idx++] = norad;
        continue;
      }
      const ecf = satellite.eciToEcf(pv.position as satellite.EciVec3<number>, gmst);
      // satellite.js returns km; CesiumJS expects meters
      buf[idx++] = ecf.x * 1000;
      buf[idx++] = ecf.y * 1000;
      buf[idx++] = ecf.z * 1000;
      buf[idx++] = norad;
    }

    // Transfer the buffer (zero-copy) back to main thread
    self.postMessage({ type: 'POSITIONS', buf }, [buf.buffer]);
  }
};
```

**Example — Main thread (SatelliteLayer.tsx):**
```typescript
// frontend/src/components/SatelliteLayer.tsx
import { useEffect, useRef } from 'react';
import { Cartesian3, PointPrimitiveCollection, Color } from 'cesium';

export function SatelliteLayer({ viewer, satellites }) {
  const workerRef = useRef<Worker | null>(null);
  const collectionRef = useRef<PointPrimitiveCollection | null>(null);
  const rafRef = useRef<number>(0);
  // Map from norad_id -> index in collection for O(1) position update
  const indexMapRef = useRef<Map<number, number>>(new Map());

  useEffect(() => {
    if (!viewer) return;

    // Create point collection once
    const collection = viewer.scene.primitives.add(new PointPrimitiveCollection());
    collectionRef.current = collection;

    // Spawn worker
    const worker = new Worker(
      new URL('../workers/propagation.worker.ts', import.meta.url),
      { type: 'module' }
    );
    workerRef.current = worker;

    worker.onmessage = (e) => {
      const { type, payload } = e.data;

      if (type === 'LOADED') {
        // Add a PointPrimitive for each satellite (index = position in collection)
        // positions initialized to Earth center; updated on first POSITIONS message
        for (let i = 0; i < payload.count; i++) {
          collection.add({
            position: Cartesian3.ZERO,
            pixelSize: 3,
            color: Color.fromCssColorString('#00D4FF').withAlpha(0.85),
          });
        }
      }

      if (type === 'POSITIONS') {
        const buf: Float64Array = e.data.buf;
        for (let i = 0; i < buf.length; i += 4) {
          const x = buf[i], y = buf[i + 1], z = buf[i + 2];
          if (isNaN(x)) continue;
          const pt = collection.get(i / 4);
          if (pt) pt.position = new Cartesian3(x, y, z);
        }
      }
    };

    // Send OMM records to worker for satrec initialization
    worker.postMessage({ type: 'LOAD_OMM', payload: satellites });

    // Animation loop — propagate at ~1 Hz (not every rAF to limit Worker IPC)
    let lastPropagation = 0;
    const PROPAGATE_INTERVAL_MS = 1000;

    function loop(ts: number) {
      if (ts - lastPropagation > PROPAGATE_INTERVAL_MS) {
        worker.postMessage({ type: 'PROPAGATE', payload: { timestamp: Date.now() } });
        lastPropagation = ts;
      }
      rafRef.current = requestAnimationFrame(loop);
    }
    rafRef.current = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(rafRef.current);
      worker.terminate();
      if (collection && !collection.isDestroyed()) viewer.scene.primitives.remove(collection);
    };
  }, [viewer, satellites]);

  return null;
}
```

### Pattern 6: ECI → ECEF → Cartesian3 Coordinate Chain

**What:** satellite.js outputs ECI (Earth-Centered Inertial) in kilometers. CesiumJS needs ECEF (Earth-Centered Earth-Fixed) in meters.

**Conversion chain (verified):**
```
propagate(satrec, date)  →  positionEci (km, ECI/TEME)
gstime(date)             →  gmst (radians)
eciToEcf(eci, gmst)      →  positionEcf (km, ECEF)
multiply by 1000         →  meters
new Cartesian3(x, y, z)  →  CesiumJS position
```

**For orbit path (eciToGeodetic approach — cleaner for polylines):**
```typescript
// Alternative using geodetic for ground track
const gmst = satellite.gstime(date);
const geodetic = satellite.eciToGeodetic(positionEci, gmst);
const cesiumPos = Cartesian3.fromRadians(
  geodetic.longitude,
  geodetic.latitude,
  geodetic.height * 1000  // km → meters
);
```

### Pattern 7: Orbit Path and Ground Track for Selected Satellite

**What:** When a satellite is selected, compute one orbital period (~5,400 seconds for LEO) at 60-second intervals in the Web Worker, returning two arrays: ECEF positions for the orbit path (3D polyline above Earth) and geodetic positions for the ground track (hugging Earth surface).

**Example — Worker addition:**
```typescript
if (type === 'COMPUTE_ORBIT') {
  const { omm, periodSeconds } = payload;
  const satrec = satellite.json2satrec(omm);
  const orbitPoints: number[] = [];
  const groundPoints: number[] = [];
  const now = new Date();
  const stepCount = Math.ceil(periodSeconds / 60);

  for (let i = 0; i <= stepCount; i++) {
    const t = new Date(now.getTime() + i * 60_000);
    const pv = satellite.propagate(satrec, t);
    if (!pv?.position || typeof pv.position === 'boolean') continue;
    const gmst = satellite.gstime(t);

    // Orbit path: ECEF in meters
    const ecf = satellite.eciToEcf(pv.position as satellite.EciVec3<number>, gmst);
    orbitPoints.push(ecf.x * 1000, ecf.y * 1000, ecf.z * 1000);

    // Ground track: geodetic (for GroundPolylinePrimitive or clamped polyline)
    const geo = satellite.eciToGeodetic(pv.position as satellite.EciVec3<number>, gmst);
    groundPoints.push(geo.longitude, geo.latitude);
  }
  self.postMessage({ type: 'ORBIT_RESULT', orbitPoints, groundPoints });
}
```

**CesiumJS orbit polyline rendering:**
```typescript
// Orbit path — 3D polyline above Earth surface
import { PolylineCollection, Cartesian3, Color, ArcType } from 'cesium';

const polylines = viewer.scene.primitives.add(new PolylineCollection());
const positions = [];
for (let i = 0; i < orbitPoints.length; i += 3) {
  positions.push(new Cartesian3(orbitPoints[i], orbitPoints[i+1], orbitPoints[i+2]));
}
polylines.add({
  positions,
  width: 1.5,
  material: { fabric: { type: 'Color', uniforms: { color: Color.fromCssColorString('#00D4FF').withAlpha(0.6) } } },
  arcType: ArcType.NONE,  // NONE = straight ECEF lines; no globe-surface curving
});
```

**Ground track — use `Cartesian3.fromRadians` array clamped to surface:**
```typescript
const groundPositions = [];
for (let i = 0; i < groundPoints.length; i += 2) {
  groundPositions.push(Cartesian3.fromRadians(groundPoints[i], groundPoints[i+1], 10_000));
}
// Add as a second polyline or GroundPolylinePrimitive
```

### Pattern 8: Click-to-Select via scene.pick()

**What:** CesiumJS `scene.pick()` returns the primitive at a screen coordinate. Attach `id = norad_cat_id` to each `PointPrimitive` when it is added, then use the returned `id` to trigger the detail fetch.

**Example:**
```typescript
// In SatelliteLayer or GlobeView
const handler = new ScreenSpaceEventHandler(viewer.scene.canvas);
handler.setInputAction((click: { position: Cartesian2 }) => {
  const picked = viewer.scene.pick(click.position);
  if (picked && picked.id !== undefined) {
    useAppStore.getState().setSelectedSatelliteId(picked.id as number);
  }
}, ScreenSpaceEventType.LEFT_CLICK);
```

**Attaching id when adding points:**
```typescript
// In the LOADED handler, track norad_ids in order
collection.add({
  position: Cartesian3.ZERO,
  pixelSize: 3,
  color: ...,
  id: norad,           // <-- this is what scene.pick() returns as picked.id
});
```

### Anti-Patterns to Avoid

- **Entity API for satellite rendering:** `viewer.entities.add()` for 5,000+ objects causes 5-10x performance degradation. Entity API adds JavaScript-side property watchers and per-frame JS checks. Use `PointPrimitiveCollection` exclusively.
- **`removeAll()` + re-add every frame:** Destroys and recreates GPU buffers each frame. Instead maintain fixed indices and update only `.position` on existing `PointPrimitive` instances.
- **Running SGP4 on the main thread:** Propagating 5,000 satellites blocks the JS event loop for tens of milliseconds — produces noticeable jank. Always offload to a Web Worker.
- **Fetching CelesTrak TLE text format:** The legacy TLE text format will break for NORAD IDs > 69999 (expected ~2026-07-20). Use OMM JSON from day one.
- **Storing only raw TLE lines and propagating on the server:** The backend stores OMM JSON (raw_omm JSONB column), which the frontend passes directly to `json2satrec()`. Avoid re-parsing on the server for every request.
- **Multiple PointPrimitiveCollections:** Use a single collection. Multiple collections degrade GPU batching.
- **Forgetting `ArcType.NONE` on orbit polylines:** `ArcType.GEODESIC` (default) curves polylines to follow Earth's surface — wrong for orbital paths above the atmosphere. Use `ArcType.NONE` for straight ECEF line segments.
- **Propagation errors crashing the worker:** `propagate()` returns `{ position: false, velocity: false }` for decayed or numerically unstable orbits. Always guard against `typeof pv.position === 'boolean'`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| SGP4 orbit propagation math | Custom orbital mechanics code | satellite.js `propagate()` | SGP4/SDP4 has numerous edge cases; satellite.js is 10+ years validated against JPL data |
| OMM JSON parsing | Custom field mapping | satellite.js `json2satrec()` | Handles OMM spec edge cases (optional fields, epoch format variants) |
| ECI→ECEF coordinate transform | Custom rotation matrix | satellite.js `eciToEcf()` + `gstime()` | GMST computation requires precise IAU1980/2006 formulas |
| 5,000-point GPU rendering | Direct WebGL calls | CesiumJS `PointPrimitiveCollection` | Handles GPU buffer management, frustum culling, per-point properties |
| Periodic job scheduling | Custom threading/cron | RQ `Repeat` class + `--with-scheduler` | Backed by Redis; handles failure, retry, distributed workers |
| Satellite catalog HTTP fetch | Custom retry/timeout logic | httpx `AsyncClient` with timeout | Handles redirects, connection pooling, async naturally |
| Constellation classification | External API lookup per satellite | Prefix matching on `OBJECT_NAME` | CelesTrak naming conventions are consistent; covers all major constellations |

**Key insight:** The satellite.js → CesiumJS integration has one non-obvious unit trap: satellite.js returns kilometers, CesiumJS expects meters. Multiply all position components by 1000 before constructing `Cartesian3`.

---

## Common Pitfalls

### Pitfall 1: satellite.js Returns km, CesiumJS Expects meters
**What goes wrong:** Satellites appear clustered at Earth's core or wildly scattered beyond the orbit.
**Why it happens:** `eciToEcf()` returns positions in kilometers. `Cartesian3` expects meters. The scale difference is 1000x.
**How to avoid:** Always multiply `ecf.x`, `ecf.y`, `ecf.z` by 1000 before constructing `Cartesian3`.
**Warning signs:** All satellite points appear at or near the globe center regardless of propagation time.

### Pitfall 2: `json2satrec()` Silently Fails on Malformed OMM Records
**What goes wrong:** Some satellites in the CelesTrak active catalog have degenerate or deprecated orbital elements — `json2satrec()` returns a satrec with `error !== 0`, or `propagate()` returns `{ position: false }`.
**Why it happens:** Decayed objects, analyst objects, or objects with incomplete OMM data remain in the active feed.
**How to avoid:** After calling `json2satrec()`, check `satrec.error === 0`. After `propagate()`, check `typeof pv.position !== 'boolean'`. Silently skip failed records — do not throw.
**Warning signs:** NaN coordinates in the position buffer; JavaScript errors crashing the Worker.

### Pitfall 3: Web Worker Receives Stale OMM Records
**What goes wrong:** Satellite positions stop updating after a TLE refresh because the Worker still holds the old satrec cache.
**Why it happens:** The Worker stores `satrecs` in module scope; TLE refresh on the backend does not automatically notify the frontend.
**How to avoid:** The `useSatellites` TanStack Query hook has `staleTime: 2 * 60 * 60 * 1000` (2 hours) and `refetchInterval: 2 * 60 * 60 * 1000`. On refetch, send a new `LOAD_OMM` message to the Worker to rebuild satrec cache.
**Warning signs:** TLE freshness indicator shows data age > 2 hours but satellite positions appear stuck.

### Pitfall 4: PointPrimitive `id` Collision with CesiumJS Internals
**What goes wrong:** `scene.pick()` returns unexpected objects, or clicking the globe surface triggers satellite selection logic.
**Why it happens:** CesiumJS uses the `id` property on picked results for its own internal entity tracking. If IDs are not integers or clash with entity IDs, ambiguity occurs.
**How to avoid:** Use the `id` property on `PointPrimitive` set to the integer `norad_cat_id`. In the pick handler, verify `typeof picked.id === 'number'` and that it falls in a plausible NORAD range (25000–99999 or 100000+ for 6-digit IDs).
**Warning signs:** Clicking blank globe space appears to select a satellite.

### Pitfall 5: CelesTrak Rate Limiting
**What goes wrong:** Backend ingestion fails with HTTP 429 or connection reset.
**Why it happens:** CelesTrak does not publish explicit rate limits, but frequent polling from the same IP triggers throttling. The active catalog (~600 KB) should only be fetched once per 2-hour cycle.
**How to avoid:** RQ scheduler enforces the 2-hour interval. Add `httpx` retry with exponential backoff. Log `updated_at` timestamp immediately after successful fetch for the freshness endpoint.
**Warning signs:** HTTP 429 or `httpx.ReadTimeout` in worker logs.

### Pitfall 6: `times=-1` in RQ `Repeat` Not Supported
**What goes wrong:** RQ worker raises `ValueError` on startup if infinite repeat syntax is wrong.
**Why it happens:** RQ `Repeat` class documents `times` as minimum 1. Infinite repeat may require a workaround (large number, or re-enqueue inside the job itself).
**How to avoid:** Spike this before committing the design. Alternative: the job re-enqueues itself with `queue.enqueue_in(timedelta(hours=2), ...)` as the last line. Or use `rq-scheduler` package `scheduler.schedule(scheduled_time=datetime.utcnow(), func=..., interval=7200, repeat=None)` (None = infinite).
**Warning signs:** Worker process exits immediately after startup.

### Pitfall 7: RQ Worker Needs Sync Functions, Not Async
**What goes wrong:** `fetch_and_upsert_satellites` is an `async def` function — RQ cannot enqueue async functions directly.
**Why it happens:** RQ runs jobs synchronously in a worker process. `async def` functions are not coroutines that RQ knows how to schedule.
**How to avoid:** Wrap the async logic in a sync function that calls `asyncio.run()`:
```python
def sync_fetch_and_upsert_satellites():
    import asyncio
    asyncio.run(fetch_and_upsert_satellites())
```
Enqueue `sync_fetch_and_upsert_satellites` (the sync wrapper), not the async version.
**Warning signs:** `TypeError: object NoneType can't be used in 'await' expression` or job silently returns `None`.

### Pitfall 8: Performance — Propagation Interval vs. Frame Rate
**What goes wrong:** Propagating 5,000+ satellites every animation frame (60 Hz) saturates Worker IPC and causes frame drops on slower hardware.
**Why it happens:** Posting large `Float64Array` buffers (~160 KB for 5,000 satellites at 4 doubles each) 60 times per second is ~9.6 MB/s of IPC traffic plus 5,000 SGP4 operations per second in the Worker.
**How to avoid:** Throttle propagation to 1 Hz (position updates every 1 second). Satellites move slowly enough that 1-second position refresh is imperceptible. Use `requestAnimationFrame` only for the CesiumJS render loop; decouple the propagation interval.
**Warning signs:** Dropped frames reported by browser performance profiler; Worker message queue backing up.

---

## Code Examples

### CelesTrak OMM JSON Record (verified field structure)
```json
{
  "OBJECT_NAME": "ISS (ZARYA)",
  "OBJECT_ID": "1998-067A",
  "EPOCH": "2024-05-06T19:53:04.999776",
  "MEAN_MOTION": 15.50957674,
  "ECCENTRICITY": 0.000358,
  "INCLINATION": 51.6393,
  "RA_OF_ASC_NODE": 160.4574,
  "ARG_OF_PERICENTER": 140.6673,
  "MEAN_ANOMALY": 205.725,
  "EPHEMERIS_TYPE": 0,
  "CLASSIFICATION_TYPE": "U",
  "NORAD_CAT_ID": 25544,
  "ELEMENT_SET_NO": 999,
  "REV_AT_EPOCH": 45212,
  "BSTAR": 0.0002731,
  "MEAN_MOTION_DOT": 0.00015698,
  "MEAN_MOTION_DDOT": 0
}
```

### satellite.js v6 json2satrec Usage
```typescript
// Source: https://github.com/shashwatak/satellite-js (v6.x README)
import * as satellite from 'satellite.js';

const satrec = satellite.json2satrec(ommRecord);  // ommRecord = CelesTrak JSON object
// Check for parse errors
if (satrec.error !== 0) {
  console.warn(`satrec error ${satrec.error} for ${ommRecord.OBJECT_NAME}`);
}

const now = new Date();
const positionAndVelocity = satellite.propagate(satrec, now);

if (typeof positionAndVelocity.position === 'boolean') {
  // Propagation failed (decayed or invalid orbit)
  return;
}

const gmst = satellite.gstime(now);
const ecf = satellite.eciToEcf(positionAndVelocity.position, gmst);
// ecf.x, ecf.y, ecf.z are in kilometers
// Multiply by 1000 for CesiumJS meters
```

### Backend Test — Satellite Endpoint
```python
# backend/tests/test_satellites.py
import pytest
from httpx import AsyncClient
from app.main import app

@pytest.mark.asyncio
async def test_satellite_list_returns_200():
    async with AsyncClient(app=app, base_url="http://test") as client:
        resp = await client.get("/api/satellites/")
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)

@pytest.mark.asyncio
async def test_satellite_detail_404_for_unknown():
    async with AsyncClient(app=app, base_url="http://test") as client:
        resp = await client.get("/api/satellites/99999999")
    assert resp.status_code == 404

@pytest.mark.asyncio
async def test_tle_freshness_returns_timestamp():
    async with AsyncClient(app=app, base_url="http://test") as client:
        resp = await client.get("/api/satellites/freshness")
    assert resp.status_code == 200
    data = resp.json()
    assert "last_updated" in data
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| CelesTrak legacy TLE text format | OMM/GP JSON format | 2020 (CelesTrak), mandate ~2026-07-20 | Must use JSON; TLE breaks for NORAD IDs > 69999 |
| `twoline2satrec()` from raw TLE string | `json2satrec()` from OMM object | satellite.js v5+ (TypeScript rewrite v6.0.0, 2025-04) | Cleaner, type-safe, future-proof |
| satellite.js `4.x` (JavaScript) | satellite.js `6.x` (TypeScript, compiled types) | 2025-04-06 | Types ship with package; no separate `@types/satellite.js` |
| CesiumJS Entity API for satellite dots | `PointPrimitiveCollection` | Long-standing best practice | 10x+ frame rate improvement at 5,000+ objects |
| `rq-scheduler` separate package | RQ built-in `Repeat` class | RQ >= 2.5 (built-in scheduling) | Simpler dependency; no separate scheduler process |

**Deprecated/outdated:**
- `twoline2satrec()` with `\r\n`-delimited TLE text: Still works for existing 5-digit IDs but is a dead end for 6-digit IDs arriving ~mid-2026.
- `satellite.js` < v5: No TypeScript, no `json2satrec`. Do not install v4.x.
- `viewer.entities.add()` for satellite rendering: Works correctly but collapses performance at scale.

---

## Open Questions

1. **RQ `Repeat(times=-1)` support for infinite repeat**
   - What we know: RQ docs specify `times >= 1`. STATE.md notes this as a blocker: "satellite.js `json2satrec()` with CelesTrak OMM format — medium confidence; spike before committing ingestion design".
   - What's unclear: Whether infinite repeat is supported via `-1` or a large number, or whether self-re-enqueue pattern is cleaner.
   - Recommendation: In the first plan (Wave 0), write a test job that enqueues itself with `queue.enqueue_in(timedelta(hours=2), sync_fetch_and_upsert_satellites)` as the last line of the sync wrapper. This is the safest pattern regardless of RQ version.

2. **CelesTrak `GROUP=active` record count**
   - What we know: The active group returns all tracked active objects — typically 8,000–12,000 satellites depending on date.
   - What's unclear: Exact current count; whether all records have parseable OMM fields or some are incomplete.
   - Recommendation: Test ingest against the live endpoint in Wave 0. Log `satrec.error !== 0` count to confirm rejection rate. Phase 2 success criterion is 5,000+ visible points, so even 50% parse failure still exceeds the target.

3. **Frontend bulk payload size for `GET /api/satellites/`**
   - What we know: 10,000 OMM records × ~400 bytes each ≈ 4 MB JSON payload.
   - What's unclear: Whether TanStack Query's default caching handles a 4 MB response gracefully, or whether pagination is needed.
   - Recommendation: Return only the fields needed by `json2satrec` (the raw_omm blob) as a compressed response. Enable `gzip` compression on the FastAPI/uvicorn side. At ~4:1 gzip ratio, compressed payload is ~1 MB — acceptable for a one-time initial load. Do not paginate; the frontend needs all records at once for the propagation Worker.

---

## Validation Architecture

> `workflow.nyquist_validation: true` — section required.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | pytest 8.x + httpx + pytest-asyncio (already configured) |
| Config file | `backend/pytest.ini` — exists, `asyncio_mode = auto` |
| Quick run command | `python3.11 -m pytest backend/tests/test_satellites.py -x` |
| Full suite command | `python3.11 -m pytest backend/tests/ -v` |

Frontend testing remains manual-only (visual + browser DevTools performance profiler). No Playwright/Cypress yet.

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SAT-01 | `GET /api/satellites/` returns list | unit | `python3.11 -m pytest backend/tests/test_satellites.py::test_satellite_list_returns_200 -x` | ❌ Wave 0 |
| SAT-01 | Satellite model table exists with correct columns | integration | `python3.11 -m pytest backend/tests/test_satellites.py::test_satellite_table_exists -x` | ❌ Wave 0 |
| SAT-01 | 5,000+ points visible on globe | visual (manual) | Open browser, confirm point cloud visible | N/A |
| SAT-01 | No frame rate collapse with 5,000+ points | visual (manual) | Browser DevTools → Performance tab, confirm ~60 FPS | N/A |
| SAT-02 | Orbit path polyline appears for selected satellite | visual (manual) | Click a satellite; confirm polyline renders above globe | N/A |
| INT-01 | `GET /api/satellites/{norad_id}` returns metadata | unit | `python3.11 -m pytest backend/tests/test_satellites.py::test_satellite_detail_returns_metadata -x` | ❌ Wave 0 |
| INT-01 | Unknown NORAD ID returns 404 | unit | `python3.11 -m pytest backend/tests/test_satellites.py::test_satellite_detail_404_for_unknown -x` | ❌ Wave 0 |
| INT-01 | Click on satellite opens detail panel | visual (manual) | Click satellite point; confirm RightDrawer opens with NORAD ID, altitude, velocity, constellation | N/A |
| GLOB-03 | TLE freshness endpoint returns timestamp | unit | `python3.11 -m pytest backend/tests/test_satellites.py::test_tle_freshness_returns_timestamp -x` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `python3.11 -m pytest backend/tests/test_satellites.py -x` (< 10 seconds)
- **Per wave merge:** `python3.11 -m pytest backend/tests/ -v` (full backend suite)
- **Phase gate:** Full suite green + manual globe visual check (5,000+ dots visible, click-to-inspect works) before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `backend/tests/test_satellites.py` — covers SAT-01, INT-01, GLOB-03 (freshness)
- [ ] `backend/app/models/satellite.py` — Satellite SQLAlchemy model with Alembic migration
- [ ] `backend/app/tasks/ingest_satellites.py` — sync wrapper + async fetch function
- [ ] `backend/app/worker.py` — RQ Worker entry point
- [ ] `backend/app/api/routes_satellites.py` — three endpoints (list, detail, freshness)
- [ ] `frontend/src/workers/propagation.worker.ts` — Web Worker with `LOAD_OMM` + `PROPAGATE` + `COMPUTE_ORBIT` handlers
- [ ] `frontend/src/components/SatelliteLayer.tsx` — PointPrimitiveCollection management
- [ ] `frontend/src/components/SatelliteDetailPanel.tsx` — RightDrawer content
- [ ] `frontend/src/hooks/useSatellites.ts` — TanStack Query hook
- [ ] Alembic migration: `alembic revision --autogenerate -m "add_satellites_table"`
- [ ] `npm install satellite.js` in frontend

*(Existing infrastructure covers all shared fixtures: conftest.py, pytest.ini, NullPool engine patch — no changes needed)*

---

## Sources

### Primary (HIGH confidence)
- [CelesTrak GP Data Formats](https://celestrak.org/NORAD/documentation/gp-data-formats.php) — OMM JSON URL patterns, field references, 5-digit cutover timeline
- [CelesTrak Current GP Element Sets](https://celestrak.org/NORAD/elements/) — GROUP values including `active`, `starlink`, `gps-ops`, etc.
- [satellite.js GitHub](https://github.com/shashwatak/satellite-js) — `json2satrec`, `propagate`, `eciToEcf`, `eciToGeodetic` API
- [satellite.js CHANGELOG](https://github.com/shashwatak/satellite-js/blob/develop/CHANGELOG.md) — v6.0.0 TypeScript rewrite (2025-04-06), v6.0.2 fixes (2026-01-07)
- [CesiumJS PointPrimitiveCollection docs](https://cesium.com/learn/cesiumjs/ref-doc/PointPrimitiveCollection.html) — 64,800-point example, per-point update model
- [CesiumJS Performance Tips for Points](https://cesium.com/blog/2016/03/02/performance-tips-for-points/) — single collection, update `.position` not `removeAll`
- [RQ Scheduling Jobs](https://python-rq.org/docs/scheduling/) — `Repeat` class, `--with-scheduler` flag, interval-based repeat
- [Vite Web Workers](https://vite.dev/guide/features#web-workers) — `new URL` syntax, `?worker` suffix, production compilation
- [satellite.js + CesiumJS gist](https://gist.github.com/thkruz/f6b63ce8f04d75aa1dfd6e18b4366b37) — verified km→m conversion, `eciToGeodetic` + `Cartesian3.fromRadians` pattern

### Secondary (MEDIUM confidence)
- [CesiumJS Visualizing ECI orbits community thread](https://community.cesium.com/t/visualizing-eci-orbits-in-cesium/41789) — confirms coordinate transform approach
- [satellite.js npm page](https://www.npmjs.com/package/satellite.js) — current version 6.0.2 confirmed
- [RQ PyPI](https://pypi.org/project/rq/) — production-ready, Redis-backed
- [CelesTrak OMM JSON example record](https://www.freepublicapis.com/celestrak-gp-data) — verified field names match `json2satrec` expected input

### Tertiary (LOW confidence — needs spike validation)
- RQ `Repeat(times=-1)` for infinite repeat — documented minimum is 1; self-re-enqueue pattern is safer until verified
- CelesTrak response size (~4 MB uncompressed for `GROUP=active`) — estimated from known active catalog size; validate empirically

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — satellite.js v6 confirmed on npm; CelesTrak URL patterns confirmed from official docs; CesiumJS PointPrimitiveCollection at 5,000+ confirmed from official performance blog
- Architecture: HIGH — ECI→ECEF→Cartesian3 chain verified from official gist and community; Vite Web Worker syntax from official docs; RQ scheduler from official docs
- Pitfalls: HIGH for coordinate units and propagation errors (directly sourced); MEDIUM for RQ `times=-1` infinite repeat (needs spike)

**Research date:** 2026-03-11
**Valid until:** 2026-04-11 (satellite.js and CelesTrak stable; RQ scheduling API stable; verify before starting if > 30 days elapsed)
