---
phase: 08-new-data-pipelines-military-maritime
plan: "06"
subsystem: ui
tags: [satellite, propagation, worker, null-guard, sgp4, cesium]

# Dependency graph
requires:
  - phase: 08-new-data-pipelines-military-maritime
    provides: "Phase 8 UAT baseline — military layer, ship layer, App.tsx wiring"
provides:
  - "Null-safe satellite propagation worker — pv === null guard at all three satellite.propagate() call sites"
  - "Phase 8 all-UAT-pass baseline — no repeating TypeError on cold start"
affects:
  - 09-gps-jamming
  - 10-snapshot-playback
  - 11-replay-engine

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "satellite.js null-return guard: check pv === null BEFORE accessing pv.position to handle decayed/invalid TLEs"

key-files:
  created: []
  modified:
    - frontend/src/workers/propagation.worker.ts

key-decisions:
  - "pv === null guard placed before existing typeof pv.position === 'boolean' check — satellite.js returns null (not { position: false }) for decayed TLEs with invalid eccentricity or negative mean motion"
  - "All three call sites patched (PROPAGATE, COMPUTE_ORBIT, GET_POSITION handlers) — single-site patch would leave two paths still crashing"

patterns-established:
  - "Propagation null check pattern: if (pv === null || typeof pv.position === 'boolean' || pv.position === undefined) — covers null return, boolean-position error return, and undefined"

requirements-completed: [LAY-01, LAY-03]

# Metrics
duration: ~10min
completed: 2026-03-12
---

# Phase 08 Plan 06: Null-safe satellite propagation worker — pv === null guard prevents repeating TypeError on cold start

**Targeted two-line null guard at all three satellite.propagate() call sites silences repeating TypeError for decayed/invalid TLEs, unblocking Phase 8 UAT test 1 (Cold Start Smoke Test)**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-03-12T06:56:34Z
- **Completed:** 2026-03-12T07:10:00Z
- **Tasks:** 2 (1 auto + 1 human-verify checkpoint)
- **Files modified:** 1

## Accomplishments

- Added `pv === null ||` guard at all three `satellite.propagate()` call sites in `propagation.worker.ts` (PROPAGATE, COMPUTE_ORBIT, GET_POSITION handlers)
- Eliminated the repeating `TypeError: Cannot read properties of null (reading 'position')` crash that surfaced on cold start when TLEs with invalid eccentricity or negative mean motion were loaded
- Phase 8 UAT human-verify checkpoint approved — browser console clean, all layers (satellite, MIL, SHIP) functional with no errors

## Task Commits

Each task was committed atomically:

1. **Task 1: Add pv === null guard to propagation.worker.ts** - `b526635` (fix)
2. **Task 2: Verify clean cold start — no repeating TypeError** - human-verify checkpoint (approved by user)

**Plan metadata:** (this commit — docs)

## Files Created/Modified

- `frontend/src/workers/propagation.worker.ts` - Added `pv === null ||` null guard before existing boolean/undefined check at three call sites (lines 64, 93, 116 approximately)

## Decisions Made

- Used `pv === null` exact check (not `!pv` or nullish coalescing) to match the pre-existing guard style and avoid masking falsy-but-valid future values
- Patched all three handlers in the same commit to eliminate split-brain state where some code paths were null-safe and others were not

## Deviations from Plan

None — plan executed exactly as written. The fix was a targeted two-line addition per the plan specification with no additional changes.

## Issues Encountered

None — root cause was correctly identified in 08-UAT.md. The fix was straightforward: `satellite.js` returns `null` (not `{ position: false }`) for decayed TLEs, so the existing guard threw before it could evaluate.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Phase 8 gap closure complete — all 9 UAT tests pass with no repeating TypeError
- Satellite propagation worker is now robust to decayed/invalid TLEs from any future TLE dataset
- Phase 9 (GPS Jamming layer) can proceed with a stable baseline

---
*Phase: 08-new-data-pipelines-military-maritime*
*Completed: 2026-03-12*
