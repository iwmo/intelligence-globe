# Phase 25: Layer Audit - Research

**Researched:** 2026-03-13
**Domain:** React Query refetch gating, rAF loop playback exclusivity, CesiumJS primitive visibility, Zustand store reads
**Confidence:** HIGH

---

## Summary

Phase 25 is a surgical audit of five layers — aircraft, ships, military, GPS jamming, and street traffic — to ensure each is fully inert during playback. The codebase has already laid the groundwork in phases 23–24: `isPlaying` is in the store, `replayMode` is globally readable, and snapshot interpolation effects exist in all three entity layers. What is missing are the guards that prevent live data from overwriting snapshot positions, the refetch freeze for GPS jamming, the "LIVE DATA" badge on the GPS jamming layer, and the particle hiding/invalidation logic for street traffic and PLAY-04 (return-to-LIVE query invalidation).

The work is mechanical: add `if (replayMode === 'playback') return;` guards in the right places, wire `queryClient.invalidateQueries()` to the LIVE toggle, and render one badge. No new libraries are needed. The `queryClient` is module-scoped in `main.tsx` and must be exported (or the pattern must change) so the PlaybackBar toggle can call `invalidateQueries`.

**Primary recommendation:** Export `queryClient` from `main.tsx` (or move it to a dedicated `queryClient.ts` module), then import it in `PlaybackBar` for the `invalidateQueries()` call on return to LIVE. All other work is pure guard insertion in existing effect bodies.

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| PLAY-04 | Returning to LIVE triggers `queryClient.invalidateQueries()` — no 90-second stale-data window after mode switch | `queryClient` must be accessible outside React tree; export from a shared module |
| LAYR-01 | Aircraft live lerp returns early in playback mode; snapshot interpolation has exclusive `bb.position` ownership in playback | Live lerp loop in Effect 2 of AircraftLayer writes `bb.position` every rAF frame and currently does NOT guard on `replayMode` |
| LAYR-02 | Ships + military `Effect 2` gated by `replayMode` — background React Query refetches cannot overwrite snapshot positions | Both ShipLayer and MilitaryAircraftLayer Effect 2 call `bb.position = pos` unconditionally on `ships.data` / `militaryAircraft.data` change |
| LAYR-03 | GPS jamming `refetchInterval` frozen in playback; amber "LIVE DATA" badge visible when layer is on in playback | `useGpsJamming` uses static `refetchInterval: 86_400_000`, not guarded by `replayMode`; no badge rendered anywhere |
| LAYR-04 | Street traffic particles hidden during playback and reappear immediately on return to LIVE | `StreetTrafficLayer` has no `replayMode` awareness at all; particles would animate during playback |
</phase_requirements>

---

## Standard Stack

### Core (all already installed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@tanstack/react-query` | ^5.90.21 | Server state + refetch control | Already used; `invalidateQueries` is the correct API |
| `zustand` | ^5.0.11 | Global store | `useAppStore` holds `replayMode`; read via `getState()` in non-React contexts |
| `vitest` | ^4.0.18 | Unit tests | Project standard; all layer tests use jsdom + vi.mock pattern |
| `cesium` | ^1.139.1 | Globe primitives | BillboardCollection, PointPrimitiveCollection, GroundPrimitive already used |

No new packages are required for this phase.

---

## Architecture Patterns

### Pattern 1: Exporting queryClient for imperative invalidation

**What:** Move the `QueryClient` instance out of `main.tsx` into a shared `src/lib/queryClient.ts` so any module can import it for imperative calls.

**When to use:** Required for PLAY-04 — `PlaybackBar.handleModeToggle` is a plain function, not a hook, so `useQueryClient()` is not applicable there.

**Example:**
```typescript
// src/lib/queryClient.ts
import { QueryClient } from '@tanstack/react-query';
export const queryClient = new QueryClient();

// main.tsx — import instead of creating inline
import { queryClient } from './lib/queryClient';
```

### Pattern 2: replayMode guard in rAF lerp loop (LAYR-01)

