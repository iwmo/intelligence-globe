# Phase 24: Satellite Propagation Fix — Research

**Researched:** 2026-03-13
**Domain:** CesiumJS satellite propagation loop, satellite.js SGP4, Zustand store integration
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| PLAY-02 | Satellites propagate at `replayTs` during playback; propagation loop skips dispatch when `isPlaying` is false | Three precise code mutations identified: loop timestamp source, pause guard, orbit/fly-to timestamp source — all verified by direct source inspection |
</phase_requirements>

---

## Summary

Phase 24 is a targeted three-file surgery: `SatelliteLayer.tsx`, `propagation.worker.ts`, and their associated tests. No new dependencies are needed. No architectural redesign is required.

The satellite propagation system already works correctly for live mode. It uses `satellite.js` (`propagate(satrec, date)`) in a Web Worker that receives `{ type: 'PROPAGATE', payload: { timestamp: ... } }` messages from a `requestAnimationFrame` loop in `SatelliteLayer.tsx`. The problem is that the loop unconditionally passes `Date.now()` as the timestamp — it never reads `replayTs` from the store. Additionally, the loop fires at 1 Hz regardless of whether `isPlaying` is `true` or `false`, causing satellites to keep moving even when the user has pressed pause.

Three code locations require changes:

1. **Propagation loop timestamp** (`SatelliteLayer.tsx` line 261): `Date.now()` must become `useAppStore.getState().replayTs` when `replayMode === 'playback'`, and stay `Date.now()` in live mode. The loop must also skip `postMessage` when `isPlaying` is `false` and mode is `'playback'`.

2. **`COMPUTE_ORBIT` timestamp** (`propagation.worker.ts` line 94): `const now = Date.now()` must be replaced with the timestamp passed in via payload. The component must send `replayTs` (or `Date.now()` in live mode) in the `COMPUTE_ORBIT` message so the orbit ring reflects the correct historical epoch.

3. **`GET_POSITION` timestamp** (`propagation.worker.ts` line 133): `const now = new Date()` must be replaced with the payload timestamp. The component must send `replayTs` (or `Date.now()` in live mode) in the `GET_POSITION` message so the click-to-fly destination matches the replay position.

**Primary recommendation:** Read `useAppStore.getState()` inside the rAF loop (never close over store values) — the same pattern already established by `useViewerClock` and the aircraft lerp loop. Pass `replayTs` through message payloads to the worker rather than having the worker call `Date.now()`.

---

## Standard Stack

### Core (all already installed — zero new dependencies)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| satellite.js | already in package.json | SGP4 propagation via `propagate(satrec, date)` | Already the project's propagation engine; `date` argument accepts any `Date` object |
| zustand | 5.0.11 | `useAppStore.getState()` inside rAF loop | Established pattern for reading mutable values in rAF without stale closures |
| vitest | 4.0.18 | Unit tests for loop behaviour and worker message handling | Project test framework |

### No New Dependencies

All packages are already in `package.json`. The fix is purely about what timestamps are passed to existing functions.

---

## Architecture Patterns

### Pattern 1: Store-Sourced Timestamp in rAF Loop

**What:** The rAF `loop()` function in `SatelliteLayer.tsx` (Effect 1) calls `useAppStore.getState()` every tick to read the current `replayMode`, `replayTs`, and `isPlaying`. It never closes over these values.

**Verified precedent:** The `useViewerClock` hook (Phase 23, `frontend/src/hooks/useViewerClock.ts` line 19) uses exactly this pattern: `const { replayMode, replayTs } = useAppStore.getState()` inside an event handler that fires every frame. The aircraft lerp loop (other layer components) also uses `getState()` in `tick()`.

**Required loop logic:**

