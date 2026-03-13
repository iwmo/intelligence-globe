# Stack Research

**Domain:** 4D Replay Engine — Time-aware animation, virtual clock synchronisation, playback correctness audit
**Researched:** 2026-03-13
**Confidence:** HIGH (all critical APIs verified against official CesiumJS docs and MDN; satellite.js API verified from codebase inspection; existing patterns confirmed by reading the full codebase)

> **Scope note:** This file covers ONLY what is new for v5.0 Playback.
> The base stack (CesiumJS 1.139.1, satellite.js 6.0.2, React 19, Zustand 5, Vite 7, FastAPI,
> PostgreSQL, PostGIS, Redis, Docker Compose) is validated and deployed — do not re-research it.
> Focus: four specific APIs for replay correctness.

---

## What This Research Covers

Four specific replay correctness problems require targeted API patterns:

1. Satellite Web Worker receives `Date.now()` unconditionally — must use `replayTs` in playback
2. Aircraft/ship live lerp loops run during playback — must stop when `replayMode === 'playback'`
3. `viewer.clock` (CesiumJS) is not synchronised to `replayTs` — scene time is wrong during replay
4. Street traffic particle animation runs during playback — particles must freeze or hide

---

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| CesiumJS | 1.139.1 (current) | Globe rendering + Clock API | Already in stack. `viewer.clock` with `JulianDate.fromDate(new Date(replayTs))` is the supported integration for syncing custom replay state with CesiumJS scene time. `shouldAnimate = false` freezes the clock at the replay moment. |
| satellite.js | 6.0.2 (current) | SGP4 propagation in Web Worker | Already in stack. `propagate(satrec, new Date(timestamp))` accepts any Date object. Worker already uses `new Date(timestamp)` — the only fix is the callsite that passes `timestamp`. No library change required. |
| Zustand | 5.0.11 (current) | Global replay state | Already in stack. `useAppStore.getState()` is the correct escape hatch to read current state inside rAF loops, Worker `onmessage` handlers, and CesiumJS event listeners — avoids stale closures without triggering React re-renders. |
| React | 19.2.0 (current) | Component lifecycle | Already in stack. `useRef<boolean>` for rAF running flags and `cancelAnimationFrame` in `useEffect` cleanup are the correct primitives for pause/resume gates. |

### Supporting APIs — No New npm Packages Required

All four problems are solvable with existing stack and built-in browser/CesiumJS APIs.

| API / Pattern | Provided By | Purpose | Confidence |
|---------------|------------|---------|-----------|
| `JulianDate.fromDate(new Date(replayTs))` | CesiumJS (built-in) | Convert ms-epoch `replayTs` to CesiumJS JulianDate for `viewer.clock.currentTime` | HIGH — CesiumJS docs confirmed |
| `viewer.clock.currentTime = julianDate` | CesiumJS (built-in) | Mutate clock to replay moment. Automatically switches `clockStep` to `SYSTEM_CLOCK_MULTIPLIER`. | HIGH — CesiumJS docs confirmed |
| `viewer.clock.shouldAnimate = false` | CesiumJS (built-in) | Prevent `Clock.tick()` from auto-advancing `currentTime`. Scene continues to render; only time advancement stops. | HIGH — CesiumJS docs confirmed |
| `viewer.clock.multiplier` | CesiumJS (built-in) | Set to `replaySpeedMultiplier` during playback. Negative values enable reverse. Set to 1.0 in live mode. | HIGH — CesiumJS docs confirmed |
| `ClockStep.SYSTEM_CLOCK_MULTIPLIER` | CesiumJS (built-in) | The correct `clockStep` value for manual control — scales real elapsed time by `multiplier`. Do NOT use `SYSTEM_CLOCK` (forces multiplier=1, auto-enables animation). | HIGH — CesiumJS docs confirmed |
| `viewer.scene.postUpdate.addEventListener(cb)` | CesiumJS (built-in) | Per-frame hook: fires after scene update, before render. Listener receives `(scene, time)`. Use to push `replayTs` into `viewer.clock` every frame without a separate rAF loop. | HIGH — CesiumJS docs confirmed (added v1.37) |
| `useRef<boolean>` running flag | React (built-in) | Gate rAF loops. `rafRunningRef.current = false` in cleanup stops the loop without triggering re-renders. Already used correctly in `AircraftLayer.tsx`. | HIGH — established pattern; confirmed in codebase |
| `useAppStore.getState()` | Zustand (built-in) | Read `replayMode` / `replayTs` inside rAF loop bodies, Worker handlers, and CesiumJS event listeners. Avoids stale closures. Already used correctly in `PlaybackBar.tsx` tick and `SatelliteLayer.tsx` OVERPASS_RESULT handler. | HIGH — Zustand docs + codebase confirmation |

