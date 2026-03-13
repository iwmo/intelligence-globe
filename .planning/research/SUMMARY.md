# Project Research Summary

**Project:** Intelligence Globe v5.0 — 4D Replay Engine Correctness Audit
**Domain:** Multi-layer geospatial replay — CesiumJS + React + Zustand + satellite.js Web Worker
**Researched:** 2026-03-13
**Confidence:** HIGH

## Executive Summary

Intelligence Globe v5.0 is a correctness audit milestone for an already-functional 4D replay engine. The base infrastructure — scrubber, speed presets, snapshot binary-search interpolation, OSINT event markers, mode toggle, React Query snapshot fetching — is fully shipped and correct. The problem is precise: six specific layer components were built before the replay store slice existed, and none of them reads `replayMode` or `replayTs`. As a result, every layer except OSINT and overpass arcs continues operating on wall-clock `Date.now()` during historical playback. Satellites orbit at the present real-world position, aircraft positions flicker between live and historical state, GPS jamming shows current daily data with no label, and street traffic particles flow continuously even when the scrubber is paused at a fixed timestamp. The recommended approach is a targeted surgical audit — no new libraries, no architecture changes, no schema migrations — purely adding `replayMode`/`replayTs` awareness at the exact callsites where live time is hardcoded.

All fixes are isolated to the frontend layer components and two hooks. Each fix uses one of three patterns already present in the codebase: `useAppStore.getState()` inside rAF closures (the `PlaybackBar.tsx` pattern), `refetchInterval` gated on `replayMode` (the `useAircraft.ts` pattern), or a `ref` kept in sync at render time and read inside the rAF loop body (the `layerVisibleRef` pattern in `StreetTrafficLayer.tsx`). One new hook is required: `useViewerClock.ts` (~20 lines) which syncs `viewer.clock.currentTime` to `replayTs` so that CesiumJS day/night shading follows replay time. No new patterns are introduced. The implementation order is: viewer clock sync first (most visually confirmable), satellite propagation second (most user-visible layer), aircraft lerp guard third (most complex write-ownership conflict), then ships/military guards, GPS jamming freeze, and street traffic freeze last.

The primary risk is a subtle write-ownership conflict: the live lerp and snapshot interpolation effect both write `bb.position` to the same CesiumJS billboard, and the lerp wins every frame at 60 Hz because it runs continuously and overwrites the snapshot position within one 16ms frame. A secondary risk is React Query background refetches during playback silently resetting entity positions to live data — `refetchInterval: false` stops the polling timer but does not prevent focus-triggered refetches. Both are addressed by the guard patterns described in the architecture research. A third risk — snapshot interpolation effect performance at 1h/s replay speed — is not a correctness blocker but must be profiled during end-to-end verification; if FPS drops below 30 with all layers active at high speed, a targeted optimisation pass is warranted.

---

## Key Findings

### Recommended Stack

No new packages are required for v5.0. The existing stack — CesiumJS 1.139.1, satellite.js 6.0.2, React 19.2.0, Zustand 5.0.11, Vite 7, FastAPI, PostgreSQL, PostGIS, Redis, Docker Compose — provides every primitive needed. All replay fixes use: `cesium`, `satellite.js`, `zustand`, `react` already installed.

**Core technologies:**
- **CesiumJS 1.139.1:** Globe rendering + Clock API — `JulianDate.fromDate(new Date(replayTs))` converts the Zustand ms-epoch to CesiumJS time; `viewer.clock.shouldAnimate = false` freezes auto-advancement; `viewer.scene.postUpdate.addEventListener` fires synchronously within the Cesium render frame (eliminates one-frame lag vs a React `useEffect`); `ClockStep.SYSTEM_CLOCK_MULTIPLIER` is the correct `clockStep` for manual replay control
- **satellite.js 6.0.2:** SGP4 propagation — `propagate(satrec, new Date(timestamp))` already accepts any `Date` including historical timestamps; the worker-side infrastructure is entirely correct; only the caller in `SatelliteLayer.tsx` line 260 sends `Date.now()` instead of `replayTs`
- **Zustand 5.0.11:** Global replay state — `useAppStore.getState()` is the correct escape hatch for reading state inside rAF callbacks and CesiumJS event listeners without triggering React re-renders or stale closure captures; already used correctly in `PlaybackBar.tsx` tick loop and `SatelliteLayer.tsx` OVERPASS handler
- **React 19.2.0:** `useRef<boolean>` for rAF running flags; `cancelAnimationFrame` in `useEffect` cleanup — both already used correctly in `AircraftLayer.tsx`; `useRef` pattern for `replayModeRef` follows the existing `layerVisibleRef` in `StreetTrafficLayer.tsx`