```typescript
// Inside SatelliteLayer.tsx Effect 1, replace lines 257-265:
let lastProp = 0;
function loop(ts: number) {
  const { replayMode, replayTs, isPlaying } = useAppStore.getState();
  // In playback mode, skip propagation when paused
  if (replayMode === 'playback' && !isPlaying) {
    rafRef.current = requestAnimationFrame(loop);
    return;
  }
  if (ts - lastProp > 1000) {
    const timestamp = replayMode === 'playback' ? replayTs : Date.now();
    worker.postMessage({ type: 'PROPAGATE', payload: { timestamp } });
    lastProp = ts;
  }
  rafRef.current = requestAnimationFrame(loop);
}
rafRef.current = requestAnimationFrame(loop);
```

**Why keep the rAF alive in paused state:** Returning early inside the loop (not cancelling `requestAnimationFrame`) is the same pattern the aircraft lerp loop uses (STATE.md: "Aircraft lerp loop must stay alive in playback (return early, not cancel rAF) — enables instant resume without loop restart"). Cancelling and restarting the rAF on `isPlaying` changes would require a new `useEffect` dependency, risking stale closures and worker reinitialisation.

### Pattern 2: Timestamp via Message Payload — No `Date.now()` in Worker

**What:** The worker must never call `Date.now()` or `new Date()` on its own. The main thread owns the clock; the worker receives timestamps as message payload. This is the correct separation of concerns.

**`COMPUTE_ORBIT` fix** (`propagation.worker.ts` lines 91-115):

The current handler ignores any timestamp in the payload and calls `const now = Date.now()`. The orbit ring loops from `now` forward, so in playback mode it shows the orbit from wall-clock time, not from the replay position. Fix: add `timestamp?: number` to the `ComputeOrbitMessage` payload type; use `const now = payload.timestamp ?? Date.now()`.

The component's Effect 2 (selectedId watcher, `SatelliteLayer.tsx` lines 306-318) sends `COMPUTE_ORBIT` without a timestamp. It must read `replayTs` from the store before posting:

```typescript
// SatelliteLayer.tsx Effect 2 — add timestamp to postMessage:
const { replayMode, replayTs } = useAppStore.getState();
const orbitTimestamp = replayMode === 'playback' ? replayTs : Date.now();
workerRef.current.postMessage({
  type: 'COMPUTE_ORBIT',
  payload: { omm: sat.omm, periodSeconds, timestamp: orbitTimestamp },
});
```

**`GET_POSITION` fix** (`propagation.worker.ts` lines 125-146):

The `GET_POSITION` handler uses `const now = new Date()` unconditionally. This controls where click-to-fly sends the camera. When scrubbed to 6 hours ago, a click should fly to the satellite's historical position. Fix: add `timestamp?: number` to the `GetPositionMessage` payload type; use `const now = new Date(payload.timestamp ?? Date.now())`.

The component's click handler (in `AircraftLayer.tsx` — verified the satellite click dispatches `GET_POSITION` via `workerRef`) must send `replayTs` when in playback mode. **Note:** The click dispatching in this codebase goes through `AircraftLayer`'s unified click dispatcher which posts to the sat worker. Research shows (from `SatelliteDetailPanel.tsx`) that clicks trigger `GET_POSITION` via a code path in `AircraftLayer`. The planner must locate that click dispatch and add the `replayTs` payload.

### Pattern 3: Orbit Ring Temporal Alignment

**What:** The orbit ring (`ORBIT_RESULT` in `propagation.worker.ts` lines 91-115) currently starts from `Date.now()` and computes the satellite's future track. In playback mode, it should compute the track centered on `replayTs`.

**orbit ring centering strategy:** The orbit loop iterates `from now to now + periodSeconds`. For replay mode, the natural approach is to center on `replayTs`: iterate `from replayTs - periodSeconds/2 to replayTs + periodSeconds/2`. However, to keep the change minimal, simply starting from `replayTs` (showing the future orbit relative to the replay timestamp) is consistent with user expectation — the satellite is shown where it is at `replayTs`, and the ring shows where it will go from there.

**Recommended: start from `payload.timestamp`** — same behavior as live mode, just anchored to the replay timestamp instead of now.

### Anti-Patterns to Avoid

