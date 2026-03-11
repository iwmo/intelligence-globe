# Phase 5: Performance - Research

**Researched:** 2026-03-11
**Domain:** CesiumJS rendering performance, satellite.js Web Worker throughput, PostGIS spatial query latency, automated verification methodology
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| INFRA-03 | Globe renders smoothly with 5,000+ satellites and hundreds of aircraft simultaneously | BlendOption.OPAQUE optimization, PointPrimitiveCollection batching, worker transferable buffers, pixel size tuning, GIST index on lat/lon columns |
</phase_requirements>

---

## Summary

Phase 5 is a **verification and hardening** phase, not a feature phase. Four prior phases built and shipped all user-visible features. This phase validates that the performance contract is actually met — 60 FPS with full catalog active, sub-100ms spatial queries, and all nine critical pitfall checks confirmed clean.

The key insight from research: the codebase already uses the correct architectural primitives (PointPrimitiveCollection via Primitive API, Web Worker propagation, transferable Float64Array IPC). Performance gaps, if any, are almost certainly in three places: (1) `blendOption` is unset on the PointPrimitiveCollection — setting it to `BlendOption.OPAQUE` is a confirmed 2x GPU improvement; (2) the satellite filter loop iterates `collection.length` on every React render-cycle triggered by store changes — this needs profiling under full load; (3) the backend aircraft `list_aircraft` route has no spatial index on `latitude`/`longitude` columns, which will cause a sequential scan on any bounding-box filter at scale.

The ISS ground track validation (success criterion 3) is a regression test, not a feature. The worker already computes ground tracks. The test is: propagate ISS (NORAD 25544) from a known TLE epoch, compare the resulting lat/lon to published reference data within an acceptable tolerance (~100 km is the SGP4 accuracy bound).

**Primary recommendation:** Profile before optimizing. Measure frame time with Chrome DevTools Performance panel at full satellite load, measure query latency with `EXPLAIN ANALYZE` on the aircraft bounding-box filter, then apply targeted fixes. Do not over-engineer.

---

## Standard Stack

### Core (already installed — no new packages needed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| cesium | 1.139.1 | Globe rendering + PointPrimitiveCollection | Already in use; BlendOption API available since v1.10 |
| satellite.js | 6.0.2 | SGP4 propagation in Web Worker | Already in use; transferable buffer pattern already implemented |
| vitest | 4.0.18 | Frontend unit + bench tests | Already installed; `bench()` API for timing assertions |
| pytest + pytest-asyncio | installed | Backend timing assertions | Already installed; `asyncio_mode = auto` configured |
| PostGIS | (docker) | Spatial queries + GIST indexes | Already in use; GIST index just needs to be added to lat/lon columns |

### Supporting (may need to add)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| pytest-benchmark | 5.2.3 | Backend query latency benchmarking with statistical output | If simple `time.perf_counter` assertions are insufficient for CI reporting |

**Installation (only if pytest-benchmark is chosen):**
```bash
pip install pytest-benchmark
```

No new frontend packages are required. All CesiumJS performance APIs (BlendOption, FrameRateMonitor, requestRenderMode) are in the already-installed cesium package.

---

## Architecture Patterns

### Recommended Phase Structure
```
05-performance/
├── 05-01-PLAN.md   — Profiling baseline + BlendOption fix + pixel size audit
├── 05-02-PLAN.md   — Backend spatial index + query latency test
├── 05-03-PLAN.md   — ISS ground track validation + nine pitfall checks + phase gate
```

### Pattern 1: BlendOption.OPAQUE on PointPrimitiveCollection

**What:** Setting `blendOption: BlendOption.OPAQUE` on the collection constructor skips the translucency render pass, cutting GPU draw time up to 2x.

**When to use:** When all points use fully opaque colors (no `.withAlpha()` < 1.0). The satellite layer uses `Color.fromCssColorString('#00D4FF').withAlpha(0.85)` — this is slightly translucent. Decision needed: either raise alpha to 1.0 and use OPAQUE, or leave as-is and accept the default blend. Aircraft uses `.withAlpha(0.9)` — same situation.

**Example:**
```typescript
// Source: https://cesium.com/learn/cesiumjs/ref-doc/PointPrimitiveCollection.html
import { PointPrimitiveCollection, BlendOption } from 'cesium';

const collection = viewer.scene.primitives.add(
  new PointPrimitiveCollection({
    blendOption: BlendOption.OPAQUE  // up to 2x GPU improvement when all points are fully opaque
  })
);
```