### Expected Features

**Must have — table stakes (v5.0 — blocks milestone close):**
- **PLAY-01:** Satellite propagation sends `replayTs` to worker when `replayMode === 'playback'`; propagation loop skips dispatch when `isPlaying === false`
- **PLAY-02a:** Aircraft live-lerp rAF loop yields position writes when `replayMode === 'playback'` — snapshot interpolation effect has exclusive `bb.position` ownership
- **PLAY-02b:** Ships `Effect 2` gated by `replayMode !== 'playback'` — live poll cache cannot overwrite snapshot positions
- **PLAY-02c:** Military `Effect 2` gated identically to ships
- **PLAY-02d:** GPS jamming shows amber "LIVE DATA" badge when `replayMode === 'playback'` and layer is visible; `refetchInterval` frozen during playback
- **PLAY-02e:** Street traffic particle `animate()` loop does not advance `p.t` in playback; particles hidden (no live historical data exists)
- **PLAY-03:** `isPlaying` promoted from `PlaybackBar` local `useState` to `useAppStore`; all guards use the store value to avoid stale closures
- **PLAY-04:** End-to-end scrub test across a 2-hour window with all layers active; freeze verified on pause; auto-stop at window end verified; FPS profiled at 15m/s+

**Should have — polish (v5.1):**
- **VIS-01:** Stale entity visual indicator — grey tint or opacity reduction for `is_stale=true` aircraft/military/ships in live mode; requires extending list API serialisation to include `is_stale` per entity (freshness DB columns already exist from v4.0)
- CinematicHUD REPLAY badge — switch "REC" label to "REPLAY [replayTs ISO]" during playback (one-liner in `CinematicHUD.tsx`)
- Snapshot loading indicator — disable play button and show "Loading snapshots…" while `isLoading === true` from react-query; zero API changes needed
- `/api/military/freshness` and `/api/ships/freshness` endpoints (deferred from v4.0 research)

**Defer (v6.0+):**
- Keyboard shortcuts — Space for play/pause, L for live/playback toggle; depends on `isPlaying` in store (which v5.0 ships)
- Per-layer `<LiveDataBadge>` reusable component
- Replay speed text readout ("60×") beside timestamp
- Replay window time-range labels at scrubber track ends
- Rewind / reverse playback — disproportionate complexity; simulation layers (street traffic, GPS jamming) have no reverse concept

**Anti-features confirmed as explicitly out of scope:**
- CZML-based replay — ruled out at v2.0 decision log; wrong pattern for snapshot-driven dynamic data at full entity density (hundreds of MB, couples all entity state to CesiumJS clock)
- Sub-minute snapshot resolution — storage cost prohibitive; 60s interval + frontend interpolation is visually acceptable at all 5 speed presets
- Live streaming overlay inside playback — doubles draw calls; no intelligence requirement identified

### Architecture Approach

The architecture is a hub-and-spoke model: `useAppStore` is the single source of truth for `replayMode`, `replayTs`, `replaySpeedMultiplier`, and window bounds. Six layer components and two hooks each need a targeted fix to read from this store at the correct callsite. One new file is required. All other changes are in-place guards added to existing files. The `PlaybackBar.tsx` rAF tick loop and `useReplaySnapshots.ts` hook are reference implementations of the correct patterns and must not be changed.

**Major components and their v5.0 changes:**

