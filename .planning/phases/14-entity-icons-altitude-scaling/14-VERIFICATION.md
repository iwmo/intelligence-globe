---
phase: 14-entity-icons-altitude-scaling
verified: 2026-03-12T18:30:00Z
status: human_needed
score: 9/10 must-haves verified
re_verification: false
human_verification:
  - test: "Confirm airplane silhouette, delta-wing, and hull shapes render visibly — not dots — in the browser at typical zoom altitudes"
    expected: "Aircraft display as orange swept-wing airplane shapes; military as red delta-wing shapes; ships as green hull silhouettes. Shapes must be perceptibly different from each other."
    why_human: "Canvas 2D path drawing is correct in code but visual distinctiveness requires seeing the actual rendered output."
  - test: "Continuous zoom test from 20,000 km orbital altitude to 500 m street level — all five entity types legible throughout"
    expected: "All icons remain visible at both extremes; no entity type disappears at mid-range zoom; sizes grow proportionally as you descend."
    why_human: "NearFarScalar behavior depends on CesiumJS runtime and GPU-side scaling; cannot be asserted from source alone."
  - test: "Click-to-detail regression — click aircraft, ship, military aircraft, satellite each open the correct detail panel"
    expected: "AircraftLayer billboard id=bare icao24 opens aircraft panel; ShipLayer id=mmsi:<mmsi> opens ship panel; MilitaryAircraftLayer id=mil:<hex> opens military panel; SatelliteLayer numeric NORAD id opens satellite panel."
    why_human: "Billboard id routing through the unified LEFT_CLICK handler requires live click interaction to confirm."
---

# Phase 14: Entity Icons and Altitude Scaling — Verification Report

**Phase Goal:** Replace generic point primitives for aircraft, military, and ship layers with distinctive shaped SVG/canvas billboard icons, and add altitude-proportional scaleByDistance scaling to satellite PointPrimitives, ensuring all entity types remain visually legible from orbital (20,000 km) to street level (500 m).

**Verified:** 2026-03-12T18:30:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Commercial aircraft render as AIRCRAFT_ICON airplane silhouette billboards (not dots) | VERIFIED | `AircraftLayer.tsx:218` — `image: AIRCRAFT_ICON` in `BillboardCollection.add()`. Canvas constant at line 50, `drawAircraftIcon()` at line 29. |
| 2 | Military aircraft render as MILITARY_ICON delta-wing billboard shapes (not dots) | VERIFIED | `MilitaryAircraftLayer.tsx:107` — `image: MILITARY_ICON` in `BillboardCollection.add()`. Canvas constant at line 38, `drawMilitaryIcon()` at line 19. |
| 3 | Ships render as SHIP_ICON vessel hull billboard shapes (not dots) | VERIFIED | `ShipLayer.tsx:115` — `image: SHIP_ICON` in `BillboardCollection.add()`. Canvas constant at line 39, `drawShipIcon()` at line 19. |
| 4 | Satellite layer stays PointPrimitiveCollection — no BillboardCollection migration | VERIFIED | `SatelliteLayer.tsx:4` imports `PointPrimitiveCollection`; line 127 creates it. No `BillboardCollection` reference anywhere in file. |
| 5 | Satellite PointPrimitives have scaleByDistance NearFarScalar set post-add | VERIFIED | `SatelliteLayer.tsx:154` — `pt.scaleByDistance = new NearFarScalar(5e5, 1.5, 5e7, 0.3)` immediately after `collection.add()` at line 148. |
| 6 | Aircraft, military, and ship icons scale with altitude via NearFarScalar | VERIFIED | All three billboard layers contain `scaleByDistance: new NearFarScalar(1e4, 1.5, 5e6, 0.4)` in their `collection.add()` calls (Aircraft:224, Military:113, Ship:121). |
| 7 | Aircraft billboards rotate to true_track heading | VERIFIED | `AircraftLayer.tsx:221` — `rotation: CesiumMath.toRadians(-(ac.true_track ?? 0))` on add; line 230 updates existing billboard rotation on each data refresh. |
| 8 | Ship billboards rotate to heading with 511-sentinel fallback to cog | VERIFIED | `ShipLayer.tsx:103–105` — `(ship.heading !== null && ship.heading !== 511) ? ship.heading : (ship.cog ?? 0)` before rotation assignment at lines 111 and 118. |
| 9 | Military billboards rotate to track heading | VERIFIED | `MilitaryAircraftLayer.tsx:98` — `const rot = ac.track ?? 0`; applied at lines 103 and 110. |
| 10 | Icons are visually legible across orbital to street level zoom range | NEEDS HUMAN | NearFarScalar values are correctly specified in code; actual rendering legibility requires in-browser zoom test. Human approved in 14-04 summary but verification requires confirming this interactively. |