---

## Installation

No new packages are required for v5.0 Playback.

```bash
# No additions to frontend/package.json or backend/requirements.txt
# All replay fixes use: cesium, satellite.js, zustand, react — already installed
```

---

## The Four Problems: Diagnosis and Fix Pattern

### Problem 1 — Satellite Worker Uses `Date.now()` Unconditionally

**Location:** `frontend/src/components/SatelliteLayer.tsx` line 260

**Current bug:**
```typescript
worker.postMessage({ type: 'PROPAGATE', payload: { timestamp: Date.now() } });
```

**Root cause:** The propagation rAF loop is initialised in a `useEffect` with deps `[viewer, satellites.data, onWorkerReady]`. `replayTs` and `replayMode` are not in that dep array, so the closure captures their mount-time values (always `'live'` / `Date.now()`). Adding them to deps would cause the effect to re-fire every frame during playback, killing and re-creating the worker 60× per second.

**Correct fix — `getState()` inside the loop:**
```typescript
function loop(ts: number) {
  const { replayMode, replayTs } = useAppStore.getState();
  const timestamp = replayMode === 'playback' ? replayTs : Date.now();
  if (ts - lastProp > 1000) {
    worker.postMessage({ type: 'PROPAGATE', payload: { timestamp } });
    lastProp = ts;
  }
  rafRef.current = requestAnimationFrame(loop);
}
```

**Why no API change needed:** The worker already calls `new Date(timestamp)` and passes it to `satellite.propagate(satrec, now)`. `satellite.propagate` accepts any `Date` object — the historical `replayTs` is valid input. The SGP4 model computes position for any time given the TLE epoch. HIGH confidence — `propagation.worker.ts` lines 65-66 confirmed.

**Pause gate (PLAY-03 also):** When `replayMode === 'playback'` and `!isPlaying`, skip the `postMessage` entirely. The worker holds its last-computed positions — that is the correct frozen visual state.

---

### Problem 2 — Live Lerp Loops Run During Playback

**Location:** `frontend/src/components/AircraftLayer.tsx` lines 250-265 (lerp loop)

**Current bug:** The lerp loop runs unconditionally every frame, always interpolating from `prevPositions` to `currPositions` using `Date.now()` as alpha. During playback, this fights the snapshot interpolation effect (Effect in lines 317-338), causing aircraft to flicker between live-lerp positions and snapshot positions.

**Correct gate pattern:**
```typescript
function lerp() {
  const { replayMode } = useAppStore.getState();
  if (!rafRunningRef.current) return;

  if (replayMode === 'playback') {
    // Halt live lerp — snapshot interpolation effect owns positions in playback.
    // Keep the rAF alive so it can resume immediately when mode changes back to live.
    rafRef.current = requestAnimationFrame(lerp);
    return;
  }

  // ... existing live lerp logic unchanged ...
  rafRef.current = requestAnimationFrame(lerp);
}
```

**Why keep the rAF alive when skipping:** Cancelling and restarting the rAF on mode changes requires a `useEffect` watching `replayMode`, which would conflict with the existing `useEffect([viewer, aircraft.data])` that starts the loop. Returning early within the same loop is simpler and cheaper — the overhead of one empty rAF frame at 60 FPS is negligible.

