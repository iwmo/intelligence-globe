# Phase 26: End-to-End Verification + Stale Indicators — Research

**Researched:** 2026-03-13
**Domain:** Replay correctness verification, Cesium billboard tinting, FPS measurement, `is_stale` frontend consumption
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| VIS-01 | Stale entities show visual degradation (grey tint / opacity reduction) in LIVE mode — requires backend to serialise `is_stale` per entity from v4.0 freshness columns | Backend already serialises `is_stale` on all three list endpoints. Frontend hooks and layer components do not yet consume it. Three layers need a tinting pass. |
| VRFY-01 | End-to-end scrub test across 2-hour window — pause freeze, all speed presets, auto-stop at window end, all layers correct | PlaybackBar rAF loop auto-stops at `replayWindowEnd`. All layer guards are in place from Phase 25. Verification is a manual + Vitest contract test across the known data paths. |
| VRFY-02 | FPS gate above 30 at 15m/s+ with aircraft + ships active; optimisation applied if gate fails | Cesium `viewer.scene.postUpdate` carries a `timeDelta` for frame timing. Performance.now() / rAF delta gives frame-budget measurement. Known hotspot: billboards at 1000+ entities iterating in playback effect. |
</phase_requirements>

---

## Summary

Phase 26 closes the v5.0 milestone. It has three non-overlapping work streams: (1) wiring `is_stale` from backend JSON to Cesium billboard `color` and `translucencyByDistance` (VIS-01), (2) writing automated and manual tests that prove the full 2-hour replay is contamination-free and auto-stops correctly (VRFY-01), and (3) measuring FPS at 15m/s and applying a targeted optimisation if the gate fails (VRFY-02).

The heaviest implementation work is VIS-01. The backend already emits `is_stale: bool` on `/api/aircraft/`, `/api/ships/`, and `/api/military/` but the frontend hooks (`useAircraft`, `useShips`, `useMilitaryAircraft`) drop the field — their TypeScript interfaces do not declare `is_stale`. Layer components read from those interfaces and have no tinting logic. The fix is additive: extend the three interfaces, add one new effect per layer that reads the stale flag and sets `bb.color = Color.GRAY.withAlpha(0.4)` (or `bb.scale = 0.7`) for stale billboards.

VRFY-01 and VRFY-02 are primarily verification tasks rather than new features. All the guards that prevent contamination are already in place from Phases 23–25. The test work is writing a Vitest contract suite that exercises the boundary conditions (auto-stop, pause, scrub to end) against the existing PlaybackBar and rAF loop logic, plus a manual FPS check using browser DevTools or a `performance.now()` measurement hook.

**Primary recommendation:** Implement VIS-01 (three-layer stale tinting) as Wave 1, then VRFY-01 (contract tests for boundary conditions) as Wave 2, then VRFY-02 (FPS measurement + conditional optimisation) as Wave 3.

---

## Standard Stack

### Core (existing — no new dependencies)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Cesium | ^1.139.1 | Globe rendering, billboard tinting via `bb.color` | Already in project |
| Vitest | ^4.0.18 | Unit/contract tests | All Phase 23–25 tests use it |
| @testing-library/react | ^16.3.2 | Component render tests | Already in project |
| Zustand | ^5.0.11 | Store (`useAppStore`) — `replayMode` read by stale effect | Already in project |
| @tanstack/react-query | ^5.90.21 | `useAircraft`, `useShips`, `useMilitaryAircraft` hooks | Already in project |

No new package installs required for any of the three requirements.

---

## Architecture Patterns

### VIS-01: Stale Billboard Tinting

**What:** Each layer's "data update" effect already iterates `aircraft.data` / `ships.data` / `militaryAircraft.data` and updates each billboard. A new sibling effect reads the same data and sets `bb.color` based on `is_stale`.

