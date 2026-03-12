---
phase: 11-replay-engine
plan: "04"
subsystem: ui
tags: [react, cesiumjs, typescript, zustand, react-query, replay, interpolation]

# Dependency graph
requires:
  - phase: 11-replay-engine/11-03
    provides: PlaybackBar component, useReplaySnapshots hook, findAdjacentSnapshots binary search, osintEvents seed data
  - phase: 10-snapshot-infrastructure
    provides: position_snapshots table, /api/replay/window endpoint, Zustand replay store slice
provides:
  - Full LIVE/PLAYBACK toggle functional end-to-end
  - Snapshot interpolation wired into AircraftLayer, MilitaryAircraftLayer, and ShipLayer
  - PlaybackBar mounted outside cleanUI gate in App.tsx
  - Human-verified replay engine satisfying REP-02, REP-03, REP-04
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Playback interpolation as additive useEffect guarded by replayMode === 'playback' — live lerp untouched
    - PlaybackBar mounted unconditionally outside cleanUI gate, consistent with CinematicHUD/LandmarkNav pattern
    - snapshotsByEntity Map lookup pattern: snapshotsByEntity.get(entityKey) → findAdjacentSnapshots → lerp alpha

key-files:
  created: []
  modified:
    - frontend/src/components/AircraftLayer.tsx
    - frontend/src/components/MilitaryAircraftLayer.tsx
    - frontend/src/components/ShipLayer.tsx
    - frontend/src/App.tsx

key-decisions:
  - "Playback interpolation added as separate additive useEffect in each layer — live lerp effects left completely untouched"
  - "Ships use altitude 100m in playback (same as live mode); aircraft use altitude + 1000m to match live lerp baseline"
  - "PlaybackBar rendered unconditionally outside cleanUI gate — same pattern as CinematicHUD and LandmarkNav"

patterns-established:
  - "Playback effect pattern: guard with replayMode === 'playback', iterate pointsBy* map, call findAdjacentSnapshots, compute alpha, set point.position"
  - "Layer snapshot fetch: useReplaySnapshots(layer, windowStart, windowEnd, replayMode === 'playback') — enabled flag disables fetch in live mode"

requirements-completed: [REP-02, REP-03, REP-04]

# Metrics
duration: continuation
completed: 2026-03-12
---

# Phase 11 Plan 04: Replay Engine Layer Integration Summary

**Snapshot interpolation wired into AircraftLayer, MilitaryAircraftLayer, and ShipLayer via additive useEffect hooks; PlaybackBar mounted outside cleanUI gate; full LIVE/PLAYBACK toggle human-verified end-to-end**

## Performance

- **Duration:** continuation session
- **Started:** 2026-03-12
- **Completed:** 2026-03-12
- **Tasks:** 3 (2 auto + 1 human-verify)
- **Files modified:** 4

## Accomplishments

- Added playback snapshot interpolation to all three layer components (AircraftLayer, MilitaryAircraftLayer, ShipLayer) without modifying the existing live lerp or direct-update paths
- Mounted PlaybackBar in App.tsx unconditionally outside the cleanUI gate, consistent with CinematicHUD and LandmarkNav mounting pattern
- Human verification confirmed all 7 replay behaviors: PLAYBACK mode freezes live polling, LIVE mode restores within one poll interval, scrubber drives entity positions, speed presets work, PlaybackBar persists in Clean UI mode, and zero OSINT event dots cause no crash

## Task Commits

Each task was committed atomically:

1. **Task 1: Add playback snapshot interpolation to AircraftLayer, MilitaryAircraftLayer, ShipLayer** - `1bb960d` (feat)
2. **Task 2: Mount PlaybackBar in App.tsx outside cleanUI gate** - `e991ae5` (feat)
3. **Task 3: Human verification of full replay engine (REP-02, REP-03, REP-04)** - approved by user

## Files Created/Modified

- `frontend/src/components/AircraftLayer.tsx` - Added useReplaySnapshots hook call and playback interpolation useEffect; live rAF lerp effect untouched
- `frontend/src/components/MilitaryAircraftLayer.tsx` - Same additive playback effect pattern using 'military' layer key
- `frontend/src/components/ShipLayer.tsx` - Playback interpolation using shipPointsByMmsi; ships have no live lerp so only additive effect needed
- `frontend/src/App.tsx` - PlaybackBar imported and mounted outside cleanUI conditional block

## Decisions Made

- Playback interpolation implemented as additive useEffect in each layer component (not modifying existing effects) — reduces regression risk and keeps live behavior isolated
- Ships use 100m altitude in playback (matching live direct-update mode); aircraft use snapshot altitude + 1000m to match live lerp visual baseline
- PlaybackBar follows the exact same unconditional mount pattern as CinematicHUD and LandmarkNav established in Phase 07-P05

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 11 replay engine is fully complete (all four requirements REP-01 through REP-04 satisfied)
- Snapshot data accumulates automatically via Phase 10 background task; meaningful replay playback available after 30-60 minutes of runtime
- No blockers for future phases

---
*Phase: 11-replay-engine*
*Completed: 2026-03-12*
