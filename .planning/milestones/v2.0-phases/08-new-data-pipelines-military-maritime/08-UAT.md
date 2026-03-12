---
status: diagnosed
phase: 08-new-data-pipelines-military-maritime
source: [08-01-SUMMARY.md, 08-02-SUMMARY.md, 08-03-SUMMARY.md, 08-04-SUMMARY.md, 08-05-SUMMARY.md]
started: 2026-03-12T09:00:00Z
updated: 2026-03-12T09:15:00Z
---

## Current Test
<!-- OVERWRITE each test - shows where we are -->

[testing complete]

## Tests

### 1. Cold Start Smoke Test
expected: Kill any running containers. Run `docker compose up --build` (or `docker compose up`). All services start without errors (backend, worker, ais-worker, redis, postgres). The backend health endpoint (or GET /api/military/) returns a live response (HTTP 200). No crash or missing-env errors on startup.
result: issue
reported: "Uncaught TypeError: Cannot read properties of null (reading 'position') at self.onmessage (propagation.worker.ts:64:21) — repeating, with SES_UNCAUGHT_EXCEPTION: null also logged repeatedly"
severity: major

### 2. MIL and SHIP Toggle Buttons in Sidebar
expected: In the bottom-left layer strip, two new buttons are visible — a shield/alert icon labeled "MIL" (amber styling) and an anchor icon labeled "SHIP" (cyan styling). Both appear alongside the existing layer toggles.
result: pass

### 3. Both Layers Hidden by Default
expected: On fresh load (without toggling anything), no amber or cyan dots appear on the globe. The MIL and SHIP layers are off by default — the globe shows only the layers already enabled in prior phases.
result: pass

### 4. Enable Military Aircraft Layer — Amber Dots Appear
expected: Click the MIL toggle button. Amber (#F59E0B) point dots appear on the globe representing military aircraft. If no military aircraft are in the feed at the moment, the layer is still enabled (no error). Clicking MIL again hides the dots.
result: pass

### 5. Click Military Aircraft → Detail Panel
expected: With the MIL layer on, click an amber dot. A detail panel opens on the right side showing military aircraft data: callsign, ICAO24 hex code, aircraft type, altitude (in feet), speed (in knots), heading, and squawk code. Closing the panel clears the selection.
result: pass

### 6. Enable Ship Layer — Cyan Dots Appear
expected: Click the SHIP toggle button. Cyan (#06B6D4) point dots appear on the globe representing ships. (If AISSTREAM_API_KEY is not set, the layer enables but shows no dots — no crash.) Clicking SHIP again hides the dots.
result: pass

### 7. Click Ship → Detail Panel
expected: With the SHIP layer on, click a cyan dot. A detail panel opens showing ship data: MMSI, vessel name, ship type, speed (SOG), heading, navigation status, and last update time. Closing the panel clears the selection.
result: pass

### 8. Ship Heading 511 Displays as N/A
expected: If a ship has heading value 511 (AIS standard for "not available"), the detail panel shows "N/A" instead of the number 511.
result: pass

### 9. Regression — Commercial Aircraft and Satellites Still Work
expected: The existing commercial aircraft layer and satellite layer (from prior phases) still function correctly after Phase 8 changes. Clicking a commercial aircraft still opens the aircraft detail panel. No regressions in the click handler or right drawer.
result: pass

## Summary

total: 9
passed: 8
issues: 1
pending: 0
skipped: 0

## Gaps

- truth: "App starts without errors — all services boot, no runtime exceptions in browser console"
  status: failed
  reason: "User reported: Uncaught TypeError: Cannot read properties of null (reading 'position') at self.onmessage (propagation.worker.ts:64:21) — repeating, with SES_UNCAUGHT_EXCEPTION: null also logged repeatedly"
  severity: major
  test: 1
  root_cause: "satellite.propagate() returns null for decayed/invalid TLEs (ecc out of range, mean motion < 0, etc.) but propagation.worker.ts line 64 reads pv.position without first checking pv === null. The guard `typeof pv.position === 'boolean' || pv.position === undefined` throws before it evaluates. Pre-existing bug from Phase 04, not introduced by Phase 08."
  artifacts:
    - path: "frontend/src/workers/propagation.worker.ts"
      issue: "line 64 (PROPAGATE loop) and line 93 (COMPUTE_ORBIT loop) missing pv === null guard before accessing pv.position"
  missing:
    - "Add `pv === null ||` to the existing guard condition at line 64 in PROPAGATE handler"
    - "Add same null guard at analogous line in COMPUTE_ORBIT handler"
  debug_session: ".planning/debug/propagation-worker-null-crash.md"