**Cesium API facts (confirmed in codebase):**
- `billboard.color` accepts a `Color` instance. Default is `Color.WHITE` (no tint).
- `Color.GRAY.withAlpha(0.4)` produces a translucent grey overlay — sufficient to make stale entities visually distinct without removing them.
- Alternatively, `billboard.scale` can be reduced (e.g. `0.6`) to signal degradation. Color tint is more immediately legible.
- Cesium billboard `color` is a multiplicative tint: setting it to white restores the original appearance.

**Pattern: dedicated stale-tint effect (LIVE-only guard)**

```typescript
// Source: AircraftLayer.tsx, ShipLayer.tsx, MilitaryAircraftLayer.tsx (same pattern)
// Runs in LIVE mode only — in playback, all entities are historical, not stale.
useEffect(() => {
  if (replayMode === 'playback') return;
  const byId = new Map(data?.map(e => [e.id, e]) ?? []);
  for (const [id, bb] of billboardsById) {
    const entity = byId.get(id);
    if (!entity) continue;
    bb.color = entity.is_stale ? Color.GRAY.withAlpha(0.4) : Color.WHITE;
  }
}, [data, replayMode]);
```

**Why separate effect, not inline in Effect 2:** Effect 2 for aircraft runs inside the rAF setup block; mixing visual state with positional state creates hard-to-test coupling. The stale-tint effect has its own dependency array (`[data, replayMode]`) and is independently testable.

**Interface extension required for each hook:**

`useAircraft.ts` — `AircraftRecord` must add `is_stale: boolean`.
`useShips.ts` — `ShipRecord` must add `is_stale: boolean`.
`useMilitaryAircraft.ts` — `MilitaryAircraftRecord` must add `is_stale: boolean`.

Backend already emits the field. It just needs to be declared in TypeScript so layer components can read it without type errors.

**LIVE guard rationale:** In playback mode, entities are rendered from snapshot data that has no `is_stale` field. Applying stale tinting in playback would tint all entities grey (since `is_stale` would be `undefined` → falsy but the `entity` lookup would fail). The early-return guard keeps playback visually clean.

---

### VRFY-01: Replay Boundary Contract Tests

**What:** Vitest tests that verify PlaybackBar's rAF loop stops exactly at `replayWindowEnd` and that `isPlaying` returns to `false`.

**Key code paths already in place (from PlaybackBar.tsx):**
```typescript
// Auto-stop logic in tick():
if (windowEnd && next >= windowEnd) {
  setTs(windowEnd);
  rafRunningRef.current = false;
  useAppStore.getState().setIsPlaying(false);
  return;
}
```

**Test pattern:** Extract the `tick` function logic into a pure helper (same contract-testing pattern used for LAYR-01/02 — see `AircraftLayer.debounce.test.tsx`). Tests use `vi.useFakeTimers()` to control rAF timing.

**What VRFY-01 tests must cover:**
1. Scrub to `replayWindowEnd - 1ms` → `isPlaying` remains true, loop continues.
2. Advance time so `next >= replayWindowEnd` → loop stops, `isPlaying` set to false, `replayTs` pinned at `replayWindowEnd`.
3. Speed preset 15m/s (`speedMultiplier = 900`): advancing 1/60s wall time advances 900/60 = 15 replay-seconds.
4. All speed presets produce correct ms-per-wall-second advancement.
5. Layer contamination: snapshot interpolation effect does not execute when `replayMode !== 'playback'` — already verified by existing LAYR-01/02/03/04 tests, no new test needed.

**Manual verification checklist** (cannot be automated without a running Cesium globe and real data):
- Scrub from 0 to end with all 6 layers active: no layer shows entities at wrong positions.
- Satellites animate at `replayTs` (PLAY-02, already shipped).
- GPS jamming badge visible throughout playback (LAYR-03, already shipped).
- Street traffic particles absent (LAYR-04, already shipped).
- Return to LIVE: entities refresh within 5 seconds (PLAY-04, already shipped).

---

### VRFY-02: FPS Gate

**What:** Measure frame rate at 15m/s playback speed with aircraft + ships visible. Gate is 30 FPS. If failing, apply a targeted optimisation.

**Measurement approach:**

