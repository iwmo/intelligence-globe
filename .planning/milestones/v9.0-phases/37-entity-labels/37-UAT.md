---
status: diagnosed
phase: 37-entity-labels
source: [37-01-SUMMARY.md, 37-02-SUMMARY.md, 37-03-SUMMARY.md]
started: 2026-03-15T00:00:00Z
updated: 2026-03-15T00:05:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Entity Labels toggle in Settings Panel
expected: Open the Settings panel. A "DISPLAY" section appears at the top (above "Default Layers"). It contains an "Entity Labels" checkbox. The checkbox is unchecked by default on a fresh load.
result: pass

### 2. Toggle persistence across refresh
expected: Check the "Entity Labels" checkbox in Settings, then refresh the browser. Reopen Settings — the checkbox is still checked (value persisted via localStorage globe-settings key).
result: [pending]

### 3. Satellite labels appear when toggle ON
expected: With Entity Labels enabled and the Satellites layer visible, cyan monospace text labels (showing OBJECT_NAME, e.g. "ISS (ZARYA)") float above each satellite dot. Labels scale down and vanish as you zoom out to global altitude.
result: issue
reported: "nothing shows"
severity: major

### 4. Aircraft labels appear when toggle ON
expected: With Entity Labels enabled and the Aircraft layer visible, orange monospace text labels (showing callsign or ICAO24 code) float above each aircraft icon. Labels scale down and vanish at high altitude.
result: issue
reported: "nothing shows"
severity: major

### 5. Military aircraft labels appear when toggle ON
expected: With Entity Labels enabled and military aircraft visible, red monospace callsign labels (uppercased) float above each military aircraft icon. They behave the same as civilian aircraft labels.
result: skipped
reason: Labels not appearing for any entity type — skipping until root issue resolved

### 6. Ship labels appear when toggle ON
expected: With Entity Labels enabled and ships visible, green monospace vessel name labels (uppercased, e.g. "EVER GIVEN") float above each ship icon.
result: skipped
reason: Labels not appearing for any entity type — skipping until root issue resolved

### 7. All labels hidden when toggle OFF
expected: Uncheck Entity Labels in Settings. All labels (satellite, aircraft, military aircraft, ships) disappear from the globe immediately, with no labels remaining visible.
result: skipped
reason: Labels not appearing — toggle-off behavior untestable

### 8. Labels respect layer visibility
expected: With Entity Labels ON, toggle off the Satellites layer (or any layer). The satellite labels also disappear — labels don't float as orphans when their parent layer is hidden.
result: skipped
reason: Labels not appearing — layer-cross-reference behavior untestable

## Summary

total: 8
passed: 1
issues: 2
pending: 1
skipped: 4

## Gaps

- truth: "Cyan OBJECT_NAME labels float above satellite dots when showEntityLabels=true"
  status: failed
  reason: "User reported: nothing shows"
  severity: major
  test: 3
  root_cause: |
    SatelliteLayer labels are created inside the async worker LOADED handler with show:false.
    The label visibility useEffect has a guard 'if (labelColl.length === 0) return' which fires
    when satellites.data arrives (before the worker responds with LOADED). After the worker
    populates the label collection, none of the effect's deps change, so the effect never
    re-runs. Labels remain show:false permanently on initial load when showEntityLabels=true
    is already set (persisted from localStorage). Toggling off→on after load would fix it,
    but labels never show on first page load with the toggle pre-enabled.
  artifacts:
    - path: "frontend/src/components/SatelliteLayer.tsx"
      issue: "Label visibility effect early-returns (labelColl.length===0) before async worker LOADED handler creates labels; no dep triggers re-run after LOADED fires"
  missing:
    - "Set initial show state in LOADED handler using useSettingsStore.getState().showEntityLabels rather than hardcoding show:false"
    - "Remove the 'if (labelColl.length === 0) return' early-return guard from label visibility effect"

- truth: "Orange callsign/ICAO24 labels float above aircraft icons when showEntityLabels=true"
  status: failed
  reason: "User reported: nothing shows"
  severity: major
  test: 4
  root_cause: |
    AircraftLayer label visibility effect deps include aircraft.data, so it fires when data
    arrives and labels are created — the timing is correct in theory. However, the
    NearFarScalar(1e4, 1.4, 5e6, 0.0) makes labels nearly invisible at the ~2893km camera
    altitude in the screenshot: interpolated scale ≈ 0.59 × 11px font ≈ 6.5px effective
    size. Cesium may cull sub-threshold labels, or they are too small to perceive.
    Additionally, if showEntityLabels is true from localStorage on initial load, the label
    effect's first run (no data yet, labelsByIcao24 empty) is a no-op, and on subsequent
    runs bb.show is correctly set by the filter effect before the label effect runs — so the
    show logic is correct, but the scale makes labels imperceptible at global altitudes.
  artifacts:
    - path: "frontend/src/components/AircraftLayer.tsx"
      issue: "NearFarScalar far bound 5e6 (5000km) causes scale ~0.59 at 2893km altitude, making 11px labels ~6.5px — effectively invisible at globe view"
  missing:
    - "Extend scaleByDistance far distance or minimum scale so labels remain legible at typical globe-view altitudes (e.g. NearFarScalar(1e4, 1.4, 2e6, 0.3) keeps a minimum 0.3 scale)"

- truth: "MilitaryAircraftLayer and ShipLayer label effects will not re-run when data arrives"
  status: failed
  reason: "Latent bug — layers off in screenshot but same pattern will fail when enabled"
  severity: major
  test: 5
  root_cause: |
    MilitaryAircraftLayer Effect 4 deps: [showEntityLabels, layerVisible] — missing
    militaryAircraft.data. ShipLayer Effect 4 deps: [showEntityLabels, layerVisible] —
    missing ships.data. When data arrives and Effect 2 creates labels (show:false), Effect 4
    does not re-run because data is not in its deps. Labels stay show:false until user
    manually toggles showEntityLabels.
  artifacts:
    - path: "frontend/src/components/MilitaryAircraftLayer.tsx"
      issue: "Effect 4 deps missing militaryAircraft.data — label visibility never synced on initial data load"
    - path: "frontend/src/components/ShipLayer.tsx"
      issue: "Effect 4 deps missing ships.data — label visibility never synced on initial data load"
  missing:
    - "Add militaryAircraft.data to MilitaryAircraftLayer Effect 4 dependency array"
    - "Add ships.data to ShipLayer Effect 4 dependency array"