**Decision:** Change satellite and aircraft point alpha values from 0.85/0.9 to 1.0 to unlock OPAQUE mode. The visual difference at these alpha levels is negligible. This is the single highest-leverage rendering change.

### Pattern 2: Pixel Size Reduction

**What:** Smaller point pixel sizes reduce the per-point GPU fill cost. The Cesium performance blog measured: 32px points → 14 FPS on 2M points; 4px points → 58 FPS on 2M points.

**When to use:** Current satellite pixelSize is 3 (already well-tuned). Aircraft pixelSize is 4. This is already correct — document it as intentional, no change needed.

### Pattern 3: scaleByDistance for Distant Points

**What:** `PointPrimitive.scaleByDistance` shrinks points progressively as the camera recedes. At globe-scale zoom (viewing all 5,000 satellites), points are tiny in screen pixels. This can improve GPU fill cost.

**When to use:** During profiling if frame budget is still tight after BlendOption fix.

**Example:**
```typescript
// Source: https://cesium.com/blog/2016/03/02/performance-tips-for-points/
import { NearFarScalar } from 'cesium';

point.scaleByDistance = new NearFarScalar(1.5e2, 15, 8.0e6, 0.0);
// Visible at close range (scale=15), invisible beyond 8000km camera distance
```

### Pattern 4: FrameRateMonitor for Automated FPS Assertion

**What:** CesiumJS ships `FrameRateMonitor` — a class that computes a rolling average FPS and fires an event below threshold. This can be wired into a smoke test.

**When to use:** For the automated FPS verification in success criterion 1. The monitor runs inside the browser; the test harness must be an integration/smoke test (not a unit test) since it requires a running CesiumJS viewer.

**Example:**
```typescript
// Source: https://cesium.com/learn/cesiumjs/ref-doc/FrameRateMonitor.html
import { FrameRateMonitor } from 'cesium';

const monitor = FrameRateMonitor.fromScene(viewer.scene, {
  samplingWindow: 5.0,          // seconds of rolling window
  quietPeriod: 2.0,             // seconds before monitoring starts
  warmupPeriod: 5.0,
  minimumFrameRateAfterWarmup: 55,  // fire event below 55 FPS
  minimumFrameRateDuringWarmup: 30
});

monitor.lowFrameRate.addEventListener((scene, fps) => {
  console.warn(`Low FPS detected: ${fps}`);
});
```

**Important note:** `FrameRateMonitor` is a runtime measurement tool. The actual FPS verification (success criterion 1) is a **human visual verification** step with Chrome DevTools, not a fully automated assertion. The automated test can verify the BlendOption is set and the pixel sizes are correct; the FPS number itself requires manual confirmation on target hardware.

### Pattern 5: PostGIS GIST Index on Aircraft Lat/Lon

**What:** The aircraft `list_aircraft` route currently uses a WHERE clause on `latitude`/`longitude` columns. Without a GIST index these are sequential scans. At hundreds of aircraft this is fast enough, but a GIST index future-proofs against full-load degradation.

**Current state:** The `Aircraft` model has `latitude` and `longitude` as Float columns — not PostGIS geometry. The bounding-box filter is done in Python (frontend-side filter, not a DB-level spatial query). The DB-level query is simply `SELECT * WHERE latitude IS NOT NULL AND longitude IS NOT NULL`.

**Research finding:** The aircraft bounding-box filter (AIR-04) is applied client-side in `matchesAircraftFilter()` in `AircraftLayer.tsx`, not server-side. This means the 100ms query target is for the full `list_aircraft` fetch, not a spatial filter. A simple B-tree index on `updated_at` (to support freshness queries) plus a composite index on `(latitude, longitude)` where both are NOT NULL will satisfy the latency contract.

**Example:**
```sql
-- Source: PostGIS documentation https://postgis.net/docs/performance_tips.html
-- For Float lat/lon columns (not geometry), use a plain B-tree composite index:
CREATE INDEX idx_aircraft_latlon ON aircraft (latitude, longitude)
  WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

-- For full GIST-based spatial queries (if promoted to geometry column in future):
-- ALTER TABLE aircraft ADD COLUMN geom geometry(Point, 4326);
-- CREATE INDEX idx_aircraft_geom ON aircraft USING GIST (geom);
```

