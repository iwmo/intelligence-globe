# Pitfalls Research

**Domain:** 4D Replay Engine — retrofitting playback correctness into an existing CesiumJS + React + Zustand + satellite.js Web Worker stack (v5.0 Playback)
**Researched:** 2026-03-13
**Confidence:** HIGH — all findings are grounded in direct inspection of the live codebase; every pitfall cites the specific file and line where the bug or risk exists

---

## Critical Pitfalls

### Pitfall 1: Worker `PROPAGATE` loop hardcodes `Date.now()` — ignores `replayTs`

**What goes wrong:**
`SatelliteLayer.tsx` Effect 1, line 260 always sends:
```
worker.postMessage({ type: 'PROPAGATE', payload: { timestamp: Date.now() } });
```
`replayTs` is read from the store (line 115) and correctly wired to overpass dispatch and staleness checks, but is never passed to the 1 Hz `PROPAGATE` message. In playback mode, satellites continue orbiting at real-world current time while every other layer shows historical data. The globe shows aircraft at a past snapshot position while satellites orbit at the current moment — visually incoherent.

The worker already accepts the timestamp correctly: it creates `new Date(timestamp)` from the payload. The entire worker side is correct. Only the caller is broken.

**Why it happens:**
The `loop()` rAF function was written before the replay store slice existed and was never updated. The `PROPAGATE` contract has accepted an external timestamp from day one, but the caller never wired `replayTs` into it.

**How to avoid:**
Inside the `loop()` function, replace `Date.now()` with a conditional read via `getState()`:
```
const { replayMode, replayTs } = useAppStore.getState();
const ts = replayMode === 'playback' ? replayTs : Date.now();
worker.postMessage({ type: 'PROPAGATE', payload: { timestamp: ts } });
```
Use `getState()` inside the rAF callback, never a closure-captured variable. This is the pattern already used by `PlaybackBar.tsx` tick() function for the same reason.

**Warning signs:**
- Satellites continue orbiting while the scrubber is paused at a past timestamp
- Overpass arc lines point to correct historical satellite positions but the rendered satellite dot is elsewhere
- `Date.now() !== replayTs` while paused in playback — satellite dot and overpass arc disagree

**Phase to address:** PLAY-01 (Satellite propagation uses `replayTs` in playback mode)

---

### Pitfall 2: Worker `COMPUTE_ORBIT` and `GET_POSITION` hardcode `Date.now()` / `new Date()` — no virtual clock path exists in the worker for these handlers

**What goes wrong:**
Two worker message handlers bypass the timestamp entirely:

- `COMPUTE_ORBIT` (propagation.worker.ts line 94): `const now = Date.now();` — orbit path is always computed from real time, not replay time
- `GET_POSITION` (propagation.worker.ts line 133): `const now = new Date();` — satellite fly-to destination is always computed from real time

During playback, clicking a satellite to fly to it sends `GET_POSITION`, which propagates the satellite to where it is now, not where it was at the scrubber timestamp. The camera flies to the wrong location. Similarly, the orbit ring displayed when a satellite is selected shows the future orbit path, not the orbit path at the replay moment.

**Why it happens:**
Both message types predate the replay slice. Only `PROPAGATE` was designed to accept an external timestamp. The worker has no concept of a virtual clock — it simply calls `Date.now()` or `new Date()` wherever time is needed.

**How to avoid:**
Add an optional `timestamp?: number` field to both message payload types. Worker handlers fall back to `Date.now()` when `timestamp` is absent (backward-compatible). Callers in playback mode pass `useAppStore.getState().replayTs`. The fix is a two-line change per handler: replace `const now = Date.now()` with `const now = payload.timestamp ?? Date.now()`.

**Warning signs:**
- Orbit ring around a selected satellite doesn't align with the satellite's replayed position
- Camera fly-to on satellite click in playback mode targets the satellite's current real-world position, not its historical position
- `POSITION_RESULT.position` diverges from the corresponding `POSITIONS.buf` entry for the same NORAD ID when in playback

