# Architecture Research

**Domain:** 4D Replay Engine — Audit and Playback Correctness
**Researched:** 2026-03-13
**Confidence:** HIGH (all findings from direct codebase inspection)

---

## Current System Overview

```
┌──────────────────────────────────────────────────────────────────────┐
│                        App.tsx (component tree root)                  │
├──────────────────────────────────────────────────────────────────────┤
│  ┌──────────┐  ┌──────────────┐  ┌────────────────┐  ┌────────────┐  │
│  │GlobeView │  │ PlaybackBar  │  │ SatelliteLayer │  │AircraftLayer│ │
│  │(Viewer)  │  │(rAF tick +   │  │(Worker + rAF)  │  │(lerp rAF)  │  │
│  │          │  │ scrubber)    │  │                │  │            │  │
│  └────┬─────┘  └──────┬───────┘  └──────┬─────────┘  └──────┬────┘  │
│       │               │                 │                    │       │
├───────┴───────────────┴─────────────────┴────────────────────┴───────┤
│                    useAppStore (Zustand)                               │
│   replayMode: 'live'|'playback'   replayTs: ms epoch                  │
│   replaySpeedMultiplier           replayWindowStart / replayWindowEnd  │
├──────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────┐  ┌──────────────┐  ┌────────────────────┐   │
│  │MilitaryAircraftLayer│  │  ShipLayer   │  │  GpsJammingLayer   │   │
│  │(billboard, no lerp) │  │(billboard,   │  │(GroundPrimitive,   │   │
│  └─────────────────────┘  │  no lerp)    │  │ daily poll)        │   │
│                           └──────────────┘  └────────────────────┘   │
│  ┌──────────────────────┐                                             │
│  │  StreetTrafficLayer  │                                             │
│  │  (rAF particle sim)  │                                             │
│  └──────────────────────┘                                             │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Bug Inventory — What is Actually Broken

### BUG-01: SatelliteLayer propagation loop always uses Date.now()

**File:** `frontend/src/components/SatelliteLayer.tsx`, lines 257–265

The rAF loop unconditionally sends:
```typescript
worker.postMessage({ type: 'PROPAGATE', payload: { timestamp: Date.now() } });
```

In playback mode, `replayTs` is the intended time source. The worker's `PROPAGATE` handler accepts a `timestamp` parameter and builds `new Date(timestamp)` — the infrastructure already supports time injection. The loop never reads `replayMode` or `replayTs`.

**Consequence:** Satellites continue orbiting to the real wall-clock position during playback. Satellite positions are always "now" regardless of where the scrubber is set.

**Note also:** The `GET_POSITION` path in the worker (used for click-to-fly) hardcodes `new Date()` at line 132. This is lower severity (only fires on satellite click) but should be audited in the same phase.

---

### BUG-02: AircraftLayer live lerp runs during playback

**File:** `frontend/src/components/AircraftLayer.tsx`, lines 247–265

The lerp rAF loop starts unconditionally when `aircraft.data` arrives (Effect 2). It runs every animation frame regardless of `replayMode`. The alpha calculation uses wall clock:
```typescript
const alpha = Math.min((Date.now() - lastUpdateTime) / POLL_INTERVAL_MS, 1.0);
```

A separate playback interpolation effect (lines 317–338) also writes `bb.position` when `replayMode === 'playback'`. Both effects write `bb.position`. The live lerp runs at 60 Hz and overwrites the position the playback effect set at the previous `replayTs` change.

**Consequence:** Aircraft positions flicker or revert to live-lerped positions during playback. The live lerp wins because it runs every rAF frame; the playback effect only fires on `replayTs` change.

---

### BUG-03: viewer.clock is not driven by replayTs

**File:** `frontend/src/components/GlobeView.tsx` — no clock sync code present

`GlobeView.tsx` initializes `viewer` with `animation: false, timeline: false` and never references `viewer.clock`. There is no component that writes `viewer.clock.currentTime` or `viewer.clock.shouldAnimate` when `replayTs` or `replayMode` changes.

**Consequence:** CesiumJS day/night shading and atmospheric lighting always reflect wall-clock time, not the replayed time. The globe looks lit for "now" even when scrubbed to midnight six hours ago.

---

### BUG-04: GpsJammingLayer has no playback behavior

**File:** `frontend/src/components/GpsJammingLayer.tsx` + `frontend/src/hooks/useGpsJamming.ts`

`useGpsJamming` fetches `/api/gps-jamming` with a 24-hour `refetchInterval` and no `replayMode` check. During playback the layer shows current daily jamming data and continues scheduling refetches.

No snapshot table exists for GPS jamming cells. Historical jamming data is not stored in the `position_snapshots` table. Showing historical jamming data at `replayTs` precision would require new backend infrastructure (out of scope).

**Decision:** Freeze the layer at its last fetched daily aggregate. Stop polling during playback. Show data as-is with an understanding that it is the current daily heatmap, not historical.

---

### BUG-05: StreetTrafficLayer particle simulation runs during playback

**File:** `frontend/src/components/StreetTrafficLayer.tsx`, lines 152–188

The `animate()` rAF loop runs continuously once roads are fetched. It reads `layerVisibleRef` but not `replayMode`. There is no check to pause particle movement during playback.

**Consequence:** Traffic particles keep moving during playback, even when the scrubber is paused at a fixed `replayTs`. All other layers are static at `replayTs` but streets keep flowing — a visible contradiction.

---

### BUG-06: MilitaryAircraftLayer and ShipLayer live data updates not gated on replayMode (minor)

**Files:** `frontend/src/components/MilitaryAircraftLayer.tsx` Effect 2, `frontend/src/components/ShipLayer.tsx` Effect 2

Both layers update billboard positions directly from live data in their data-update effects without a `replayMode` guard. The `useMilitaryAircraft` and `useShips` hooks correctly gate `refetchInterval: replayMode === 'live' ? interval : false`, so no new network requests occur during playback. However, if cached data triggers a React Query re-render after entering playback (e.g., cache invalidation on focus), Effect 2 would overwrite playback-interpolated positions with live positions.

**Severity:** Low — polling is halted so this only affects the frame immediately after entering playback or on window focus. The pattern should still be guarded for correctness.

---

## Component Responsibilities (Current State)

| Component | Responsibility | Playback Bug |
|-----------|---------------|--------------|
| `PlaybackBar` | rAF tick advancing `replayTs`; scrubber UI; speed presets | None — correct |
| `SatelliteLayer` | SGP4 propagation via Web Worker; 1 Hz rAF loop | BUG-01: always uses `Date.now()` |
| `AircraftLayer` | Live lerp rAF loop; playback snapshot interpolation | BUG-02: live lerp runs during playback |
| `MilitaryAircraftLayer` | Billboard position updates; playback snapshot interpolation | BUG-06 minor: no replayMode guard on Effect 2 |
| `ShipLayer` | Billboard position updates; playback snapshot interpolation | BUG-06 minor: same pattern as military |
| `GpsJammingLayer` | GroundPrimitive hex cells from daily poll | BUG-04: polls during playback, no freeze |
| `StreetTrafficLayer` | rAF particle simulation on OSM roads | BUG-05: particles animate during playback |
| `GlobeView` | CesiumJS Viewer initialization | BUG-03: viewer.clock never synced to replayTs |
| `useAppStore` | Single source of truth for `replayMode`, `replayTs` | None — store is correct |
| `useReplaySnapshots` | React Query wrapper for `/api/replay/snapshots` | None — hook is correct |
| `propagation.worker.ts` | SGP4 batch propagation; accepts `timestamp` param | None — ready for BUG-01 fix |

---

## Recommended Fix Architecture

### Fix Pattern 1: Satellite — Read replayTs in propagation loop

The rAF loop in `SatelliteLayer` Effect 1 must read `replayMode` and `replayTs` on each tick via `useAppStore.getState()` (not a React subscription — this is inside a rAF closure, same pattern `PlaybackBar` uses for its tick loop).

```typescript
// Inside the loop() function in SatelliteLayer Effect 1:
const { replayMode, replayTs } = useAppStore.getState();
const ts = replayMode === 'playback' ? replayTs : Date.now();
worker.postMessage({ type: 'PROPAGATE', payload: { timestamp: ts } });
```

The loop frequency remains 1 Hz. In playback the loop fires on each tick and uses `replayTs` as the timestamp. For scrubbing (large timestamp jumps), propagation catches up within the next 1-second interval.

### Fix Pattern 2: Aircraft — Gate live lerp on replayMode

The live lerp loop in AircraftLayer Effect 2 must check `replayMode` before writing positions:

```typescript
// Inside lerp() function body, before any bb.position writes:
const { replayMode } = useAppStore.getState();
if (replayMode === 'playback') {
  rafRef.current = requestAnimationFrame(lerp);
  return; // playback effect owns bb.position
}
```

The rAF loop continues running (so it re-activates immediately on return to live) but suppresses all `bb.position` writes in playback mode. The playback interpolation effect (already structurally correct) then has exclusive ownership of `bb.position` in playback mode.

### Fix Pattern 3: viewer.clock sync

A new `useViewerClock` hook subscribes to `replayTs` and `replayMode` and syncs `viewer.clock`:

```typescript
// useViewerClock.ts
export function useViewerClock(viewer: Viewer | null) {
  const replayMode = useAppStore(s => s.replayMode);
  const replayTs   = useAppStore(s => s.replayTs);

  useEffect(() => {
    if (!viewer || viewer.isDestroyed()) return;
    if (replayMode === 'playback') {
      viewer.clock.currentTime = JulianDate.fromDate(new Date(replayTs));
      viewer.clock.shouldAnimate = false;
    } else {
      viewer.clock.currentTime = JulianDate.now();
      viewer.clock.shouldAnimate = true;
      viewer.clock.multiplier = 1;
    }
  }, [viewer, replayMode, replayTs]);
}
```

`viewer.clock.shouldAnimate = false` stops CesiumJS from auto-advancing the clock. The PlaybackBar rAF loop drives `replayTs`; this effect mirrors each change into `viewer.clock.currentTime`. Mount the hook in `App.tsx` alongside the other layer components, passing `cesiumViewer`.

### Fix Pattern 4: GpsJammingLayer — Freeze on playback entry

Add `replayMode` to the `useGpsJamming` hook, gating `refetchInterval`:

```typescript
// useGpsJamming.ts
export function useGpsJamming() {
  const replayMode = useAppStore(s => s.replayMode);
  return useQuery({
    ...
    refetchInterval: replayMode === 'live' ? 86_400_000 : false,
    ...
  });
}
```

This is the same pattern already used by `useAircraft` and `useMilitaryAircraft`. No visual change — the layer renders its last fetched daily aggregate during playback. No `GpsJammingLayer.tsx` changes required.

### Fix Pattern 5: StreetTrafficLayer — Pause animation during playback

Add a `replayModeRef` following the same pattern as `layerVisibleRef`:

```typescript
// StreetTrafficLayer.tsx, top of component:
const replayMode = useAppStore(s => s.replayMode);
const replayModeRef = useRef(replayMode);
replayModeRef.current = replayMode; // kept in sync at render time

