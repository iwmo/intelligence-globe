# Deferred Items — Phase 11 Plan 03

## Pre-existing Regressions (out of scope)

### SatelliteLayer.cleanup.test.tsx Pitfall 1 failure

- **Discovered during:** Task 2 full suite run
- **File:** `frontend/src/components/GpsJammingLayer.tsx`
- **Issue:** GpsJammingLayer.tsx (already modified before Plan 03) uses `EntityCollection` or `viewer.entities` — causes SatelliteLayer static audit grep to flag it.
- **Root cause:** Pre-existing uncommitted change in GpsJammingLayer.tsx. The grep pattern `EntityCollection|viewer\.entities` matches content in that file's working tree version.
- **Not caused by:** Plan 03 files (useReplaySnapshots.ts, osintEvents.ts, PlaybackBar.tsx).
- **Action needed:** Review GpsJammingLayer.tsx for EntityCollection/viewer.entities usage and refactor to use Primitive API. Defer to a dedicated gap-closure plan.