**What:** Read `replayMode` from the store inside the rAF `lerp()` closure via `useAppStore.getState()` and return early without writing `bb.position` when in playback mode. The loop itself continues running so resume is instant (existing Phase 23/24 decision: "Aircraft lerp loop must stay alive in playback — enables instant resume without loop restart").

**Critical detail:** The loop closure captures `collection` but must NOT capture `replayMode` as a stale closure variable. Read it via `getState()` each frame.

```typescript
function lerp() {
  if (!rafRunningRef.current) return;
  // LAYR-01: yield position ownership to snapshot interpolation in playback
  if (useAppStore.getState().replayMode === 'playback') {
    rafRef.current = requestAnimationFrame(lerp);
    return;
  }
  const alpha = Math.min((Date.now() - lastUpdateTime) / POLL_INTERVAL_MS, 1.0);
  for (const [icao24, bb] of billboardsByIcao24) {
    // ... lerp as before
  }
  rafRef.current = requestAnimationFrame(lerp);
}
```

### Pattern 3: Effect 2 guard for ships and military (LAYR-02)

**What:** Add `if (replayMode === 'playback') return;` at the top of `ShipLayer` Effect 2 and `MilitaryAircraftLayer` Effect 2. Both effects depend on `[viewer, ships.data, layerVisible]` / `[viewer, militaryAircraft.data, layerVisible]`. The `replayMode` value is already a reactive selector in both components — add it to the effect deps array.

**Focus-triggered refetch risk:** React Query `refetchOnWindowFocus` is true by default. When the browser tab regains focus, a `staleTime`-expired query refetches, then Effect 2 fires. The guard prevents this overwrite. `refetchInterval: false` in playback already suppresses interval refetches; focus refetches need the Effect 2 guard as a second defense (confirmed in STATE.md accumulated context).

### Pattern 4: useGpsJamming refetchInterval gating (LAYR-03)

**What:** `useGpsJamming` currently hard-codes `refetchInterval: 86_400_000`. Change to `replayMode === 'live' ? 86_400_000 : false` matching the pattern in `useAircraft` and `useShips`.

```typescript
export function useGpsJamming() {
  const replayMode = useAppStore(s => s.replayMode);
  return useQuery<{ cells: GpsJammingCell[] }>({
    // ...
    staleTime: 86_400_000,
    refetchInterval: replayMode === 'live' ? 86_400_000 : false,
    // ...
  });
}
```

**Badge placement:** `GpsJammingLayer` renders `null`. The badge must be rendered by a React component that has access to `replayMode` and `layerVisible`. Options:
1. Move badge rendering into `GpsJammingLayer` by returning a React Fragment with a positioned `<div>` overlay alongside the Cesium primitive management.
2. Render the badge in `LeftSidebar` or a HUD component.

**Recommended approach:** Return a React Fragment from `GpsJammingLayer` containing both the null primitive side and a conditionally rendered overlay `<div>` positioned fixed at the top-right with `pointerEvents: 'none'`. This keeps all GPS jamming UI co-located. The badge text should read "GPS LIVE DATA" in amber (`#F59E0B` or `color: 'orange'`).

### Pattern 5: Street traffic hidden in playback (LAYR-04)

**What:** `StreetTrafficLayer` must:
1. Set all particle `show = false` when `replayMode === 'playback'`
2. Resume showing particles (via existing Effect 4 which already handles `layerVisible`) when mode returns to LIVE

**Implementation approach:**
- Read `replayMode` from store in `StreetTrafficLayer`
- Add a `replayModeRef` alongside `layerVisibleRef` for the rAF loop
- In the rAF `animate()` loop, also check `replayModeRef.current !== 'playback'` before moving particles
- Add a dedicated `useEffect` on `[replayMode]` that sets `p.primitive.show = layerVisible && replayMode !== 'playback'` for all particles (mirrors existing Effect 4 pattern)

Additionally, `useStreetTraffic` should stop fetching road data during playback. The `handleMoveEnd` callback already guards on `layerVisibleRef.current` — add a `replayModeRef` check:
```typescript
if (replayModeRef.current === 'playback') return;
```