**Same pattern applies to:** `ShipLayer.tsx` and `MilitaryAircraftLayer.tsx` if they have rAF lerp loops. Verify by reading those files during implementation.

---

### Problem 3 — `viewer.clock` Not Synchronised to `replayTs`

**Location:** `frontend/src/components/GlobeView.tsx` — no clock integration exists

**Current state:** `GlobeView.tsx` creates the viewer and never touches `viewer.clock`. The clock defaults to real time, `shouldAnimate: false`. Scene lighting, atmosphere, and any future time-dependent entities all read `viewer.clock.currentTime` — currently always real time.

**Correct integration — subscribe to `scene.postUpdate`:**

Register once in a `useEffect([viewer])` that fires after the viewer is ready. Inside the listener, read state via `getState()` — no stale closures, no React re-renders:

```typescript
useEffect(() => {
  if (!viewer || viewer.isDestroyed()) return;

  const removeListener = viewer.scene.postUpdate.addEventListener(() => {
    const { replayMode, replayTs } = useAppStore.getState();

    if (replayMode === 'playback') {
      viewer.clock.shouldAnimate = false;
      viewer.clock.currentTime = JulianDate.fromDate(new Date(replayTs));
    } else {
      // Live mode: let CesiumJS clock track real time
      viewer.clock.shouldAnimate = true;
      viewer.clock.clockStep = ClockStep.SYSTEM_CLOCK_MULTIPLIER;
      viewer.clock.multiplier = 1.0;
    }
  });

  return () => removeListener();
}, [viewer]);
```

**Why `scene.postUpdate` over a separate `useEffect([viewer, replayTs])`:** A React `useEffect` watching `replayTs` fires during the React commit phase — asynchronous relative to the CesiumJS render loop. `scene.postUpdate` fires synchronously within the CesiumJS render frame tick, guaranteeing the clock is set before the scene renders each frame. This eliminates one-frame visual lag between scrubber position and globe state.

**Why NOT `scene.preRender`:** `preRender` fires after scene update is complete and immediately before render. `postUpdate` fires before both render and `preRender`, giving more time for downstream effects to respond. Either works; `postUpdate` is earlier in the pipeline.

**JulianDate API verified:**
- `JulianDate.fromDate(date: Date): JulianDate` — factory from JS Date object
- `JulianDate.toDate(jd: JulianDate): Date` — inverse, for extracting ms-epoch back if needed
- `JulianDate.now(): JulianDate` — equivalent to `fromDate(new Date())`
- Import: `import { JulianDate, ClockStep } from 'cesium'`

---

### Problem 4 — Street Traffic Particles Animate During Playback

**Location:** `frontend/src/components/StreetTrafficLayer.tsx` — `animate()` function, Effect 3

**Current bug:** The `animate()` rAF loop advances `p.t` values every frame regardless of `replayMode`. Street traffic has no historical snapshots — it is a live simulation only. Showing animated traffic particles at a historical replay timestamp is misleading.

**Correct fix — read `replayMode` ref inside loop:**

The existing pattern of `layerVisibleRef` and `roadsRef` (refs kept in sync with current state, read inside the rAF loop) is the right model. Extend it with a `replayModeRef`:

```typescript
const replayModeRef = useRef<string>(replayMode);
replayModeRef.current = replayMode; // keep in sync each render

// Inside animate():
function animate() {
  if (replayModeRef.current === 'playback') {
    // Hide particles in playback — no historical road data exists
    for (const p of particlesRef.current) p.primitive.show = false;
    rafHandleRef.current = requestAnimationFrame(animate);
    return;
  }
  // Restore visibility when returning to live
  const currentVisible = layerVisibleRef.current;
  for (const p of particlesRef.current) {
    p.primitive.show = currentVisible;
  }
  // ... existing advance logic unchanged ...
}
```

