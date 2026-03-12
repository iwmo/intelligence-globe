# Phase 11: Replay Engine - Research

**Researched:** 2026-03-12
**Domain:** React/CesiumJS LIVE/PLAYBACK mode toggle, custom timeline scrubber UI, frontend lerp interpolation over 60-second snapshot data, OSINT event marker rendering
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| REP-02 | User can switch between LIVE and PLAYBACK modes via a toggle in the top bar | Zustand store extension for `replayMode` + `replayTs` state; all live layer hooks conditionally pause their refetch intervals when `replayMode === 'playback'`; a new `PlaybackBar` component in the top bar area drives viewer.clock or manages its own `replayTs` timestamp |
| REP-03 | User can scrub through a historical timeline with configurable speed controls (1m/s, 3m/s, 5m/s, 15m/s, 1h/s) | Custom HTML range input as scrubber drives `replayTs` in store; a `useInterval` rAF loop advances `replayTs` by `speedMultiplier × dt`; a `useReplaySnapshots` hook fetches the available window from `/api/replay/snapshots` and returns sorted snapshot arrays per layer; frontend lerp between adjacent snapshots by `alpha = (replayTs - snapA.ts) / (snapB.ts - snapA.ts)` |
| REP-04 | User sees OSINT event markers on the timeline (Kinetic, Airspace Closure, Maritime, GPS Jamming, Internet Blackout) and can click a marker to jump the scrubber to that moment | Event markers are static data objects (no DB persistence in Phase 11 — Phase 12 handles event entry); they are rendered as absolutely-positioned colored dots on the timeline bar; clicking jumps `replayTs` to the event's `ts` field in the store |
</phase_requirements>

---

## Summary

Phase 11 is predominantly a **frontend-only phase**. The backend API (`GET /api/replay/snapshots`) was completed in Phase 10. The work here is entirely in the React/CesiumJS frontend: (1) a global mode toggle that freezes all live-polling hooks when PLAYBACK is active, (2) a custom timeline scrubber that drives a `replayTs` timestamp through the snapshot history window, (3) a configurable playback speed loop, and (4) colored OSINT event marker dots on the timeline that jump the scrubber.

The project has an explicit architectural decision against CZML-based replay ("CZML replay is not flexible enough for multi-layer custom timeline UI") and against using the CesiumJS default Timeline widget ("CesiumJS widget lacks speed presets, event dot coloring, and category filtering"). The correct approach is a **custom React `PlaybackBar` component** that manages `replayTs` in the Zustand store and drives entity positions directly through the same `PointPrimitive.position` mechanism that live lerp already uses — just with a different interpolation source (snapshot pairs instead of live-poll pairs).

The key insight for interpolation: in live mode, `AircraftLayer` lerps between `prevPositions` and `currPositions` over `POLL_INTERVAL_MS`. In playback mode, the same math applies but `prevPositions` and `currPositions` are loaded from the snapshot API response, and `alpha` is derived from `(replayTs - snapA.ts) / (snapB.ts - snapA.ts)` rather than from wall-clock elapsed time.

**Primary recommendation:** Extend Zustand store with `replayMode`, `replayTs`, and `replaySpeedMultiplier`; create `useReplaySnapshots` hook consuming `/api/replay/snapshots`; create `PlaybackBar` component with scrubber + speed controls + event markers; modify each layer component to respect `replayMode` from store.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| zustand | ^5.0.11 (installed) | Global replay state: mode, timestamp, speed | Already the project state manager; established pattern for all layer/selection state |
| @tanstack/react-query | ^5.90.21 (installed) | Fetch snapshot window from `/api/replay/snapshots` | Already used by all hooks; `staleTime` and `refetchInterval` control is critical for pausing live polling |
| cesium | ^1.139.1 (installed) | `PointPrimitive.position` mutation for playback positions | All entity layers already use PointPrimitiveCollection; playback writes to same primitives |
| lucide-react | ^0.577.0 (installed) | Icons for LIVE/PLAYBACK toggle, play/pause, speed controls | Established project UI icon library; `Play`, `Pause`, `SkipBack`, `Radio` already confirmed present |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| React `useRef` + `requestAnimationFrame` | built-in | Playback advancement loop that advances `replayTs` each frame by `speedMultiplier × dt` | Use rAF loop (not `setInterval`) to keep playback smooth — same pattern as the live lerp rAF loop in `AircraftLayer` |
| React `useCallback` + `useEffect` | built-in | Hook `useReplaySnapshots` caches parsed snapshot arrays between fetches | Avoids re-sorting 660,000-row arrays on every re-render |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Custom React PlaybackBar | CesiumJS default Timeline widget | CesiumJS widget has no speed presets, no event dot coloring, no category filtering — explicitly excluded in STATE.md decisions |
| Custom React PlaybackBar | CZML-based replay driving `viewer.clock` | CZML is not flexible enough for multi-layer custom UI — explicitly excluded in STATE.md decisions |
| Store-driven `replayTs` | viewer.clock.currentTime | viewer.clock drives CesiumJS animations but not custom layer hooks; mixing the two clocks creates sync bugs |
| rAF advancement loop | `setInterval` for playback tick | rAF is throttled when tab is backgrounded, preventing run-away time advancement; also syncs with render cycle |