- **`Date.now()` inside the worker:** Workers cannot know about `replayTs`. The worker must be a pure function of its inputs. Any `Date.now()` or `new Date()` call inside the worker (other than a fallback) is a bug in playback mode.
- **Cancelling rAF on pause:** Do not `cancelAnimationFrame` when `isPlaying` becomes false. Keep the loop running but return early without posting. This matches the aircraft lerp pattern and allows instant resume.
- **Adding `isPlaying` and `replayMode` to the Effect 1 dependency array:** The rAF loop is set up once in Effect 1 (dependencies: `[viewer, satellites.data, onWorkerReady]`). Adding `isPlaying` or `replayMode` would tear down and reinitialise the worker on every play/pause toggle — destroying all loaded satrecs. The loop reads these values via `getState()` inside the tick function, not via closure.
- **Reading `replayTs` in Effect 2 via closure:** Effect 2 (selectedId watcher) runs on `[selectedId, satellites.data, viewer]` change. When `selectedId` changes, it reads the current `replayTs` via `useAppStore.getState()`. Do not add `replayTs` to Effect 2's dependency array — orbit recomputation on every scrubber tick is wasteful and the orbit ring is anchored to the selection timestamp, not continuously updated.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Timestamp-aware propagation | Custom epoch offset math | `satellite.propagate(satrec, new Date(timestamp))` | satellite.js accepts any `Date`; all ECI→ECEF math handles the epoch internally |
| Worker-side clock awareness | Reading `Date.now()` in worker | Pass `timestamp` in the message payload | Worker is a pure compute engine; clock ownership stays with main thread |
| Pause detection in loop | Separate `useEffect` cancelling rAF | `if (!isPlaying) return` inside loop | Avoids worker teardown; enables instant resume |

---

## Common Pitfalls

### Pitfall 1: Stale Closure Over `replayTs` in rAF Loop

**What goes wrong:** If the loop closes over `replayTs` from the `useEffect` closure (at worker init time), all propagation dispatches use the `replayTs` value from when the effect first ran — typically `Date.now()` at page load.

**Why it happens:** The rAF `loop` function is a closure created inside `useEffect`. The effect dependency array is `[viewer, satellites.data, onWorkerReady]`. `replayTs` is not in the deps, so it is captured once at effect mount time.

**How to avoid:** Read `replayTs` via `useAppStore.getState().replayTs` inside `loop()`, not via any variable in scope from the effect closure.

**Warning signs:** Satellites appear at real-time positions even when scrubbed to historical times; console logs show `timestamp: <page-load-time>` in `PROPAGATE` messages.

### Pitfall 2: Worker Worker Reinitiialisation on Play/Pause

**What goes wrong:** If `isPlaying` is added to Effect 1's dependency array, every play/pause toggle tears down the worker, clears all loaded satrecs, rebuilds the `PointPrimitiveCollection`, and re-sends `LOAD_OMM` with thousands of records. This causes a 1-2 second blank satellite layer on every pause.

**How to avoid:** `isPlaying` must NOT be in Effect 1's dependency array. Read it inside the loop via `getState()`.

**Warning signs:** Satellites disappear for ~1 second on every play/pause click; worker console logs show `LOADED` message on every toggle.

### Pitfall 3: `COMPUTE_ORBIT` Ignoring the Passed Timestamp

**What goes wrong:** Adding `timestamp` to the message payload but forgetting to use it in the worker — the handler still calls `const now = Date.now()`.

**How to avoid:** After adding `payload.timestamp` support, the test for `COMPUTE_ORBIT` must assert that `propagate` was called with a `Date` whose `getTime()` matches the passed timestamp, not `Date.now()`.

**Warning signs:** Orbit ring appears at the satellite's real current position (current orbit orientation), not the historical orbit orientation from the replay timestamp.

### Pitfall 4: `GET_POSITION` Still Uses Wall Clock