**Why hide rather than freeze:** Freezing (skipping `t += speed`, keeping particles visible) leaves particles visually present at a historical timestamp — implying live traffic exists at the replay moment. This is dishonest. Hiding is semantically correct: there is no historical traffic data for this time.

**Why `replayModeRef` over `useAppStore.getState()`:** Both work. `getState()` is equally valid here. `replayModeRef` is the existing code idiom in this file — consistency with `layerVisibleRef` reduces cognitive load for whoever maintains this file.

---

### Problem 5 — `GET_POSITION` Worker Handler Uses `new Date()` (Live Only)

**Location:** `frontend/src/workers/propagation.worker.ts` lines 131-132

**Current bug:**
```typescript
const now = new Date(); // always real time — ignores replayTs
```

**Impact:** Low — `GET_POSITION` is only called when flying to a satellite from search (Effect 2 in `SatelliteLayer.tsx`). During playback, the fly-to destination would be the satellite's current real-time position, not its replay-time position. This is tolerable but incorrect.

**Fix:** The `GET_POSITION` message should optionally accept a `timestamp` parameter. The caller (`SatelliteLayer.tsx`) should pass `replayTs` when in playback mode. No worker API version change needed — the payload already has room for this.

---

### Problem 6 — `COMPUTE_ORBIT` Uses `Date.now()` (Orbit Preview)

**Location:** `frontend/src/workers/propagation.worker.ts` line 95

**Current code:**
```typescript
const now = Date.now();
for (let i = 0; i <= stepCount; i++) {
  const t = new Date(now + i * 60_000);
```

**Impact:** Medium during playback. When a satellite is selected in playback mode, the orbit path shown is computed from real time forward, not from `replayTs` forward. The ground track and overpass calculations will disagree with the propagation display.

**Fix:** `COMPUTE_ORBIT` message should accept an optional `timestamp` parameter. Use it as the base for orbit path generation. The caller already computes the orbital period from OMM — it just needs to pass `replayTs` when in playback mode.

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Adding `replayTs` to `useEffect` dependency array of the satellite rAF init | `replayTs` changes every frame in playback — effect re-fires every tick, kills and recreates the Worker 60× per second, causing flicker and performance collapse | `useAppStore.getState()` inside the rAF loop body — reads current state without triggering effects |
| CZML-based time animation | Explicitly excluded in PROJECT.md: "wrong pattern for snapshot-driven dynamic data" | Custom `replayTs` in Zustand + snapshot interpolation (already implemented) |
| `viewer.clock.clockStep = ClockStep.SYSTEM_CLOCK` | Forces `multiplier = 1.0` and `shouldAnimate = true` automatically — clock will auto-advance ignoring `replayTs` | `ClockStep.SYSTEM_CLOCK_MULTIPLIER` with `shouldAnimate = false` for full manual control |
| A separate rAF loop to sync `viewer.clock` | Two rAF loops (PlaybackBar tick + clock sync) waste frame budget and risk drifting relative to CesiumJS render | `viewer.scene.postUpdate` event listener — fires in the CesiumJS render frame pipeline, no extra loop |
| Calling `cancelAnimationFrame` on mode change to pause lerp | Requires a second `useEffect` watching `replayMode`; conflicts with the `useEffect([viewer, aircraft.data])` that owns the loop | Read `replayMode` via `getState()` at the top of the loop body and return early — one loop, one effect |
| `setInterval` for propagation | Subject to tab throttling (clamped to 1 Hz minimum in hidden tabs); not frame-synchronised | Keep existing rAF + 1-second gate (`ts - lastProp > 1000`) pattern |
| Freezing (not hiding) street traffic particles during playback | Frozen particles at a historical timestamp imply live traffic data exists for that time — misleading | Hide particles entirely in playback (`p.primitive.show = false`) |
| New npm package for animation control | No package provides better primitives than `cancelAnimationFrame` + `rafRunningRef` + `getState()` | Native browser APIs + Zustand escape hatch |

