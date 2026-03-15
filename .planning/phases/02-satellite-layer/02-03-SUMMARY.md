---
phase: 02-satellite-layer
plan: 03
subsystem: frontend-propagation
tags: [satellite.js, web-worker, sgp4, tanstack-query, zustand, propagation]
dependency_graph:
  requires: [02-01]
  provides: [propagation-worker, satellites-hook, satellite-store-state]
  affects: [02-04-satellite-layer-rendering]
tech_stack:
  added: [satellite.js@6.x]
  patterns: [web-worker-transferable, tanstack-query-server-state, zustand-extension]
key_files:
  created:
    - frontend/src/workers/propagation.worker.ts
    - frontend/src/hooks/useSatellites.ts
  modified:
    - frontend/package.json
    - frontend/src/store/useAppStore.ts
key_decisions:
  - "satellite.js json2satrec guards satrec.error !== 0 to silently discard malformed OMM records"
  - "PROPAGATE uses transferable Float64Array (zero-copy IPC) packing [x,y,z,norad]*N in meters"
  - "30s AbortController timeout on /api/satellites/ fetch — large (~4 MB) payload exceeds typical 5s window"
metrics:
  duration: 86s
  completed: 2026-03-11
  tasks_completed: 2
  files_changed: 4
---

# Phase 02 Plan 03: SGP4 Propagation Engine and Frontend Satellite State Summary

**One-liner:** Off-thread SGP4 propagation via satellite.js Web Worker with zero-copy Float64Array IPC, TanStack Query satellite fetch hook, and Zustand store satellite selection state.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Install satellite.js and create propagation Web Worker | 832fcd7 | `frontend/package.json`, `frontend/src/workers/propagation.worker.ts` |
| 2 | TanStack Query hook and Zustand store extension | 77ab7d5 | `frontend/src/hooks/useSatellites.ts`, `frontend/src/store/useAppStore.ts` |

## What Was Built

### propagation.worker.ts

A TypeScript Web Worker handling three message types:

- **LOAD_OMM**: Accepts `Array<{norad_cat_id, omm}>`, calls `satellite.json2satrec()` per record, discards any where `satrec.error !== 0`, stores the valid `SatrecEntry[]` array in module scope, responds `{type: 'LOADED', count}`.

- **PROPAGATE**: Accepts `{timestamp: number}` (ms epoch), propagates all loaded satrecs at that time using `satellite.propagate()`, converts ECI to ECF via `satellite.eciToEcf()` with `gstime()`, multiplies km to meters for CesiumJS. Packs `[x_m, y_m, z_m, norad_id]` per satellite into a `Float64Array` and transfers it as a transferable object (zero-copy).

- **COMPUTE_ORBIT**: Accepts `{omm, periodSeconds}`, creates a fresh satrec, steps through the orbit in 60-second intervals, returns ECF orbit points (meters) and geodetic ground track (longitude/latitude radians).

### useSatellites.ts

TanStack Query hook with:
- `queryKey: ['satellites']`
- `queryFn` fetching `/api/satellites/` with a 30-second AbortController timeout
- `staleTime: 7_200_000` (2 hours, matching backend TLE refresh)
- `refetchInterval: 7_200_000` (2 hours)
- `retry: 3`, `retryDelay: 5_000`

### useAppStore.ts extension

Added to the existing Zustand store without removing any existing fields:
- `selectedSatelliteId: number | null` — currently selected satellite for detail panel
- `setSelectedSatelliteId: (id: number | null) => void`
- `tleLastUpdated: string | null` — ISO8601 timestamp from `/api/satellites/freshness`
- `setTleLastUpdated: (ts: string | null) => void`

## Verification

- `satellite.js` installed in `frontend/node_modules` and listed in `package.json` dependencies
- `propagation.worker.ts` exists with all three handlers
- `npx tsc --noEmit` exits clean — zero TypeScript errors across all new/modified files

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check

- [x] `frontend/src/workers/propagation.worker.ts` — exists
- [x] `frontend/src/hooks/useSatellites.ts` — exists
- [x] `frontend/src/store/useAppStore.ts` — extended with new fields
- [x] Commit 832fcd7 — Task 1
- [x] Commit 77ab7d5 — Task 2
- [x] TypeScript: zero errors