**Installation:** No new packages needed. All dependencies are already in `package.json`.

---

## Architecture Patterns

### Recommended Project Structure
```
frontend/src/
├── store/
│   └── useAppStore.ts              # extend with replayMode, replayTs, replaySpeedMultiplier slices
├── hooks/
│   └── useReplaySnapshots.ts       # fetch /api/replay/snapshots for given time window and layer
├── components/
│   ├── PlaybackBar.tsx             # LIVE/PLAYBACK toggle + scrubber + speed controls + event markers
│   ├── AircraftLayer.tsx           # extend: read replayMode from store; in playback, use snapshot lerp
│   ├── MilitaryAircraftLayer.tsx   # extend: same pattern as AircraftLayer
│   └── ShipLayer.tsx               # extend: same pattern (ships don't lerp in live, but do in playback)
├── data/
│   └── osintEvents.ts              # static OSINT event seed data for Phase 11 timeline markers
└── components/__tests__/
    └── PlaybackBar.test.tsx        # smoke test: renders null when no snapshot window; renders scrubber
```

### Pattern 1: Zustand Store Extension for Replay Mode

**What:** Add three new fields to `useAppStore`: `replayMode` ('live' | 'playback'), `replayTs` (number — Unix epoch ms), and `replaySpeedMultiplier` (60 | 180 | 300 | 900 | 3600 corresponding to 1m/s, 3m/s, 5m/s, 15m/s, 1h/s). Also add `replayWindowStart` and `replayWindowEnd` (timestamps of available snapshot history, fetched from the backend).

**When to use:** Every component that has live-polling behavior reads `replayMode` and either continues polling normally (live) or freezes its data and reads from snapshot state (playback).

**Example:**
```typescript
// Extension to useAppStore.ts
replayMode: 'live' | 'playback';
setReplayMode: (mode: 'live' | 'playback') => void;
replayTs: number;              // ms since epoch; drives globe time in playback
setReplayTs: (ts: number) => void;
replaySpeedMultiplier: number; // seconds of real-world time per 1 second of wall-clock
setReplaySpeedMultiplier: (s: number) => void;
replayWindowStart: number | null;  // earliest available snapshot ts (ms)
replayWindowEnd: number | null;    // most recent available snapshot ts (ms)
setReplayWindow: (start: number, end: number) => void;
```

**Default state:**
```typescript
replayMode: 'live',
replayTs: Date.now(),
replaySpeedMultiplier: 60,   // 1m/s default
replayWindowStart: null,
replayWindowEnd: null,
```

### Pattern 2: Pausing Live Polling Hooks in Playback Mode

**What:** Each live hook (`useAircraft`, `useMilitaryAircraft`, `useShips`) conditionally disables its `refetchInterval` when `replayMode === 'playback'`. React Query supports `refetchInterval: false` to stop polling.

**When to use:** Immediately when mode switches to 'playback'. The hook's cached data stays in memory — the layer component reads that frozen snapshot as the "last known live position" until playback overwrites it.

**Example:**
```typescript
// hooks/useAircraft.ts — existing hook, minimal change
export function useAircraft() {
  const replayMode = useAppStore(s => s.replayMode);
  return useQuery<AircraftRecord[]>({
    queryKey: ['aircraft'],
    queryFn: ...,
    staleTime: 90_000,
    refetchInterval: replayMode === 'live' ? 90_000 : false,  // pause in playback
    retry: 3,
    retryDelay: 5_000,
  });
}
```

**Critical:** `refetchInterval: false` only stops future refetches. It does NOT cancel an in-flight request. If a refetch fired just before mode switch, the result will still arrive and overwrite cached data. This is acceptable — the layer component will ignore it once it switches to snapshot-driven positions.

### Pattern 3: useReplaySnapshots Hook

**What:** Fetch the full snapshot window from `/api/replay/snapshots` for a given layer and time range. Returns sorted arrays per layer, keyed by `entity_id`. Pre-processes the flat array into a `Map<entityId, SnapshotRecord[]>` for O(1) lookup during the playback lerp loop.

**When to use:** Called once when playback mode activates. The time range is the available history window (`replayWindowStart` to `replayWindowEnd`). The result is cached by React Query; re-fetching is disabled during active playback.

