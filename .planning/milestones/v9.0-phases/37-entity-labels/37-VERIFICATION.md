---
phase: 37-entity-labels
verified: 2026-03-15T00:10:00Z
status: human_needed
score: 13/13 must-haves verified
re_verification:
  previous_status: passed
  previous_score: 9/9
  gaps_closed:
    - "Satellite labels now appear on initial page load when showEntityLabels=true is persisted in localStorage (Plan 04)"
    - "Aircraft labels remain visible at globe-view altitude (~2893km) due to NearFarScalar minimum floor (Plan 04)"
    - "Military aircraft labels re-evaluated for visibility after data arrives — no longer stuck show:false on initial load (Plan 05)"
    - "Ship labels re-evaluated for visibility after data arrives — no longer stuck show:false on initial load (Plan 05)"
  gaps_remaining: []
  regressions: []
gaps: []
human_verification:
  - test: "Toggle Entity Labels on with all four layers active"
    expected: "Cyan satellite labels, orange aircraft labels, red military labels, green ship labels all appear simultaneously above their icons"
    why_human: "Cesium LabelCollection rendering and TextureAtlas behaviour cannot be confirmed via static analysis"
  - test: "Zoom from ground level to global altitude with labels enabled"
    expected: "Labels are readable at close range; aircraft/ship/military fade but remain visible at globe altitude (0.3 minimum scale); satellite labels fade to invisible beyond ~50,000 km"
    why_human: "NearFarScalar runtime interpolation requires an active Cesium viewer to observe"
  - test: "Toggle labels off while all layers are active"
    expected: "All labels disappear instantly without page reload; entity icons remain visible"
    why_human: "Requires runtime confirmation that show=false propagates correctly to all Cesium label primitives"
  - test: "Enable labels, refresh browser, reopen Settings panel"
    expected: "Entity Labels checkbox is still checked; labels appear on layers that have loaded data"
    why_human: "localStorage persistence and the LOADED-handler immediate-apply path require browser runtime to verify"
  - test: "Load app with showEntityLabels=true in localStorage — wait for all layers to load"
    expected: "Labels appear for all entity types without any user interaction (initial-load fix from Plans 04 and 05)"
    why_human: "Async timing of worker LOADED callback and React effect dep-array re-evaluation requires runtime observation"
---

# Phase 37: Entity Labels Verification Report

**Phase Goal:** Users can see floating text labels above every tracked entity on the globe, with the feature switchable from the settings panel and the preference remembered across sessions.
**Verified:** 2026-03-15
**Status:** HUMAN_NEEDED — all automated checks pass; 5 items require runtime testing
**Re-verification:** Yes — after gap closure (Plans 04 and 05 added since previous verification)

---

## Re-verification Context

The previous VERIFICATION.md (status: passed, score: 9/9) covered Plans 01–03. Since then, two gap-closure plans executed:

- **Plan 04** fixed satellite labels not showing on initial load and aircraft labels being culled at globe altitude.
- **Plan 05** fixed military aircraft and ship labels being stuck `show:false` on initial load due to missing `data` dependency in Effect 4.