// Inside animate() body, before position writes:
if (!currentVisible || replayModeRef.current === 'playback') {
  rafHandleRef.current = requestAnimationFrame(animate);
  return;
}
```

Particles freeze at their last positions when entering playback mode. They resume moving from those positions when live mode resumes. `useStreetTraffic.ts` does not require changes — road fetching is already gated by `layerVisible` and camera altitude.

---

## Data Flow — Corrected Replay Path

```
PlaybackBar rAF tick
  → setReplayTs(next)  [Zustand, 60 Hz during play]
       │
       ├── SatelliteLayer loop() [1 Hz interval check]
       │     reads replayTs via getState()
       │     → worker.postMessage({ PROPAGATE, timestamp: replayTs })
       │     → worker returns POSITIONS buffer
       │     → updates PointPrimitiveCollection positions
       │
       ├── AircraftLayer playback effect [fires on replayTs change]
       │     reads snapshotsByEntity (React Query, staleTime: Infinity)
       │     → findAdjacentSnapshots(snapshots, replayTs) binary search
       │     → bb.position = lerped Cartesian3 from adjacent snapshots
       │     live lerp loop: SKIPS position writes (replayMode guard)
       │
       ├── MilitaryAircraftLayer playback effect [fires on replayTs change]
       │     same snapshot interpolation pattern as AircraftLayer
       │     Effect 2 (live update): SKIPS writes (replayMode guard)
       │
       ├── ShipLayer playback effect [fires on replayTs change]
       │     same snapshot interpolation pattern
       │     Effect 2 (live update): SKIPS writes (replayMode guard)
       │
       ├── GpsJammingLayer [no change — frozen at last daily fetch]
       │     refetchInterval: false while in playback
       │
       ├── StreetTrafficLayer [particles frozen]
       │     animate() returns early without position writes
       │
       └── useViewerClock effect [fires on replayTs change]
             viewer.clock.currentTime = JulianDate.fromDate(new Date(replayTs))
             viewer.clock.shouldAnimate = false
             → CesiumJS day/night shading follows replayTs
