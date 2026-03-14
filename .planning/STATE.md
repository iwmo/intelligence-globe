---
gsd_state_version: 1.0
milestone: v6.0
milestone_name: Production Ready
status: roadmap_ready
stopped_at: Roadmap created, ready for Phase 27 planning
last_updated: "2026-03-14T00:00:00.000Z"
last_activity: "2026-03-14 — Roadmap created for v6.0 (5 phases, 14 requirements, phases 27-31)"
progress:
  total_phases: 5
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-14)

**Core value:** A unified, visually impressive intelligence picture — satellites orbiting, aircraft moving, anomalies surfacing — all rendered on one polished 3D globe that feels operational and modern.
**Current focus:** v6.0 Production Ready — Phase 27 next

## Current Position

Phase: 27 — Secrets Cleanup (not started)
Plan: —
Status: Roadmap ready, awaiting Phase 27 planning
Last activity: 2026-03-14 — Roadmap created

```
v6.0 Progress: [░░░░░░░░░░░░░░░░░░░░] 0% (0/5 phases)
Phase 27 ░  Phase 28 ░  Phase 29 ░  Phase 30 ░  Phase 31 ░
```

## Performance Metrics

| Metric | v6.0 Target | Current |
|--------|-------------|---------|
| Requirements covered | 14/14 | 14/14 (roadmap) |
| Phases planned | 5 | 5 |
| Plans complete | TBD | 0 |

## Accumulated Context

### Key Decisions (v6.0)

- Static API key (not JWT/session auth) — homelab tool, single user, simple shared secret sufficient
- Full production nginx stack integrated into main docker-compose.yml (not a separate compose file) — single source of truth, build targets differentiate dev vs prod
- All 4 CI checks: pytest, vitest+tsc, gitleaks secret scanning, docker build — covers correctness + security
- Observability deferred — current /health endpoint sufficient for homelab use
- Phase 27 runs before Phase 28 so API_KEY is guaranteed present in .env.example before middleware uses it
- Phase 31 depends on 29+30 so README can accurately describe the CI and Docker stack

### Phase Dependency Map

```
Phase 27 (Secrets)
  └─► Phase 28 (API Key Auth)
  └─► Phase 29 (Production Docker)
  └─► Phase 30 (CI Pipeline)
         └─► Phase 31 (Documentation)
```

### CRITICAL: Credential Rotation Required Before Public Release

User must revoke and rotate the following before making the repo public — real keys are in git history via old docker-compose.yml hardcoded fallbacks:
- OpenSky OAuth2 client secret
- AISStream API key

Phase 27 (SEC-01) removes the fallbacks from the compose file but does NOT purge git history. User action required: `git filter-repo` or GitHub repo reset.

### Preserved from v5.0

- `useAppStore.getState()` inside rAF/postUpdate callbacks required — selectors captured at render time go stale
- Hand-written Alembic migrations only — never autogenerate (position_snapshots is range-partitioned)
- `useSettingsStore` separate from `useAppStore` — prevents transient runtime values persisting
- Detail endpoints unaffected by stale filtering — replay engine needs historical rows
- `stale_cutoff()` called inside handler body (not module scope)

### Pending Todos

None.

### Blockers/Concerns

None blocking roadmap. Credential rotation (see above) is a user action item, not a code task.

## Session Continuity

Last session: 2026-03-14
Stopped at: Roadmap created (phases 27-31), Phase 27 ready for planning
Resume file: None
Next action: `/gsd:plan-phase 27`
