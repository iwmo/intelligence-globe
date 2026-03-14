---
gsd_state_version: 1.0
milestone: v6.0
milestone_name: Production Ready
status: defining_requirements
stopped_at: Requirements defined, roadmap pending
last_updated: "2026-03-14T00:00:00.000Z"
last_activity: "2026-03-14 — Milestone v6.0 started; 14 requirements defined across 4 categories"
progress:
  total_phases: 0
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-14)

**Core value:** A unified, visually impressive intelligence picture — satellites orbiting, aircraft moving, anomalies surfacing — all rendered on one polished 3D globe that feels operational and modern.
**Current focus:** Planning v6.0 Production Ready milestone

## Current Position

Phase: Not started (defining requirements)
Plan: —
Status: Defining requirements
Last activity: 2026-03-14 — Milestone v6.0 started

## Accumulated Context

### Key Decisions (v6.0)

- Static API key (not JWT/session auth) — homelab tool, single user, simple shared secret sufficient
- Full production nginx stack (not separate docker-compose.prod.yml) — single compose file covers both dev and prod with build targets
- All 4 CI checks: pytest, vitest+tsc, gitleaks secret scanning, docker build
- Observability deferred — current /health endpoint sufficient for homelab use

### Preserved from v5.0

- `useAppStore.getState()` inside rAF/postUpdate callbacks required — selectors captured at render time go stale
- Hand-written Alembic migrations only — never autogenerate (position_snapshots is range-partitioned)
- `useSettingsStore` separate from `useAppStore` — prevents transient runtime values persisting
- Detail endpoints unaffected by stale filtering — replay engine needs historical rows
- `stale_cutoff()` called inside handler body (not module scope)

### Pending Todos

None.

### Blockers/Concerns

- User must revoke OpenSky and AISStream credentials before making repo public — real keys are in git history via old docker-compose.yml fallbacks.

## Session Continuity

Last session: 2026-03-14
Stopped at: Requirements defined, roadmap pending
Resume file: None