```

```
Mode toggle: LIVE → PLAYBACK
  useAppStore.setReplayMode('playback')
  PlaybackBar: fetches /api/replay/window → sets replayWindowStart/End
  PlaybackBar: useReplaySnapshots('all', ...) enabled=true → fetch snapshots
  AircraftLayer / MilitaryAircraftLayer / ShipLayer: snapshot hooks enabled=true
  useAircraft / useMilitaryAircraft / useShips: refetchInterval → false
  useGpsJamming: refetchInterval → false
  SatelliteLayer loop: timestamp source switches to replayTs
  StreetTrafficLayer: particles freeze (replayModeRef guard)
  useViewerClock: viewer.clock.shouldAnimate = false
  viewer.clock.currentTime mirrors replayTs

Mode toggle: PLAYBACK → LIVE
  PlaybackBar.handleModeToggle(): setReplayTs(Date.now()), setReplayMode('live')
  AircraftLayer live lerp: resumes (guard releases, replayMode === 'live')
  SatelliteLayer loop: timestamp source switches back to Date.now()
  useAircraft / useMilitaryAircraft / useShips: refetchInterval resumes
  useGpsJamming: refetchInterval resumes
  StreetTrafficLayer: particles unfreeze
  useViewerClock: viewer.clock.shouldAnimate = true, multiplier = 1