**Decision for Phase 5:** Add the partial B-tree index on `(latitude, longitude)` via Alembic migration. Do not promote the column to PostGIS geometry type — that is a schema change beyond Phase 5 scope and the bounding-box filter is client-side.

### Pattern 6: ISS Ground Track Validation

**What:** ISS (NORAD 25544) has a well-known orbital inclination of ~51.6 degrees. A propagated ground track should never exceed ±51.6 degrees latitude. Any point outside this range indicates an ECI/ECEF conversion error.

**Validation method:**
1. Fetch ISS OMM from CelesTrak (or use a hardcoded test fixture with a known epoch)
2. Run `COMPUTE_ORBIT` via the propagation worker
3. Assert all ground track latitude values satisfy `|lat_deg| <= 52.0`
4. Assert at least one full orbit period is returned (>= 90 minutes worth of points at 1-min resolution)
5. Assert orbit points are in ECEF meters (magnitude ~6.5M to ~7.0M meters, i.e. 400-500km above Earth radius 6371km)

**Example (vitest):**
```typescript
// Smoke test — not a full Web Worker integration test, can use worker inline
import * as satelliteLib from 'satellite.js';

test('ISS ground track stays within orbital inclination bounds', () => {
  // Use a hardcoded OMM fixture to avoid network dependency in tests
  const issOmm = { /* ...known ISS OMM record... */ };
  const satrec = satelliteLib.json2satrec(issOmm);
  expect(satrec.error).toBe(0);

  const groundPoints: Array<{ lat: number; lon: number }> = [];
  const now = Date.now();
  const periodSteps = 96; // 96 minutes / 1 min step ≈ one orbit

  for (let i = 0; i <= periodSteps; i++) {
    const t = new Date(now + i * 60_000);
    const gmst = satelliteLib.gstime(t);
    const pv = satelliteLib.propagate(satrec, t);
    if (typeof pv.position === 'boolean') continue;
    const geo = satelliteLib.eciToGeodetic(pv.position, gmst);
    groundPoints.push({
      lat: satelliteLib.degreesLat(geo.latitude),
      lon: satelliteLib.degreesLong(geo.longitude),
    });
  }

  expect(groundPoints.length).toBeGreaterThan(90);
  for (const pt of groundPoints) {
    // ISS inclination ~51.6 deg — add 2 deg tolerance for propagation drift
    expect(Math.abs(pt.lat)).toBeLessThanOrEqual(53.0);
    // Longitude must be valid
    expect(pt.lon).toBeGreaterThanOrEqual(-180);
    expect(pt.lon).toBeLessThanOrEqual(180);
  }
});
```

### Anti-Patterns to Avoid

- **Adding new rendering layers during performance phase:** Phase 5 should not introduce visual features. If a fix requires a visual change, justify it explicitly.
- **Using Entity API for any new primitives:** Already avoided in previous phases. Confirmed correct. Entity API collapses above ~500 entities.
- **Running satellite propagation on main thread:** Already avoided via Web Worker. Document as verified, not as a pending fix.
- **EXPLAIN ANALYZE on production tables:** Run on the Docker dev database only. Never on live data without EXPLAIN (no ANALYZE).
- **Treating FrameRateMonitor events as automated CI tests:** FPS depends on hardware. Automated tests should verify configuration choices (BlendOption set, pixel sizes correct). Human verification confirms the actual FPS target.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| FPS measurement | Custom frame counter in rAF loop | `FrameRateMonitor.fromScene()` | Built into CesiumJS, handles sampling window, quiet period, warmup period correctly |
| Propagation timing | Custom Date.now() wrapper in worker | `vitest bench()` with satellite.js imported directly | bench() provides statistical output (p50/p95/p99), not just one sample |
| Query latency assertion | Custom stopwatch in test | `time.perf_counter()` with direct assertion OR `pytest-benchmark` | Simple assertion is fine; pytest-benchmark if CI regression tracking is needed |
| Spatial index schema change | Custom latitude lookup function | Alembic migration adding partial B-tree index | Schema changes must go through migration to be reproducible in Docker |
| ISS reference position | Fetching live ISS data in tests | Hardcoded OMM fixture in test file | Tests must be offline-capable; live TLEs drift daily and would make tests flaky |

---

## Common Pitfalls

