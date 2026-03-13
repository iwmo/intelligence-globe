---
gsd_state_version: 1.0
milestone: v5.0
milestone_name: Playback
status: ready_to_plan
last_updated: "2026-03-13"
last_activity: 2026-03-13 — v5.0 roadmap created; phases 23-26 defined
progress:
  total_phases: 4
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-13)

**Core value:** A unified, visually impressive intelligence picture — satellites orbiting, aircraft moving, anomalies surfacing — all rendered on one polished 3D globe that feels operational and modern.
**Current focus:** Phase 23 — Store Foundation + Viewer Clock

## Current Position

Phase: 23 of 26 (Store Foundation + Viewer Clock)
Plan: 0 of ? in current phase
Status: Ready to plan
Last activity: 2026-03-13 — v5.0 roadmap created; phases 23-26 defined

Progress: [████████████████████░░░░░░░░░░] 68% (v4.0 complete, v5.0 starting)

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

## Accumulated Context

### Key Decisions (v5.0)

- `isPlaying` in `useAppStore` (not `useSettingsStore`) — transient runtime state, not localStorage-persisted
- `viewer.clock` sync via `viewer.scene.postUpdate.addEventListener` not React `useEffect` on `replayTs` — avoids one-frame render lag
- Aircraft lerp loop must stay alive in playback (return early, not cancel rAF) — enables instant resume without loop restart
- `refetchInterval: false` alone insufficient — focus-triggered React Query refetches bypass it; add `replayMode` guard inside Effect 2 as defense in depth

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

Last session: 2026-03-13
Stopped at: Roadmap created for v5.0; ready to plan Phase 23
Resume file: None
