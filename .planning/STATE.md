---
gsd_state_version: 1.0
milestone: v5.0
milestone_name: Playback
status: completed
stopped_at: Completed 26-04-PLAN.md
last_updated: "2026-03-13T21:17:34.991Z"
last_activity: "2026-03-14 — Plan 26-04 complete: VRFY-02 FPS gate PASSED (>= 30 FPS at 15m/s playback) — no throttle guard needed, v5.0 milestone closes cleanly, 213-test suite green"
progress:
  total_phases: 4
  completed_phases: 4
  total_plans: 14
  completed_plans: 14
  percent: 100
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-14)

**Core value:** A unified, visually impressive intelligence picture — satellites orbiting, aircraft moving, anomalies surfacing — all rendered on one polished 3D globe that feels operational and modern.
**Current focus:** Planning next milestone (v6.0)

## Current Position

Phase: 26 of 26 (End-to-End Verification + Stale Indicators) — COMPLETE
Status: v5.0 Playback milestone archived — ready for /gsd:new-milestone
Last activity: 2026-03-14 — v5.0 milestone archived; 13/13 requirements satisfied; 213-test suite green; git tagged v5.0

Progress: [██████████] 100% (v5.0 complete)

## Performance Metrics

**Velocity:**
- Total plans completed: 71 (across v1.0–v4.0)
- Average duration: ~15 min
- Total execution time: ~17.8 hours

**By Phase:**

| Phase | Plans | Status |
|-------|-------|--------|
| 23. Store Foundation + Viewer Clock | TBD | Not started |
| 24. Satellite Propagation Fix | TBD | Not started |
| 25. Layer Audit | TBD | Not started |
| 26. End-to-End Verification + Stale Indicators | TBD | Not started |

**Recent Trend:**
- v4.0 shipped same-day in 6 phases / 13 plans
- Trend: Stable
| Phase 23 P02 | 8 | 2 tasks | 3 files |
| Phase 23 P04 | 3 min | 2 tasks | 3 files |
| Phase 23-store-foundation-viewer-clock P03 | 6 | 2 tasks | 3 files |
| Phase 24-satellite-propagation-fix P01 | 7 | 2 tasks | 3 files |
| Phase 24-satellite-propagation-fix P02 | 8 | 4 tasks | 4 files |
| Phase 25-layer-audit P01 | 8 | 2 tasks | 9 files |
| Phase 25-layer-audit P02 | 8 | 2 tasks | 6 files |
| Phase 25-layer-audit P03 | 7 | 2 tasks | 3 files |
| Phase 25-layer-audit P04 | 5 | 2 tasks | 5 files |
| Phase 26-end-to-end-verification-stale-indicators P01 | 2 | 2 tasks | 4 files |
| Phase 26-end-to-end-verification-stale-indicators P02 | 3 | 2 tasks | 6 files |
| Phase 26-end-to-end-verification-stale-indicators P03 | 10 | 2 tasks | 0 files |
| Phase 26-end-to-end-verification-stale-indicators P04 | 5 | 2 tasks | 0 files |

## Accumulated Context

### Key Decisions (v5.0)

- `isPlaying` in `useAppStore` (not `useSettingsStore`) — transient runtime state, not localStorage-persisted
- `viewer.clock` sync via `viewer.scene.postUpdate.addEventListener` not React `useEffect` on `replayTs` — avoids one-frame render lag
- Aircraft lerp loop must stay alive in playback (return early, not cancel rAF) — enables instant resume without loop restart
- `refetchInterval: false` alone insufficient — focus-triggered React Query refetches bypass it; add `replayMode` guard inside Effect 2 as defense in depth
- `resolveTimestamp` returns null (not 0) for pause guard — null is a deliberate skip-dispatch signal, not a timestamp [24-01]
- PLAY-02 tests use deterministic 2026-01-01T12:00:00Z reference time to avoid wall-clock flakiness [24-01]
- orbitTimestamp read via getState() inside Effect 2 body (not in deps) — orbit anchored to satellite selection moment, not latest scrub [24-02]
- GET_POSITION added to Effect 2 alongside COMPUTE_ORBIT — globe click fly-to fixed without any change to AircraftLayer [24-02]
- queryClient extracted to frontend/src/lib/queryClient.ts as zero-behavior-change refactor enabling PLAY-04 test mocking [25-01]
- Contract-test helper pattern for lerp/Effect guard RED tests: standalone helpers mirror unguarded production logic, assertions check guarded outcome [25-01]
- AircraftLayer lerp reads replayMode via getState() inside rAF body — not captured closure — prevents stale value after effect re-creation [25-02]
- ShipLayer/MilitaryAircraftLayer Effect 2 guard placed before null checks, replayMode in deps for live-resume reactivity [25-02]
- GPS jamming badge rendered via conditional JSX return (not inside useEffect) — keeps Cesium primitive and React DOM concerns separate [25-03]
- vi.mock paths in Vitest are relative to test file location, not source file — corrected useGpsJamming test mock path [25-03]
- Effect 5 added alongside Effect 4 in StreetTrafficLayer — replayMode and layerVisible change handling kept separate with independent reactive deps [25-04]
- vi.hoisted used for mockInvalidateQueries — avoids temporal dead zone when vi.mock factory is hoisted before module-level const declarations [25-04]
- useAppStore mock requires .getState() for components that call getState() imperatively — selector mock alone insufficient for handleModeToggle [25-04]
- VIS-01 contract helpers encode guard inline — tests GREEN as written, document expected 26-02 behavior, any regression requires explicit helper update [26-01]
- VRFY-01 simulateTickAdvance mirrors PlaybackBar tick() arithmetic exactly — speed-preset ratios locked as contract, regressions surfaced by helper mismatch [26-01]
- Stale-tint effect placed last in each layer component; Color.GRAY.withAlpha(0.4) and Color.WHITE.clone() prevent Cesium singleton mutation [26-02]
- VRFY-02 FPS gate PASSED — no interpolation throttle guard needed in AircraftLayer or ShipLayer; 213-test suite green confirms no regression [26-04]

### Preserved from v4.0

- Hand-written Alembic migrations only — never autogenerate (position_snapshots is range-partitioned)
- `useSettingsStore` separate from `useAppStore` — prevents transient runtime values persisting
- Detail endpoints unaffected by stale filtering — replay engine needs historical rows
- `stale_cutoff()` called inside handler body (not module scope)

### Pending Todos

None.

### Blockers/Concerns

None. v5.0 complete and archived.

## Session Continuity

Last session: 2026-03-13T21:01:39.729Z
Stopped at: Completed 26-04-PLAN.md
Resume file: None