**Example:**
```typescript
// hooks/useReplaySnapshots.ts
export interface SnapshotRecord {
  ts: number;           // parsed to ms since epoch
  entity_id: string;
  latitude: number;
  longitude: number;
  altitude: number | null;
  heading: number | null;
  speed: number | null;
}

export function useReplaySnapshots(
  layer: 'aircraft' | 'military' | 'ship' | 'all',
  windowStart: number | null,
  windowEnd: number | null,
  enabled: boolean,
) {
  return useQuery({
    queryKey: ['replaySnapshots', layer, windowStart, windowEnd],
    queryFn: async () => {
      if (!windowStart || !windowEnd) return new Map<string, SnapshotRecord[]>();
      const params = new URLSearchParams({
        layer,
        start: new Date(windowStart).toISOString(),
        end: new Date(windowEnd).toISOString(),
        limit: '100000',
      });
      const res = await fetch(`/api/replay/snapshots?${params}`);
      if (!res.ok) throw new Error(`Snapshot fetch failed: ${res.status}`);
      const { snapshots } = await res.json() as { snapshots: Array<{ts: string; entity_id: string; latitude: number; longitude: number; altitude: number | null; heading: number | null; speed: number | null}> };
      // Convert to Map<entityId, sorted SnapshotRecord[]>
      const byEntity = new Map<string, SnapshotRecord[]>();
      for (const s of snapshots) {
        const rec: SnapshotRecord = { ...s, ts: new Date(s.ts).getTime() };
        const arr = byEntity.get(s.entity_id) ?? [];
        arr.push(rec);
        byEntity.set(s.entity_id, arr);
      }
      // Sort each entity's snapshots by ts ascending (they should be, but guarantee it)
      for (const [, arr] of byEntity) arr.sort((a, b) => a.ts - b.ts);
      return byEntity;
    },
    enabled,
    staleTime: Infinity,   // snapshot history is immutable — never re-fetch during playback
    refetchInterval: false,
  });
}
```

### Pattern 4: PlaybackBar Component (Core UI)

**What:** A fixed-position bar rendered at the top of the viewport. Contains: LIVE/PLAYBACK toggle button, a time scrubber (HTML `<input type="range">`), current timestamp display, speed selector (5 preset buttons), and colored event marker dots overlaid on the scrubber track.

**Layout position:** Fixed at top, full-width, above the CinematicHUD's classification banner (or below it). The classification banner sits at `top: 0`, height ~26px. PlaybackBar should sit at `top: 26px` when visible, pushing existing elements down if needed — OR render as an overlay below the banner. zIndex: 79 (below CinematicHUD's zIndex: 80 but above layers).

**Visibility:** PlaybackBar renders only when `replayMode === 'playback'` OR it renders always but shows minimal chrome in live mode (just the LIVE/PLAYBACK toggle). The simplest approach: always-rendered, the scrubber + controls only appear in playback mode.

**Example structure:**
```tsx
// components/PlaybackBar.tsx
export function PlaybackBar() {
  const { replayMode, setReplayMode, replayTs, setReplayTs,
          replayWindowStart, replayWindowEnd,
          replaySpeedMultiplier, setReplaySpeedMultiplier } = useAppStore(s => ({...}));

  // Compute scrubber position as 0-1000 integer for <input type="range">
  const scrubberValue = replayWindowStart && replayWindowEnd
    ? Math.round(((replayTs - replayWindowStart) / (replayWindowEnd - replayWindowStart)) * 1000)
    : 0;

  const SPEED_PRESETS = [
    { label: '1m/s', value: 60 },
    { label: '3m/s', value: 180 },
    { label: '5m/s', value: 300 },
    { label: '15m/s', value: 900 },
    { label: '1h/s', value: 3600 },
  ];

  return (
    <div style={{ position: 'fixed', top: '26px', left: 0, right: 0, zIndex: 79, ... }}>
      {/* LIVE/PLAYBACK toggle */}
      <button onClick={() => setReplayMode(replayMode === 'live' ? 'playback' : 'live')}>
        {replayMode === 'live' ? 'PLAYBACK' : 'LIVE'}
      </button>

      {replayMode === 'playback' && (
        <>
          {/* Timeline scrubber */}
          <div style={{ position: 'relative', flex: 1 }}>
            <input type="range" min={0} max={1000} value={scrubberValue}
              onChange={e => {
                if (!replayWindowStart || !replayWindowEnd) return;
                const frac = parseInt(e.target.value) / 1000;
                setReplayTs(replayWindowStart + frac * (replayWindowEnd - replayWindowStart));
              }}
            />
            {/* OSINT event markers overlaid on scrubber track */}
            {OSINT_EVENTS.map(evt => <EventDot key={evt.id} event={evt} ... />)}
          </div>

          {/* Current time display */}
          <span>{new Date(replayTs).toISOString().slice(0, 19)}Z</span>

          {/* Speed selector */}
          {SPEED_PRESETS.map(p => (
            <button key={p.value}
              onClick={() => setReplaySpeedMultiplier(p.value)}
              style={{ fontWeight: replaySpeedMultiplier === p.value ? 700 : 400 }}>
              {p.label}
            </button>
          ))}
        </>
      )}
    </div>
  );
}
```

### Pattern 5: Playback Advancement rAF Loop

**What:** A `useEffect` in `PlaybackBar` (or a dedicated `usePlaybackClock` hook) runs a rAF loop that advances `replayTs` by `replaySpeedMultiplier * dt_seconds` each frame, clamped to `replayWindowEnd`. When `replayTs` reaches `replayWindowEnd`, playback auto-pauses (sets a `isPlaying` local state to false).