**Score:** 9/10 truths verified by code inspection (1 requiring human confirmation)

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `frontend/src/components/AircraftLayer.tsx` | BillboardCollection replacing PointPrimitiveCollection; AIRCRAFT_ICON; lerp loop on billboards | VERIFIED | Lines 4, 50, 83, 89, 117, 218, 224, 243, 247 — complete migration confirmed. No `PointPrimitiveCollection` import. |
| `frontend/src/components/MilitaryAircraftLayer.tsx` | BillboardCollection replacing PointPrimitiveCollection; MILITARY_ICON; scaleByDistance | VERIFIED | Lines 4, 38, 42, 46, 70, 107, 113 — complete migration confirmed. No `PointPrimitiveCollection` import. |
| `frontend/src/components/ShipLayer.tsx` | BillboardCollection replacing PointPrimitiveCollection; SHIP_ICON; heading rotation; scaleByDistance | VERIFIED | Lines 4, 39, 43, 47, 71, 115, 121 — complete migration confirmed. No `PointPrimitiveCollection` import. |
| `frontend/src/components/SatelliteLayer.tsx` | PointPrimitive scaleByDistance set post-add in LOADED handler; layer type unchanged | VERIFIED | Line 16 imports `NearFarScalar`; line 154 sets `pt.scaleByDistance = new NearFarScalar(5e5, 1.5, 5e7, 0.3)` post-add. |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| AircraftLayer BillboardCollection.add() | AIRCRAFT_ICON canvas constant | `image: AIRCRAFT_ICON` | WIRED | Line 218 — module-scope export at line 50; same object reference ensures TextureAtlas dedup. |
| MilitaryAircraftLayer BillboardCollection.add() | MILITARY_ICON canvas constant | `image: MILITARY_ICON` | WIRED | Line 107 — module-scope export at line 38. |
| ShipLayer BillboardCollection.add() | SHIP_ICON canvas constant | `image: SHIP_ICON` | WIRED | Line 115 — module-scope export at line 39. |
| rAF lerp function | billboardsByIcao24 map | `bb.position = Cartesian3.lerp(prev, curr, alpha, scratchLerp)` | WIRED | AircraftLayer.tsx:247 — lerp loop closes over module-scope `billboardsByIcao24`; position API identical to former point API. |
| SatelliteLayer LOADED handler | PointPrimitive scaleByDistance | `pt.scaleByDistance = new NearFarScalar(...)` post-add | WIRED | Line 154 — captures return of `collection.add()` as `pt`, sets property immediately. |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| ICONS-01 | 14-01, 14-03 | Commercial aircraft displayed as airplane-shaped SVG billboard icons | SATISFIED | `AircraftLayer.tsx` — `AIRCRAFT_ICON` canvas (swept-wing silhouette, #FF8C00) wired to `BillboardCollection.add()` at line 218. |
| ICONS-02 | 14-01, 14-02 | Military flights displayed as a distinct military aircraft SVG billboard icon | SATISFIED | `MilitaryAircraftLayer.tsx` — `MILITARY_ICON` canvas (delta-wing silhouette, #EF4444) wired to `BillboardCollection.add()` at line 107. |
| ICONS-03 | 14-01, 14-02 | Ships displayed as vessel-shaped SVG billboard icons | SATISFIED | `ShipLayer.tsx` — `SHIP_ICON` canvas (hull-from-above, #22C55E) wired to `BillboardCollection.add()` at line 115. |
| ICONS-04 | 14-04 | Satellites displayed as improved orbital-cross markers (PointPrimitive — billboard not used at 5,000+ entity count due to GPU texture limit) | SATISFIED | `SatelliteLayer.tsx` stays `PointPrimitiveCollection`; `scaleByDistance` adds altitude-proportional size variation. Design decision to keep PointPrimitive documented in REQUIREMENTS.md "Out of Scope" for billboard. |
| ICONS-05 | 14-02, 14-03, 14-04 | Aircraft, military, and ship icons scale proportionally with camera altitude | SATISFIED | All billboard layers use `NearFarScalar(1e4, 1.5, 5e6, 0.4)`. Satellites use `NearFarScalar(5e5, 1.5, 5e7, 0.3)`. All verified in source. |

No orphaned requirements — all five ICONS-0x IDs mapped to this phase are claimed by plans 14-01 through 14-04 and verified in code.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `frontend/src/workers/propagation.worker.ts` | 87 | Pre-existing TypeScript error (`TS2769` — ArrayBuffer transfer arg position) | Info | Documented as pre-existing before Phase 14. Does not affect billboard rendering or layer behavior. Tracked in `deferred-items.md`. |
| `frontend/src/workers/__tests__/propagation.test.ts` | 144, 146 | Pre-existing TypeScript error (`TS18047` — possibly null) | Info | Test-only; pre-existing; out of scope. |
| `frontend/vite.config.ts` | 42 | Pre-existing TypeScript error (`TS2769` — unknown `test` property in UserConfigExport) | Info | Vitest config issue; pre-existing; does not affect production build. |

No blockers or warnings introduced by Phase 14 changes. The three Info items are all pre-existing and explicitly scoped out in `deferred-items.md`.

---

### Human Verification Required

#### 1. Entity Shape Visual Check

**Test:** Start the dev server (`cd frontend && npm run dev`). Enable all layers (AIRCRAFT, MILITARY, SHIPS, SATELLITES). Zoom to an area with traffic for each entity type.
**Expected:** Aircraft display as orange swept-wing airplane silhouettes; military as red delta-wing shapes (visually distinct from commercial); ships as green hull-from-above silhouettes; satellites as small cyan dots (by design — not shaped icons).
**Why human:** Canvas 2D paths are syntactically and logically correct in code, but perceptible visual distinctiveness of the three shapes requires seeing the rendered output at a realistic scale.

#### 2. Altitude Scaling Legibility (NearFarScalar)

**Test:** With all layers enabled, zoom continuously from ~20,000 km (planetary view showing all continents) down to ~500 m (street-level view of a city with airport or port).
**Expected:** All icon types remain visible throughout the range. At orbital altitude: small but present. At street level: large enough to be legible without being excessively oversized. No entity type disappears at mid-range zoom.
**Why human:** `NearFarScalar` runtime behaviour is a GPU-side CesiumJS interpolation that depends on the actual camera altitude reported at runtime — cannot be validated from source code alone.

#### 3. Click-to-Detail Regression Check

**Test:** Click one entity of each type and confirm the correct detail panel opens. Also click an empty area to confirm all panels close.
**Expected:** Aircraft (bare icao24 id) → aircraft panel; Ship (mmsi:<mmsi> id) → ship panel; Military (mil:<hex> id) → military panel; Satellite (numeric NORAD id > 1000) → satellite panel; empty globe click → all panels clear.
**Why human:** The unified LEFT_CLICK handler routing logic is structurally unchanged in code, but the billboard `id` value hand-off through CesiumJS `scene.pick()` to the store dispatch requires live interaction to confirm end-to-end.

---

### Gaps Summary

No structural gaps found. All five ICONS requirements are implemented and wired in code. The three items flagged for human verification are behavioral/visual confirmations that the human approved during the 14-04-SUMMARY checkpoint (zoom test approved, no NearFarScalar tuning required). The VERIFICATION.md status is `human_needed` rather than `passed` because this verifier cannot independently confirm visual rendering from source inspection alone, and the phase goal explicitly requires legibility "from orbital (20,000 km) to street level (500 m)".

If the human approval recorded in 14-04-SUMMARY is accepted as sufficient evidence, the phase can be promoted to `passed` without additional testing.

---

_Verified: 2026-03-12T18:30:00Z_
_Verifier: Claude (gsd-verifier)_