### Pitfall 1: Measuring FPS at Wrong Camera Distance
**What goes wrong:** Chrome DevTools or FrameRateMonitor shows 60 FPS when the camera is zoomed into 10 satellites but drops to 25 FPS at global view with all 5,000 visible.
**Why it happens:** GPU fill cost scales with visible pixels per point. At global zoom all 5,000 points are visible simultaneously; at close zoom only ~50 are on screen.
**How to avoid:** Always measure FPS with the camera at a full-globe view (altitude ~20,000 km) with all layers active and the satellite layer unfiltered.
**Warning signs:** FPS looks fine during development but drops in the success-criteria demo.

### Pitfall 2: BlendOption Mismatch with Alpha < 1.0
**What goes wrong:** Setting `BlendOption.OPAQUE` while keeping `.withAlpha(0.85)` on points produces incorrect rendering — points may become fully opaque visually but the GPU render path is inconsistent.
**Why it happens:** The BlendOption must match the actual point colors. OPAQUE assumes no alpha blending is needed.
**How to avoid:** When switching to OPAQUE, simultaneously change all point colors to alpha = 1.0. The current values (0.85 for satellites, 0.9 for aircraft) are visually indistinguishable from 1.0 on a dark background.
**Warning signs:** Points render as solid rectangles or artifacts appear at edges after BlendOption change.

### Pitfall 3: Filter Loop Performance at Full Collection Size
**What goes wrong:** The combined filter+visibility effect in SatelliteLayer iterates all `collection.length` points (5,000+) synchronously on every Zustand state change. If the filter UI allows rapid changes (slider drag), this triggers O(5000) synchronous DOM-equivalent work per frame.
**Why it happens:** The `useEffect` has `[satelliteFilter, satellites.data, layerVisible]` dependencies — any change to filter state re-runs the full loop.
**How to avoid:** This is fine for deliberate user actions (button click, dropdown selection). It is only a problem if a continuous input (slider) triggers rapid state changes. Phase 4's FilterPanel uses discrete constellation/altitude-band selection — no slider involved. Document as acceptable.
**Warning signs:** UI jank when switching constellation filters, particularly on low-end hardware.

### Pitfall 4: Alembic Migration for Index vs. Direct SQL
**What goes wrong:** Developer adds the index via `psql` directly in the running container without creating an Alembic migration. Index exists in dev, missing in clean Docker rebuild.
**Why it happens:** Docker volume persistence makes it easy to forget that container-level changes are ephemeral.
**How to avoid:** All schema changes (including indexes) must be Alembic migrations. Use `op.create_index()` in the migration script.
**Warning signs:** `docker compose down -v && docker compose up` produces a different schema than the running instance.