**When to use:** Only active when `replayMode === 'playback'` AND `isPlaying === true`. The scrubber drag sets `replayTs` directly without going through the rAF loop.

**Example:**
```typescript
// Inside PlaybackBar or usePlaybackClock hook
const rafRef = useRef<number>(0);
const lastFrameRef = useRef<number>(0);

useEffect(() => {
  if (replayMode !== 'playback' || !isPlaying) return;

  function tick(now: number) {
    const dt = lastFrameRef.current ? (now - lastFrameRef.current) / 1000 : 0;
    lastFrameRef.current = now;
    const next = replayTs + dt * replaySpeedMultiplier * 1000;  // ms
    if (replayWindowEnd && next >= replayWindowEnd) {
      setReplayTs(replayWindowEnd);
      setIsPlaying(false);
      return;
    }
    setReplayTs(next);
    rafRef.current = requestAnimationFrame(tick);
  }

  lastFrameRef.current = 0;
  rafRef.current = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(rafRef.current);
}, [replayMode, isPlaying, replaySpeedMultiplier]);
// NOTE: replayTs is intentionally NOT in deps — it's written by the loop, not read
```

**Critical:** `replayTs` must NOT be in the `useEffect` dependency array for the rAF loop. Reading it inside the callback via a ref (`replayTsRef.current`) avoids stale closure. Use `useAppStore.getState().replayTs` for latest value inside the rAF callback rather than closing over the React state.

### Pattern 6: Layer Snapshot Interpolation in Playback Mode

**What:** Each layer component (AircraftLayer, MilitaryAircraftLayer, ShipLayer) gains a new effect that watches `replayMode` and `replayTs` from the store. When in playback mode, it finds the two adjacent snapshots for each entity at `replayTs` using a binary search on the sorted snapshot array, computes `alpha`, and writes to `PointPrimitive.position`.

**When to use:** Replace the existing live lerp effect with a conditional: if playback, use snapshot lerp; if live, use existing live lerp.

**Snapshot lookup helper:**
```typescript
// Pure function — no React dependencies
function findAdjacentSnapshots(
  snapshots: SnapshotRecord[],
  ts: number,
): [SnapshotRecord | null, SnapshotRecord | null] {
  // Binary search for the last snapshot at or before ts
  let lo = 0, hi = snapshots.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (snapshots[mid].ts <= ts) lo = mid; else hi = mid - 1;
  }
  const before = snapshots[lo]?.ts <= ts ? snapshots[lo] : null;
  const after = snapshots[lo + 1] ?? null;
  return [before, after];
}

// In layer component playback effect:
const [snapA, snapB] = findAdjacentSnapshots(entitySnapshots, replayTs);
const alpha = snapA && snapB
  ? (replayTs - snapA.ts) / (snapB.ts - snapA.ts)
  : 1.0;
const lat = snapA && snapB ? snapA.latitude + alpha * (snapB.latitude - snapA.latitude) : snapA?.latitude ?? 0;
const lon = snapA && snapB ? snapA.longitude + alpha * (snapB.longitude - snapA.longitude) : snapA?.longitude ?? 0;
```

### Pattern 7: OSINT Event Markers (Static Data, Phase 11)

**What:** Phase 11 uses a static seed array of OSINT event objects (no database persistence — Phase 12 handles event entry). Each event has: `id`, `ts` (ms epoch), `category` ('KINETIC' | 'AIRSPACE' | 'MARITIME' | 'JAMMING' | 'BLACKOUT'), `label`, `color`.

**When to use:** Rendered as absolutely-positioned colored `<div>` dots inside the scrubber container. X position = `(event.ts - replayWindowStart) / (replayWindowEnd - replayWindowStart) * 100%`. Clicking dispatches `setReplayTs(event.ts)`.

**Event colors (per requirement):**
```typescript
const EVENT_COLORS: Record<string, string> = {
  KINETIC:   '#ff3333',   // red
  AIRSPACE:  '#ffaa00',   // amber
  MARITIME:  '#00aaff',   // blue
  JAMMING:   '#ff00ff',   // magenta
  BLACKOUT:  '#888888',   // grey
};
```

**Static seed data in `src/data/osintEvents.ts`:**
```typescript
export interface OsintEvent {
  id: string;
  ts: number;          // ms epoch
  category: 'KINETIC' | 'AIRSPACE' | 'MARITIME' | 'JAMMING' | 'BLACKOUT';
  label: string;
}

// Seeded with a few representative events across the history window
// (actual timestamps will be relative to available snapshot data)
export const OSINT_EVENTS: OsintEvent[] = [
  // Phase 11 uses placeholder events; Phase 12 replaces with DB-driven events
];
```

**Design note:** Phase 12 will replace this with database-driven events. For Phase 11, the seed data is hardcoded. The event marker rendering component must be designed to accept `OsintEvent[]` as a prop so Phase 12 can inject dynamic data without structural changes.