### Pattern 6: Return-to-LIVE query invalidation (PLAY-04)

**What:** `PlaybackBar.handleModeToggle` currently does:
```typescript
useAppStore.getState().setIsPlaying(false);
setReplayMode('live');
useAppStore.getState().setReplayTs(Date.now());
```

Add `queryClient.invalidateQueries()` after mode is set to LIVE. This triggers immediate refetch of `['aircraft']`, `['ships']`, `['military-aircraft']`, `['gps-jamming']`, bypassing the stale window.

```typescript
import { queryClient } from '../lib/queryClient';

function handleModeToggle() {
  if (replayMode === 'live') {
    setReplayMode('playback');
  } else {
    useAppStore.getState().setIsPlaying(false);
    setReplayMode('live');
    useAppStore.getState().setReplayTs(Date.now());
    // PLAY-04: flush stale cache so layers show current data immediately
    queryClient.invalidateQueries();
  }
}
```

### Recommended File Touch List

| File | Change | Requirement |
|------|--------|-------------|
| `src/lib/queryClient.ts` | **New file** — export shared QueryClient instance | PLAY-04 |
| `src/main.tsx` | Import `queryClient` from `./lib/queryClient` instead of inline | PLAY-04 |
| `src/components/PlaybackBar.tsx` | Import `queryClient`, call `invalidateQueries()` on return to LIVE | PLAY-04 |
| `src/components/AircraftLayer.tsx` | Guard lerp loop with `getState().replayMode === 'playback'` early return | LAYR-01 |
| `src/components/ShipLayer.tsx` | Guard Effect 2 with `if (replayMode === 'playback') return;` | LAYR-02 |
| `src/components/MilitaryAircraftLayer.tsx` | Guard Effect 2 with `if (replayMode === 'playback') return;` | LAYR-02 |
| `src/hooks/useGpsJamming.ts` | Read `replayMode` from store, gate `refetchInterval` | LAYR-03 |
| `src/components/GpsJammingLayer.tsx` | Render amber "LIVE DATA" badge overlay when `replayMode === 'playback' && layerVisible` | LAYR-03 |
| `src/components/StreetTrafficLayer.tsx` | Read `replayMode`, hide particles + freeze rAF during playback | LAYR-04 |
| `src/hooks/useStreetTraffic.ts` | Guard `handleMoveEnd` road fetch when `replayMode === 'playback'` | LAYR-04 |

### Anti-Patterns to Avoid

- **Capturing `replayMode` as a stale closure variable inside rAF loops.** Always read via `useAppStore.getState().replayMode` inside the rAF body.
- **Cancelling the rAF loop on entering playback.** The aircraft lerp loop must stay running — only the `bb.position` write should be skipped. Cancelling means re-starting on resume, which causes one-frame stutter.
- **Calling `queryClient.invalidateQueries()` inside a React render.** Only call it in event handlers or `useEffect` cleanup.
- **Adding `replayMode` to Effect 2's dep array without also reading `replayMode` from the store selector.** Both components already select `replayMode` — add it to the effect dep list.
- **Rendering the GPS badge inside a Cesium primitive lifecycle effect.** Cesium primitive management and React DOM rendering must stay in separate effects. Use a conditional render in the JSX return, not inside `useEffect`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Cache invalidation on mode switch | Custom refetch timer | `queryClient.invalidateQueries()` | React Query handles deduplication, error retry, loading state |
| Checking if tab focus triggered refetch | Intercept focus events | `refetchInterval: false` + Effect 2 guard | Defense-in-depth pattern already validated in STATE.md |
| Badge animation | CSS keyframes | Static styled `<div>` with amber color | No animation requirement in success criteria |

---

## Common Pitfalls

### Pitfall 1: Aircraft rAF loop capturing stale `replayMode`
**What goes wrong:** The `lerp()` closure is created once when `aircraft.data` changes (Effect 2). If `replayMode` is read as a closure variable from the `useEffect` scope, it will be the value at the time the effect ran, not the current value when the frame fires.
**Why it happens:** rAF loops in React run outside the render cycle. Closures freeze over state at effect creation time.
**How to avoid:** Read `useAppStore.getState().replayMode` inside the `lerp()` function body, not from the outer `useEffect` scope.
**Warning signs:** Positions freeze correctly when entering playback, but don't resume correctly after toggling back to LIVE without a re-render.