This re-verification extends coverage to all five plans and confirms the gap-closure changes are present and correctly wired.

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Settings panel has an 'Entity Labels' checkbox toggle | VERIFIED | `SettingsPanel.tsx` lines 93-106: DISPLAY section with `Entity Labels` label, `checked={showEntityLabels}`, `onChange` wired |
| 2 | Toggling the checkbox immediately updates showEntityLabels in useSettingsStore | VERIFIED | `onChange={() => setShowEntityLabels(!showEntityLabels)}` — direct setter call, no intermediate state |
| 3 | showEntityLabels defaults to false (labels off on first load) | VERIFIED | `useSettingsStore.ts` line 42: `showEntityLabels: false` inside persist factory |
| 4 | Toggle persists across browser refresh (localStorage) | VERIFIED | Field inside `persist()` with `name: 'globe-settings'` — Zustand persist serialises it |
| 5 | Satellite labels show OBJECT_NAME in cyan above each PointPrimitive when toggle is on | VERIFIED | `SatelliteLayer.tsx` lines 168-181: `labelColl.add()` with `fillColor: '#00D4FF'`, `text: omm['OBJECT_NAME']`; positions synced in POSITIONS handler |
| 6 | Satellite labels are visible on initial load when toggle was pre-enabled in localStorage | VERIFIED | Lines 185-192: `useSettingsStore.getState().showEntityLabels` read in LOADED handler; corrects show state immediately after label creation |
| 7 | Aircraft labels show callsign/ICAO24 in orange above each billboard when toggle is on | VERIFIED | `AircraftLayer.tsx` lines 274-290: `fillColor: '#FF8C00'`, `text: (ac.callsign?.trim() \|\| ac.icao24).toUpperCase()` |
| 8 | Aircraft labels remain visible at globe-view altitude | VERIFIED | Line 286: `scaleByDistance: new NearFarScalar(1e4, 1.4, 2e6, 0.3)` — 0.3 minimum scale floor beyond 2000km |
| 9 | Military aircraft labels show flight/hex in red above each billboard when toggle is on | VERIFIED | `MilitaryAircraftLayer.tsx` lines 141-155: `fillColor: '#EF4444'`, `text: (ac.flight?.trim() \|\| ac.hex).toUpperCase()` |
| 10 | Military labels re-evaluated for visibility after data arrives | VERIFIED | Line 174: Effect 4 dep array `[showEntityLabels, layerVisible, militaryAircraft.data]` — data dep ensures re-run after Effect 2 populates the label map |
| 11 | Ship labels show vessel_name/MMSI in green above each billboard when toggle is on | VERIFIED | `ShipLayer.tsx` lines 149-163: `fillColor: '#22C55E'`, `text: (ship.vessel_name?.trim() \|\| ship.mmsi).toUpperCase()` |
| 12 | Ship labels re-evaluated for visibility after data arrives | VERIFIED | Line 182: Effect 4 dep array `[showEntityLabels, layerVisible, ships.data]` — data dep ensures re-run after Effect 2 populates the label map |
| 13 | All labels scale with camera distance | VERIFIED | All four layers use `NearFarScalar`; satellites: `(5e5, 1.2, 5e7, 0.0)`; aircraft: `(1e4, 1.4, 2e6, 0.3)`; military/ships: `(1e4, 1.4, 5e6, 0.0)` |