**What goes wrong:** The satellite click-to-fly sends the camera to the satellite's current real position, not its replay-timestamp position. This is visible: scrub to 6 hours ago, click a satellite, globe rotates to where the satellite is NOW (not 6 hours ago).

**How to avoid:** The click handler that posts `GET_POSITION` must include `timestamp: useAppStore.getState().replayTs` when `replayMode === 'playback'`.

**Warning signs:** After clicking a satellite in playback mode, the globe flies to a different position than the visible dot.

### Pitfall 5: `OVERPASS_RESULT` Stale Guard Is Already Correct — Don't Break It

**What goes now correctly:** Effect 6 (`COMPUTE_OVERPASS` dispatch) already uses `replayTs` as the timestamp. The `OVERPASS_RESULT` handler already guards stale results with `Math.abs(ovMsg.timestamp - currentTs) > 2000`. This code path does NOT need changes in Phase 24 — it was implemented correctly in an earlier phase.

**How to avoid:** Do not touch `COMPUTE_OVERPASS` or the `OVERPASS_RESULT` handler. Only touch `PROPAGATE`, `COMPUTE_ORBIT`, and `GET_POSITION`.

---

## Code Examples

Verified patterns from direct source inspection:

### Loop Fix — Store-Sourced Timestamp with Pause Guard

```typescript
// SatelliteLayer.tsx — replace the loop() function in Effect 1
// Source: direct inspection of SatelliteLayer.tsx lines 257-265 and useViewerClock.ts pattern

let lastProp = 0;
function loop(ts: number) {
  const { replayMode, replayTs, isPlaying } = useAppStore.getState();
  // Pause guard: keep rAF alive but skip dispatch when paused in playback
  if (replayMode === 'playback' && !isPlaying) {
    rafRef.current = requestAnimationFrame(loop);
    return;
  }
  if (ts - lastProp > 1000) {
    const timestamp = replayMode === 'playback' ? replayTs : Date.now();
    worker.postMessage({ type: 'PROPAGATE', payload: { timestamp } });
    lastProp = ts;
  }
  rafRef.current = requestAnimationFrame(loop);
}
rafRef.current = requestAnimationFrame(loop);
```

### Worker `COMPUTE_ORBIT` Handler — Accept Payload Timestamp

```typescript
// propagation.worker.ts — COMPUTE_ORBIT handler
// Source: direct inspection of lines 91-115

if (type === 'COMPUTE_ORBIT') {
  const { omm, periodSeconds, timestamp } = payload as {
    omm: Record<string, unknown>;
    periodSeconds: number;
    timestamp?: number;
  };
  const satrec = satellite.json2satrec(omm as satellite.OMMJsonObject);
  const startMs = timestamp ?? Date.now();           // wall-clock fallback for live mode
  const stepCount = Math.ceil(periodSeconds / 60);
  const orbitPoints: number[][] = [];
  const groundPoints: number[][] = [];

  for (let i = 0; i <= stepCount; i++) {
    const t = new Date(startMs + i * 60_000);
    // ... rest unchanged
  }
  // ...
}
```

### Worker `GET_POSITION` Handler — Accept Payload Timestamp

```typescript
// propagation.worker.ts — GET_POSITION handler
// Source: direct inspection of lines 125-146

if (type === 'GET_POSITION') {
  const { norad, timestamp } = payload as { norad: number; timestamp?: number };
  const entry = satrecs.find(s => s.norad === norad);
  if (!entry) {
    self.postMessage({ type: 'POSITION_RESULT', norad, position: null });
    return;
  }
  const now = new Date(timestamp ?? Date.now());    // wall-clock fallback for live mode
  const gmst = satellite.gstime(now);
  const pv = satellite.propagate(entry.satrec, now);
  // ... rest unchanged
}
```

### Component Effect 2 — Send `replayTs` in `COMPUTE_ORBIT`