### Anti-Patterns to Avoid

- **Including `replayTs` in the rAF loop `useEffect` deps:** The loop writes `replayTs`, not reads it. Adding it to deps creates a new effect on every frame — infinite loop.
- **Using viewer.clock for replay timing:** `viewer.clock` drives CesiumJS built-in animations. Our layer hooks are driven by React state, not CesiumJS clock. Mixing the two produces unsynchronized entity motion.
- **Calling the snapshot API on every scrubber drag event:** Fetch the full history window once on playback mode activation; subsequent scrubber drags only update `replayTs` in the store — no API call.
- **Storing `Map<string, SnapshotRecord[]>` in Zustand:** Maps are not serializable and break Zustand's shallow equality. Store the snapshot data in React Query cache only. The layer components read it via `useReplaySnapshots`.
- **Re-sorting snapshot arrays on each render:** Sort once in `useReplaySnapshots` when data arrives, store the sorted result. Component effects read pre-sorted data.
- **Mounting PlaybackBar inside `{!cleanUI && ...}`:** The LIVE/PLAYBACK toggle must be accessible even in Clean UI mode (it affects the fundamental globe operation). Render PlaybackBar outside the cleanUI gate, same as CinematicHUD.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Playback time advancement | Custom `setInterval`-based clock | rAF loop pattern (same as AircraftLayer's lerp loop) | rAF self-throttles when tab is hidden; setInterval continues running and overshoots the window |
| Scrubber UI | Custom drag handler + canvas | HTML `<input type="range">` | Handles all pointer/touch events, keyboard accessibility, and browser rendering natively |
| Snapshot window discovery | Custom API endpoint | Reuse existing `/api/replay/snapshots` with wide time range | Phase 10 endpoint already returns earliest/latest ts in the response; query once with `limit=1` to discover bounds, OR use `ORDER BY ts DESC LIMIT 1` query. Alternatively, call with a 7-day window and read min/max ts from the result |
| Entity binary search | Linear scan through snapshots | `findAdjacentSnapshots` binary search helper (O(log n)) | At 10,000 entities × 7 days × 1440 snapshots/day = 14M snapshot records in memory; linear scan per frame is O(n) and will freeze the browser |
| Speed labels | Custom multiplier math | Static SPEED_PRESETS array with `{label, value}` objects | Prevents off-by-one errors in speed conversion; labels are user-visible requirements (1m/s, 3m/s, etc.) |

**Key insight:** The interpolation math is the same as the live lerp already implemented in `AircraftLayer`. The only difference is where `alpha` comes from: wall-clock elapsed time (live) vs. `(replayTs - snapA.ts) / (snapB.ts - snapA.ts)` (playback).

---

## Common Pitfalls

### Pitfall 1: Snapshot Data Volume in Browser Memory

**What goes wrong:** Fetching the full 7-day history for all layers returns 105M+ rows (see Phase 10 Research: ~15M rows/day). Parsing and storing this in the browser crashes the tab.

**Why it happens:** The `/api/replay/snapshots` endpoint has a default `limit=10000`. Requesting `layer=all` with `limit=100000` for a narrow time window is fine. Requesting the full 7-day window without a limit is catastrophic.

**How to avoid:** The `useReplaySnapshots` hook should fetch a **sliding window** of no more than 3-6 hours at a time, not the full 7-day history. The PlaybackBar shows the full available window in the scrubber but only fetches data for the visible/active window. When the user scrubs outside the loaded window, fetch the next window. For Phase 11, start with a 2-hour window — enough for meaningful playback without memory pressure.

**Warning signs:** Browser tab memory usage exceeds 500MB. Network response takes >10s.

### Pitfall 2: replayTs Stale Closure in rAF Loop

**What goes wrong:** The rAF callback closes over `replayTs` from when the effect ran (e.g., `1741820400000`). Every frame advances from that stale value instead of the current value. Result: clicking the scrubber has no effect — the loop resets to the stale value on the next frame.

**Why it happens:** `useEffect` captures variables at creation time. The loop runs many frames between effect re-creations.

**How to avoid:** Read `replayTs` from `useAppStore.getState().replayTs` inside the rAF callback — this is the mutable Zustand state, not the React closure. Write new value via `useAppStore.getState().setReplayTs(next)` — same pattern.

**Warning signs:** Scrubber jumps back after dragging. Speed change takes multiple seconds to take effect.

### Pitfall 3: Live Polling Resumes Before Layer Components Update

**What goes wrong:** User switches from PLAYBACK to LIVE. `refetchInterval` re-enables immediately. React Query fires a fetch. Result arrives while the layer component is still reading from snapshot data. The component shows a jarring jump from the last snapshot position to the live position.

**Why it happens:** The live refetch and the component mode-switch happen in different effects with different timing.

**How to avoid:** On switching back to live, set `replayTs = Date.now()` and clear snapshot data. The layer component checks `replayMode === 'live'` before each frame update. The brief period between mode switch and first live poll will show frozen-last-snapshot positions — this is acceptable and not jarring.

**Warning signs:** Entity positions "teleport" when switching from PLAYBACK to LIVE.

### Pitfall 4: No Snapshots in Database During Development

**What goes wrong:** Developer enables PLAYBACK mode and sees no entities — the snapshot API returns an empty list because Phase 10's snapshot task hasn't accumulated data yet (or docker-compose isn't running with the worker).

**Why it happens:** Phase 11 depends on Phase 10 having run for at least 1-2 hours.

**How to avoid:** The `PlaybackBar` should handle an empty snapshot response gracefully: show "No historical data available" message and disable the scrubber. Do not crash. The Wave 0 tests mock the snapshot API response to avoid this dependency in CI.

**Warning signs:** Scrubber renders but no entities appear when dragging.

### Pitfall 5: Event Marker Click Area Too Small

**What goes wrong:** OSINT event markers on the scrubber track are 6-8px dots. On a 1440px-wide scrubber, markers at similar timestamps overlap. Clicking them is unreliable on touchscreens.

**Why it happens:** Timeline scrubber is a thin horizontal bar; events cluster around notable time periods.

**How to avoid:** Give each marker a minimum 16×16px click target with `padding` or invisible `:before` pseudo-element. Use `title` attribute for tooltip. Sort markers and offset overlapping ones vertically.

### Pitfall 6: ShipLayer Lacks Lerp in Live Mode

**What goes wrong:** `ShipLayer` has no rAF lerp loop in live mode (STATE.md: "ShipLayer omits lerp rAF loop — direct position update sufficient for ship update cadence (30s)"). When implementing playback lerp for ships, the structure is different from `AircraftLayer`.

**Why it happens:** Ships update every 30s; the live lerp was deemed unnecessary for ships. But the snapshot API records ship positions at 60s intervals, same as aircraft.

**How to avoid:** For playback mode, ships DO need the `findAdjacentSnapshots` + alpha interpolation — add a playback-specific effect to `ShipLayer` that only runs when `replayMode === 'playback'`. The live path remains unchanged (no lerp loop).

---

## Code Examples

Verified patterns from existing project code:

### Zustand Store Slice Pattern (from useAppStore.ts)
```typescript
// Source: frontend/src/store/useAppStore.ts — established pattern
// New replay slice follows the same spread-merge setter pattern:
replayMode: 'live' as 'live' | 'playback',
setReplayMode: (mode) => set({ replayMode: mode }),
replayTs: Date.now(),
setReplayTs: (ts) => set({ replayTs: ts }),
replaySpeedMultiplier: 60,
setReplaySpeedMultiplier: (s) => set({ replaySpeedMultiplier: s }),
replayWindowStart: null as number | null,
replayWindowEnd: null as number | null,
setReplayWindow: (start, end) => set({ replayWindowStart: start, replayWindowEnd: end }),
```

### React Query Hook Pause Pattern (from useShips.ts)
```typescript
// Source: frontend/src/hooks/useShips.ts — established refetchInterval pattern
// To pause in playback mode, add one line:
refetchInterval: replayMode === 'live' ? 30_000 : false,
```

### rAF Loop Pattern (from AircraftLayer.tsx)
```typescript
// Source: frontend/src/components/AircraftLayer.tsx — established lerp loop
// Playback advancement loop follows same structure:
function tick(now: number) {
  if (!rafRunningRef.current) return;
  // ... advance replayTs via useAppStore.getState() ...
  rafRef.current = requestAnimationFrame(tick);
}
rafRef.current = requestAnimationFrame(tick);
// Cleanup:
return () => { cancelAnimationFrame(rafRef.current); rafRunningRef.current = false; };
```

### CesiumJS Viewer Access (from viewerRegistry.ts)
```typescript
// Source: frontend/src/lib/viewerRegistry.ts — getViewer() pattern
// PlaybackBar does NOT need the viewer directly (no CesiumJS calls needed).
// Layer components already have viewer as a prop.
```

### Frontend Smoke Test Pattern (from MilitaryAircraftLayer.test.tsx)
```typescript
// Source: frontend/src/components/__tests__/MilitaryAircraftLayer.test.tsx
// PlaybackBar.test.tsx follows same vi.mock pattern:
vi.mock('cesium', () => ({ /* minimal cesium mock */ }));
vi.mock('../../store/useAppStore', () => ({
  useAppStore: vi.fn((selector) => selector({
    replayMode: 'live',
    setReplayMode: vi.fn(),
    replayTs: Date.now(),
    setReplayTs: vi.fn(),
    replayWindowStart: null,
    replayWindowEnd: null,
    replaySpeedMultiplier: 60,
    setReplaySpeedMultiplier: vi.fn(),
  })),
}));
vi.mock('../../hooks/useReplaySnapshots', () => ({
  useReplaySnapshots: vi.fn(() => ({ data: new Map(), isLoading: false })),
}));
import { PlaybackBar } from '../PlaybackBar';
describe('PlaybackBar smoke test', () => {
  it('renders PLAYBACK button in live mode', () => {
    const { getByText } = render(<PlaybackBar />);
    expect(getByText('PLAYBACK')).toBeTruthy();
  });
});
```

### Replay API Fetch Pattern (extends routes_replay.py contract)
```typescript
// Fetching available snapshot window (Phase 11 frontend → Phase 10 backend)
// GET /api/replay/snapshots?layer=all&start=ISO&end=ISO&limit=1
// Response: { snapshots: [{ts, layer_type, entity_id, latitude, longitude, altitude, heading, speed}], count: N }
// Use start = 7 days ago, end = now, limit = 1 to discover if any data exists
const windowRes = await fetch(
  `/api/replay/snapshots?layer=all&start=${sevenDaysAgo}&end=${now}&limit=1`
);
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| CesiumJS Timeline widget for replay | Custom React timeline component | STATE.md decision (Phase 10 research) | Full control over speed presets, event dot coloring, category filtering |
| CZML for entity position replay | Direct `PointPrimitive.position` writes from snapshot data | STATE.md decision | Simpler, supports multi-layer async updates, no CZML parsing overhead |
| viewer.clock drives all animation | React state (`replayTs` in Zustand) drives layer positions | This project's design | Layer components are React-first; CesiumJS viewer is the render target, not the clock master |
| `setInterval` for data polling | React Query `refetchInterval` | @tanstack/react-query v5 | Automatic pause/resume via `refetchInterval: false`; built-in retry logic |

**Deprecated/outdated:**
- CesiumJS `viewer.clock.currentTime`: Do not use for driving layer positions. This project's architecture treats CesiumJS as a render layer, not a simulation engine.
- CZML `CzmlDataSource`: Explicitly excluded in REQUIREMENTS.md Out of Scope table. Do not introduce it.

---

## Open Questions

1. **Snapshot window discovery API call**
   - What we know: `/api/replay/snapshots` returns snapshots for a given time range. To discover the available window, the frontend must make a query.
   - What's unclear: Whether to add a dedicated `/api/replay/window` endpoint (returns `{oldest_ts, newest_ts}`) or infer it from a dual-limit query (`limit=1` ordered ASC and DESC). Adding an endpoint is cleaner but requires a backend change.
   - Recommendation: Add a lightweight `/api/replay/window` endpoint in Phase 11 Plan 01 (before Wave 0 stubs) that returns `{oldest_ts: ISO, newest_ts: ISO}`. This is a single DB query: `SELECT MIN(ts), MAX(ts) FROM position_snapshots`. The frontend calls this once on mount to populate `replayWindowStart` / `replayWindowEnd` in the store.

2. **Memory management for sliding snapshot window**
   - What we know: 2-hour window at ~11,000 entities × 120 snapshots/entity = ~1.32M records. Each record has ~7 numeric fields + string keys ≈ ~200 bytes → ~264MB for all three layers combined.
   - What's unclear: Whether 264MB is within acceptable browser memory budget for this homelab application. Likely yes (modern browsers allow 1-2GB per tab), but needs validation.
   - Recommendation: Start with 2-hour window in the initial implementation. Add a note to verify memory usage during UAT. If problematic, implement sliding-window fetching in Phase 12.

3. **SatelliteLayer in playback mode**
   - What we know: The SatelliteLayer uses SGP4 propagation (not snapshot data) to compute positions. Satellite positions are computed from TLEs, not stored in `position_snapshots`.
   - What's unclear: Whether satellite positions should be replayed from SGP4-computed positions at `replayTs` (most accurate) or frozen (simplest).
   - Recommendation: In Phase 11, freeze satellite positions in playback mode (use last live propagation result). Phase 12 (satellite overpass lines) will need SGP4 computation at `replayTs` — design the hook to accept a `targetTime` parameter that defaults to `Date.now()` in live mode and uses `replayTs` in playback mode.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 4.x (frontend) + pytest 8.x (backend) |
| Config file | `frontend/vite.config.ts` (`test.environment: 'jsdom'`) / `backend/pytest.ini` (`asyncio_mode = auto`) |
| Quick run command | `cd frontend && npx vitest run src/components/__tests__/PlaybackBar.test.tsx src/hooks/__tests__/useReplaySnapshots.test.ts` |
| Full suite command | `cd frontend && npx vitest run` and `cd backend && python -m pytest -x -q` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| REP-02 | `PlaybackBar` renders 'PLAYBACK' button when `replayMode === 'live'` | smoke | `npx vitest run src/components/__tests__/PlaybackBar.test.tsx` | Wave 0 |
| REP-02 | `PlaybackBar` renders 'LIVE' button when `replayMode === 'playback'` | smoke | `npx vitest run src/components/__tests__/PlaybackBar.test.tsx` | Wave 0 |
| REP-02 | Zustand store `setReplayMode` toggles `replayMode` between 'live' and 'playback' | unit | `npx vitest run src/store/__tests__/useAppStore.test.ts` | Wave 0 (extend existing) |
| REP-03 | `useReplaySnapshots` returns empty Map when `enabled=false` | unit | `npx vitest run src/hooks/__tests__/useReplaySnapshots.test.ts` | Wave 0 |
| REP-03 | `findAdjacentSnapshots([{ts:1000}, {ts:2000}], 1500)` returns `[snap@1000, snap@2000]` | unit | `npx vitest run src/hooks/__tests__/useReplaySnapshots.test.ts` | Wave 0 |
| REP-03 | Speed preset buttons render with correct labels | smoke | `npx vitest run src/components/__tests__/PlaybackBar.test.tsx` | Wave 0 |
| REP-04 | Event marker dots render for each event in OSINT_EVENTS when in playback mode | smoke | `npx vitest run src/components/__tests__/PlaybackBar.test.tsx` | Wave 0 |
| REP-04 | `/api/replay/window` returns 200 with `oldest_ts` and `newest_ts` keys | integration | `cd backend && python -m pytest tests/test_replay.py::test_replay_window_route -x` | Wave 0 |

### Sampling Rate
- **Per task commit:** `cd frontend && npx vitest run src/components/__tests__/PlaybackBar.test.tsx src/hooks/__tests__/useReplaySnapshots.test.ts`
- **Per wave merge:** `cd frontend && npx vitest run` and `cd backend && python -m pytest -x -q`
- **Phase gate:** Full frontend + backend suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `frontend/src/components/__tests__/PlaybackBar.test.tsx` — smoke tests for REP-02, REP-03, REP-04 (mode toggle button, speed presets, event markers)
- [ ] `frontend/src/hooks/__tests__/useReplaySnapshots.test.ts` — unit tests for `useReplaySnapshots` (disabled state, snapshot map building) and `findAdjacentSnapshots` pure function
- [ ] `backend/tests/test_replay.py` — extend with `test_replay_window_route` for new `/api/replay/window` endpoint (RED: expects 200 with `oldest_ts` / `newest_ts` keys before the route is implemented)
- [ ] Extend `frontend/src/store/__tests__/useAppStore.test.ts` — add assertions for `replayMode`, `replayTs`, `replaySpeedMultiplier` initial state and setters

*(Framework already installed — vitest 4.x in devDependencies, pytest in requirements-dev.txt)*

---

## Sources

### Primary (HIGH confidence)
- Existing project code: `frontend/src/store/useAppStore.ts` — Zustand slice extension pattern; spread-merge setter; TypeScript interface conventions
- Existing project code: `frontend/src/components/AircraftLayer.tsx` — rAF lerp loop pattern; `prevPositions`/`currPositions` Map pattern; `rafRunningRef` guard; module-scope Maps surviving re-renders
- Existing project code: `frontend/src/hooks/useShips.ts` — React Query `refetchInterval` pattern; how to pause polling
- Existing project code: `frontend/src/components/__tests__/MilitaryAircraftLayer.test.tsx` — vitest smoke test pattern with `vi.mock` for cesium and store
- Existing project code: `frontend/src/components/CinematicHUD.tsx` — fixed-position overlay pattern; zIndex: 80; pointer-events strategy; top-bar positioning
- Existing project code: `frontend/src/components/LeftSidebar.tsx` — layer toggle button component pattern; zIndex layering reference
- Existing project code: `frontend/src/App.tsx` — component mounting pattern; cleanUI gate logic
- Existing project code: `.planning/phases/10-snapshot-infrastructure/10-RESEARCH.md` — `/api/replay/snapshots` API contract; response shape; snapshot volume data
- `.planning/STATE.md` — locked architectural decisions: custom React TimelinePanel, LIVE/PLAYBACK mode drives viewer.clock directly (actually: drives Zustand replayTs), 60-second snapshot interval with frontend lerp
- `.planning/REQUIREMENTS.md` — REP-02/03/04 exact requirements; Out of Scope table (CZML, CesiumJS default Timeline)

### Secondary (MEDIUM confidence)
- @tanstack/react-query v5 docs (refetchInterval: false) — confirmed in package.json at ^5.90.21; `refetchInterval: false` is a documented option in v5
- HTML `<input type="range">` browser support — universally supported; appropriate for custom scrubber

### Tertiary (LOW confidence)
- Memory estimates for 2-hour snapshot window — calculated from Phase 10 Research volume figures (15M rows/day ÷ 24h × 2h = 1.25M rows); browser JSON parse time estimated; not empirically measured

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already installed; no new dependencies; patterns verified against existing code
- Architecture: HIGH — derived directly from AircraftLayer lerp pattern, Zustand patterns, React Query patterns all confirmed in existing files; architectural decisions locked in STATE.md
- Pitfalls: HIGH — stale closure pitfall is standard React/rAF; others derived from established project decisions and volume calculations from Phase 10 Research
- Snapshot volume: MEDIUM — estimated from Phase 10 Research figures; actual browser memory impact not empirically measured

**Research date:** 2026-03-12
**Valid until:** 2026-04-12 (stable stack; no planned breaking changes in zustand 5, react-query 5, or cesium 1.x)
