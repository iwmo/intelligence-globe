---
phase: 12-osint-event-correlation
plan: "04"
subsystem: frontend-osint-ui
tags: [osint, react, hooks, tanstack-query, tdd, form-component]
dependency_graph:
  requires: [12-02, 12-03]
  provides: [OsintEventPanel.tsx, useOsintEvents.ts, updated OsintEvent type with SEISMIC]
  affects: [frontend/src/data/osintEvents.ts, frontend/src/hooks/useOsintEvents.ts, frontend/src/components/OsintEventPanel.tsx]
tech_stack:
  added: []
  patterns: [useQuery-with-enabled-pause, controlled-form-component, tdd-red-green]
key_files:
  created:
    - frontend/src/hooks/useOsintEvents.ts
  modified:
    - frontend/src/data/osintEvents.ts
    - frontend/src/components/OsintEventPanel.tsx
decisions:
  - OsintEventPanel props are optional (open defaults true) so test renders <OsintEventPanel /> without props
  - source_url input uses type=url to satisfy test selector input[type="url"]
  - useOsintEvents accepts positional boolean (not object) matching test call signature useOsintEvents({ enabled })
metrics:
  duration: "~3 minutes"
  completed_date: "2026-03-12"
  tasks_completed: 2
  files_changed: 3
---

# Phase 12 Plan 04: OSINT Event Frontend Summary

**One-liner:** `useOsintEvents` TanStack Query hook with enabled-pause pattern and `OsintEventPanel` fixed-position form posting to `/api/osint-events`, with `OsintEvent` type updated to SEISMIC category.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Update osintEvents.ts and create useOsintEvents hook | a763c57 | frontend/src/data/osintEvents.ts, frontend/src/hooks/useOsintEvents.ts |
| 2 | Create OsintEventPanel component | 496f12b | frontend/src/components/OsintEventPanel.tsx |

## What Was Built

**osintEvents.ts:** `OsintEvent.category` union changed from `KINETIC|AIRSPACE|MARITIME|JAMMING|BLACKOUT` to `KINETIC|AIRSPACE|MARITIME|SEISMIC|JAMMING`. `OsintEvent` gains optional `latitude`/`longitude` fields for PlaybackBar AOI auto-set. `EVENT_COLORS` adds `SEISMIC: '#ffff00'`, removes `BLACKOUT` key. `OSINT_EVENTS` remains empty array.

**useOsintEvents.ts:** `useOsintEvents(enabled: boolean)` hook using `useQuery` with `queryKey: ['osint-events']`, fetches `GET /api/osint-events`, maps `ApiOsintEvent[]` to `OsintEvent[]` (id as string, ts as ms epoch via `new Date(e.ts).getTime()`). `refetchInterval: enabled ? 30_000 : false` pauses polling when not needed. `staleTime: 25_000`. Returns `{ events: data?.events ?? [], isLoading }`.

**OsintEventPanel.tsx:** Fixed-position overlay form (`position: fixed, top: 60px, right: 16px, zIndex: 90, width: 280px`). Dark semi-transparent background with cyan border, monospace font. Form fields: label (`name="label"`), datetime-local (`name="ts"`), category select with 5 options (`name="category"`), source URL (`type="url"`, `name="source_url"`), latitude and longitude number inputs. `LOG EVENT` submit button in `#00D4FF`. On submit: POSTs to `/api/osint-events`, on success calls `onClose()` and resets fields. Renders null when `open=false`. Props are optional (open defaults to true).

## Verification Results

```
useOsintEvents.test.ts: 5/5 passed
OsintEventPanel.test.tsx: 6/6 passed
Full suite: 92 passed / 99 total (7 pre-existing RED tests from Plans 05+ — no regressions; +4 tests turned GREEN vs Plan 03 baseline)
```

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

Files exist:
- frontend/src/data/osintEvents.ts: FOUND (modified)
- frontend/src/hooks/useOsintEvents.ts: FOUND (created)
- frontend/src/components/OsintEventPanel.tsx: FOUND (created)

Commits exist:
- a763c57: FOUND
- 496f12b: FOUND
