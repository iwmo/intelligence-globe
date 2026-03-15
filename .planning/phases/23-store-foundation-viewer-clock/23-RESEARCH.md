# Phase 23: Store Foundation + Viewer Clock — Research

**Researched:** 2026-03-13
**Domain:** Zustand store surgery, CesiumJS viewer.clock sync, React UI state promotion
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| PLAY-01 | `isPlaying` promoted from `PlaybackBar` local state to `useAppStore` so all layer components can read it | Store already holds `replayMode`/`replayTs`; `isPlaying` addition follows exact same Zustand slice pattern |
| PLAY-03 | Globe day/night shading follows `replayTs` via new `useViewerClock` hook syncing `viewer.clock.currentTime` | `viewer.clock` API confirmed; `scene.postUpdate.addEventListener` pattern locks sync to render loop |
| VIS-02 | CinematicHUD shows `REPLAY [ISO timestamp]` instead of `REC` when in playback mode | HUD already reads `useAppStore`; needs `replayMode` + `replayTs` selectors and conditional render |
| VIS-03 | Play button disabled with "Loading snapshots…" indicator while snapshot fetch is in progress | `useReplaySnapshots` returns `isLoading`; play button in `PlaybackBar` must read this from the store or from hook return value |
</phase_requirements>

---

## Summary

Phase 23 is a pure frontend refactor with no backend changes. There are four concrete changes to make:

1. **Promote `isPlaying`** from a `useState` local variable inside `PlaybackBar` to a new slice in `useAppStore` (`isPlaying: boolean`, `setIsPlaying`, `toggleIsPlaying`). The rAF loop already reads store state via `useAppStore.getState()` inside `tick()`, so moving the toggle there requires no architectural redesign — only the declaration site moves.

2. **Create `useViewerClock` hook** that attaches to `viewer.scene.postUpdate` and writes `viewer.clock.currentTime = JulianDate.fromDate(new Date(replayTs))` on every render frame when `replayMode === 'playback'`. This is the key CesiumJS integration — day/night shading is driven entirely by `viewer.clock.currentTime`, and the `postUpdate` listener fires inside the CesiumJS render loop, guaranteeing zero frame lag.

3. **Update `CinematicHUD`** to conditionally render `REPLAY [ISO timestamp]` vs. `REC` based on `replayMode` from the store. The pulsing red dot disappears in replay mode; the timestamp shows `replayTs` formatted as ISO-8601 instead of the live `Date.now()` clock.

4. **Gate the play button** with a loading state from `useReplaySnapshots`. The hook already returns `isLoading`. The play button must be disabled and show "Loading snapshots…" while `isLoading` is true. `isPlaying` stays `false` until loading completes.

**Primary recommendation:** Add `isPlaying`/`setIsPlaying` to `useAppStore` in one small slice commit, then wire everything else to that single source of truth. The `postUpdate` event listener pattern for `viewer.clock` is the only CesiumJS-specific pattern needed.

---

## Standard Stack

### Core (all already installed — no new deps)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| zustand | 5.0.11 | Global state — `isPlaying` slice | Already the project store; `create` + `set` pattern matches existing slices |
| cesium | 1.139.1 | `viewer.clock.currentTime`, `JulianDate.fromDate`, `scene.postUpdate` | Only supported CesiumJS clock API; drives day/night lighting |
| react | 19.2.0 | `useEffect` for listener teardown in `useViewerClock` | Standard hook pattern |
| vitest + @testing-library/react | 4.0.18 / 16.3.2 | Test new slice and updated components | Already configured; test environment is jsdom |

### No New Dependencies Required

All packages needed are already in `package.json`. The `JulianDate` import already comes from `cesium` (tree-shaken).

---

## Architecture Patterns

### Pattern 1: Zustand Slice Addition (PLAY-01)

**What:** Add `isPlaying` and `setIsPlaying` / `toggleIsPlaying` to the existing `AppState` interface in `useAppStore.ts`.

**Current state of `PlaybackBar`:** Line 45 — `const [isPlaying, setIsPlaying] = useState(false)`. This is the only declaration site. The rAF loop calls `setIsPlaying(false)` on window end (line 97) and returns. The PLAY/PAUSE toggle calls `setIsPlaying(p => !p)` (line 175). Neither of these patterns requires React state — they are imperative mutations that work identically against Zustand `set`.

