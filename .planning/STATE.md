---
gsd_state_version: 1.0
milestone: v5.0
milestone_name: Playback
status: executing
stopped_at: Completed 25-04-PLAN.md
last_updated: "2026-03-13T20:14:53.735Z"
last_activity: "2026-03-13 — Plan 25-03 complete: GPS jamming poll frozen in playback (refetchInterval: false), amber GPS LIVE DATA badge rendered, LAYR-03 GREEN"
progress:
  total_phases: 4
  completed_phases: 3
  total_plans: 10
  completed_plans: 10
  percent: 100
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-13)

**Core value:** A unified, visually impressive intelligence picture — satellites orbiting, aircraft moving, anomalies surfacing — all rendered on one polished 3D globe that feels operational and modern.
**Current focus:** Phase 26 — End-to-End Verification + Stale Indicators

## Current Position

Phase: 25 of 26 (Layer Audit)
Plan: 4 of 4 complete in current phase
Status: Phase Complete
Last activity: 2026-03-13 — Plan 25-04 complete: street traffic particles hidden in playback, rAF loop frozen, road fetch debounced blocked, invalidateQueries wired on LIVE return — LAYR-04 and PLAY-04 GREEN; full 192-test suite green

Progress: [██████████████████████████████] 100% (v5.0 phase 24 complete)

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

### Preserved from v4.0

- Hand-written Alembic migrations only — never autogenerate (position_snapshots is range-partitioned)
- `useSettingsStore` separate from `useAppStore` — prevents transient runtime values persisting
- Detail endpoints unaffected by stale filtering — replay engine needs historical rows
- `stale_cutoff()` called inside handler body (not module scope)

### Pending Todos

None.

### Blockers/Concerns

- Phase 26: FPS gate at 15m/s may trigger optimisation pass if snapshot interpolation at 1h/s exhausts CPU with 1,000+ aircraft; design only after profiling confirms the problem

## Session Continuity

Last session: 2026-03-13T20:14:53.732Z
Stopped at: Completed 25-04-PLAN.md
Resume file: None