1. **`useAppStore.ts`** — add `isPlaying: boolean` and `setIsPlaying` (transient runtime state, not localStorage-persisted; must live in `useAppStore`, not `useSettingsStore`)
2. **`useViewerClock.ts` (NEW)** — single hook: subscribes to `replayMode`/`replayTs`, syncs `viewer.clock.currentTime` and `viewer.clock.shouldAnimate`; mounted in `App.tsx` alongside other layer components
3. **`SatelliteLayer.tsx`** — in rAF loop body, read `replayMode`/`replayTs` via `getState()` each tick; pass `replayTs` to `PROPAGATE` message; skip dispatch when `!isPlaying`
4. **`AircraftLayer.tsx`** — in live lerp loop body, check `replayMode` via `getState()` and `return` early if `'playback'`; loop stays alive for instant resume
5. **`MilitaryAircraftLayer.tsx` + `ShipLayer.tsx`** — add `replayMode` guard to Effect 2 (live data update effect); one line each
6. **`useGpsJamming.ts`** — add `refetchInterval: replayMode === 'live' ? 86_400_000 : false`; same pattern as `useAircraft.ts`
7. **`StreetTrafficLayer.tsx`** — add `replayModeRef`; skip particle position writes and hide particles in `animate()` when `replayMode === 'playback'`
8. **`PlaybackBar.tsx`** — replace local `useState(isPlaying)` with store; add `queryClient.invalidateQueries()` on return to live mode

**No changes required:** `useAppStore.ts` store shape (correct), `useReplaySnapshots.ts` (correct), `propagation.worker.ts` (correct, already accepts `timestamp` param), `PlaybackBar.tsx` rAF tick (correct), `useAircraft.ts` / `useMilitaryAircraft.ts` / `useShips.ts` refetch gating (already correct pattern)

### Critical Pitfalls

1. **Satellite worker callsite hardcodes `Date.now()` despite worker being ready** — `SatelliteLayer.tsx` line 260 unconditionally sends `{ timestamp: Date.now() }`. The fix is one conditional read inside the rAF loop. Never add `replayTs` to the `useEffect` dependency array of a loop — it changes at 60 Hz during playback, causing 60 worker restarts per second and visible satellite flicker.

2. **Live lerp wins every frame over snapshot interpolation — the lerp is not inert** — Both the live lerp (60 Hz rAF) and the snapshot interpolation effect write `bb.position` to the same billboard. The lerp fires every 16ms; the snapshot effect fires only on `replayTs` change. The lerp overwrites the correct historical position within one frame. Gate the lerp body with `getState().replayMode === 'playback'` and return early — do not cancel the rAF loop, keep it alive so it resumes instantly on mode switch.