**Migration path:**
- Add to `AppState` interface: `isPlaying: boolean`, `setIsPlaying: (v: boolean | ((prev: boolean) => boolean)) => void`
- Add to store implementation: `isPlaying: false`, `setIsPlaying: (v) => set((s) => ({ isPlaying: typeof v === 'function' ? v(s.isPlaying) : v }))`
- In `PlaybackBar`: delete `useState` line; replace with `const isPlaying = useAppStore(s => s.isPlaying)` and `const setIsPlaying = useAppStore(s => s.setIsPlaying)`
- In the rAF `tick()` loop: `setIsPlaying(false)` already works because `tick` calls `useAppStore.getState().setIsPlaying(false)` — it reads state fresh. No stale closure issue.
- Reset `isPlaying` to `false` when switching back to LIVE mode (inside `handleModeToggle`), same as today.

**Critical rule from STATE.md:** `isPlaying` belongs in `useAppStore` (transient runtime state), not `useSettingsStore` (not persisted). This matches the existing decision: `useSettingsStore` only holds `defaultMode`, not runtime playback state.

### Pattern 2: `useViewerClock` Hook (PLAY-03)

**What:** A new hook that reads `replayMode` and `replayTs` from the store and keeps `viewer.clock.currentTime` in sync with the frame loop.

**Why `postUpdate` not `useEffect` on `replayTs`:**
STATE.md documents this decision explicitly: `viewer.scene.postUpdate.addEventListener` not React `useEffect` on `replayTs` — avoids one-frame render lag. `useEffect` fires asynchronously after paint; `postUpdate` fires synchronously inside the CesiumJS render frame before draw commands execute. For lighting to update in the same frame as the scrubber position, `postUpdate` is the correct hook.

**CesiumJS clock API (verified against codebase + CesiumJS 1.x docs):**
- `viewer.clock` is a `Clock` instance always present on the `Viewer`
- `viewer.clock.currentTime` is a `JulianDate` (not a JS `Date`)
- `JulianDate.fromDate(new Date(replayTs))` converts a Unix timestamp (ms) to JulianDate
- Setting `viewer.clock.currentTime` directly is the supported pattern; no need to touch `viewer.clock.multiplier` or `viewer.clock.shouldAnimate` for this phase — those concern the built-in CesiumJS clock tick, not the store-driven replay

**Hook signature:**
```typescript
// src/hooks/useViewerClock.ts
import { useEffect } from 'react';
import type { Viewer } from 'cesium';
import { JulianDate } from 'cesium';
import { useAppStore } from '../store/useAppStore';

export function useViewerClock(viewer: Viewer | null): void {
  useEffect(() => {
    if (!viewer) return;
    const handler = () => {
      const { replayMode, replayTs } = useAppStore.getState();
      if (replayMode !== 'playback') return;
      viewer.clock.currentTime = JulianDate.fromDate(new Date(replayTs));
    };
    viewer.scene.postUpdate.addEventListener(handler);
    return () => {
      if (!viewer.isDestroyed()) {
        viewer.scene.postUpdate.removeEventListener(handler);
      }
    };
  }, [viewer]);
}
```

**Where to mount:** `App.tsx` — call `useViewerClock(cesiumViewer)` alongside existing hooks. No prop drilling required; viewer is already a state variable there.

**CesiumJS lighting chain confirmed:** `viewer.scene.globe.enableLighting = true` is already set in `GlobeView.tsx` (line 70). `dynamicAtmosphereLighting = true` also set (line 71). These settings mean `viewer.clock.currentTime` directly controls sun position, so scrubbing to a nighttime timestamp will turn the globe dark. This is already the designed mechanism.

### Pattern 3: CinematicHUD Conditional Render (VIS-02)

**Current HUD state:** The component reads `useAppStore` for `cleanUI`, `setCleanUI`, and `selectedSatelliteId`. The REC block (lines 153-170) always renders with `utcTime` from `setInterval(Date.now, 1000)`.

**Required change:** Read `replayMode` and `replayTs` from the store. In LIVE mode: unchanged (`REC` + pulsing dot + live UTC clock). In PLAYBACK mode: replace with `REPLAY` label (no pulsing dot) and the formatted `replayTs` ISO string.

The live `utcTime` interval can stay active at all times — it is only rendered when `replayMode === 'live'`. No side effects from keeping it running.

**ISO format:** `new Date(replayTs).toISOString().slice(0, 19) + 'Z'` — same pattern already used in `PlaybackBar` at line 120.

### Pattern 4: Play Button Loading State (VIS-03)