```typescript
// Inline measurement hook — not a new file, added to PlaybackBar or GlobeView temporarily
const fpsRef = useRef<number[]>([]);
const lastFpsFrame = useRef<number>(0);

// In the existing rAF tick body:
const fps = 1000 / (now - lastFpsFrame.current);
fpsRef.current.push(fps);
lastFpsFrame.current = now;
if (fpsRef.current.length > 60) {
  const avg = fpsRef.current.reduce((a, b) => a + b, 0) / fpsRef.current.length;
  console.log('[VRFY-02] avg FPS over last 60 frames:', avg.toFixed(1));
  fpsRef.current = [];
}
```

**Known hotspot (STATE.md concern):** At 15m/s (900× real-time), the playback snapshot interpolation effect fires on every `replayTs` change. If `replayTs` changes 60 times/second and there are 1000+ aircraft, each rAF tick iterates the full `billboardsByIcao24` map. With 1000 aircraft, that is ~60,000 map lookups/second plus `Cartesian3.fromDegrees` calls.

**Optimisation pass (apply only if FPS < 30):**

Option 1 — Throttle `setReplayTs` at 15 FPS minimum resolution: instead of firing on every rAF tick, only call `setReplayTs` when the simulated time advances by ≥ 1/15 of a second (67ms). The visual difference is imperceptible at 900× speed.

Option 2 — Skip billboard update for off-screen entities using `viewer.camera.frustum.computeCullingVolume()`. HIGH complexity; do not pursue unless Option 1 is insufficient.

Option 3 — Batch position updates into a single `requestAnimationFrame` rather than updating inside a React `useEffect` that re-renders. This is the existing architecture (rAF loop in Effect 2 for aircraft, not in React render) — so this hotspot may not exist. Profiling confirms or eliminates it.

**Research finding:** The existing `AircraftLayer` snapshot interpolation effect is NOT in the rAF loop — it is a `useEffect` that fires when `replayTs` changes. This means every `setReplayTs` call triggers a React re-render cycle, which then runs the effect. At 60 Hz with `setReplayTs` called every frame, this is 60 React effect runs/second. At 1000+ aircraft, each run iterates the full billboard map. This is the primary FPS risk.

**If optimisation is needed:** Add a `useRef` frame counter and skip the interpolation effect if fewer than N ms have passed since the last bb.position update. N = 33ms (30 FPS budget). This is a single guard at the top of the playback interpolation effect, not a structural change.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Billboard opacity | Custom shader or PNG swap | `bb.color = Color.GRAY.withAlpha(0.4)` | Cesium Color tint is GPU-side, zero extra geometry |
| FPS counter UI | New component | `console.log` + browser DevTools | Phase is verification, not production polish |
| FPS gate enforcement | CI integration | Manual gate + conditional opt pass | Single-user tool, no CI pipeline in this codebase |
| Stale state aggregation endpoint | New `/api/freshness` endpoint | Existing `is_stale` field per entity | All three list endpoints already serialise it |

---

## Common Pitfalls