```typescript
// SatelliteLayer.tsx — Effect 2 (selectedId watcher), lines 306-318
// Source: direct inspection

useEffect(() => {
  if (!selectedId || !satellites.data || !workerRef.current || !viewer) return;
  const sat = satellites.data.find(s => s.norad_cat_id === selectedId);
  if (!sat) return;
  const meanMotion = (sat.omm as Record<string, number>).MEAN_MOTION ?? 14;
  const periodSeconds = Math.round(86400 / meanMotion);
  const { replayMode, replayTs } = useAppStore.getState();
  const orbitTimestamp = replayMode === 'playback' ? replayTs : Date.now();
  workerRef.current.postMessage({
    type: 'COMPUTE_ORBIT',
    payload: { omm: sat.omm, periodSeconds, timestamp: orbitTimestamp },
  });
}, [selectedId, satellites.data, viewer]);
// NOTE: replayTs deliberately NOT in deps — orbit is anchored to selection time
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Loop always sends `Date.now()` | Loop sends `replayTs` in playback, `Date.now()` in live | Phase 24 | Satellites appear at historical positions during replay |
| Loop fires at 1 Hz even when paused | Loop skips dispatch when `!isPlaying` in playback | Phase 24 | Satellites freeze instantly on pause |
| `COMPUTE_ORBIT` uses `Date.now()` internally | `COMPUTE_ORBIT` uses payload `timestamp` | Phase 24 | Orbit ring reflects replay epoch |
| `GET_POSITION` uses `new Date()` internally | `GET_POSITION` uses payload `timestamp` | Phase 24 | Click-to-fly matches visible replay position |

---

## Open Questions

1. **Where does the satellite click handler post `GET_POSITION`?**
   - What we know: `SatelliteDetailPanel.tsx` is purely a detail display component. The satellite click → `GET_POSITION` path is in `AircraftLayer.tsx`'s unified click dispatcher (verified: `SatelliteLayer.tsx` comment at line 254: "Click handling is owned by AircraftLayer (unified dispatcher) — no handler here").
   - What's unclear: The exact line in `AircraftLayer.tsx` that posts `GET_POSITION` to `satWorker` needs to be located by the planner before coding the timestamp addition.
   - Recommendation: The planner should read `AircraftLayer.tsx` as a Wave 0 task to locate the `GET_POSITION` post, then add `timestamp: replayMode === 'playback' ? replayTs : Date.now()` to that payload.

2. **Should orbit ring update continuously as `replayTs` advances during playback?**
   - What we know: Effect 2 fires on `selectedId` change, not on `replayTs` change. The orbit ring is a one-shot calculation.
   - What's unclear: Whether operators expect the orbit ring to advance in real time with the scrubber.
   - Recommendation: Phase 24 scope — orbit ring reflects `replayTs` at the moment of satellite selection. Continuous orbit ring updates would add `replayTs` to Effect 2 deps, triggering a COMPUTE_ORBIT message every second during playback; this is unnecessary complexity and outside PLAY-02 scope.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.0.18 |
| Config file | `frontend/vite.config.ts` (inline `test:` block) |
| Quick run command | `cd frontend && npx vitest run --reporter=verbose` |
| Full suite command | `cd frontend && npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PLAY-02 | Loop sends `replayTs` when `replayMode === 'playback'` | unit | `cd frontend && npx vitest run src/workers/__tests__/propagation.test.ts` | ✅ (needs new describe block) |
| PLAY-02 | Loop skips `postMessage` when `replayMode === 'playback' && !isPlaying` | unit | `cd frontend && npx vitest run src/workers/__tests__/propagation.test.ts` | ✅ (needs new describe block) |
| PLAY-02 | `COMPUTE_ORBIT` uses `payload.timestamp` not `Date.now()` | unit | `cd frontend && npx vitest run src/workers/__tests__/propagation.test.ts` | ✅ (needs new test) |
| PLAY-02 | `GET_POSITION` uses `payload.timestamp` not `new Date()` | unit | `cd frontend && npx vitest run src/workers/__tests__/propagation.test.ts` | ✅ (needs new test) |
| PLAY-02 | In live mode, loop still uses `Date.now()` (regression) | unit | `cd frontend && npx vitest run src/workers/__tests__/propagation.test.ts` | ✅ (needs new test) |