**Current play button:** In `PlaybackBar`, lines 173-189. The button is `disabled={!hasWindow}`. It has no loading state. `useReplaySnapshots` is called at line 66 and the result is currently discarded (return value unused).

**Required change:** Destructure `isLoading` from `useReplaySnapshots(...)`. Gate the play button on `!isLoading && hasWindow`. When `isLoading` is true, display "Loading snapshots..." as the button label.

**`isLoading` lifecycle:** React Query sets `isLoading: true` from the moment the query fires until the first successful resolution. Since `useReplaySnapshots` passes `enabled: replayMode === 'playback'`, it begins loading the moment the user switches to PLAYBACK mode. For large 2-hour windows, this fetch can take seconds. The button must be non-interactive during this window.

**`placeholderData: new Map()`** is already set in the hook, so `data` is never `undefined` — but `isLoading` is still correctly `true` during the initial fetch.

### Anti-Patterns to Avoid

- **Functional updater in Zustand `set`:** `set(s => ({ isPlaying: !s.isPlaying }))` works, but the rAF `tick()` loop must use `useAppStore.getState().setIsPlaying(false)` (not a React closure over `setIsPlaying`). The current codebase already follows this pattern in `PlaybackBar` — the `tick()` function reads all mutable values via `getState()` to avoid stale closures.
- **Canceling rAF loop on `isPlaying` becoming false via store:** The rAF `useEffect` dependency array currently includes `[replayMode, isPlaying]`. After `isPlaying` moves to the store, `isPlaying` must remain a dependency OR the effect must subscribe to the store. The safest approach: keep `const isPlaying = useAppStore(s => s.isPlaying)` as a reactive selector — Zustand will re-render `PlaybackBar` on change, which retriggers the `useEffect` exactly as before.
- **Setting `viewer.clock.shouldAnimate = true`:** Do not start the CesiumJS built-in clock tick. The store-driven `postUpdate` pattern is explicitly chosen to keep the replay timeline under React/Zustand control, not CesiumJS's own animation loop.
- **`useEffect` on `replayTs` for clock sync:** One-frame lag makes day/night transition visually delayed behind the scrubber. Always use `postUpdate` (settled design decision from STATE.md).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Julian date conversion | Custom UTC→JulianDate math | `JulianDate.fromDate(new Date(ts))` | CesiumJS handles leap seconds, timezone, precision correctly |
| Clock sync timing | React `useEffect` watcher on `replayTs` | `viewer.scene.postUpdate.addEventListener` | postUpdate fires inside render frame; useEffect fires after paint — one frame lag |
| Global play state | Component-local `useState` | Zustand slice in `useAppStore` | All layers in v5.0 Phases 25+ read `isPlaying` to gate live lerp |

---

## Common Pitfalls

### Pitfall 1: Stale `isPlaying` closure in rAF tick
**What goes wrong:** If `tick()` closes over the React-state `isPlaying` variable, the function captures the value at the time the `useEffect` ran, not the current value when the frame fires.
**Why it happens:** JavaScript closures.
**How to avoid:** `tick()` must read mutable values via `useAppStore.getState()`, not via closure. This pattern is already established in the existing `PlaybackBar` code (lines 90-91). After the migration, `setIsPlaying(false)` at window end should be `useAppStore.getState().setIsPlaying(false)`.
**Warning signs:** Play button shows "PLAY" but animation is advancing; or animation auto-stops but button shows "PAUSE".

### Pitfall 2: `viewer.isDestroyed()` check missing in postUpdate teardown
**What goes wrong:** The `useEffect` cleanup in `useViewerClock` calls `viewer.scene.postUpdate.removeEventListener(handler)`. If the `Viewer` has been destroyed (e.g. React StrictMode double-unmount), this throws a DeveloperError.
**How to avoid:** Guard with `if (!viewer.isDestroyed())` before calling `removeEventListener`. Already seen this pattern in other cleanup paths in the codebase.

### Pitfall 3: `isPlaying` persisted in `useSettingsStore`
**What goes wrong:** If `isPlaying` is accidentally persisted via `zustand/persist`, a page reload would start playing immediately.
**How to avoid:** `isPlaying` must only be added to `useAppStore` (no `persist` middleware). `useSettingsStore` holds only `defaultMode` which is `'live' | 'playback'`, not `isPlaying`.

### Pitfall 4: PlaybackBar mock in tests missing `isPlaying`
**What goes wrong:** Existing `PlaybackBar.test.tsx` and `PlaybackBar.category.test.tsx` mock `useAppStore` with a static `mockState` object. After `isPlaying` moves to the store, both mocks are missing the `isPlaying` field, causing `undefined` reads in the component.
**How to avoid:** Add `isPlaying: false` and `setIsPlaying: vi.fn()` to the `mockState` object in both test files.