```

---

## Integration Points — Files to Change

### New Files

| File | Purpose |
|------|---------|
| `frontend/src/hooks/useViewerClock.ts` | Syncs `viewer.clock.currentTime` and `viewer.clock.shouldAnimate` to `replayTs`/`replayMode`. New hook, mounted in `App.tsx`. |

### Modified Files

| File | Change | Bug Fixed |
|------|--------|-----------|
| `frontend/src/components/SatelliteLayer.tsx` | In rAF loop, read `replayMode`/`replayTs` from `getState()` each tick; pass `replayTs` to `PROPAGATE` in playback mode | BUG-01 |
| `frontend/src/components/AircraftLayer.tsx` | In live lerp loop body, check `replayMode` via `getState()` and `return` early if `'playback'` | BUG-02 |
| `frontend/src/components/MilitaryAircraftLayer.tsx` | Add `replayMode` guard to Effect 2 (data update effect) — skip position writes in playback | BUG-06 |
| `frontend/src/components/ShipLayer.tsx` | Add `replayMode` guard to Effect 2 — same pattern as military | BUG-06 |
| `frontend/src/hooks/useGpsJamming.ts` | Add `replayMode` check; `refetchInterval: replayMode === 'live' ? 86_400_000 : false` | BUG-04 |
| `frontend/src/components/StreetTrafficLayer.tsx` | Add `replayModeRef`; skip position writes in `animate()` when `replayMode === 'playback'` | BUG-05 |
| `frontend/src/App.tsx` | Mount `useViewerClock(cesiumViewer)` | BUG-03 |

### No Changes Required

| File | Why |
|------|-----|
| `frontend/src/store/useAppStore.ts` | Store shape is correct — `replayMode`, `replayTs`, `replaySpeedMultiplier`, window bounds all present |
| `frontend/src/hooks/useReplaySnapshots.ts` | Hook is correct — `enabled` flag, `staleTime: Infinity`, `findAdjacentSnapshots` binary search all correct |
| `frontend/src/components/PlaybackBar.tsx` | rAF tick loop is correct — uses `getState()`, auto-stops at `windowEnd`, `isPlaying` state is local |
| `frontend/src/workers/propagation.worker.ts` | Worker already accepts `timestamp` parameter in `PROPAGATE` handler — ready for BUG-01 fix with no worker changes |
| `frontend/src/hooks/useAircraft.ts` | `refetchInterval` already gated on `replayMode` — correct pattern |
| `frontend/src/hooks/useMilitaryAircraft.ts` | Same — correct |
| `frontend/src/hooks/useShips.ts` | Same pattern — verify on implementation |
| `frontend/src/components/GlobeView.tsx` | No changes — viewer.clock sync extracted to `useViewerClock` hook |

---

## Suggested Build Order

Dependencies: store is already correct. All fixes are independent of each other but the clock sync (BUG-03) is most visually testable first.

### Step 1 — viewer.clock sync (BUG-03)

**Rationale:** Self-contained new hook, no interaction with other fixes. Validates CesiumJS `JulianDate` API usage before touching layer code. Visually dramatic test signal: scrub to a historical nighttime timestamp, globe goes dark.

**Files:** New `useViewerClock.ts`, one-line mount in `App.tsx`.

---

### Step 2 — Satellite propagation fix (BUG-01)

**Rationale:** One-line fix in the rAF loop closure. Worker infrastructure already supports parameterized timestamps. Most visually prominent correctness improvement — satellites visibly jump to historical orbital positions.

**Files:** `SatelliteLayer.tsx` loop only.

---

### Step 3 — Aircraft live lerp guard (BUG-02)

**Rationale:** More complex because two effects write `bb.position`. Must verify that the live lerp guard does not accidentally also suppress playback interpolation. Depends on snapshot data being correctly fetched (already working). Test both: paused scrubbing (lerp idle, no position drift) and active playback (lerp idle, playback effect updates positions per tick).

**Files:** `AircraftLayer.tsx` lerp loop body.

---

### Step 4 — Military and ship replayMode guards (BUG-06)

**Rationale:** Same pattern as Step 3 but simpler (no lerp). One guard per layer in Effect 2.

**Files:** `MilitaryAircraftLayer.tsx` Effect 2, `ShipLayer.tsx` Effect 2.

---

### Step 5 — GpsJamming polling freeze (BUG-04)

**Rationale:** Single-line hook change. Isolated from all renderer logic. Low risk.

**Files:** `useGpsJamming.ts`.

---

### Step 6 — StreetTraffic animation freeze (BUG-05)

**Rationale:** The `replayModeRef` pattern is straightforward but `StreetTrafficLayer` has the most complex internal rAF state (particles, roads, visibility, altitude gate). Fix last to ensure simpler fixes are confirmed first and don't mask issues here.

**Files:** `StreetTrafficLayer.tsx`.

---

## Architectural Patterns to Follow (Do Not Deviate)

### Pattern: getState() inside rAF closures — never subscriptions

All `PlaybackBar` tick logic reads current store state via `useAppStore.getState()` inside the rAF closure. This avoids stale closure bugs where the closure captures an old value from the render that started the loop.

BUG-01 and BUG-02 fixes must use `getState()`, never `useAppStore(s => s.replayTs)` inside a loop body. Adding `replayTs` to a `useEffect` dependency array that contains a 60 Hz rAF loop would restart the loop on every `replayTs` change — 60 re-mounts per second.

### Pattern: Ref for fast-path reads in rAF closures

`StreetTrafficLayer` uses `layerVisibleRef` (ref updated at render time, read in rAF closure) to access latest state without subscribing. The BUG-05 fix follows this exact pattern with `replayModeRef`.

### Pattern: refetchInterval gated on replayMode

`useAircraft` and `useMilitaryAircraft` use `refetchInterval: replayMode === 'live' ? interval : false`. This is the established hook-level pattern for halting polls during playback. BUG-04 uses this same pattern in `useGpsJamming`.

### Pattern: Playback effect structurally separate from live effect

In `AircraftLayer`, `MilitaryAircraftLayer`, and `ShipLayer`, the playback interpolation effect is a separate `useEffect` that does not modify live-mode data structures. BUG-02 fix mutes the live lerp via a guard; it does NOT merge the two effects or alter the playback effect. Structural separation preserved.

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Subscribing to replayTs inside an rAF loop's useEffect deps

**What people do:** Add `replayTs` to the `useEffect` dependency array that contains rAF loop setup.

**Why it's wrong:** `replayTs` changes at ~60 Hz during playback. Every change triggers effect cleanup (cancel rAF) and re-setup (restart rAF), restarting the loop 60 times per second. This causes jank, dropped frames, and potential Worker message queue backlog.

**Do this instead:** Read `replayTs` inside the loop body via `useAppStore.getState()`. Let the loop run continuously and sample state each tick.

---

### Anti-Pattern 2: Two effects both writing bb.position without ownership separation

**What people do:** Keep the live lerp running and add a playback effect that also writes `bb.position`.

**Why it's wrong:** The live lerp runs every animation frame (~16ms). The playback effect fires on `replayTs` change. The lerp always overwrites the playback position within one frame, making the playback effect a no-op. This is exactly BUG-02 in the current codebase.

**Do this instead:** Gate the live lerp with a `replayMode` check from `getState()`. In playback mode, the loop body returns early. The playback effect has exclusive ownership of `bb.position`.

---

### Anti-Pattern 3: Rebuilding GroundPrimitive on replayTs change

**What people do:** Make `GpsJammingLayer` react to `replayTs` and attempt to fetch historical jamming data, rebuilding the `GroundPrimitive` on each tick.

**Why it's wrong:** `GroundPrimitive` geometry is immutable after construction. Rebuilding requires destroy + recreate including GPU tessellation (~100ms per rebuild). At 60 Hz this is catastrophic. No historical jamming snapshot table exists in the backend.

**Do this instead:** Freeze the layer at its last fetched daily aggregate. GPS jamming is a daily inference — showing the current day's heatmap during historical replay is honest and labeled as such.

---

### Anti-Pattern 4: Driving viewer.clock from a component that also owns expensive geometry

**What people do:** Add clock sync code directly into `GlobeView.tsx` as a `useEffect` inside the viewer init effect.

**Why it's wrong:** GlobeView is already large and manages complex viewer lifecycle. Clock sync has its own `replayTs` subscription which runs at 60 Hz. Mixing this concern into the viewer init effect risks accidental re-runs of expensive CesiumJS init code.

**Do this instead:** Extract into `useViewerClock.ts`. The hook takes `viewer` as a parameter and has a single small `useEffect`. Mount it in `App.tsx` alongside the other layer components.

---

## Scaling Considerations

This is a single-user homelab tool. Concerns are rendering performance, not multi-tenancy.

| Concern | Current | Impact of Fix |
|---------|---------|---------------|
| Satellite propagation (1 Hz) | Worker batch, Float64Array zero-copy IPC | No change in frequency — `getState()` is O(1) |
| Aircraft lerp (60 Hz) | Module-scope maps, scratch Cartesian3 reuse | One `getState()` call added per frame — negligible |
| viewer.clock sync | New useEffect, fires on replayTs change | Two-line effect — no expensive computation |
| Snapshot memory | 2h window warned at ~264MB | No change to snapshot fetch scope or strategy |
| StreetTraffic freeze | No computation skipped in animate() idle path | Guard adds one ref read per frame — no cost |

---

## Sources

All findings from direct inspection of the codebase:

- `frontend/src/components/SatelliteLayer.tsx` — BUG-01 identified at lines 257–265
- `frontend/src/components/AircraftLayer.tsx` — BUG-02 identified at lines 247–265, 317–338
- `frontend/src/components/MilitaryAircraftLayer.tsx` — BUG-06 pattern identified in Effect 2
- `frontend/src/components/ShipLayer.tsx` — BUG-06 mirror pattern
- `frontend/src/components/GpsJammingLayer.tsx` — BUG-04: no replayMode awareness
- `frontend/src/components/StreetTrafficLayer.tsx` — BUG-05: animate() has no replayMode check
- `frontend/src/components/GlobeView.tsx` — BUG-03: no viewer.clock sync present
- `frontend/src/components/PlaybackBar.tsx` — correct reference implementation of getState() pattern
- `frontend/src/workers/propagation.worker.ts` — PROPAGATE handler ready for parameterized timestamp
- `frontend/src/hooks/useReplaySnapshots.ts` — correct reference implementation
- `frontend/src/hooks/useAircraft.ts` — correct refetchInterval gating pattern
- `frontend/src/hooks/useGpsJamming.ts` — missing replayMode gating (BUG-04)
- `frontend/src/hooks/useStreetTraffic.ts` — no replayMode awareness
- `frontend/src/store/useAppStore.ts` — store shape confirmed correct
- `frontend/src/App.tsx` — component mount points for useViewerClock

CesiumJS clock API (HIGH confidence — verified in v2.0 phase plans):
- `viewer.clock.currentTime` accepts a `JulianDate`
- `viewer.clock.shouldAnimate = false` pauses auto-advancement
- `JulianDate.fromDate(date)` converts JavaScript `Date` to CesiumJS `JulianDate`
- `viewer.clock.multiplier` controls playback speed (not used here — PlaybackBar owns speed)

---

*Architecture research for: 4D Replay Engine Correctness — v5.0 milestone*
*Researched: 2026-03-13*