### Pitfall 1: Tinting Fires in Playback Mode
**What goes wrong:** If the stale-tint effect lacks a `replayMode === 'playback'` early-return guard, it tries to read `is_stale` from snapshot data (which doesn't have that field), tinting all entities grey during playback.
**Why it happens:** The effect depends on `data` which is still populated in playback mode (React Query holds the last live fetch).
**How to avoid:** First line of the effect: `if (replayMode === 'playback') return;`
**Warning signs:** All entities grey during playback scrub.

### Pitfall 2: `is_stale` Not in TypeScript Interface
**What goes wrong:** TypeScript builds fine but `entity.is_stale` is `undefined` at runtime because `AircraftRecord` / `ShipRecord` / `MilitaryAircraftRecord` don't declare the field.
**Why it happens:** The backend added `is_stale` to the API response but the frontend interface wasn't updated.
**How to avoid:** Add `is_stale: boolean` to all three hook interfaces before writing the effect. Compile will then catch any usage errors.
**Warning signs:** All entities permanently white (falsy `is_stale`) or TypeScript `Property 'is_stale' does not exist` compile error.

### Pitfall 3: FPS Measurement Contaminated by Layer Loading
**What goes wrong:** FPS is measured while snapshots are still loading, showing artificially low numbers.
**Why it happens:** The snapshot fetch (100k rows) saturates the main thread during initial load.
**How to avoid:** Only start FPS measurement after `snapshotsLoading === false`.
**Warning signs:** First 3–5 seconds of playback show <5 FPS, then recovers to 60 FPS.

### Pitfall 4: Auto-Stop Test Uses Real Timers
**What goes wrong:** VRFY-01 auto-stop test runs for minutes of real time because it doesn't use `vi.useFakeTimers()`.
**Why it happens:** `requestAnimationFrame` in jsdom falls back to `setTimeout(fn, 0)`. Without fake timers, tests hang.
**How to avoid:** All PlaybackBar timing tests use `vi.useFakeTimers()` + `vi.advanceTimersByTime()`. See existing `PlaybackBar.test.tsx` pattern.
**Warning signs:** Test timeout in CI after 5 seconds.

### Pitfall 5: Stale Tint Applied to Billboards Not Yet in Collection
**What goes wrong:** The tint effect runs before Effect 2 has populated `billboardsByIcao24`, so `bb` lookups return `undefined`.
**Why it happens:** React effects run in declaration order within a component, but data may arrive in any fetch order.
**How to avoid:** Guard each `bb` access: `if (!bb) continue;` — same pattern used in all existing interpolation effects.
**Warning signs:** `Cannot set properties of undefined (setting 'color')` runtime error.

### Pitfall 6: `Color.WHITE` vs `Color.clone(Color.WHITE)`
**What goes wrong:** Writing `bb.color = Color.WHITE` shares the singleton. Subsequent mutation of `Color.WHITE` anywhere in the app would affect all billboard colours.
**Why it happens:** Cesium `Color.WHITE` is a static instance, not a factory.
**How to avoid:** Use `Color.WHITE.clone()` or just `new Color(1, 1, 1, 1)` when setting fresh colour. `Color.GRAY.withAlpha(0.4)` already returns a new instance.
**Warning signs:** All billboards unexpectedly change colour simultaneously.

---

## Code Examples

### VIS-01: Stale tint effect (AircraftLayer pattern)
```typescript
// Source: derived from existing billboard iteration in AircraftLayer.tsx + routes_aircraft.py
// Add after Effect 3 (trail) in AircraftLayer.tsx
const { Color } = await import('cesium'); // already imported at top of file

useEffect(() => {
  if (replayMode === 'playback') return;  // no is_stale in snapshot data
  const byId = new Map(aircraft.data?.map(a => [a.icao24, a]) ?? []);
  for (const [icao24, bb] of billboardsByIcao24) {
    const ac = byId.get(icao24);
    if (!ac || !bb) continue;
    bb.color = ac.is_stale ? Color.GRAY.withAlpha(0.4) : Color.WHITE.clone();
  }
}, [aircraft.data, replayMode]);
```

### VRFY-01: Auto-stop contract test pattern
```typescript
// Source: derived from PlaybackBar.tsx tick() function — same contract-test approach as LAYR-01
// Pattern: extract the loop-boundary logic into a pure function, test it in isolation.
function simulateTickAdvance(
  current: number,
  windowEnd: number,
  speed: number,   // speedMultiplier (e.g. 900 for 15m/s)
  dt: number,      // wall-clock seconds (e.g. 1/60)
): { next: number; shouldStop: boolean } {
  const next = current + dt * speed * 1000;
  if (next >= windowEnd) {
    return { next: windowEnd, shouldStop: true };
  }
  return { next, shouldStop: false };
}

// Tests:
it('stops when next >= windowEnd', () => {
  const result = simulateTickAdvance(
    replayWindowEnd - 100,  // current: 100ms before end
    replayWindowEnd,
    900,   // 15m/s
    1/60,  // one frame
  );
  expect(result.shouldStop).toBe(true);
  expect(result.next).toBe(replayWindowEnd);
});
```

### VRFY-02: FPS throttle guard (apply only if gate fails)
```typescript
// Source: derived from AircraftLayer.tsx playback interpolation pattern
// Guard at top of playback effect — skip update if last update < 33ms ago
const lastInterpolationRef = useRef<number>(0);

useEffect(() => {
  if (replayMode !== 'playback') return;
  const now = performance.now();
  if (now - lastInterpolationRef.current < 33) return;  // 30 FPS cap on interpolation
  lastInterpolationRef.current = now;
  // ... rest of interpolation logic unchanged
}, [replayMode, replayTs, snapshotsByEntity]);
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `is_stale` computed frontend from `fetched_at` age | `is_stale` serialised per entity by backend | Phase 17–18 (v4.0) | Backend owns freshness thresholds, frontend just reads the flag |
| Local `isPlaying` in PlaybackBar | `isPlaying` in `useAppStore` | Phase 23 | All layer components can read it without prop drilling |
| playback contamination via React Query refetch focus | `refetchInterval: false` + `replayMode` guard in Effect 2 | Phase 25 | No live data can overwrite snapshot positions |

**Deprecated in this codebase:**
- Computing `is_stale` in the frontend from timestamp arithmetic. The backend does it and serialises the result. Do not recompute it frontend-side.

---

## Open Questions

1. **What opacity/colour value for stale tint?**
   - What we know: requirement says "visible grey tint or reduced opacity" — either is acceptable.
   - What's unclear: exact RGBA values. `Color.GRAY.withAlpha(0.4)` is a reasonable starting point but may need tuning against the dark globe background.
   - Recommendation: Start with `Color.fromCssColorString('#888888').withAlpha(0.55)` — slightly lighter than pure grey to remain legible against dark background. Adjustable.

2. **Ships: `is_stale` field available but `last_seen_at` vs `fetched_at` distinction**
   - What we know: `routes_ships.py` serialises `is_stale: is_stale(r.last_seen_at, settings.SHIP_STALE_SECONDS)`. `ShipRecord` interface doesn't declare `is_stale`.
   - What's unclear: The `useShips` hook's `ShipRecord` interface currently does not include `is_stale`. It needs to be added.
   - Recommendation: Add `is_stale: boolean` to `ShipRecord`.

3. **FPS measurement: in-app vs DevTools**
   - What we know: DevTools Performance tab is sufficient for a one-off gate check. In-app measurement is more rigorous but adds temporary code.
   - What's unclear: Whether FPS will be close to the 30 FPS boundary (requiring precise measurement) or clearly above/below.
   - Recommendation: Use DevTools first. Only add in-app measurement if result is ambiguous (25–35 FPS range).

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.0.18 (frontend), pytest (backend) |
| Config file | `frontend/vite.config.ts` (test section, jsdom environment) |
| Quick run command | `cd frontend && npx vitest run` |
| Full suite command | `cd frontend && npx vitest run` (all 29 files, 192 tests currently green) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| VIS-01 | Stale billboard tint effect skips in playback mode | unit/contract | `npx vitest run src/components/__tests__/AircraftLayer.debounce.test.tsx` | ❌ Wave 0 (new describe block in existing file or new file) |
| VIS-01 | Stale tint applied when `is_stale=true` in live mode | unit/contract | `npx vitest run src/components/__tests__/AircraftLayer.debounce.test.tsx` | ❌ Wave 0 |
| VIS-01 | Same contract for ShipLayer and MilitaryAircraftLayer | unit/contract | `npx vitest run src/components/__tests__/ShipLayer.test.tsx` | ❌ Wave 0 (new describe block) |
| VRFY-01 | Auto-stop: `isPlaying` set false when ts reaches windowEnd | unit/contract | `npx vitest run src/components/__tests__/PlaybackBar.test.tsx` | ❌ Wave 0 (new describe block) |
| VRFY-01 | Speed preset 15m/s advances 900s per wall-second | unit/contract | `npx vitest run src/components/__tests__/PlaybackBar.test.tsx` | ❌ Wave 0 |
| VRFY-01 | All 5 speed presets produce correct ms/s ratio | unit/contract | `npx vitest run src/components/__tests__/PlaybackBar.test.tsx` | ❌ Wave 0 |
| VRFY-02 | FPS gate measurement | manual | DevTools Performance tab — 30s recording at 15m/s | N/A |
| VRFY-02 | If optimisation applied: interpolation skips if <33ms elapsed | unit/contract | `npx vitest run src/components/__tests__/AircraftLayer.debounce.test.tsx` | ❌ Wave 0 (conditional) |

### Sampling Rate
- **Per task commit:** `cd frontend && npx vitest run`
- **Per wave merge:** `cd frontend && npx vitest run` (full suite — currently 192 tests, will grow)
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `frontend/src/components/__tests__/AircraftLayer.staleTint.test.tsx` — or new `describe` block appended to `AircraftLayer.debounce.test.tsx` — covers VIS-01 stale tint logic for aircraft
- [ ] VIS-01 contract block for `ShipLayer.test.tsx` (new `describe` appended)
- [ ] VIS-01 contract block for `MilitaryAircraftLayer.test.tsx` (new `describe` appended)
- [ ] VRFY-01 auto-stop contract block appended to `PlaybackBar.test.tsx`
- [ ] VRFY-01 speed-preset arithmetic tests appended to `PlaybackBar.test.tsx`

No new test files required — all gaps are `describe` blocks appended to existing test files. Framework install: none needed (Vitest already installed).

---

## Sources

### Primary (HIGH confidence)

- `backend/app/api/routes_aircraft.py` — confirms `is_stale` is serialised per entity on the aircraft list endpoint
- `backend/app/api/routes_ships.py` — confirms `is_stale` is serialised per entity on the ships list endpoint
- `backend/app/api/routes_military.py` — confirms `is_stale` is serialised per entity on the military list endpoint
- `backend/app/freshness.py` — `is_stale(ts, threshold_s)` function definition
- `frontend/src/hooks/useAircraft.ts` — `AircraftRecord` interface lacks `is_stale` field (confirmed by reading file)
- `frontend/src/hooks/useShips.ts` — `ShipRecord` interface lacks `is_stale` field (confirmed by reading file)
- `frontend/src/hooks/useMilitaryAircraft.ts` — `MilitaryAircraftRecord` interface lacks `is_stale` field (confirmed by reading file)
- `frontend/src/components/AircraftLayer.tsx` — billboard tinting API via `bb.color`, existing effect structure
- `frontend/src/components/PlaybackBar.tsx` — auto-stop logic in `tick()`, all speed presets, rAF loop structure
- `frontend/src/components/__tests__/PlaybackBar.test.tsx` — existing test pattern for contract testing PlaybackBar

### Secondary (MEDIUM confidence)

- Cesium `billboard.color` API — multiplicative tint, `Color.GRAY.withAlpha(0.4)` is a new Color instance (standard Cesium pattern, same API version in use: ^1.139.1)

### Tertiary (LOW confidence)

- None. All research findings are backed by reading the actual source files in this project.

---

## Metadata

**Confidence breakdown:**
- VIS-01 architecture: HIGH — backend already emits `is_stale`, Cesium billboard `color` API is well-understood from existing codebase usage
- VRFY-01 test targets: HIGH — PlaybackBar tick() function is fully readable, boundary conditions are deterministic
- VRFY-02 FPS risk: MEDIUM — hotspot identified (React effect per rAF frame at 1000+ entities) but actual impact requires measurement; optimisation approach is LOW risk (single guard line)
- Stale tint values: MEDIUM — exact RGBA is a design choice, not a technical constraint

**Research date:** 2026-03-13
**Valid until:** 2026-04-13 (stable stack, no fast-moving dependencies)