### Pitfall 2: GpsJammingLayer returns null — badge has no DOM attachment point
**What goes wrong:** `GpsJammingLayer` currently returns `null`. A badge `<div>` cannot be returned alongside `null` without a wrapper.
**Why it happens:** The component was designed as a pure Cesium side-effect component.
**How to avoid:** Change the return type to `React.ReactElement | null` and return either `null` (no badge) or a `<>...</>` fragment containing a fixed-position `<div>` overlay when the badge is needed.

### Pitfall 3: queryClient not accessible in PlaybackBar
**What goes wrong:** `queryClient` is created inline in `main.tsx` and never exported. Importing from `main.tsx` creates a circular module graph in some bundler configurations.
**Why it happens:** Common "works for now" initialization pattern that doesn't anticipate imperative access.
**How to avoid:** Create `src/lib/queryClient.ts` as a dedicated module. Both `main.tsx` and `PlaybackBar.tsx` import from there.

### Pitfall 4: Street traffic roads persist into playback after camera panned
**What goes wrong:** If the user pans below 100km altitude before entering playback, roads are loaded and stored in the hook's `useState`. Hiding particles hides the visual, but the road data remains. On return to LIVE, the pre-loaded data is still valid and particles resume correctly — this is fine. However, if the debounce timer fires during playback (unlikely given DEBOUNCE_MS = 3000 but possible), a fetch is triggered and road data updates during playback.
**How to avoid:** In `useStreetTraffic`, the `handleMoveEnd` guard `if (!layerVisibleRef.current) return` should be extended to also check a `replayModeRef`. This prevents the debounce from firing during playback.

### Pitfall 5: Ships/military Effect 2 has replayMode in old dep array
**What goes wrong:** Adding `if (replayMode === 'playback') return;` works, but if `replayMode` is not in the effect deps, ESLint react-hooks/exhaustive-deps will warn. More importantly, when transitioning from playback back to LIVE, the effect will NOT re-run to apply the latest data (since neither `ships.data` nor `layerVisible` changed). This means the first live data update after resume will be the next refetch, not the invalidated data.
**How to avoid:** Add `replayMode` to the deps array. When `setReplayMode('live')` fires and `invalidateQueries()` triggers a refetch, the new data will arrive and `ships.data` changes, re-running Effect 2 with `replayMode === 'live'`, writing the fresh positions.

---

## Code Examples

### LAYR-01: Aircraft rAF lerp guard
```typescript
// Source: AircraftLayer.tsx Effect 2 rAF loop — add guard at top of lerp()
function lerp() {
  if (!rafRunningRef.current) return;
  // LAYR-01: snapshot interpolation has exclusive bb.position ownership in playback
  if (useAppStore.getState().replayMode === 'playback') {
    rafRef.current = requestAnimationFrame(lerp);
    return;
  }
  const alpha = Math.min((Date.now() - lastUpdateTime) / POLL_INTERVAL_MS, 1.0);
  for (const [icao24, bb] of billboardsByIcao24) {
    const prev = prevPositions.get(icao24);
    const curr = currPositions.get(icao24);
    if (prev && curr && bb && !collection.isDestroyed()) {
      bb.position = Cartesian3.lerp(prev, curr, alpha, scratchLerp);
    }
  }
  rafRef.current = requestAnimationFrame(lerp);
}
```

### LAYR-02: Ship Effect 2 guard
```typescript
// Source: ShipLayer.tsx Effect 2 — add replayMode guard and dep
useEffect(() => {
  if (replayMode === 'playback') return;   // LAYR-02: guard added
  if (!viewer || viewer.isDestroyed() || !ships.data || !collectionRef.current) return;
  // ... existing position update logic unchanged
}, [viewer, ships.data, layerVisible, replayMode]); // replayMode added to deps
```