3. **React Query `refetchInterval: false` does not prevent background refetches** — Window focus triggers a background refetch even when the polling interval is disabled (`refetchOnWindowFocus: true` is React Query's default). If `aircraft.data` updates during playback, Effect 2 resets entity positions to live data, overriding snapshot interpolation. Add a `replayMode` guard as defense in depth inside Effect 2, and add `queryClient.invalidateQueries()` on return to live for immediate data freshness.

4. **`viewer.clock` defaults to real wall-clock time — globe lighting is always "now"** — `GlobeView.tsx` never touches `viewer.clock`. With `enableLighting: true` and `dynamicAtmosphereLighting: true` both set, the globe renders in daylight during a historical 02:00 UTC replay event. Sync `viewer.clock.currentTime` via `useAppStore.subscribe()` or `viewer.scene.postUpdate.addEventListener` — not a React `useEffect` on `replayTs` (fires async relative to Cesium render pipeline, one frame late).

5. **Snapshot interpolation effect runs at 60 Hz at high replay speeds** — At 1h/s, the rAF tick fires 60 `setReplayTs()` calls per second; each triggers `useEffect([replayTs])` in both `AircraftLayer` and `ShipLayer`, causing 60,000 binary searches and `Cartesian3.fromDegrees()` calls per second at 1,000 aircraft. This is not a correctness blocker but is a performance risk. Profile during PLAY-04; only optimise if FPS drops below 30 at 15m/s+.

---

## Implications for Roadmap

Based on combined research, the work splits cleanly into 4 phases. All phases are frontend-only. No backend schema changes, no new npm dependencies, no infrastructure changes.

### Phase 1 — Promote `isPlaying` to Store + Viewer Clock Sync

**Rationale:** `isPlaying` is a hard dependency for the satellite propagation pause gate (PLAY-01), street traffic freeze (PLAY-02e), the snapshot loading indicator, and future keyboard shortcuts. It must be in the store before any other layer can read it. The viewer clock sync is self-contained (new hook, one mount point in `App.tsx`) and delivers the most visually dramatic correctness signal: scrub to a nighttime historical event and the globe goes dark. Confirming `JulianDate.fromDate()` works correctly here de-risks the satellite fix in Phase 2.

**Delivers:**
- `isPlaying` + `setIsPlaying` in `useAppStore` (transient, not persisted)
- `PlaybackBar.tsx` migrated to use store `isPlaying` (no functional change, just source of truth)
- `useViewerClock.ts` hook: CesiumJS day/night shading follows `replayTs`

**Addresses:** BUG-03, PLAY-03 (partial — store promotion)

**Avoids:** Stale `isPlaying` closures in layer components; anti-pattern of syncing `viewer.clock` inside a React `useEffect` that fires outside the Cesium render pipeline

**Research flag:** Standard patterns — no phase research needed

---

### Phase 2 — Satellite Propagation Fix (PLAY-01)

**Rationale:** Satellites are the most visually prominent layer. When PLAY-01 is broken, the "go back in time" premise of the entire feature collapses for users — aircraft appear at historical positions while satellites orbit at present-day orbital positions. This is the highest-leverage single fix in the milestone. The worker infrastructure is already correct; only one callsite changes. Phase 1's `isPlaying` promotion is a prerequisite for the propagation pause gate.

**Delivers:**
- Satellite positions follow `replayTs` during playback
- Propagation loop skips dispatch when `isPlaying === false`
- `COMPUTE_ORBIT` and `GET_POSITION` worker handlers accept optional `timestamp` parameter (fixes orbit ring and fly-to destination during playback)

**Addresses:** PLAY-01, BUG-01, Pitfall 1 and Pitfall 2 (from PITFALLS.md)

**Avoids:** Adding `replayTs` to `useEffect` deps array — would restart worker 60 times per second; use `getState()` inside loop body exclusively

**Research flag:** Standard patterns — all confirmed from codebase and official CesiumJS + satellite.js docs

---

### Phase 3 — Layer Audit: Aircraft, Ships, Military, GPS Jamming, Street Traffic (PLAY-02 + PLAY-03)

**Rationale:** After Phase 2, satellites are correct. This phase fixes the remaining five layers. Aircraft is the most complex (write-ownership conflict between live lerp and snapshot interpolation). Ships and military are LOW complexity (one guard line per Effect 2). GPS jamming and street traffic have no historical data — they need a LIVE badge and freeze, not snapshot wiring. All five are sequential in one phase given their low individual complexity.

**Delivers:**
- Aircraft live lerp gated — snapshot interpolation has exclusive `bb.position` ownership during playback
- Ships and military Effect 2 gated — live poll cache cannot overwrite historical positions even on background refetch
- GPS jamming: `refetchInterval` frozen during playback; amber "LIVE DATA" badge rendered when layer is visible in playback
- Street traffic: `replayModeRef` added; particles hidden during playback (`p.primitive.show = false`)
- `queryClient.invalidateQueries()` on return to live for immediate data freshness (prevents 90-second stale window after mode switch)

**Addresses:** PLAY-02a/b/c/d/e, PLAY-03 (complete), BUG-02, BUG-04, BUG-05, BUG-06, Pitfalls 3, 4, 8, 9

**Avoids:** Two effects simultaneously owning `bb.position`; React Query focus-triggered refetch silently resetting playback positions; street traffic particles moving during paused replay implying live data exists at historical timestamps

**Research flag:** Standard patterns — all confirmed by direct codebase inspection; no novel API usage

---

### Phase 4 — End-to-End Verification + Performance Gate (PLAY-04)

**Rationale:** Replay engine correctness bugs are invisible without a verified test scenario executed across a real data window. This phase defines and executes the acceptance criteria. The performance risk (snapshot interpolation at 1h/s with all layers) is unknown until profiled — if FPS drops below 30, a targeted optimisation is applied here before the milestone closes.

**Delivers:**
- Full scrub test: 2-hour window, all layers active, verified frozen pause, correct entity movement at all speed presets, auto-stop at window end
- Clock sync verification: `viewer.clock.currentTime` confirmed tracking `replayTs` in console
- Write-ownership verification: confirmed single writer of `bb.position` per frame in playback via temporary logging
- React Query invalidation verified: return to live triggers fresh data within 5 seconds (not 90s stale window)
- Snapshot window race condition verified: entering playback immediately on page load does not produce empty layers
- Performance gate: FPS above 30 at 15m/s with aircraft + ships visible; optimisation applied if gate fails
- v5.0 milestone signed off

**Addresses:** PLAY-04, Pitfalls 5, 6, 7 (from PITFALLS.md)

**Avoids:** "Looks done but isn't" failures: satellite drifting when paused; lerp appearing to stop because `alpha` reached 1.0 (not because of the mode guard); stale cache on mode switch showing 90-second-old positions as live

**Research flag:** May need targeted research if FPS gate fails — snapshot interpolation decoupling from React state cadence is a medium-complexity refactor with multiple approaches (dirty flag, rAF-gated batch writes, per-layer throttle); design only after profiling confirms the problem

---

### Phase Ordering Rationale

- Phase 1 before Phase 2: `isPlaying` in the store is a hard dependency for the satellite propagation pause gate and cannot be skipped.
- Phase 2 before Phase 3: The satellite fix is the most user-visible correctness gain and validates the `getState()` inside rAF pattern before it is applied more broadly in Phase 3. It also removes the most confusing visual contradiction (live-orbiting satellites alongside historical aircraft snapshots).
- Phase 3 before Phase 4: All layer fixes must be in place before the end-to-end verification is meaningful. Running PLAY-04 before PLAY-02 would mask which bugs remain.
- Phase 4 last: Verification gates the milestone; performance optimisation is conditional on profiling results not available until all fixes exist.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 4 (if FPS gate fails):** Snapshot interpolation performance refactor. Multiple decoupling approaches exist; the best choice depends on profiling data not available until PLAY-04 runs. Design options: (a) dirty-flag to skip writes when entity didn't cross a snapshot boundary, (b) move position writes out of `useEffect([replayTs])` into a shared rAF callback called once per frame, (c) per-layer throttle that skips write if `replayTs` advanced less than one snapshot interval.

Phases with standard, well-documented patterns (skip research-phase):
- **Phase 1:** `isPlaying` store promotion is 2 lines; `useViewerClock` follows the `useAircraft` hook structure; `JulianDate.fromDate()` confirmed from official CesiumJS docs.
- **Phase 2:** `getState()` inside rAF is the established codebase pattern (`PlaybackBar.tsx` is the reference); `propagate(satrec, new Date(ts))` is confirmed; zero API ambiguity.
- **Phase 3:** Each layer fix is 1–5 lines using patterns already present in the codebase. `refetchInterval` gating mirrors `useAircraft.ts`. `replayModeRef` mirrors `layerVisibleRef` in `StreetTrafficLayer.tsx`.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All APIs verified against official CesiumJS docs and live codebase inspection; no new packages required, eliminating version compatibility risk entirely |
| Features | HIGH | All bugs confirmed by direct line-by-line codebase inspection with specific file and line citations; no inference required; existing correct implementations serve as ground truth |
| Architecture | HIGH | Fix patterns derived from existing correct reference implementations in the same codebase; build order based on actual file dependency graph |
| Pitfalls | HIGH | Every pitfall cites the specific file and line where the bug exists; recovery cost assessed as LOW for 7 of 9 pitfalls; only the performance optimisation (if needed) is MEDIUM |

**Overall confidence:** HIGH

### Gaps to Address

- **`isPlaying` promotion side effects in `PlaybackBar.tsx`:** The local `useState(isPlaying)` is referenced in multiple places within that component (play button UI, auto-stop handler, snapshot loading gate). The migration to store state must be audited for any side effects on the button state, the auto-stop at `windowEnd`, and the `setIsPlaying(false)` call path. LOW risk but requires careful diff review at Phase 1 implementation time.

- **`COMPUTE_ORBIT` and `GET_POSITION` caller locations:** The worker-side changes are trivial (add optional `timestamp` field). The caller sites — the orbit request dispatch and the click-to-fly dispatch in `SatelliteLayer.tsx` — need to be located precisely during Phase 2 implementation. PITFALLS.md confirms these handlers exist at lines 94 and 133 of `propagation.worker.ts`; the caller effect indices in `SatelliteLayer.tsx` should be re-verified.

- **GPS jamming LIVE badge placement:** Two options — hide entirely vs show with amber badge. Research recommends showing with badge (preserves situational awareness). The specific badge component design and placement is left to Phase 3 implementation. For v5.0, an inline conditional render in `GpsJammingLayer.tsx` is sufficient; the reusable `<LiveDataBadge>` component is a v6.0 item.

- **Performance profile baseline unknown:** The snapshot interpolation performance risk at 1h/s is theoretical until measured. No profiling exists. Optimisation must only be designed after PLAY-04 confirms the problem — premature optimisation would add complexity to already-correct effects.

---

## Sources

### Primary (HIGH confidence)

- [CesiumJS Clock API](https://cesium.com/learn/cesiumjs/ref-doc/Clock.html) — `currentTime`, `shouldAnimate`, `canAnimate`, `multiplier`, `clockStep`, `onTick`
- [CesiumJS JulianDate API](https://cesium.com/learn/cesiumjs/ref-doc/JulianDate.html) — `fromDate()`, `fromIso8601()`, `now()`, `toDate()`
- [CesiumJS Scene API](https://cesium.com/learn/cesiumjs/ref-doc/Scene.html) — `preUpdate`, `postUpdate`, `preRender`, `postRender` events; listener parameters; availability since CesiumJS 1.37
- [satellite-js GitHub](https://github.com/shashwatak/satellite-js) — `propagate(satrec, date)` signature accepts `Date` object
- [Zustand `getState()` escape hatch](https://github.com/pmndrs/zustand) — non-React context state access pattern
- **Codebase (direct inspection — highest confidence source):**
  - `SatelliteLayer.tsx` line 260: `timestamp: Date.now()` confirmed hardcoded in PROPAGATE
  - `AircraftLayer.tsx` lines 250–264 (lerp) and 317–338 (snapshot effect): write conflict confirmed
  - `MilitaryAircraftLayer.tsx` Effect 2: missing `replayMode` guard confirmed
  - `ShipLayer.tsx` Effect 2: identical missing guard confirmed
  - `GpsJammingLayer.tsx` + `useGpsJamming.ts`: no replay mode awareness confirmed
  - `StreetTrafficLayer.tsx` lines 152–188: `animate()` has no `replayMode` guard confirmed
  - `GlobeView.tsx`: `viewer.clock` never assigned; `enableLighting: true` set confirmed
  - `PlaybackBar.tsx`: `getState()` pattern and local `isPlaying` state confirmed as reference and gap respectively
  - `propagation.worker.ts` lines 63–88, 94–96, 131–132: worker-side correctness and COMPUTE_ORBIT/GET_POSITION bugs confirmed
  - `useAppStore.ts` line 130: `replayTs: Date.now()` and `replayWindowStart/End: null` initial state confirmed
  - `useReplaySnapshots.ts`: correct `enabled` flag, `staleTime: Infinity`, binary-search sort guarantee confirmed

### Secondary (MEDIUM confidence)

- [Flightradar24 playback blog](https://www.flightradar24.com/blog/inside-flightradar24/playback-is-now-available-in-the-flightradar24-app/) — competitor single-layer replay UX reference; confirms Intelligence Globe's multi-layer sync is a genuine differentiator with no free-tool equivalent
- [FlightAware Flight Replay introduction](https://blog.flightaware.com/201710-introducing-flight-replay-and-track-visualization) — competitor speed control patterns

---

*Research completed: 2026-03-13*
*Ready for roadmap: yes*