### Pitfall 5: HUD timer interval in playback mode
**What goes wrong:** If the existing `setInterval(Date.now)` runs and the HUD render logic has a bug, the HUD could momentarily show live UTC time even in playback mode.
**How to avoid:** The conditional render in CinematicHUD should be `{replayMode === 'live' ? (<liveBlock />) : (<replayBlock />)}` — not a state variable that might be stale. Both branches can co-exist in the component; only one renders at a time.

---

## Code Examples

### Adding `isPlaying` slice to `useAppStore.ts`
```typescript
// Append to AppState interface:
isPlaying: boolean;
setIsPlaying: (v: boolean | ((prev: boolean) => boolean)) => void;

// Append to create() implementation:
isPlaying: false,
setIsPlaying: (v) =>
  set((s) => ({ isPlaying: typeof v === 'function' ? v(s.isPlaying) : v })),
```

### `useViewerClock` hook
```typescript
// src/hooks/useViewerClock.ts
import { useEffect } from 'react';
import type { Viewer } from 'cesium';
import { JulianDate } from 'cesium';
import { useAppStore } from '../store/useAppStore';

export function useViewerClock(viewer: Viewer | null): void {
  useEffect(() => {
    if (!viewer) return;
    const handler = () => {
      const { replayMode, replayTs } = useAppStore.getState();
      if (replayMode !== 'playback') return;
      viewer.clock.currentTime = JulianDate.fromDate(new Date(replayTs));
    };
    viewer.scene.postUpdate.addEventListener(handler);
    return () => {
      if (!viewer.isDestroyed()) {
        viewer.scene.postUpdate.removeEventListener(handler);
      }
    };
  }, [viewer]);
}
```

### CinematicHUD REC block replacement (VIS-02)
```typescript
// Replace lines 153-170 in CinematicHUD.tsx:
const replayMode = useAppStore(s => s.replayMode);
const replayTs   = useAppStore(s => s.replayTs);

// In JSX:
<div style={{ position: 'absolute', top: 62, left: 8, ... }}>
  {replayMode === 'live' ? (
    <>
      <div><span style={pulseStyle}>&#9679;</span>{' '}REC</div>
      <div>{utcTime}</div>
    </>
  ) : (
    <>
      <div>REPLAY</div>
      <div>{new Date(replayTs).toISOString().slice(0, 19) + 'Z'}</div>
    </>
  )}
</div>
```