### LAYR-03: GPS jamming refetchInterval gate
```typescript
// Source: useGpsJamming.ts — add replayMode selector and gate
import { useAppStore } from '../store/useAppStore';

export function useGpsJamming() {
  const replayMode = useAppStore(s => s.replayMode);
  return useQuery<{ cells: GpsJammingCell[] }>({
    queryKey: ['gps-jamming'],
    queryFn: async () => { /* unchanged */ },
    staleTime: 86_400_000,
    refetchInterval: replayMode === 'live' ? 86_400_000 : false,
    retry: 3,
    retryDelay: 5_000,
  });
}
```

### LAYR-03: GPS jamming badge in GpsJammingLayer
```typescript
// Source: GpsJammingLayer.tsx — change return to render badge overlay
const replayMode = useAppStore(s => s.replayMode);
// ... existing effects unchanged ...

const badge = replayMode === 'playback' && layerVisible ? (
  <div style={{
    position: 'fixed',
    top: '60px',
    right: '12px',
    zIndex: 100,
    background: 'rgba(245, 158, 11, 0.15)',
    border: '1px solid #F59E0B',
    color: '#F59E0B',
    fontFamily: 'monospace',
    fontSize: '10px',
    fontWeight: 700,
    padding: '2px 6px',
    borderRadius: '3px',
    pointerEvents: 'none',
  }}>
    GPS LIVE DATA
  </div>
) : null;

return badge;
```

### LAYR-04: Street traffic playback hide effect
```typescript
// Source: StreetTrafficLayer.tsx — new effect after Effect 4
const replayMode = useAppStore(s => s.replayMode);
const replayModeRef = useRef(replayMode);
replayModeRef.current = replayMode;

// Effect 5: Hide particles during playback
useEffect(() => {
  for (const p of particlesRef.current) {
    p.primitive.show = layerVisible && replayMode !== 'playback';
  }
}, [replayMode, layerVisible]);
```

### PLAY-04: queryClient module + invalidation
```typescript
// Source: NEW src/lib/queryClient.ts
import { QueryClient } from '@tanstack/react-query';
export const queryClient = new QueryClient();

// Source: PlaybackBar.tsx handleModeToggle
import { queryClient } from '../lib/queryClient';

function handleModeToggle() {
  if (replayMode === 'live') {
    setReplayMode('playback');
  } else {
    useAppStore.getState().setIsPlaying(false);
    setReplayMode('live');
    useAppStore.getState().setReplayTs(Date.now());
    queryClient.invalidateQueries(); // PLAY-04: flush stale cache immediately
  }
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `refetchInterval: false` alone to freeze queries | `refetchInterval: false` + Effect 2 guard (defense in depth) | Phase 24 STATE.md decision | Focus-triggered refetches bypass `refetchInterval: false`; guard prevents position overwrite |
| `isPlaying` in PlaybackBar local state | `isPlaying` in `useAppStore` | Phase 23 | All layer components can read it |
| Aircraft lerp loop cancelled on playback | Loop kept alive, `bb.position` write skipped | Phase 24 design decision | Instant resume without loop restart |

---

## Open Questions

1. **Badge positioning conflict with other HUD elements**
   - What we know: CinematicHUD and PlaybackBar are at `z-index: 79–80`; badge would be at `z-index: 100`
   - What's unclear: Exact position `top: 60px, right: 12px` may collide with other overlays at certain screen sizes
   - Recommendation: Use the values above; adjust if manual testing reveals overlap

2. **`queryClient.invalidateQueries()` invalidates ALL queries including snapshots**
   - What we know: `invalidateQueries()` with no filter invalidates everything, including `['replay-snapshots']`
   - What's unclear: Whether invalidating snapshot queries on return to LIVE causes a spurious fetch
   - Recommendation: Use `queryClient.invalidateQueries({ queryKey: ['aircraft'] })` etc. with specific keys, OR accept the no-arg version since snapshot queries have `enabled: false` in LIVE mode and will not re-fetch

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 4.0.18 |
| Config file | `frontend/vite.config.ts` (test section) |
| Quick run command | `cd frontend && npx vitest run --reporter=verbose src/components/__tests__/AircraftLayer.debounce.test.tsx` |
| Full suite command | `cd frontend && npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PLAY-04 | `invalidateQueries()` called when switching to LIVE | unit | `npx vitest run src/components/__tests__/PlaybackBar.test.tsx` | ✅ (needs new test case) |
| LAYR-01 | Aircraft lerp skips `bb.position` write when `replayMode === 'playback'` | unit | `npx vitest run src/hooks/__tests__/useAircraftLerpGuard.test.ts` | ❌ Wave 0 |
| LAYR-02 | ShipLayer Effect 2 returns early in playback | unit | `npx vitest run src/components/__tests__/ShipLayer.test.tsx` | ✅ (needs new test case) |
| LAYR-02 | MilitaryAircraftLayer Effect 2 returns early in playback | unit | `npx vitest run src/components/__tests__/MilitaryAircraftLayer.test.tsx` | ✅ (needs new test case) |
| LAYR-03 | `useGpsJamming` refetchInterval is `false` in playback | unit | `npx vitest run src/hooks/__tests__/useGpsJamming.test.ts` | ❌ Wave 0 |
| LAYR-03 | GPS badge renders when playback + layer visible | unit | `npx vitest run src/components/__tests__/GpsJammingLayer.test.tsx` | ✅ (needs new test case) |
| LAYR-04 | Street traffic particles hidden in playback | unit | `npx vitest run src/components/__tests__/StreetTrafficLayer.test.tsx` | ✅ (needs new test case) |

