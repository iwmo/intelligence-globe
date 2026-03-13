---
gsd_state_version: 1.0
milestone: v5.0
milestone_name: Playback
status: defining_requirements
last_updated: "2026-03-13"
last_activity: 2026-03-13 — Milestone v5.0 started
progress:
  total_phases: 0
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-13 after v5.0 milestone start)

**Core value:** A unified, visually impressive intelligence picture — satellites orbiting, aircraft moving, anomalies surfacing — all rendered on one polished 3D globe that feels operational and modern.
**Current focus:** Defining requirements for v5.0 Playback

## Current Position

Phase: Not started (defining requirements)
Plan: —
Status: Defining requirements
Last activity: 2026-03-13 — Milestone v5.0 started

## Accumulated Context

### Preserved from v4.0

- All schema changes hand-written Alembic migrations only — never autogenerate (position_snapshots is range-partitioned)
- useSettingsStore separate from useAppStore — prevents transient runtime values from persisting
- Settings gear icon NOT gated by cleanUI — settings must remain accessible in cinematic mode
- SVG icon canvases pre-rendered at module scope — TextureAtlas budget constraint
- Detail endpoints unaffected by stale filtering — replay engine needs historical rows
- stale_cutoff() called inside handler body (not module scope)

### v5.0 Playback Context

- **Root bug confirmed**: SatelliteLayer propagation loop always posts `timestamp: Date.now()` to worker — never `replayTs`. Satellites move at real time in all modes.
- **Street traffic**: Pure animation loop, no time awareness — particles always moving regardless of mode.
- **GPS Jamming**: No playback logic — always renders same H3 hexagons, no snapshot support.
- **Live lerp (aircraft)**: rAF loop computes alpha from `Date.now() - lastUpdateTime` — may still advance in playback mode if not gated.
- **Snapshot window**: Fetched from `/api/replay/window` on PlaybackBar mount. If DB has no snapshots (position_snapshots table empty), scrubber shows "No historical data".
- **OSINT events**: Polled every 30s in playback mode only — correct direction.

### Pending Todos

None — v5.0 requirements definition in progress.

### Blockers/Concerns

None.