### Pitfall 5: Worker Timing vs. Main Thread Frame Budget
**What goes wrong:** The propagation worker processes 5,000 satellites every 1 second. If propagation takes > 16ms (one frame budget), it doesn't block the main thread, but the transferable buffer postMessage can briefly spike main-thread message handling.
**Why it happens:** `Float64Array` of 5,000×4 = 160KB is transferred zero-copy (transferable), so buffer marshaling is not the issue. The issue is the `onmessage` handler in SatelliteLayer iterating `buf.length / 4 = 5,000` iterations to update point positions — this runs on the main thread.
**How to avoid:** The current implementation already does this. Profile the onmessage handler duration in Chrome DevTools. If it exceeds 8ms, consider batching the update loop using `requestIdleCallback` or chunked updates.
**Warning signs:** Frame drops correlated with the 1-second propagation interval (every second there's a jank spike).

### Pitfall 6: GET_POSITION Linear Search at Scale
**What goes wrong:** The worker's `GET_POSITION` handler uses `satrecs.find(s => s.norad === norad)` — an O(N) linear scan over 5,000 entries. This runs on the worker thread so it doesn't block the UI, but it takes ~0.1ms on modern hardware which is acceptable. However, if this is called in a hot loop (e.g., search-as-you-type), it could cause worker contention.
**Why it happens:** The current search-by-NORAD is triggered once per explicit user action (fly-to), not in a loop.
**How to avoid:** Document as acceptable for current usage pattern. If search-as-you-type is added in a future phase, the worker should maintain a Map<number, SatrecEntry> for O(1) lookup.
**Warning signs:** Search results feel slow when typing quickly.

---

## Code Examples

Verified patterns from official sources:

### BlendOption.OPAQUE on Collection
```typescript
// Source: https://cesium.com/learn/cesiumjs/ref-doc/PointPrimitiveCollection.html
import { PointPrimitiveCollection, BlendOption, Color } from 'cesium';

// Change 1: Use OPAQUE blend mode (up to 2x GPU improvement)
const collection = viewer.scene.primitives.add(
  new PointPrimitiveCollection({
    blendOption: BlendOption.OPAQUE
  })
);

// Change 2: Use alpha = 1.0 (required for OPAQUE mode correctness)
collection.add({
  position: position,
  pixelSize: 3,
  color: Color.fromCssColorString('#00D4FF'),  // no .withAlpha() — alpha defaults to 1.0
  id: noradCatId,
});
```

### requestRenderMode (optional — evaluate after profiling)
```typescript
// Source: https://cesium.com/blog/2018/01/24/cesium-scene-rendering-performance/
// WARNING: requestRenderMode conflicts with the existing 1Hz propagation loop.
// The rAF loop already calls requestAnimationFrame continuously, keeping rendering active.
// requestRenderMode is NOT recommended for this application because:
// 1. The propagation loop runs every frame (rAF-based)
// 2. Aircraft lerp runs every frame (rAF-based)
// These continuous rAF loops mean the scene is never "idle" — requestRenderMode provides no benefit.
// Document this as "evaluated and ruled out."
```

### Backend: Timing Assertion for Query Latency
```python
# Source: pytest-asyncio documentation, standard Python timing
import time
import pytest
from httpx import AsyncClient
from app.main import app

@pytest.mark.asyncio
async def test_aircraft_list_latency():
    """list_aircraft must return under 100ms under full load."""
    async with AsyncClient(app=app, base_url="http://test") as client:
        start = time.perf_counter()
        response = await client.get("/api/aircraft/")
        elapsed_ms = (time.perf_counter() - start) * 1000

    assert response.status_code == 200
    assert elapsed_ms < 100, f"list_aircraft took {elapsed_ms:.1f}ms, must be under 100ms"
```

### Alembic Migration: Partial Index on Aircraft Lat/Lon
```python
# Source: Alembic op.create_index() documentation
# In a new Alembic migration file:
from alembic import op

def upgrade():
    op.create_index(
        "idx_aircraft_latlon_not_null",
        "aircraft",
        ["latitude", "longitude"],
        postgresql_where="latitude IS NOT NULL AND longitude IS NOT NULL",
    )

def downgrade():
    op.drop_index("idx_aircraft_latlon_not_null", table_name="aircraft")
```

### ISS OMM Test Fixture (hardcoded for offline tests)
```typescript
// Source: CelesTrak OMM format documentation
// Use a snapshot of a real ISS OMM — hardcode it so tests are offline-capable.
// The epoch doesn't matter for the ground-track bounds test (only inclination matters,
// and SGP4 propagation from any recent epoch will stay within ±53 degrees latitude for ISS).
export const ISS_OMM_FIXTURE = {
  OBJECT_NAME: "ISS (ZARYA)",
  OBJECT_ID: "1998-067A",
  EPOCH: "2026-01-01T00:00:00.000000",
  MEAN_MOTION: 15.49,       // ~92 min period
  ECCENTRICITY: 0.0002,
  INCLINATION: 51.6,
  RA_OF_ASC_NODE: 0.0,
  ARG_OF_PERICENTER: 0.0,
  MEAN_ANOMALY: 0.0,
  EPHEMERIS_TYPE: 0,
  CLASSIFICATION_TYPE: "U",
  NORAD_CAT_ID: 25544,
  ELEMENT_SET_NO: 999,
  REV_AT_EPOCH: 0,
  BSTAR: 0.0001,
  MEAN_MOTION_DOT: 0.00001,
  MEAN_MOTION_DDOT: 0.0,
};
// Note: Use a REAL OMM snapshot from CelesTrak for the actual fixture.
// The values above are illustrative. Obtain the real fixture once and commit it.
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Entity API (CZML/entities) | Primitive API (PointPrimitiveCollection) | CesiumJS ~1.30 era | Entity API degrades above 500 entities; Primitive API handles 15,000+ without issue |
| Main-thread propagation | Web Worker + transferable Float64Array | Phase 2 decision | Eliminates main-thread jank from O(5000) SGP4 calculations per second |
| Billboard circles for satellite dots | PointPrimitive | Phase 2 decision | 29% less memory, faster dynamic updates at 250K+ points |
| Default BlendOption (OPAQUE_AND_TRANSLUCENT) | BlendOption.OPAQUE | **Phase 5 target** | Up to 2x GPU fill cost reduction |

**Deprecated/outdated:**
- `requestRenderMode`: Evaluated and ruled out — incompatible with continuous rAF animation loops already present in SatelliteLayer and AircraftLayer.
- CZML-based satellite visualization: Superseded by Primitive API for large counts.

---

## Open Questions

1. **Actual FPS measurement on target hardware**
   - What we know: BlendOption.OPAQUE is the highest-leverage fix. Current pixel sizes (3px satellites, 4px aircraft) are already near-optimal.
   - What's unclear: Whether current FPS is already at 60 before any fix, or if we need to apply fixes first.
   - Recommendation: Profile first with Chrome DevTools at full-globe zoom, all layers active. If already 55-60 FPS, document as verified-sufficient and apply BlendOption.OPAQUE as a preventive hardening step regardless.

2. **Worker onmessage loop duration at 5,000 satellites**
   - What we know: The main-thread handler iterates `buf.length/4 = 5,000` iterations on every POSITIONS message (every ~1 second).
   - What's unclear: Whether this iteration loop causes > 4ms main-thread blocking (which would impact frame budget).
   - Recommendation: Profile the onmessage handler with Chrome DevTools Performance panel. If it exceeds 8ms, use `setTimeout(fn, 0)` chunked batching inside the handler. If under 4ms, no action needed.

3. **Aircraft query performance at scale**
   - What we know: The `list_aircraft` route does `SELECT * WHERE lat IS NOT NULL AND lon IS NOT NULL`. OpenSky typically returns 5,000-15,000 aircraft globally. The DB may have hundreds of rows (ingest rate is every 90 seconds).
   - What's unclear: Whether hundreds of rows requires an index at all (PostgreSQL will seq-scan tables under ~10K rows efficiently).
   - Recommendation: Add the partial index anyway — it costs nothing at this scale and documents the performance-conscious intent. Run `EXPLAIN ANALYZE` before and after to confirm it is used.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Backend framework | pytest 8.x with pytest-asyncio (asyncio_mode = auto) |
| Backend config | `/backend/pytest.ini` |
| Backend quick run | `python3.11 -m pytest tests/test_performance.py -x` |
| Backend full suite | `python3.11 -m pytest tests/ -x` |
| Frontend framework | vitest 4.0.18 |
| Frontend config | `vite.config.ts` (test.environment: jsdom, globals: true) |
| Frontend quick run | `npx vitest run src/workers/__tests__/` |
| Frontend full suite | `npx vitest run` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| INFRA-03 (FPS) | 60 FPS with 5,000+ satellites + hundreds of aircraft | Manual (Chrome DevTools) | N/A — requires running browser | Wave 0 — no file needed (manual checklist) |
| INFRA-03 (query latency) | `/api/aircraft/` returns in < 100ms | Integration | `python3.11 -m pytest tests/test_performance.py::test_aircraft_list_latency -x` | Wave 0 gap |
| INFRA-03 (ECI/ECEF validation) | ISS ground track latitude stays within ±53 degrees | Unit (vitest) | `npx vitest run src/workers/__tests__/propagation.test.ts` | Wave 0 gap |
| INFRA-03 (Primitive API verified) | PointPrimitiveCollection is used (not Entity API) | Smoke/static | Code review + grep | No test file needed |
| INFRA-03 (viewer cleanup verified) | Worker terminates + primitives removed on unmount | Unit (vitest mock) | `npx vitest run src/components/__tests__/SatelliteLayer.cleanup.test.tsx` | Wave 0 gap |
| INFRA-03 (BlendOption set) | BlendOption.OPAQUE present in SatelliteLayer and AircraftLayer | Static analysis | `grep -r "BlendOption.OPAQUE" src/` | After Phase 5 fix |

### Sampling Rate
- **Per task commit:** `python3.11 -m pytest tests/test_performance.py -x` + `npx vitest run src/workers/__tests__/`
- **Per wave merge:** `python3.11 -m pytest tests/ -x` + `npx vitest run`
- **Phase gate:** Full suite green + manual FPS checklist confirmed before phase closure

### Wave 0 Gaps
- [ ] `backend/tests/test_performance.py` — covers INFRA-03 query latency
- [ ] `frontend/src/workers/__tests__/propagation.test.ts` — covers INFRA-03 ISS ground track ECI/ECEF validation (note: `propagation.worker.ts` is a Web Worker; test imports `satellite.js` directly without the worker transport layer)
- [ ] `frontend/src/components/__tests__/SatelliteLayer.cleanup.test.tsx` — covers INFRA-03 viewer cleanup (vitest with jsdom + mocked Cesium primitives)
- [ ] Alembic migration for aircraft lat/lon partial index

---

## Nine Critical Pitfall Checks

The Phase 5 success criterion references "nine critical pitfall checks." Based on the accumulated decisions log and the success criteria wording, these map to:

| # | Check | Status | How to Verify |
|---|-------|--------|---------------|
| 1 | Primitive API used (not Entity API) | Confirmed — all prior phases use PointPrimitiveCollection | `grep -r "EntityCollection\|viewer.entities" src/` must return empty |
| 2 | Viewer cleanup on unmount | Confirmed — SatelliteLayer and AircraftLayer return cleanup functions | Code review + cleanup test |
| 3 | ECI to ECEF conversion correct | Confirmed in worker — `eciToEcf(pv.position, gmst)` | ISS ground track unit test |
| 4 | ECEF units in meters (not km) | Confirmed — `ecf.x * 1000` in worker | ISS orbit radius magnitude assertion (should be ~6.8M meters) |
| 5 | Worker terminated on unmount | Confirmed — `worker.terminate()` in cleanup | Cleanup test |
| 6 | PointPrimitive `position` updated via direct assignment (not remove+re-add) | Confirmed — `pt.position = new Cartesian3(...)` | Code review |
| 7 | ArcType.NONE on orbit polylines (not geodesic arc) | Confirmed — Phase 2 decision | `grep -r "ArcType" src/` should show only ArcType.NONE |
| 8 | No main-thread propagation (worker handles all SGP4) | Confirmed — satellite.js imported only in propagation.worker.ts | `grep -r "import.*satellite" src/components/ src/hooks/` must return empty |
| 9 | requestAnimationFrame guard for viewer.isDestroyed() | Confirmed — `loop()` checks collection.isDestroyed() | Code review |

These are **verification checks** (already implemented in Phases 1-4), not new features. Phase 5's job is to confirm they are all still true and document the confirmation.

---

## Sources

### Primary (HIGH confidence)
- [CesiumJS PointPrimitiveCollection Docs](https://cesium.com/learn/cesiumjs/ref-doc/PointPrimitiveCollection.html) — BlendOption API, constructor options
- [CesiumJS Performance Tips for Points](https://cesium.com/blog/2016/03/02/performance-tips-for-points/) — pixel size benchmarks, distance-based optimization
- [CesiumJS Explicit Rendering Blog](https://cesium.com/blog/2018/01/24/cesium-scene-rendering-performance/) — requestRenderMode API and CPU savings
- [CesiumJS FrameRateMonitor Docs](https://cesium.com/learn/cesiumjs/ref-doc/FrameRateMonitor.html) — FPS monitoring API
- [PostGIS Performance Tips](https://postgis.net/docs/performance_tips.html) — GIST index guidance
- Codebase inspection — SatelliteLayer.tsx, AircraftLayer.tsx, propagation.worker.ts, routes_aircraft.py, routes_satellites.py

### Secondary (MEDIUM confidence)
- [PostGIS Spatial Indexing Workshop](http://postgis.net/workshops/postgis-intro/indexing.html) — bounding box operators and GIST index behavior
- [Alembic op.create_index() partial index pattern](https://alembic.sqlalchemy.org/) — verified against Alembic docs
- [Vitest bench() API](https://vitest.dev/api/) — benchmark function timing API

### Tertiary (LOW confidence — not used for critical decisions)
- Community forum posts on CesiumJS FPS targets — general guidance only, hardware-dependent
- SGP4 accuracy papers — context for ISS validation tolerance (~1 km per day drift)

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already installed; BlendOption API verified in official docs
- Architecture: HIGH — BlendOption fix and index migration are well-established patterns; ISS validation method derived from satellite.js API already in use
- Pitfalls: HIGH — pitfalls derived from direct codebase inspection + official CesiumJS documentation

**Research date:** 2026-03-11
**Valid until:** 2026-06-11 (stable domain — CesiumJS Primitive API and PostGIS GIST indexes are long-stable APIs)