**Note on worker testing strategy:** The `propagation.worker.ts` is a Web Worker and cannot be imported and executed directly as a module in Vitest (workers require `new Worker(...)` instantiation). The existing test suite (`propagation.test.ts`) tests satellite.js functions directly (not the worker message loop). The correct strategy for Phase 24 tests is:

- **Pure function extraction (preferred):** Extract the timestamp resolution logic from the loop into a pure helper (e.g. `resolveTimestamp(replayMode, isPlaying, replayTs): number | null`) in a separate module and test that function directly.
- **OR:** Add tests to `propagation.test.ts` for the worker's message handler behaviour by importing the functions that `propagation.worker.ts` calls (satellite.js propagate), verifying they produce different results for different timestamps — which is already covered by the existing ISS ground track tests.
- **SatelliteLayer component test:** A `SatelliteLayer.propagation.test.tsx` file could mock the worker and assert postMessage is called with `replayTs` in playback mode — but this is more complex. The planner should target a direct unit test of the pure helper function as the simplest path.

### Sampling Rate

- **Per task commit:** `cd frontend && npx vitest run --reporter=verbose`
- **Per wave merge:** `cd frontend && npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] New `describe('PLAY-02 — replay timestamp propagation')` block in `frontend/src/workers/__tests__/propagation.test.ts`
- [ ] Locate `GET_POSITION` dispatch site in `frontend/src/components/AircraftLayer.tsx` — read that file in Wave 0 before writing the fix
- [ ] No framework install needed — existing Vitest infrastructure covers all tests

---

## Sources

### Primary (HIGH confidence)

- `frontend/src/components/SatelliteLayer.tsx` — direct inspection; confirmed `Date.now()` at line 261 (PROPAGATE), no pause guard, `COMPUTE_ORBIT` dispatch without timestamp at lines 306-318
- `frontend/src/workers/propagation.worker.ts` — direct inspection; confirmed `Date.now()` at line 94 (COMPUTE_ORBIT), `new Date()` at line 133 (GET_POSITION)
- `frontend/src/hooks/useViewerClock.ts` — confirmed `getState()` inside postUpdate handler as the established pattern for reading store state in synchronous frame-level callbacks
- `frontend/src/store/useAppStore.ts` — confirmed `isPlaying: boolean` and `setIsPlaying` exist (Phase 23 complete); `replayMode`, `replayTs` confirmed present
- `.planning/STATE.md` — locked decision: "Aircraft lerp loop must stay alive in playback (return early, not cancel rAF) — enables instant resume without loop restart"
- `.planning/phases/23-store-foundation-viewer-clock/23-03-SUMMARY.md` — confirmed Phase 23 complete: `useViewerClock` wired, `isPlaying` in store, `replayTs` drives clock

### Secondary (MEDIUM confidence)

- `satellite.js` API: `propagate(satrec, date)` accepts any JavaScript `Date` object — inferred from existing codebase usage and satellite.js documentation. The `json2satrec` and `propagate` functions are unchanged across satellite.js versions that this project uses.

### Tertiary (LOW confidence)

- None required — all critical findings are backed by direct source inspection.

---

## Metadata

**Confidence breakdown:**
- Problem diagnosis: HIGH — three exact code lines identified by direct inspection
- Fix approach: HIGH — `getState()` pattern established and in use; satellite.js `propagate(satrec, date)` accepts any Date
- Test strategy: MEDIUM — worker test isolation requires pure function extraction or mock; exact approach left to planner
- `GET_POSITION` dispatch location: MEDIUM — stated in SatelliteLayer comment to be in AircraftLayer, but exact line not verified (planner must read AircraftLayer.tsx in Wave 0)

**Research date:** 2026-03-13
**Valid until:** 2026-04-13 (stable stack; no external API changes expected)