**Score:** 13/13 truths verified

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `frontend/src/store/useSettingsStore.ts` | `showEntityLabels: boolean` + `setShowEntityLabels` in persisted store | VERIFIED | Lines 18, 24, 42, 48 — field in interface, default false, action, all inside `persist()` |
| `frontend/src/components/SettingsPanel.tsx` | Entity Labels toggle checkbox in Display section | VERIFIED | Lines 93-106 — DISPLAY section checkbox reads/writes showEntityLabels |
| `frontend/src/components/SatelliteLayer.tsx` | LabelCollection + initial-load fix + no early-return guard | VERIFIED | Lines 111, 138-139: ref + primitive created; line 185: `useSettingsStore.getState()`; line 362: no length guard |
| `frontend/src/components/AircraftLayer.tsx` | LabelCollection + `labelsByIcao24` map + NearFarScalar floor | VERIFIED | Lines 93, 100, 132-134: map + ref + created; line 286: `NearFarScalar(1e4, 1.4, 2e6, 0.3)` |
| `frontend/src/components/MilitaryAircraftLayer.tsx` | LabelCollection + `militaryLabelsByHex` + data dep in Effect 4 | VERIFIED | Lines 51, 56, 85-87: map + ref + created; line 174: dep array includes `militaryAircraft.data` |
| `frontend/src/components/ShipLayer.tsx` | LabelCollection + `shipLabelsByMmsi` + data dep in Effect 4 | VERIFIED | Lines 52, 57, 86-88: map + ref + created; line 182: dep array includes `ships.data` |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `SettingsPanel.tsx` | `useSettingsStore.ts` | `showEntityLabels` + `setShowEntityLabels` | WIRED | Line 67 destructures both; line 101 calls `setShowEntityLabels(!showEntityLabels)` |
| `SatelliteLayer.tsx` | `useSettingsStore.ts` | `useSettingsStore(s => s.showEntityLabels)` | WIRED | Line 358 selector; lines 359-368 effect syncs label visibility |
| `SatelliteLayer.tsx LOADED` | `useSettingsStore.getState()` | Direct escape-hatch read in async worker callback | WIRED | Line 185 — `useSettingsStore.getState().showEntityLabels` inside LOADED handler |
| `AircraftLayer.tsx` | `useSettingsStore.ts` | `useSettingsStore(s => s.showEntityLabels)` | WIRED | Line 343 selector; lines 344-349 effect syncs label visibility |
| `MilitaryAircraftLayer.tsx` | `useSettingsStore.ts` | `useSettingsStore(s => s.showEntityLabels)` | WIRED | Line 59 selector; lines 169-174 Effect 4 syncs label visibility |
| `MilitaryAircraftLayer Effect 4` | `militaryAircraft.data` | React dependency array | WIRED | Line 174: `[showEntityLabels, layerVisible, militaryAircraft.data]` — fires after data populates label map |
| `ShipLayer.tsx` | `useSettingsStore.ts` | `useSettingsStore(s => s.showEntityLabels)` | WIRED | Line 60 selector; lines 177-182 Effect 4 syncs label visibility |
| `ShipLayer Effect 4` | `ships.data` | React dependency array | WIRED | Line 182: `[showEntityLabels, layerVisible, ships.data]` — fires after data populates label map |

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| LBL-01 | 37-01 | User can toggle entity labels on/off via Settings panel | SATISFIED | SettingsPanel DISPLAY section with Entity Labels checkbox |
| LBL-02 | 37-01 | Label toggle state persists across browser refresh (localStorage via useSettingsStore) | SATISFIED | `showEntityLabels` inside `persist()` with `name: 'globe-settings'` |
| LBL-03 | 37-02, 37-04 | When labels enabled, each satellite shows `object_name` as floating text above its PointPrimitive | SATISFIED | SatelliteLayer `labelColl.add()` with `text: omm['OBJECT_NAME']`; initial-load fix in LOADED handler |
| LBL-04 | 37-02, 37-04 | Satellite labels are cyan (#00D4FF) monospace, sized to remain readable at all zoom levels | SATISFIED | `fillColor: '#00D4FF'`, `font: '11px monospace'`, `scaleByDistance: NearFarScalar(5e5, 1.2, 5e7, 0.0)` |
| LBL-05 | 37-02 | When labels enabled, each commercial aircraft shows callsign (or ICAO24) above its billboard | SATISFIED | AircraftLayer `text: (ac.callsign?.trim() \|\| ac.icao24).toUpperCase()` |
| LBL-06 | 37-02 | Aircraft labels are orange (#FF8C00) to match the entity icon color | SATISFIED | `fillColor: Color.fromCssColorString('#FF8C00')` |
| LBL-07 | 37-03, 37-05 | When labels enabled, each military aircraft shows flight callsign (or hex) above its billboard | SATISFIED | MilitaryAircraftLayer `text: (ac.flight?.trim() \|\| ac.hex).toUpperCase()`; data dep in Effect 4 |
| LBL-08 | 37-03 | Military labels are red (#EF4444) to match the entity icon color | SATISFIED | `fillColor: Color.fromCssColorString('#EF4444')` |
| LBL-09 | 37-03, 37-05 | When labels enabled, each ship shows vessel_name (or MMSI) above its billboard | SATISFIED | ShipLayer `text: (ship.vessel_name?.trim() \|\| ship.mmsi).toUpperCase()`; data dep in Effect 4 |
| LBL-10 | 37-03 | Ship labels are green (#22C55E) to match the entity icon color | SATISFIED | `fillColor: Color.fromCssColorString('#22C55E')` |

All 10 LBL requirements satisfied. No orphaned requirements found in REQUIREMENTS.md for Phase 37.

---

## Anti-Patterns Found

None. Scanned all six modified files for TODO/FIXME/HACK/PLACEHOLDER comments, empty handlers, stub returns, and console.log-only implementations. Zero hits.

---

## Cleanup Verification

All four layer components implement proper LabelCollection cleanup:

- **SatelliteLayer**: Effect 1 cleanup checks `labelCollectionRef.current.isDestroyed()` before removing from scene; nulls ref (lines 322-325)
- **AircraftLayer**: Effect 1 cleanup removes `lc` from scene, nulls `labelCollectionRef`, calls `labelsByIcao24.clear()` (lines 220-223)
- **MilitaryAircraftLayer**: Effect 1 cleanup removes `lc` from scene, nulls `labelCollectionRef`, calls `militaryLabelsByHex.clear()` (lines 96-99)
- **ShipLayer**: Effect 1 cleanup removes `lc` from scene, nulls `labelCollectionRef`, calls `shipLabelsByMmsi.clear()` (lines 98-101)

---

## Commit Verification

All 10 commits confirmed present in git history:

| Commit | Description |
|--------|-------------|
| `5fe4750` | feat(37-01): add showEntityLabels field and setShowEntityLabels action to useSettingsStore |
| `2de1dd6` | feat(37-01): add Entity Labels toggle checkbox to SettingsPanel Display section |
| `3238207` | feat(37-02): add satellite label LabelCollection to SatelliteLayer |
| `2ce339a` | feat(37-02): add aircraft label LabelCollection to AircraftLayer |
| `07822f6` | feat(37-03): add red LabelCollection for military aircraft callsigns |
| `27b09a4` | feat(37-03): add green LabelCollection for ship vessel names |
| `ffab86b` | fix(37-04): fix satellite labels not visible on initial load when toggle pre-enabled |
| `a27dd7c` | fix(37-04): raise aircraft label scaleByDistance minimum to stay visible at globe altitude |
| `dfeb4f3` | fix(37-05): add militaryAircraft.data to Effect 4 dep array in MilitaryAircraftLayer |
| `f70f2c8` | fix(37-05): add ships.data to Effect 4 dep array in ShipLayer |

---

## TypeScript

`npx tsc --noEmit` exits clean — zero errors across all modified files (confirmed: EXIT:0).

---

## Human Verification Required

### 1. All four entity label types render at runtime

**Test:** Open the app with all four layers enabled. Open Settings and check "Entity Labels".
**Expected:** Cyan satellite labels, orange aircraft labels, red military aircraft labels, and green ship labels all appear floating above their respective icons simultaneously.
**Why human:** Cesium LabelCollection rendering, TextureAtlas behaviour, and label positioning above icons cannot be confirmed via static analysis.

### 2. Distance-based scaling — aircraft minimum floor

**Test:** With labels enabled, zoom from close range out to global altitude (~2893km camera height).
**Expected:** Aircraft/ship/military labels are readable at close range and remain faintly visible at global altitude (0.3 minimum scale); satellite labels fade to invisible at ~50,000km. Labels do not obscure the globe at close zoom.
**Why human:** NearFarScalar runtime interpolation and Cesium's culling threshold behaviour require an active Cesium viewer to observe.

### 3. Labels toggle off cleanly

**Test:** Enable labels while all four layers are active, then uncheck Entity Labels in Settings.
**Expected:** All labels disappear instantly without page reload; entity icons remain visible.
**Why human:** Requires runtime confirmation that the visibility effects re-run and propagate `show=false` to all Cesium label primitives across all four entity types.

### 4. Persistence across browser refresh

**Test:** Enable Entity Labels, refresh the browser, open Settings.
**Expected:** Entity Labels checkbox is still checked; labels reappear on layers that have loaded data.
**Why human:** localStorage persistence via Zustand persist requires browser runtime to verify the `globe-settings` key is written and re-read correctly.

### 5. Initial-load labels (Plans 04 and 05 fix)

**Test:** With `showEntityLabels=true` persisted in localStorage, hard-reload the app and wait for all layers to fetch data.
**Expected:** Labels appear for all four entity types without any toggle interaction — satellites via the LOADED handler immediate-apply path, aircraft/military/ship via the data dep in Effect 4.
**Why human:** Async timing between the worker's LOADED callback, React's effect dep re-evaluation, and data fetch completion requires runtime observation to confirm the gap-closure logic fires in the correct order.

---

## Summary

Phase 37 goal is fully achieved at the code level across all five plans. All 10 LBL requirements are satisfied. All six implementation files are substantive (not stubs), all key links are wired, TypeScript compiles clean (EXIT:0), and all 10 commits are confirmed in git history. The four gap-closure changes from Plans 04 and 05 are verified present:

- `useSettingsStore.getState().showEntityLabels` in SatelliteLayer LOADED handler (line 185)
- No `labelColl.length === 0` early-return guard in SatelliteLayer label effect
- `NearFarScalar(1e4, 1.4, 2e6, 0.3)` in AircraftLayer (line 286)
- `militaryAircraft.data` in MilitaryAircraftLayer Effect 4 dep array (line 174)
- `ships.data` in ShipLayer Effect 4 dep array (line 182)

Five items require human runtime verification to confirm Cesium rendering behaviour, NearFarScalar scaling at globe altitude, localStorage persistence, and the initial-load timing fix. No automated gaps remain.

---

_Verified: 2026-03-15_
_Verifier: Claude (gsd-verifier)_