### Sampling Rate
- **Per task commit:** `cd frontend && npx vitest run src/components/__tests__/ src/hooks/__tests__/`
- **Per wave merge:** `cd frontend && npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `frontend/src/hooks/__tests__/useGpsJamming.test.ts` — covers LAYR-03 refetchInterval freeze
- [ ] `frontend/src/hooks/__tests__/useAircraftLerpGuard.test.ts` — covers LAYR-01 rAF guard logic

*(Existing test files for GpsJammingLayer, ShipLayer, MilitaryAircraftLayer, StreetTrafficLayer, and PlaybackBar exist but only have smoke tests; each needs a new `describe` block for playback-mode behavior.)*

---

## Sources

### Primary (HIGH confidence)
- Direct source inspection: `frontend/src/components/AircraftLayer.tsx` — live lerp loop has no `replayMode` guard (confirmed)
- Direct source inspection: `frontend/src/components/ShipLayer.tsx` — Effect 2 has no `replayMode` guard (confirmed)
- Direct source inspection: `frontend/src/components/MilitaryAircraftLayer.tsx` — Effect 2 has no `replayMode` guard (confirmed)
- Direct source inspection: `frontend/src/hooks/useGpsJamming.ts` — `refetchInterval` not gated by `replayMode` (confirmed)
- Direct source inspection: `frontend/src/components/GpsJammingLayer.tsx` — no badge, no `replayMode` reference (confirmed)
- Direct source inspection: `frontend/src/components/StreetTrafficLayer.tsx` — no `replayMode` reference (confirmed)
- Direct source inspection: `frontend/src/main.tsx` — `queryClient` created inline, not exported (confirmed)
- `.planning/STATE.md` accumulated context — "refetchInterval: false alone insufficient — focus-triggered React Query refetches bypass it; add replayMode guard inside Effect 2 as defense in depth"
- `.planning/REQUIREMENTS.md` — all five requirement IDs confirmed as pending

### Secondary (MEDIUM confidence)
- TanStack Query v5 docs pattern: `queryClient.invalidateQueries()` triggers immediate background refetch for all registered queries; queries with `enabled: false` are unaffected

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already installed and in use
- Architecture: HIGH — all patterns derived from direct source inspection, not inference
- Pitfalls: HIGH — each pitfall is grounded in specific lines of actual code read during research

**Research date:** 2026-03-13
**Valid until:** 2026-04-13 (stable React Query + Zustand APIs; Cesium primitives unchanged)