**Phase to address:** PLAY-01

---

### Pitfall 3: Live lerp loop in `AircraftLayer` continues running in playback mode — fights the snapshot interpolation effect

**What goes wrong:**
`AircraftLayer.tsx` Effect 2 (lines 250–264) starts a rAF lerp loop that runs unconditionally whenever `aircraft.data` changes. It writes `bb.position` on every animation frame using `Cartesian3.lerp()` between the previous and current live data positions.

The playback snapshot interpolation effect (lines 317–338) separately writes `bb.position` on every `replayTs` change, setting the correct historical position.

Both effects write to the same `bb.position` field. On every rAF frame:
1. Snapshot effect: sets correct historical position (runs when `replayTs` changes)
2. Lerp loop: overwrites it with the live lerp position (runs every 16ms)

Result: aircraft positions continuously snap back to live data during playback. The correct snapshot position is visible for one frame, then immediately overwritten. At 60 FPS, this appears as a rapid oscillation or as the aircraft permanently stuck at the live position.

**Why it happens:**
The lerp loop has no mode awareness. `rafRunningRef.current = true` is set unconditionally in Effect 2 when `aircraft.data` arrives. The snapshot effect was added as an additive fix, assuming the lerp loop would be inert — it is not, because `aircraft.data` continues updating in playback mode (refetchInterval only stops polling; it doesn't clear cached data from React Query).

**How to avoid:**
Add a mode check inside the `lerp()` function body using `getState()`:
```
function lerp() {
  if (!rafRunningRef.current) return;
  if (useAppStore.getState().replayMode === 'playback') {
    // Snapshot effect owns bb.position in playback — lerp yields.
    rafRef.current = requestAnimationFrame(lerp);
    return;
  }
  // ... existing lerp logic
}
```
This preserves the rAF loop structure (avoids unmount/remount on mode switch) while guaranteeing the lerp never writes position in playback mode. Do not add `replayMode` to Effect 2's dependency array — that would restart the entire billboard setup on every mode toggle.

An equivalent approach is to check `rafRunningRef.current` as a tri-state: `null` (unstarted), `true` (live), `false` (paused). But the single `getState()` call inside the loop is simpler and matches the existing pattern used by `PlaybackBar.tsx`.

**Warning signs:**
- Aircraft positions flash at correct replay location for one frame, then snap back to live position
- During playback with aircraft layer visible: scrubbing the timeline causes aircraft to briefly move, then return to their live coordinates
- DevTools animation profiler shows two simultaneous writes to the same Cesium primitive position each frame

**Phase to address:** PLAY-03 (Live lerp guards)

---

### Pitfall 4: `useAircraft` / `useShips` `refetchInterval: false` stops polling but does NOT invalidate the cache — stale live data persists after switching back to live mode

**What goes wrong:**
`useAircraft` sets `refetchInterval: replayMode === 'live' ? 90_000 : false`. This correctly stops the polling interval when in playback. However, `staleTime: 90_000` means the cached live positions are still considered fresh for 90 seconds from when they were last fetched. When the user switches back to live mode, React Query resumes the polling interval but does not immediately trigger a refetch — it waits until `staleTime` expires.

Consequence: for up to 90 seconds after returning to live mode, the aircraft displayed on the globe are from a snapshot up to 90 seconds old. For ships (`staleTime: 30_000`), the window is 30 seconds. The globe appears "live" (the LIVE label is shown, no indicators suggest staleness) but the data is not current.

There is a second issue: on switching to playback mode, `aircraft.data` from the React Query cache is still present and non-null. Effect 2 in `AircraftLayer` fires on `aircraft.data` change. If React Query performs a background refetch during playback (it may, since `staleTime` will eventually expire), Effect 2 runs again, shifting `prevPositions`/`currPositions` and restarting the lerp loop with new live data.

**Why it happens:**
React Query's `refetchInterval` controls only the polling timer. `staleTime` and the cache are orthogonal. Developers assume that `refetchInterval: false` also freezes the cache — it does not. Background refetches triggered by window focus or cache invalidation events can still fire.

**How to avoid:**
In `PlaybackBar.tsx`'s `handleModeToggle` function (line 123), add explicit cache invalidation on returning to live mode:
```
import { useQueryClient } from '@tanstack/react-query';
// Inside component:
const queryClient = useQueryClient();

function handleModeToggle() {
  if (replayMode === 'playback') {
    setIsPlaying(false);
    setReplayMode('live');
    useAppStore.getState().setReplayTs(Date.now());
    // Force immediate refetch of live data
    queryClient.invalidateQueries({ queryKey: ['aircraft'] });
    queryClient.invalidateQueries({ queryKey: ['ships'] });
    queryClient.invalidateQueries({ queryKey: ['military'] });
  } else {
    setReplayMode('playback');
  }
}
```
Use `invalidateQueries` rather than `removeQueries`. `removeQueries` clears the cache, causing a loading state flash. `invalidateQueries` marks the cache stale and triggers a background refetch while the existing data continues to render.

**Warning signs:**
- Aircraft positions after returning to live mode don't match current positions for 60–90 seconds
- Ship positions frozen at playback-era coordinates after mode switch
- No visible loading state or staleness indicator despite data being up to 90 seconds old on return to live

**Phase to address:** PLAY-02 (Layer audit: no live movement in playback), PLAY-04 (End-to-end verification)

---

### Pitfall 5: `replayTs` initialises to `Date.now()` at store creation — snapshot window starts as `null` — race condition on immediate mode switch

**What goes wrong:**
`useAppStore.ts` line 130: `replayTs: Date.now()`. The replay window (`replayWindowStart`, `replayWindowEnd`) starts as `null`. `useReplaySnapshots` is enabled when `replayMode === 'playback'`, but `windowStart`/`windowEnd` are `null` until `PlaybackBar` mounts and the `/api/replay/window` fetch resolves.

If the user clicks "PLAYBACK" before that fetch completes — for example, immediately after page load — `useReplaySnapshots` is enabled with `null` params. The `queryFn` guard `if (!windowStart || !windowEnd) return new Map()` handles this gracefully (no crash), but the snapshot Map is empty. All aircraft/ship billboards have no snapshot data and display nothing in playback mode.

The window fetch is in a `useEffect` with no debounce or explicit loading state. On slow connections or cold Docker starts, the fetch takes several seconds. The PLAYBACK button is not disabled during this window.

**Why it happens:**
`PlaybackBar` initiates the window fetch on mount; if the user enters playback before mount completes (or before the fetch resolves), the precondition for snapshot availability is not met. There is no guard on the PLAYBACK toggle button.

**How to avoid:**
Disable the PLAYBACK toggle button until `replayWindowStart !== null && replayWindowEnd !== null`. Show a loading indicator in the PlaybackBar during the window fetch. Both are purely UX guards — the data layer already handles `null` window gracefully. The alternative (pre-fetching the window in a global effect outside `PlaybackBar`) would work but adds complexity.

**Warning signs:**
- Clicking PLAYBACK immediately on app load results in empty aircraft/ship layers
- Layers repopulate several seconds later without user action (window fetch resolved)
- "No historical data" message appears briefly, then layers appear (correct recovery, but jarring)

**Phase to address:** PLAY-04 (End-to-end verification)

---

### Pitfall 6: CesiumJS `viewer.clock` is never wired to `replayTs` — day/night shading and atmosphere reflect current real time, not replay time

**What goes wrong:**
`GlobeView.tsx` creates the viewer with `useDefaultRenderLoop: true` and never modifies `viewer.clock`. CesiumJS drives its day/night shading, atmosphere colour, and shadow direction from `viewer.clock.currentTime` (a `JulianDate`). The clock ticks in real time by default.

`viewer.scene.globe.enableLighting = true` and `dynamicAtmosphereLighting = true` are both set (GlobeView.tsx lines 70–71). This means the globe appearance is visually driven by the real-world current time, not by `replayTs`. During playback of a historical event at night (e.g. a 02:00 UTC event), the globe may render in daylight if the current real-world time is 14:00 UTC.

The PROJECT.md key decisions explicitly state "LIVE/PLAYBACK drives viewer.clock directly" as the intended pattern — it is not yet implemented.

**Why it happens:**
`viewer.clock` synchronisation requires a `JulianDate` conversion from a Unix ms timestamp. This was deferred from v2.0 when the replay UI was added. The custom React `PlaybackBar` advances `replayTs` in Zustand but has no integration with the Cesium clock object.

**How to avoid:**
Subscribe to Zustand `replayTs` + `replayMode` changes and propagate them to `viewer.clock`. Use `useAppStore.subscribe()` (external Zustand subscriber) rather than a `useEffect`, to avoid triggering React re-renders on every `replayTs` change:
```
// In GlobeView.tsx, after viewer is created:
import { JulianDate } from 'cesium';
const unsub = useAppStore.subscribe(
  state => ({ mode: state.replayMode, ts: state.replayTs }),
  ({ mode, ts }) => {
    if (!viewer || viewer.isDestroyed()) return;
    if (mode === 'playback') {
      viewer.clock.currentTime = JulianDate.fromDate(new Date(ts));
      viewer.clock.shouldAnimate = false;
    } else {
      viewer.clock.shouldAnimate = true;
      viewer.clock.multiplier = 1;
    }
  },
  { equalityFn: (a, b) => a.mode === b.mode && a.ts === b.ts }
);
```
The `JulianDate.fromDate(new Date(replayTs))` conversion is the correct path — never divide by 1000 manually; `JulianDate.fromDate()` handles the epoch.

**Warning signs:**
- Scrubbing to a historical nighttime event: globe renders in daytime (or vice versa)
- Day/night terminator line position doesn't match the replay timestamp date
- `viewer.clock.currentTime` when logged in playback mode returns the current real-world time, not the `replayTs`-derived time

**Phase to address:** PLAY-04 (End-to-end verification)

---

### Pitfall 7: Snapshot interpolation effect runs on every Zustand `replayTs` write — at 1h/s, this saturates the main thread

**What goes wrong:**
The playback snapshot effect in `AircraftLayer` (lines 317–338) and `ShipLayer` (lines 138–159) runs on every `replayTs` change. At 1h/s replay speed, the `PlaybackBar` rAF loop advances `replayTs` by 3600 virtual seconds per real second, firing 60 `setReplayTs()` calls per second (60 FPS). Each call triggers the snapshot interpolation effect in both layers.

Each effect iterates all entities in `billboardsByIcao24` (potentially thousands) and computes `findAdjacentSnapshots` + lerp per entity. At 60 Hz with 1,000 aircraft: 60,000 binary searches and 60,000 `Cartesian3.fromDegrees()` calls per second on the main thread.

CesiumJS must consume all those position writes in its render loop. Above approximately 500 aircraft at 15m/s speed, frame rate visibly drops. At 1h/s with both layers, it can fall to single digits.

**Why it happens:**
React `useEffect` runs synchronously on every state change that matches its dependency array. `replayTs` changes at the rAF frame rate, making the effect fire at rAF cadence. The effect was designed for correctness, not for render-loop integration.

**How to avoid:**
Decouple the "time tick" (advancing `replayTs` in Zustand at rAF speed) from the "position render" (writing `bb.position` to CesiumJS primitives at render cadence). One approach: convert the snapshot position computation into a per-frame operation driven by the rAF loop in `PlaybackBar`, which could call a shared `updateEntityPositions(replayTs)` function once per frame rather than relying on `useEffect` re-runs. Alternatively, add a dirty flag — only recompute positions when `replayTs` has changed by more than one snapshot interval (60,000ms) since the last write.

For the current milestone scope (audit and fix correctness), the performance issue only manifests at 15m/s+ with many entities. The correctness fix (wiring `replayTs` to the snapshot effect) should be done first. Performance optimisation is a secondary concern unless it causes visible FPS regression during end-to-end verification.

**Warning signs:**
- FPS drops from 60 to below 30 when playing at 15m/s with aircraft and ships both visible
- Chrome DevTools shows main thread blocked by "React state update" and "Cesium render" interleaved at high frequency
- CPU usage saturates a single core during 1h/s playback (not GPU — this is CPU-bound)

**Phase to address:** PLAY-04 (End-to-end verification) — profile during validation and apply optimisation if FPS drops below 30 at 15m/s

---

### Pitfall 8: `AircraftLayer` Effect 2 writes `bb.position` from live data even when `replayMode === 'playback'` — live data falls through

**What goes wrong:**
`AircraftLayer.tsx` Effect 2 (lines 202–266) runs whenever `aircraft.data` changes. It unconditionally sets `prevPositions`, `currPositions`, and starts the lerp loop. There is no `replayMode` guard.

`useAircraft` has `refetchInterval: replayMode === 'live' ? 90_000 : false`, which stops polling in playback. However, `aircraft.data` may still change in playback mode due to:
1. A background refetch triggered by window focus events (React Query default behaviour)
2. A cache invalidation triggered elsewhere in the app
3. An in-flight request that was initiated just before switching to playback

When Effect 2 fires in playback mode, it resets `prevPositions` and `currPositions` to the live positions and starts (or restarts) the lerp loop — immediately showing live aircraft positions on the globe and overriding any historical positions set by the snapshot effect.

**Why it happens:**
Effect 2's dependency array is `[viewer, aircraft.data]`. Adding `replayMode` to this array would make Effect 2 fire on mode changes, which would reset billboard state — undesirable. The solution is not to add a dep but to guard position writes inside the effect body.

**How to avoid:**
Add an early return guard at the start of the live data processing section of Effect 2:
```
if (useAppStore.getState().replayMode === 'playback') return;
```
This prevents live position data from being written to `prevPositions`/`currPositions` when in playback. The lerp loop start is also gated by this check. The billboard setup (adding new aircraft to the collection) can still proceed — it only needs to be guarded for position writes.

**Warning signs:**
- Switching to playback mode causes aircraft to jump to their live positions after a few seconds (background refetch fired)
- During playback, restoring window focus causes an aircraft position reset (React Query `refetchOnWindowFocus: true` default)
- Aircraft layer shows live positions intermittently during otherwise-correct playback

**Phase to address:** PLAY-02 (Layer audit), PLAY-03 (Lerp guards)

---

### Pitfall 9: GPS jamming and street traffic layers have no playback mode — they show live data or nothing during replay, with no indication to the user

**What goes wrong:**
`GpsJammingLayer` reads from `useGpsJamming()` which polls a live endpoint with no `replayMode` gate. During playback, the jamming heatmap continues to show current live jamming data, not historical jamming data. There are no GPS jamming snapshots in the snapshot infrastructure.

`useStreetTraffic` is viewport-driven and has no mode awareness. The street traffic particle simulation runs identically in both live and playback modes.

Neither layer displays any indication that it is showing live data during playback. The user sees the PLAYBACK scrubber positioned at a past time, but the jamming heatmap and street traffic reflect the current moment.

**Why it happens:**
Both layers were built without replay support. The snapshot infrastructure only covers aircraft, military, and ships (`layer: 'aircraft' | 'military' | 'ship' | 'all'`). GPS jamming and street traffic were out-of-scope for the replay architecture.

**How to avoid:**
Two options:
1. **Hide the layers in playback mode**: Add a `replayMode` check in `GpsJammingLayer` and `StreetTrafficLayer` — if `replayMode === 'playback'`, return null (hide the layer entirely). Display a note in the PlaybackBar or layer panel: "GPS jamming and street traffic not available in playback."
2. **Show with a staleness banner**: Keep the layers visible but add a visual indicator ("LIVE DATA — no historical replay"). This maintains situational awareness but clearly labels the data as non-historical.

Option 1 is simpler and avoids showing temporally inconsistent data silently. Option 2 is better UX if the user may want approximate context.

**Warning signs:**
- GPS jamming layer visible during playback of a past event where no jamming occurred — user may incorrectly correlate current jamming with the past event
- Street traffic particles animating during paused playback — any motion in a "paused" state is surprising

**Phase to address:** PLAY-02 (Layer audit: no live movement in playback)

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| `useAppStore.getState()` inside rAF callbacks | No stale closure; no deps to manage | Pattern must be applied consistently — missing one read causes subtle staleness bugs | Acceptable — it is the established pattern in this codebase |
| `staleTime: Infinity` for snapshot data | Prevents duplicate fetches during playback | If the user changes the replay window mid-session, old snapshot data is served silently | Acceptable when the window is fixed at session start; add explicit invalidation if the window can change |
| Module-scope `billboardsByIcao24` Map | Zero GC pressure; fast iteration | Map must be cleared on unmount; fails visibly under React Strict Mode double-mount without the `.clear()` call | Acceptable — unmount cleanup already calls `.clear()` |
| Live lerp yield (continue rAF loop, skip writes) | Trivial mode guard; avoids rAF restart overhead | One wasted rAF callback per frame in playback | Acceptable for a single-user homelab tool |
| `refetchInterval: false` in playback without explicit invalidation | No redundant network calls in playback | Stale live data on return to live; requires `invalidateQueries` at mode switch | Never acceptable without the corresponding `invalidateQueries` on mode exit |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| satellite.js `propagate()` + replay | Caller uses `Date.now()` even though worker accepts `timestamp` in payload | Always pass `timestamp` from `replayTs` in playback; worker uses `new Date(timestamp)` — the worker side is already correct |
| CesiumJS `viewer.clock` + Zustand `replayTs` | Using a `useEffect` on `replayTs` that triggers a React re-render cycle every 16ms | Use `useAppStore.subscribe()` at the viewer-mount scope; fires on state change without causing re-renders |
| React Query `refetchInterval: false` | Assuming this flushes the cache or prevents background refetches | `refetchInterval: false` only stops the timer; `refetchOnWindowFocus: true` (React Query default) still triggers refetches on focus; must use `invalidateQueries` on mode switch |
| `JulianDate` + Unix ms timestamp | Manually dividing `replayTs` by 1000 to convert ms to seconds before passing to CesiumJS | `JulianDate.fromDate(new Date(replayTs))` handles epoch conversion correctly; do not pass raw ms to JulianDate constructors |
| `Float64Array` Transferable + replay | Sending the same buffer twice after it has been transferred (detached) | The worker creates a fresh `Float64Array` on each `PROPAGATE` call; replay does not change this — the buffer is always fresh on the worker side |
| `findAdjacentSnapshots` binary search | Calling it with an unsorted array (returns incorrect bracket) | `useReplaySnapshots.ts` guarantees sort order via `arr.sort((a,b) => a.ts - b.ts)` at fetch time; do not skip this sort step in any future snapshot consumer |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Snapshot effect iterates all entities on every `replayTs` write | FPS collapses at 15m/s+ with 500+ entities | Decouple position writes from Zustand state change cadence; use rAF-gated updates | Above ~500 aircraft at 15m/s replay speed |
| `useReplaySnapshots` fetches all layers simultaneously | Network and memory spike when entering playback with multiple layers | Fetch per-layer only when that layer is visible; `enabled` already gated on `replayMode` but not on `layerVisible` | When aircraft + ships + military all visible and all snapshot data fetched at once |
| Both `PlaybackBar` rAF loop and `AircraftLayer` lerp rAF loop running in playback | Two rAF loops active; snapshot effect triggers on every frame | Yield in lerp loop during playback (do not cancel; just skip writes) | Acceptable overhead for two loops; avoid adding a third per additional layer |
| `billboardsByIcao24` iteration in snapshot effect with no dirty guard | 1000 billboard updates per frame regardless of whether any entity moved | Add a skip-if-same guard using a tolerance epsilon on position | Only matters at 1h/s with thousands of entities; not a blocking correctness issue |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| No visual feedback that satellite positions reflect current real time in playback | User correlates satellite positions with the replay event incorrectly | Show a "SATELLITES: LIVE" badge on the satellite layer toggle when in playback, until PLAY-01 is fixed |
| Live data falls through to globe in playback | User sees present-day aircraft while scrubber shows 2 hours ago | Display a "LIVE DATA" watermark if any layer is serving non-historical data in playback mode |
| GPS jamming / street traffic continue updating in playback | User may correlate current jamming with a past event | Hide these layers in playback, or show a "LIVE — no history" label |
| Returning to live mode shows 90-second-old aircraft | The mode toggle implies "now" but data is from up to 90s ago | Trigger immediate `invalidateQueries` on mode switch; show a loading indicator until fresh data arrives |
| Scrubber initialises to window end (most recent data), not window start | User lands at the end of the recorded window; scrubbing feels backwards | Consider initialising to `replayWindowStart` (beginning of window) or showing a prominent "you are at the end of recording" label |

---

## "Looks Done But Isn't" Checklist

- [ ] **Satellite propagation in playback:** The `PROPAGATE` message fires — but verify `payload.timestamp === replayTs` (not `Date.now()`) when paused. Log both values in the console.
- [ ] **Lerp loop guard:** Aircraft appear stationary in playback — but confirm the lerp loop is yielding, not that `alpha` reached 1.0 naturally (which would also stop visible movement but for the wrong reason).
- [ ] **React Query invalidation:** `refetchInterval: false` is set in playback — but verify that returning to live mode triggers a fetch within 5 seconds, not 90 seconds.
- [ ] **CesiumJS clock sync:** Day/night shading changes when scrubbing — but log `viewer.clock.currentTime.toString()` in the console; it must differ from the current real-world time when scrubber is in the past.
- [ ] **Snapshot data availability:** Snapshot effect runs in playback — but verify `snapshotsByEntity.size > 0`. Log it on first render in playback. An empty Map silently skips all interpolation with no error.
- [ ] **Lerp vs snapshot ownership:** Verify there is only one writer of `bb.position` per frame in playback mode. Add temporary logging to confirm the lerp loop yields and the snapshot effect is the sole writer.
- [ ] **Window boundary auto-stop:** When `replayTs` reaches `replayWindowEnd`, `isPlaying` becomes `false` — verify `replayMode` remains `'playback'` (does not auto-reset to `'live'`).
- [ ] **GPS jamming / street traffic in playback:** Both layers should either disappear or show a "LIVE DATA" label — verify one of these outcomes, not silent serving of live data alongside historical aircraft.

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| `PROPAGATE` uses `Date.now()` | LOW | One-line conditional in `SatelliteLayer.tsx` loop; no structural change |
| `COMPUTE_ORBIT` / `GET_POSITION` use current time | LOW | Add optional `timestamp` field to worker message payloads; two-line change per handler |
| Lerp loop fights snapshot effect | LOW | Add 3-line yield guard inside existing `lerp()` function; no rAF restructure |
| React Query cache stale on mode switch | LOW | Add `queryClient.invalidateQueries()` calls to `handleModeToggle` in PlaybackBar |
| CesiumJS clock not synced to `replayTs` | LOW | Add `useAppStore.subscribe()` callback in GlobeView after viewer creation; one-time wiring |
| Live data falls through to playback via Effect 2 | LOW | Add `replayMode` guard at top of live-data section in Effect 2; one-line check |
| GPS jamming / street traffic show live data in playback | LOW | Add `if (replayMode === 'playback') return null` to respective layer components |
| Snapshot effect perf at high speed | MEDIUM | Refactor position writes to a shared rAF loop; adds coordination complexity across layers |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| `PROPAGATE` uses `Date.now()` | PLAY-01: Satellite propagation audit | Pause at T-2h; satellite dots must hold their orbital position without drifting |
| `COMPUTE_ORBIT` / `GET_POSITION` use current time | PLAY-01: Satellite propagation audit | Click satellite in playback; orbit ring must align with the replayed dot position |
| Lerp loop fights snapshot effect | PLAY-03: Lerp guard audit | Scrub to T-1h; aircraft must not snap to live position between frames |
| React Query cache stale on mode switch | PLAY-02 + PLAY-04: Layer audit + E2E | Switch live → playback → live; aircraft must match current OpenSky data within 10 seconds |
| Snapshot window unavailable race condition | PLAY-04: E2E verification | Enable playback immediately on page load; layers must not go blank |
| CesiumJS clock not synced | PLAY-04: E2E verification | Scrub to 02:00 UTC event; globe must show night-side shading |
| Live data falls through via Effect 2 | PLAY-02: Layer audit | Background refetch during playback must not reset aircraft positions |
| GPS jamming / street traffic during playback | PLAY-02: Layer audit | Enter playback; GPS jamming layer must hide or show "LIVE DATA" label |
| Snapshot effect perf at high speed | PLAY-04: E2E verification | Play at 1h/s with aircraft + ships visible; FPS must stay above 30 |

---

## Sources

- Direct inspection: `frontend/src/workers/propagation.worker.ts` — `PROPAGATE` handler uses passed `timestamp` correctly (line 64–65); `COMPUTE_ORBIT` uses `Date.now()` (line 94); `GET_POSITION` uses `new Date()` (line 133)
- Direct inspection: `frontend/src/components/SatelliteLayer.tsx` lines 258–264 — rAF loop sends `{ timestamp: Date.now() }` unconditionally, ignoring `replayTs` read at line 115
- Direct inspection: `frontend/src/components/AircraftLayer.tsx` lines 250–264 — lerp loop has no `replayMode` guard; lines 317–338 — snapshot effect runs independently on every `replayTs` change
- Direct inspection: `frontend/src/hooks/useAircraft.ts` — `refetchInterval: replayMode === 'live' ? 90_000 : false`; no cache invalidation on mode switch
- Direct inspection: `frontend/src/components/PlaybackBar.tsx` lines 84–110 — tick() uses `getState()` correctly as the reference pattern; lines 123–132 — `handleModeToggle` has no `invalidateQueries` call
- Direct inspection: `frontend/src/components/GlobeView.tsx` — `viewer.clock` never assigned; `enableLighting: true` and `dynamicAtmosphereLighting: true` set at lines 70–71; `useDefaultRenderLoop: true` (line 62)
- Direct inspection: `frontend/src/hooks/useReplaySnapshots.ts` — `enabled` gated on `replayMode === 'playback'` but not on `layerVisible`; `staleTime: Infinity` intentional for immutable snapshot history
- Direct inspection: `frontend/src/store/useAppStore.ts` line 130 — `replayTs: Date.now()` at store creation; `replayWindowStart/End: null` until PlaybackBar window fetch resolves
- PROJECT.md key decisions: "LIVE/PLAYBACK drives viewer.clock directly" — confirmed as intended pattern (not yet implemented)
- CesiumJS API: `JulianDate.fromDate(date: Date)` is the correct conversion from JS Date to CesiumJS Julian date; `viewer.clock.shouldAnimate = false` freezes the internal clock tick
- Zustand documentation: `store.subscribe(selector, callback, options)` fires without causing React re-renders — preferred over `useEffect` for high-frequency external synchronisation

---
*Pitfalls research for: 4D replay engine audit — CesiumJS + React + Zustand + satellite.js (v5.0 Playback)*
*Researched: 2026-03-13*