### Play button with loading state (VIS-03)
```typescript
// In PlaybackBar, replace line 66 destructuring:
const { isLoading: snapshotsLoading } = useReplaySnapshots(
  'all', snapshotWindowStart, snapshotWindowEnd, replayMode === 'playback'
);

// Play button:
<button
  onClick={() => setIsPlaying(p => !p)}
  disabled={!hasWindow || snapshotsLoading}
  ...
>
  {snapshotsLoading ? 'Loading snapshots...' : isPlaying ? 'PAUSE' : 'PLAY'}
</button>
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `isPlaying` local to `PlaybackBar` | `isPlaying` in `useAppStore` | Phase 23 (this phase) | All layer components can read it; Phases 25+ depend on this |
| Live UTC clock always shown in HUD | Conditional: REC in live, REPLAY+ts in playback | Phase 23 (this phase) | Operator immediately knows they are in replay mode |
| Play button gated only on `hasWindow` | Also gated on `snapshotsLoading` | Phase 23 (this phase) | Prevents play with empty snapshot data |
| `viewer.clock.currentTime` never set | Synced every frame via `postUpdate` | Phase 23 (this phase) | Globe lighting matches replay timestamp |

---

## Open Questions

1. **Should `isPlaying` be reset to `false` when `replayWindowEnd` is reached, or when switching back to LIVE?**
   - What we know: Both need a reset. The rAF `tick()` already calls `setIsPlaying(false)` on window end. `handleModeToggle()` already calls `setIsPlaying(false)` before switching back to LIVE.
   - What's unclear: None — both reset sites are clear from the existing code.
   - Recommendation: Both reset sites remain; just change them to call the store action instead of the React state setter.

2. **Does `useViewerClock` need to be mounted in `App.tsx` or can it mount alongside the GlobeView init?**
   - What we know: `cesiumViewer` is a `useState` in `App.tsx`; it becomes non-null only after `onViewerReady` fires. The hook takes `viewer: Viewer | null` and guards with `if (!viewer) return`.
   - Recommendation: Call `useViewerClock(cesiumViewer)` in `App.tsx` at the same level as other viewer-dependent effects. This is the cleanest and most consistent with other hooks.

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
| PLAY-01 | `isPlaying` in store: defaults `false`, toggle, reset on mode switch | unit | `cd frontend && npx vitest run src/store/__tests__/useAppStore.test.ts` | ✅ (needs new describe block) |
| PLAY-01 | `PlaybackBar` reads `isPlaying` from store, not local state | unit | `cd frontend && npx vitest run src/components/__tests__/PlaybackBar.test.tsx` | ✅ (needs mock update) |
| PLAY-03 | `useViewerClock` attaches to `postUpdate` and writes `JulianDate` | unit | `cd frontend && npx vitest run src/hooks/__tests__/useViewerClock.test.ts` | ❌ Wave 0 |
| VIS-02 | HUD renders `REPLAY [ISO]` in playback mode | unit | `cd frontend && npx vitest run src/components/__tests__/CinematicHUD.test.tsx` | ❌ Wave 0 |
| VIS-03 | Play button shows "Loading snapshots..." + disabled during `isLoading` | unit | `cd frontend && npx vitest run src/components/__tests__/PlaybackBar.test.tsx` | ✅ (needs new test cases) |

### Sampling Rate

- **Per task commit:** `cd frontend && npx vitest run --reporter=verbose`
- **Per wave merge:** `cd frontend && npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `frontend/src/hooks/__tests__/useViewerClock.test.ts` — covers PLAY-03 (mock `viewer.scene.postUpdate`, assert `addEventListener` called; assert `JulianDate.fromDate` called with correct value)
- [ ] `frontend/src/components/__tests__/CinematicHUD.test.tsx` — covers VIS-02 (render in `live` mode → `REC` text; render in `playback` mode → `REPLAY` text)
- Existing `PlaybackBar.test.tsx` mock must add `isPlaying: false` + `setIsPlaying: vi.fn()` to `mockState` (both test files)
- Existing `useAppStore.test.ts` needs new `describe('isPlaying slice')` block

---

## Sources

### Primary (HIGH confidence)

- Direct source file reads: `frontend/src/store/useAppStore.ts` — confirmed current slice shape, no `isPlaying` present
- Direct source file reads: `frontend/src/components/PlaybackBar.tsx` — confirmed `useState(false)` at line 45, rAF loop at lines 69-111
- Direct source file reads: `frontend/src/components/CinematicHUD.tsx` — confirmed `REC` block always renders, no replay mode check
- Direct source file reads: `frontend/src/hooks/useReplaySnapshots.ts` — confirmed `isLoading` is in return value, currently unused in PlaybackBar
- Direct source file reads: `frontend/src/components/GlobeView.tsx` — confirmed `enableLighting: true` and `dynamicAtmosphereLighting: true` already set
- Direct source file reads: `frontend/src/lib/viewerRegistry.ts` — confirmed `getViewer()` available as alternative mount point
- `.planning/STATE.md` — locked decision: `postUpdate` not `useEffect` for clock sync; `isPlaying` in `useAppStore`

### Secondary (MEDIUM confidence)

- CesiumJS 1.x API: `viewer.clock`, `JulianDate.fromDate`, `scene.postUpdate` — inferred from codebase patterns and CesiumJS documentation structure. CesiumJS `Viewer` always has `.clock`; `JulianDate.fromDate` is a standard static method. Confidence MEDIUM only because not verified against Context7 for v1.139 specifically — but these are stable CesiumJS APIs unchanged for many major versions.

### Tertiary (LOW confidence)

- None required — all findings backed by primary source inspection or well-established CesiumJS APIs.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — zero new dependencies; all packages already in `package.json`
- Architecture (PLAY-01 store promotion): HIGH — exact migration path visible in source code
- Architecture (PLAY-03 viewer clock): HIGH — design decision locked in STATE.md; CesiumJS API well-established
- Architecture (VIS-02 HUD): HIGH — component read in full; change is a conditional render
- Architecture (VIS-03 loading gate): HIGH — `isLoading` already in hook return; change is a button guard
- Pitfalls: HIGH — all derived from existing code patterns and known CesiumJS quirks documented in project

**Research date:** 2026-03-13
**Valid until:** 2026-04-13 (stable stack; no external API changes expected)
