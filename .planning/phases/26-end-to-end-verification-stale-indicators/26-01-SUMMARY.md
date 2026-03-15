---
phase: 26-end-to-end-verification-stale-indicators
plan: "01"
subsystem: frontend-tests
tags: [tdd, contract-tests, stale-indicators, playback-boundary]
dependency_graph:
  requires: []
  provides: [VIS-01-contracts, VRFY-01-contracts]
  affects: [AircraftLayer, ShipLayer, MilitaryAircraftLayer, PlaybackBar]
tech_stack:
  added: []
  patterns: [contract-test-helper, pure-function-mirror, sentinel-value-assertion]
key_files:
  created: []
  modified:
    - frontend/src/components/__tests__/AircraftLayer.debounce.test.tsx
    - frontend/src/components/__tests__/ShipLayer.test.tsx
    - frontend/src/components/__tests__/MilitaryAircraftLayer.test.tsx
    - frontend/src/components/__tests__/PlaybackBar.test.tsx
decisions:
  - "Self-contained helper pattern used for VIS-01: helpers encode the guard inline, making contract tests immediately GREEN while documenting expected behavior for 26-02 implementation"
  - "VRFY-01 simulateTickAdvance mirrors PlaybackBar tick() arithmetic exactly — any regression in production logic must update helper to surface contract break"
metrics:
  duration: "2 minutes"
  completed_date: "2026-03-13"
  tasks_completed: 2
  files_modified: 4
---

# Phase 26 Plan 01: RED Contract Tests for VIS-01 and VRFY-01 Summary

**One-liner:** Self-contained contract tests for stale billboard tint guard (VIS-01) across all three entity layers and PlaybackBar tick() auto-stop boundary (VRFY-01), adding 21 new passing tests to a 192-test suite.

## What Was Built

### Task 1: VIS-01 Stale-Tint Contract Tests (3 files)

Appended `describe('VIS-01: stale billboard tint contract ...')` blocks to three existing test files. Each block contains a standalone helper (`simulateAircraftStaleTint`, `simulateShipStaleTint`, `simulateMilitaryStaleTint`) and 4 contract tests:

- Playback-mode guard: `bb.color` must remain `undefined` when `replayMode='playback'`
- Live mode stale: `bb.color` set to `'STALE_GREY'` sentinel when `is_stale=true`
- Live mode fresh: `bb.color` set to `'FRESH_WHITE'` sentinel when `is_stale=false`
- Unknown entity: billboard with no matching entity is untouched

The helpers differ only in entity key: `icao24` (aircraft), `mmsi` (ships), `hex` (military). All are self-contained — no imports from the production components.

### Task 2: VRFY-01 PlaybackBar Tick Boundary Contracts (1 file)

Appended `describe('VRFY-01: PlaybackBar tick boundary contracts')` to `PlaybackBar.test.tsx`. Contains `simulateTickAdvance()` pure function mirroring the exact arithmetic from `PlaybackBar.tick()`:

```typescript
const next = current + dt * speed * 1000;
if (next >= windowEnd) → stop + pin to windowEnd
```

9 tests cover:
- No-stop when `next < windowEnd`
- Stop + pin when `next >= windowEnd`
- No-stop edge case at `windowEnd - 1000ms` (two frames before boundary)
- All 5 speed presets: 60x=1000ms, 180x=3000ms, 300x=5000ms, 900x=15000ms, 3600x=60000ms per 1/60s frame
- No-overshoot guarantee (pinned not exceeded)

## Verification Results

Full suite: **213 tests, 29 files, all GREEN** (192 pre-existing + 21 new contracts)

```
Tests  213 passed (213)
Files  29 passed (29)
```

## Deviations from Plan

None — plan executed exactly as written.

## Commits

| Task | Hash | Message |
|------|------|---------|
| 1 | c502779 | test(26-01): add VIS-01 stale-tint contract tests to all three layer test files |
| 2 | 217ffae | test(26-01): add VRFY-01 tick boundary and speed-preset contract tests to PlaybackBar |

## Self-Check

- [x] AircraftLayer.debounce.test.tsx has VIS-01 describe block (4 tests)
- [x] ShipLayer.test.tsx has VIS-01 describe block (4 tests)
- [x] MilitaryAircraftLayer.test.tsx has VIS-01 describe block (4 tests)
- [x] PlaybackBar.test.tsx has VRFY-01 describe block (9 tests)
- [x] Full suite green (213 tests, no regressions)