---

## Stack Patterns by Variant

**If writing a new per-frame side-effect that reads Zustand state:**
- Use `useAppStore.getState()` inside the callback body
- NOT `useAppStore(selector)` hook — hooks only work in React component/hook scope, not rAF callbacks or event listeners

**If a rAF loop must be pausable without restarting:**
- Use `useRef<boolean>` running flag (`rafRunningRef.current`)
- Read it at the top of the loop; return early (but optionally re-queue) if in the pause condition
- Set to `false` in `useEffect` cleanup AND when conditions warrant stopping fully

**If syncing `viewer.clock` to custom replay state:**
- Subscribe once to `viewer.scene.postUpdate` in a `useEffect([viewer])` effect
- Read current state inside the listener via `getState()`
- Always unsubscribe in the effect cleanup via the returned removal function

**If a Worker handler must respect `replayTs`:**
- Add an optional `timestamp` parameter to the message payload
- Default to `Date.now()` when not provided (backwards compatibility with live mode callers)
- Do NOT pass `replayTs` from a React closure — pass it from the `getState()` call at the time of dispatch

---

## Version Compatibility

| Package | Version | Relevant APIs | Notes |
|---------|---------|--------------|-------|
| cesium@1.139.1 | — | `JulianDate.fromDate`, `viewer.clock.shouldAnimate`, `viewer.clock.currentTime`, `scene.postUpdate`, `ClockStep` | All APIs stable and present since CesiumJS 1.37+. No compatibility risk. |
| satellite.js@6.0.2 | — | `propagate(satrec, date)` accepts any JS `Date` | No version change needed. `new Date(anyMsTimestamp)` is valid input. |
| zustand@5.0.11 | React 19 | `getState()` escape hatch | Unchanged from Zustand 4. Already used correctly in codebase. |
| react@19.2.0 | — | `useRef`, `useEffect`, `cancelAnimationFrame` | Standard hooks and browser APIs. No version-specific behaviour. |
| ClockStep enum | cesium@1.139.1 | `import { ClockStep } from 'cesium'` | Values: `SYSTEM_CLOCK`, `SYSTEM_CLOCK_MULTIPLIER`, `TICK_DEPENDENT`. Use `SYSTEM_CLOCK_MULTIPLIER` for replay mode. |

---

## Sources

- [CesiumJS Clock API](https://cesium.com/learn/cesiumjs/ref-doc/Clock.html) — `currentTime`, `shouldAnimate`, `canAnimate`, `multiplier`, `clockStep`, `onTick` — HIGH confidence
- [CesiumJS JulianDate API](https://cesium.com/learn/cesiumjs/ref-doc/JulianDate.html) — `fromDate()`, `fromIso8601()`, `now()`, `toDate()` — HIGH confidence
- [CesiumJS Scene API](https://cesium.com/learn/cesiumjs/ref-doc/Scene.html) — `preUpdate`, `postUpdate`, `preRender`, `postRender` events, listener parameters — HIGH confidence
- [satellite-js GitHub](https://github.com/shashwatak/satellite-js) — `propagate(satrec, date)` signature accepts `Date` object — HIGH confidence (codebase confirms `new Date(timestamp)` pattern in `propagation.worker.ts` line 65)
- [Zustand getState escape hatch](https://github.com/pmndrs/zustand) — non-React context state access pattern — HIGH confidence
- Codebase inspection: `SatelliteLayer.tsx` (lines 257-265), `AircraftLayer.tsx` (lines 250-265, 317-338), `StreetTrafficLayer.tsx` (lines 151-188), `PlaybackBar.tsx` (lines 84-101), `propagation.worker.ts` (lines 63-88, 94-96, 131-132), `useAppStore.ts` (lines 55-63) — HIGH confidence — direct source of truth for existing bugs and patterns

---

*Stack research for: Intelligence Globe v5.0 Playback — replay engine audit and correctness fixes*
*Researched: 2026-03-13*
