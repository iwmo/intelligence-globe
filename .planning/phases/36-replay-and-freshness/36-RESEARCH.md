# Phase 36: Replay and Freshness - Research

**Researched:** 2026-03-14
**Domain:** Frontend replay integration, client-side temporal filtering, PlaybackBar timeline markers, freshness indicators
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| GDELT-10 | `useGdeltEvents` hook loads events once per replay session using a `since`/`until` time window; events accumulate client-side as the scrubber advances, anchored at `occurred_at` | Replay window state (`replayWindowStart`/`replayWindowEnd`) is already in `useAppStore`; `since`/`until` params are already supported by `GET /api/gdelt-events`; `replayMode` selector already in hook |
| GDELT-11 | GDELT events appear as coloured dots on the PlaybackBar timeline scrubber track using the QuadClass colour scheme | PlaybackBar already renders OSINT event dots using the exact pattern; QUAD_CLASS_COLORS already defined in GdeltLayer; PlaybackBar imports `useOsintEvents` — mirroring that pattern for GDELT is the implementation path |
| GDELT-12 | GDELT layer card shows `source_is_stale` freshness indicator when the last ingest cycle is stale, using the same visual treatment as the GPS jamming layer card | `source_is_stale` is already on every `GdeltEvent` returned by the hook; GpsJammingLayer's `GPS LIVE DATA` overlay pattern is the reference implementation |
</phase_requirements>

---

## Summary

Phase 36 is purely a frontend integration phase — no backend changes required. All three requirements are wiring tasks that connect already-built infrastructure:

**GDELT-10** requires modifying `useGdeltEvents` to detect replay mode entry, fire one load with `since`/`until` params covering the replay window, then filter client-side as `replayTs` advances. The backend `GET /api/gdelt-events` already supports `since`/`until` query params. The `replayWindowStart` and `replayWindowEnd` values are already in `useAppStore`. The hook currently does no time-range fetching at all — it fetches all events with an optional bbox. The change is to detect `replayMode === 'playback'`, use `replayWindowStart`/`replayWindowEnd` as `since`/`until`, and not refetch as the scrubber moves.

**GDELT-11** requires adding GDELT event dots to the PlaybackBar timeline track. The OSINT event dot rendering pattern is already in PlaybackBar (lines 212–250), producing a `<div>` positioned via `left: frac * 100%`. GDELT dots follow the exact same pattern but source from `useGdeltEvents` data and use `QUAD_CLASS_COLORS` hex values. PlaybackBar receives GDELT data either via a new prop or by calling `useGdeltEvents()` directly inside the component.

**GDELT-12** requires adding a stale indicator to the GEO layer card in LeftSidebar. The reference implementation is GpsJammingLayer's `GPS LIVE DATA` overlay (`position: fixed`, `top: 60px`, `right: 12px`, amber border+text). The GDELT stale indicator should render when `source_is_stale` is `true` on any returned event. The `useGdeltEvents` hook already returns `source_is_stale` on each event. The indicator lives either in `GdeltLayer` (mirroring GpsJammingLayer) or inline in `LeftSidebar` next to the GEO toggle.

**Primary recommendation:** Implement all three requirements as targeted modifications to three existing files: `useGdeltEvents.ts`, `PlaybackBar.tsx`, and `GdeltLayer.tsx` (or `LeftSidebar.tsx` for GDELT-12). No new files are needed for the core implementation; only new test files are required.

---

## Standard Stack

### Core (unchanged from Phase 35)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@tanstack/react-query` | ^5.90.21 | Data fetching + caching in `useGdeltEvents` | Already in use; `queryKey` controls caching identity |
| `zustand` | ^5.0.11 | `useAppStore` — replay state (`replayTs`, `replayWindowStart`, `replayWindowEnd`, `replayMode`) | Already in use |
| `vitest` | ^4.0.18 | Test framework | Already configured (`jsdom` environment, `vi.mock` hoisting) |
| `@testing-library/react` | ^16.3.2 | Component rendering in tests | Already in use |
| `cesium` | ^1.139.1 | `PointGraphics.show` for temporal hiding in GdeltLayer | Already in use |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| React (useEffect) | ^19.2.0 | Effect 2 in GdeltLayer: respond to `replayTs` changes for visibility updates | Already used in GdeltLayer |

---

## Architecture Patterns

### Recommended Project Structure (no changes needed)
```
frontend/src/
├── hooks/useGdeltEvents.ts     # MODIFIED: add since/until replay window params
├── components/GdeltLayer.tsx   # MODIFIED: temporal entity visibility + stale indicator
├── components/PlaybackBar.tsx  # MODIFIED: GDELT timeline dots
├── hooks/__tests__/useGdeltEvents.test.ts   # MODIFIED: add GDELT-10 tests
├── components/__tests__/GdeltLayer.test.tsx  # MODIFIED: add GDELT-12 tests
└── components/__tests__/PlaybackBar.*.test.tsx  # NEW: GDELT-11 tests
```

### Pattern 1: Single-Load Replay Fetch (GDELT-10)

**What:** On entering replay mode, `useGdeltEvents` fires one fetch with `since`/`until` params derived from the replay window, then returns all events for the session. The queryKey must encode replay-session identity (not `replayTs`) so React Query does not refetch on every scrubber tick.

**When to use:** Any layer that has time-ranged data in replay mode where per-tick fetching is unacceptable (this is the established VPC-08 extension pattern).

**Key insight from codebase:** `replayWindowStart` and `replayWindowEnd` are already in `useAppStore`. The hook already reads `replayMode`. The change is:
1. Read `replayWindowStart` and `replayWindowEnd` from the store.
2. When `replayMode === 'playback'` AND the window is available, include `since` / `until` in the query params.
3. The queryKey must be `['gdelt-events', effectiveBbox, replayWindowStart, replayWindowEnd]` — this ensures one load per session (window values do not change during playback) and no re-fetch as `replayTs` ticks.

```typescript
// Source: codebase pattern — useGdeltEvents.ts (modified)
export function useGdeltEvents() {
  const replayMode        = useAppStore(s => s.replayMode);
  const viewportBbox      = useAppStore(s => s.viewportBbox);
  const replayWindowStart = useAppStore(s => s.replayWindowStart);
  const replayWindowEnd   = useAppStore(s => s.replayWindowEnd);

  const effectiveBbox = replayMode === 'live' ? viewportBbox : null;

  // Replay window params — only when in playback with a valid window
  const replayWindowSince = (replayMode === 'playback' && replayWindowStart)
    ? new Date(replayWindowStart).toISOString()
    : null;
  const replayWindowUntil = (replayMode === 'playback' && replayWindowEnd)
    ? new Date(replayWindowEnd).toISOString()
    : null;

  return useQuery<GdeltEvent[]>({
    // queryKey includes window bounds — constant per session, no per-tick invalidation
    queryKey: ['gdelt-events', effectiveBbox, replayWindowSince, replayWindowUntil],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (effectiveBbox) {
        params.set('min_lat', String(effectiveBbox.minLat));
        params.set('max_lat', String(effectiveBbox.maxLat));
        params.set('min_lon', String(effectiveBbox.minLon));
        params.set('max_lon', String(effectiveBbox.maxLon));
      }
      if (replayWindowSince) params.set('since', replayWindowSince);
      if (replayWindowUntil) params.set('until', replayWindowUntil);
      const url = params.toString() ? `/api/gdelt-events?${params}` : '/api/gdelt-events';
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30_000);
      try {
        const res = await fetch(url, { signal: controller.signal });
        if (!res.ok) throw new Error(`GDELT events fetch failed: ${res.status}`);
        return res.json() as Promise<GdeltEvent[]>;
      } finally {
        clearTimeout(timeoutId);
      }
    },
    staleTime: 900_000,
    refetchInterval: replayMode === 'live' ? 900_000 : false,
    retry: 3,
    retryDelay: 5_000,
  });
}
```

### Pattern 2: Client-Side Temporal Accumulation (GDELT-10 continued)

**What:** In GdeltLayer Effect 2, filter entities to only show events where `occurred_at <= replayTs`. Events past the scrubber are invisible; events at or before the scrubber are visible. This is a change to `entity.point.show` only — no entity add/remove on every tick (that would cause flicker).

**When to use:** Any layer where events accumulate historically rather than being positional snapshots.

**Key insight:** The existing Effect 2 already does a full `removeAll` + rebuild on data change. Adding `replayTs` to the dep array would cause full rebuild on every tick (flicker). The correct approach is to split visibility into two concerns:
- QuadClass visibility: `gdeltQuadClassFilter.includes(event.quad_class)` (existing)
- Temporal visibility: `replayMode === 'live' || new Date(event.occurred_at).getTime() <= replayTs`

Both can be AND-combined in the `show` field. The rebuild only happens when `events` data changes (session load), not on every `replayTs` tick. `replayTs` must be read in Effect 2 at the time of rebuild via `useAppStore.getState().replayTs` to avoid the stale closure problem established in Phase 11/23.

**CRITICAL pitfall:** If `replayTs` is added to the useEffect deps array for Effect 2, the layer will do a full entity rebuild on every animation frame tick, causing severe flicker. Instead:
- Option A (recommended): Effect 2 does one rebuild per data load; add a separate Effect 3 that iterates `dataSource.entities` and updates `.point.show` when `replayTs` changes — avoids full rebuild
- Option B: Use `useAppStore.getState().replayTs` inside Effect 2 (do NOT add `replayTs` as a dep) but add `replayMode` — this means visibility is set once at load time and is static during playback (events are invisible until the layer refreshes)

Option A is correct for "no flicker on scrub" per the success criteria. It requires updating `entity.point.show` directly on the already-placed CesiumJS entity objects without rebuilding.

**CesiumJS pattern for updating entity visibility:**
```typescript
// Effect 3 — temporal visibility (deps: [replayTs, replayMode])
// NOTE: does NOT rebuild entities, just updates show on existing entities
useEffect(() => {
  const ds = dataSourceRef.current;
  if (!ds) return;
  const entities = ds.entities.values; // CesiumJS EntityCollection.values
  for (const entity of entities) {
    if (!entity.point) continue;
    // parse occurred_at from entity id: "gdelt:{global_event_id}"
    // BUT: entity id does not encode timestamp — need the raw data
    // Therefore: store occurred_at on entity.properties or use a Map<id, ts>
  }
}, [replayTs, replayMode]);
```

**IMPORTANT:** CesiumJS entities do not carry `occurred_at` by default. The cleanest approach is to store a lookup map in a `useRef<Map<string, number>>` inside `GdeltLayer` that maps `global_event_id → occurred_at_epoch_ms`. Effect 2 populates this map during rebuild. Effect 3 reads from it. This avoids any CesiumJS `entity.properties` API and the associated serialization overhead.

```typescript
// Source: codebase pattern — GdeltLayer.tsx (modified, sketch)
const tsMapRef = useRef<Map<string, number>>(new Map());

// Inside Effect 2 rebuild loop:
tsMapRef.current.set(event.global_event_id, new Date(event.occurred_at).getTime());

// Effect 3 — update show field based on replayTs
useEffect(() => {
  const ds = dataSourceRef.current;
  if (!ds) return;
  const currentTs = replayMode === 'live' ? Infinity : replayTs;
  for (const entity of ds.entities.values) {
    if (!entity.point) continue;
    const evtId = entity.id?.replace('gdelt:', '');
    if (!evtId) continue;
    const occurredAt = tsMapRef.current.get(evtId);
    const inFilter = gdeltQuadClassFilter.includes(/* quad_class from a second map */);
    // Both temporal and quad class visibility must be AND-combined
    entity.point.show = new ConstantProperty(
      (occurredAt !== undefined ? occurredAt <= currentTs : true) && inFilter
    );
  }
}, [replayTs, replayMode, gdeltQuadClassFilter]);
```

Note: `ConstantProperty` from CesiumJS is the correct wrapper for `entity.point.show` mutation. Without it, direct boolean assignment may not trigger CesiumJS property change detection. However, looking at the existing code in GdeltLayer, `PointGraphics.show` is set at construction time as a plain boolean — this works because the whole entity is rebuilt each time. For the Effect 3 approach, `entity.point.show` must be a CesiumJS `ConstantProperty`. If `PointGraphics.show` accepts direct boolean assignment in CesiumJS 1.139, this may work without `new ConstantProperty()` — verify during implementation.

**Simpler alternative (Option C):** Store both `occurred_at_ts` and `quad_class` in two `useRef<Map>` instances (or one Map of objects). Effect 3 is straightforward with no CesiumJS property API complexity.

### Pattern 3: PlaybackBar GDELT Timeline Dots (GDELT-11)

**What:** Coloured dots at fractional positions on the scrubber track, using the same `left: frac * 100%` + `position: absolute` pattern as existing OSINT dots.

**Reference implementation** (PlaybackBar.tsx lines 212–250):
```typescript
// Source: frontend/src/components/PlaybackBar.tsx (existing OSINT pattern)
{hasWindow && (() => {
  const visibleEvents = /* filter events */;
  return visibleEvents.map(evt => {
    const frac = (evt.ts - replayWindowStart!) / (replayWindowEnd! - replayWindowStart!);
    if (frac < 0 || frac > 1) return null;
    return (
      <div
        key={evt.id}
        title={evt.label}
        style={{
          position: 'absolute',
          left: `${frac * 100}%`,
          top: '50%',
          transform: 'translate(-50%, -50%)',
          width: '8px', height: '8px',
          borderRadius: '50%',
          background: EVENT_COLORS[evt.category] ?? '#fff',
          cursor: 'pointer',
          zIndex: 2,
          border: '1px solid rgba(0,0,0,0.5)',
        }}
      />
    );
  });
})()}
```

**GDELT adaptation:** Call `useGdeltEvents()` inside PlaybackBar (it is already called in GdeltLayer — React Query deduplicates; the second call hits cache). Map `occurred_at` to a fractional position. Use the `QUAD_CLASS_COLORS` hex values (`#3B82F6`, `#22C55E`, `#EAB308`, `#EF4444`). These colours live in `GdeltLayer.tsx` as module-level constants — they must be extracted to a shared constant or duplicated in PlaybackBar.

**Recommended:** Extract `QUAD_CLASS_COLORS` as a hex string map (not CesiumJS `Color` objects) to a shared location (e.g., `frontend/src/data/gdeltColors.ts`) so both `GdeltLayer` and `PlaybackBar` can import them. GdeltLayer converts to CesiumJS Color; PlaybackBar uses raw hex strings.

**Only show GDELT dots in playback mode** (same as OSINT dots — they only render inside the `replayMode === 'playback'` block).

### Pattern 4: Stale Freshness Indicator (GDELT-12)

**Reference implementation** (GpsJammingLayer.tsx lines 113–133):
```typescript
// Source: frontend/src/components/GpsJammingLayer.tsx (existing stale pattern)
if (replayMode === 'playback' && layerVisible) {
  return (
    <div style={{
      position: 'fixed', top: '60px', right: '12px', zIndex: 100,
      background: 'rgba(245, 158, 11, 0.15)',
      border: '1px solid #F59E0B',
      color: '#F59E0B',
      fontFamily: 'monospace', fontSize: '10px', fontWeight: 700,
      padding: '2px 6px', borderRadius: '3px',
      pointerEvents: 'none',
    }}>
      GPS LIVE DATA
    </div>
  );
}
```

**GDELT-12 adaptation:** The condition is different — it is `source_is_stale === true` on the event data (not a playback-mode check). The indicator should show in live mode too when ingest is behind.

**Source of truth:** `source_is_stale` is per-event from the hook. Since all events in a batch are written at the same ingest cycle, `source_is_stale` will be uniformly `true` or `false` across all events in a session. Check `events?.some(e => e.source_is_stale) === true` or `events?.[0]?.source_is_stale === true`.

**Where to render:** GdeltLayer already returns `null` for its DOM output (line 103). The stale indicator can be added as a conditional return in GdeltLayer — when `layerVisible && sourceIsStale`, return the indicator div; otherwise return `null`. This mirrors how GpsJammingLayer returns the overlay div as its sole DOM output.

**Visual treatment must match GPS jamming:** Use the same amber (`#F59E0B`) colour, `position: fixed`, same font/padding. Label it `GEO STALE` or `GDELT STALE` (rather than `GPS LIVE DATA` which is a different semantic). Since GDELT-12 says "same visual treatment", the style is identical — only the label and trigger condition differ.

**Position collision concern:** GpsJammingLayer renders at `top: 60px, right: 12px`. If both GPS jamming and GDELT stale indicators are visible simultaneously, they will overlap. Solution: render GdeltLayer stale indicator at `top: 85px` (25px below the GPS one) or use a different positioning strategy. This is a known risk to document.

### Anti-Patterns to Avoid

- **Adding `replayTs` to Effect 2 deps:** Causes full entity rebuild on every animation frame — severe flicker and GPU churn. Use a separate Effect 3 for temporal visibility updates.
- **Fetching per scrubber tick:** Any fetch inside `replayTs` selector or Effect would saturate the backend. The queryKey must not include `replayTs`.
- **Importing `GdeltEvent[]` directly into PlaybackBar without React Query deduplication:** PlaybackBar calling `useGdeltEvents()` is fine because TanStack Query deduplicates requests sharing the same queryKey. No extra network request.
- **Rendering GDELT dots when `replayMode === 'live'`:** GDELT dots have no meaning outside of playback context where the scrubber exists — they should only render inside the existing `replayMode === 'playback'` block in PlaybackBar.
- **GDELT-12 stale indicator: checking `replayMode` instead of `source_is_stale`:** The freshness indicator should reflect actual data freshness, not playback mode. GPS jamming uses playback mode because its data is always live; GDELT's `source_is_stale` is an explicit backend-set field.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Per-session replay fetch deduplication | Custom session ID tracking | TanStack Query queryKey with `[..., replayWindowStart, replayWindowEnd]` | Window bounds are stable per session — queryKey change only on new session |
| Stale data detection | Custom polling / timestamp math | `source_is_stale` boolean from existing API response | Already computed by ingest worker at write time |
| CesiumJS entity temporal filtering | Custom CesiumJS `SampledProperty` or CZML | Direct `entity.point.show` mutation in a lightweight Effect 3 | CZML is complex; SampledProperty is for continuous interpolation not discrete visibility |
| Timeline dot positioning | Canvas/SVG rendering | CSS `position: absolute; left: frac * 100%` (exact OSINT pattern) | Already proven in PlaybackBar; consistent with codebase |

---

## Common Pitfalls

### Pitfall 1: Flicker from Effect 2 + replayTs dependency
**What goes wrong:** Developer adds `replayTs` to Effect 2's deps array to keep entities current. Effect 2 does `entities.removeAll()` then full rebuild. At 60fps with 1000+ entities, this causes visible flicker and CPU/GPU spike.
**Why it happens:** The most obvious "make entities react to replayTs" implementation puts replayTs in Effect 2 deps.
**How to avoid:** Effect 2 deps = `[events, gdeltQuadClassFilter, layerVisible, viewer]` (exactly as now). Add Effect 3 with deps `[replayTs, replayMode, gdeltQuadClassFilter]` that iterates existing entities and mutates only `.point.show` — no removeAll/rebuild.
**Warning signs:** GPU fan spin when scrubbing; entity flicker; DevTools Profiler shows rapid React render cycles.

### Pitfall 2: Query refetch on scrubber movement
**What goes wrong:** `replayTs` leaks into the queryKey — either directly or via a computed value derived from it. Every tick issues a new API request.
**Why it happens:** Developer uses a `since` that tracks `replayTs` rather than `replayWindowStart`.
**How to avoid:** `since` = `replayWindowStart` (constant for the session), `until` = `replayWindowEnd` (constant for the session). Never use `replayTs` in the queryKey or query params.
**Warning signs:** DevTools Network tab shows GDELT requests firing continuously during playback.

### Pitfall 3: GDELT dot colour type mismatch
**What goes wrong:** Developer imports `QUAD_CLASS_COLORS` from `GdeltLayer.tsx` which exports `Record<number, Color>` (CesiumJS Color objects). PlaybackBar needs hex strings for CSS `background`.
**Why it happens:** `QUAD_CLASS_COLORS` in GdeltLayer stores CesiumJS `Color` instances, not hex strings. Passing a CesiumJS Color as `background` CSS value produces `[object Object]`.
**How to avoid:** Define a separate `QUAD_CLASS_HEX: Record<number, string>` in a shared file. GdeltLayer derives its CesiumJS Colors from it; PlaybackBar uses the hex map directly.

### Pitfall 4: PlaybackBar prop threading vs hook call
**What goes wrong:** Developer threads `gdeltEvents` as a prop through App.tsx → PlaybackBar. This increases coupling and requires App.tsx state wiring.
**Why it happens:** Concern about calling `useGdeltEvents()` in two components.
**How to avoid:** Call `useGdeltEvents()` directly in PlaybackBar. TanStack Query deduplicates — same queryKey hits cache, no extra network request. This is the same pattern used by `useOsintEvents` in PlaybackBar.

### Pitfall 5: Position overlap of stale indicators
**What goes wrong:** GdeltLayer stale indicator renders at `top: 60px, right: 12px` — same position as GpsJammingLayer overlay — when both layers are visible.
**Why it happens:** GPS jamming uses `top: 60px, right: 12px` as a hardcoded position.
**How to avoid:** Render GdeltLayer stale indicator at `top: 85px, right: 12px` (25px offset). Document this coupling in code comments.

### Pitfall 6: Undefined `replayWindowStart` at hook call time
**What goes wrong:** On mount, `replayWindowStart` is null (set via `/api/replay/window` fetch in PlaybackBar). Hook fires with `null` window → fetches all events without time bounds.
**Why it happens:** `replayWindowStart`/`replayWindowEnd` are null until the PlaybackBar effect completes.
**How to avoid:** Guard the since/until params: only include them if both `replayWindowStart` AND `replayWindowEnd` are non-null. When null in playback mode, either wait (queryKey includes nulls → one fetch when null, re-fetch when set) or disable the query until window is loaded. The safest is to include null values in the queryKey — React Query will fire one request with no time bounds, then fire again when the window loads.

---

## Code Examples

Verified patterns from codebase:

### CesiumJS EntityCollection iteration (for Effect 3)
```typescript
// Source: CesiumJS 1.x API — EntityCollection.values is a plain JS array
const entities = dataSourceRef.current.entities.values;
for (const entity of entities) {
  // entity.point is a PointGraphics instance
  // entity.point.show is a CesiumJS Property
  // Direct boolean assignment works when PointGraphics constructed with plain boolean:
  //   new PointGraphics({ show: true }) creates a ConstantProperty internally
  // Mutation: entity.point.show = new ConstantProperty(bool)  [safe]
  //       or: entity.point.show = bool  [may work, verify at runtime]
}
```

### PlaybackBar OSINT dot pattern (to mirror for GDELT)
```typescript
// Source: frontend/src/components/PlaybackBar.tsx lines 212-250 (existing)
{hasWindow && (() => {
  return osintEvents.map(evt => {
    const frac = (evt.ts - replayWindowStart!) / (replayWindowEnd! - replayWindowStart!);
    if (frac < 0 || frac > 1) return null;
    return (
      <div
        key={evt.id}
        title={evt.label}
        style={{
          position: 'absolute',
          left: `${frac * 100}%`,
          top: '50%',
          transform: 'translate(-50%, -50%)',
          width: '8px', height: '8px',
          borderRadius: '50%',
          background: EVENT_COLORS[evt.category] ?? '#fff',
          zIndex: 2,
          border: '1px solid rgba(0,0,0,0.5)',
        }}
      />
    );
  });
})()}
```

### QuadClass hex colours (canonical values from GdeltLayer)
```typescript
// Source: frontend/src/components/GdeltLayer.tsx (existing, to be extracted)
// 1 = Verbal Cooperation   → '#3B82F6' (blue)
// 2 = Material Cooperation → '#22C55E' (green)
// 3 = Verbal Conflict      → '#EAB308' (yellow)
// 4 = Material Conflict    → '#EF4444' (red)
const QUAD_CLASS_HEX: Record<number, string> = {
  1: '#3B82F6',
  2: '#22C55E',
  3: '#EAB308',
  4: '#EF4444',
};
```

### Stale indicator reference (GpsJammingLayer pattern)
```typescript
// Source: frontend/src/components/GpsJammingLayer.tsx lines 113-133 (existing)
// GDELT-12: render at top: 85px to avoid GPS JAM overlay collision at top: 60px
return (
  <div style={{
    position: 'fixed', top: '85px', right: '12px', zIndex: 100,
    background: 'rgba(245, 158, 11, 0.15)',
    border: '1px solid #F59E0B',
    color: '#F59E0B',
    fontFamily: 'monospace', fontSize: '10px', fontWeight: 700,
    padding: '2px 6px', borderRadius: '3px',
    pointerEvents: 'none',
  }}>
    GEO STALE
  </div>
);
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `useGdeltEvents` fetches with bbox only | Hook must also support `since`/`until` replay window params | Phase 36 | One load per session, no per-tick refetch |
| GdeltLayer Effect 2 sets all entity visibility once at load | Effect 3 dynamically updates show based on `replayTs` | Phase 36 | Temporal accumulation without flicker |
| PlaybackBar only shows OSINT event dots | PlaybackBar shows both OSINT and GDELT dots | Phase 36 | Unified timeline representation |
| GdeltLayer returns null always | GdeltLayer conditionally returns stale indicator div | Phase 36 | Mirrors GpsJammingLayer pattern |

---

## Open Questions

1. **ConstantProperty mutation for entity.point.show**
   - What we know: CesiumJS `PointGraphics.show` is a `Property` interface; constructing with `new PointGraphics({ show: true })` creates an internal `ConstantProperty`
   - What's unclear: Whether `entity.point.show = booleanValue` (direct assignment) works in CesiumJS 1.139 or requires `entity.point.show = new ConstantProperty(booleanValue)`
   - Recommendation: Use `new ConstantProperty(bool)` in Effect 3 to be safe; test at implementation time. If CesiumJS 1.139 coerces, simplify.

2. **GDELT dot count performance in PlaybackBar**
   - What we know: GDELT events for a 7-day window can be 100–150k rows; PlaybackBar renders dots for all
   - What's unclear: Browser performance with 50k+ absolutely positioned divs on the scrubber track
   - Recommendation: Apply the same `gdeltQuadClassFilter` to limit visible dots; consider capping at 1000 dots with a density algorithm if performance is observed to be poor during human verification. The existing OSINT dot code has no such cap (events are limited to a few dozen), so this is uncharted for GDELT volume.

3. **Replay window `since`/`until` vs actual data availability**
   - What we know: Replay window comes from `/api/replay/window` which queries `positions_snapshots`, not `gdelt_events`; the GDELT 7-day retention may not align exactly with the positions_snapshots window
   - What's unclear: Whether `replayWindowStart`/`replayWindowEnd` will always be within the GDELT 7-day window
   - Recommendation: Let the API do the right thing — `since`/`until` are passed directly; if GDELT events don't cover the full replay window, fewer events are returned (acceptable).

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.0.18 |
| Config file | `frontend/vite.config.ts` (test section: environment jsdom, globals true) |
| Quick run command | `npx vitest run --reporter=verbose src/hooks/__tests__/useGdeltEvents.test.ts src/components/__tests__/GdeltLayer.test.tsx src/components/__tests__/PlaybackBar.test.tsx` |
| Full suite command | `npx vitest run` (from `frontend/` directory) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| GDELT-10 | `useGdeltEvents` includes `since`/`until` params when in playback mode with valid window | unit | `npx vitest run src/hooks/__tests__/useGdeltEvents.test.ts` | ✅ (needs new tests appended) |
| GDELT-10 | queryKey does NOT include `replayTs` — only window bounds | unit | `npx vitest run src/hooks/__tests__/useGdeltEvents.test.ts` | ✅ (needs new tests) |
| GDELT-10 | refetchInterval is false in playback mode | unit | `npx vitest run src/hooks/__tests__/useGdeltEvents.test.ts` | ✅ (existing, passes) |
| GDELT-10 | GdeltLayer Effect 3: entities with `occurred_at > replayTs` have `show = false` | unit | `npx vitest run src/components/__tests__/GdeltLayer.test.tsx` | ✅ (needs new tests) |
| GDELT-11 | GDELT dots render on PlaybackBar scrubber track in playback mode | unit | `npx vitest run src/components/__tests__/PlaybackBar.test.tsx` | ✅ (needs new tests) |
| GDELT-11 | GDELT dots use QuadClass hex colour for `background` CSS | unit | `npx vitest run src/components/__tests__/PlaybackBar.test.tsx` | ✅ (needs new tests) |
| GDELT-12 | GdeltLayer renders stale indicator div when `source_is_stale=true` and layer visible | unit | `npx vitest run src/components/__tests__/GdeltLayer.test.tsx` | ✅ (needs new tests) |
| GDELT-12 | GdeltLayer does NOT render stale indicator when `source_is_stale=false` | unit | `npx vitest run src/components/__tests__/GdeltLayer.test.tsx` | ✅ (needs new tests) |

### Sampling Rate
- **Per task commit:** `npx vitest run src/hooks/__tests__/useGdeltEvents.test.ts src/components/__tests__/GdeltLayer.test.tsx src/components/__tests__/PlaybackBar.test.tsx`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
No new test files are required — all new tests are appended to existing test files:
- `src/hooks/__tests__/useGdeltEvents.test.ts` — add GDELT-10 tests for `since`/`until` params and queryKey shape
- `src/components/__tests__/GdeltLayer.test.tsx` — add GDELT-10 (temporal show) and GDELT-12 (stale indicator) tests
- `src/components/__tests__/PlaybackBar.test.tsx` — add GDELT-11 tests for GDELT dot rendering

All test files already exist and pass. New tests follow the Wave 0 stub pattern: `it.todo()` or `describe.skip` for contracts not yet implemented.

---

## Sources

### Primary (HIGH confidence)
- Codebase — `frontend/src/hooks/useGdeltEvents.ts` — current hook implementation, queryKey structure, VPC-08 pattern
- Codebase — `frontend/src/components/PlaybackBar.tsx` — OSINT dot rendering pattern (lines 212–250), exact CSS values
- Codebase — `frontend/src/components/GpsJammingLayer.tsx` — stale indicator DOM pattern (lines 113–133)
- Codebase — `frontend/src/components/GdeltLayer.tsx` — Effect 1/2 structure, QUAD_CLASS_COLORS values, entity id format
- Codebase — `frontend/src/store/useAppStore.ts` — `replayWindowStart`, `replayWindowEnd`, `replayTs`, `replayMode` slice shapes
- Codebase — `backend/app/api/routes_gdelt.py` — `since`/`until` param support confirmed
- Codebase — `.planning/STATE.md` — key decisions: `useGdeltEvents.getState()` pattern, staleTime=900_000, single-load per session decision

### Secondary (MEDIUM confidence)
- Codebase — `frontend/src/hooks/useOsintEvents.ts` — PlaybackBar hook-call pattern (called directly inside PlaybackBar, not threaded as prop)
- CesiumJS 1.x API (training data, corroborated by existing codebase usage) — `EntityCollection.values`, `PointGraphics.show` as CesiumJS Property interface

### Tertiary (LOW confidence)
- CesiumJS `entity.point.show = boolean` direct mutation — behaviour in v1.139 not verified against official docs; verify at implementation time

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new libraries; all patterns are already in production in this codebase
- Architecture: HIGH — OSINT dot pattern and stale indicator pattern are working reference implementations; effect split (Effect 2 + Effect 3) is a direct derivation from existing Effect 1/2 split in GdeltLayer
- Pitfalls: HIGH — replayTs-in-deps flicker and query-per-tick saturation are directly derived from existing decisions documented in STATE.md

**Research date:** 2026-03-14
**Valid until:** 2026-04-14 (stable codebase; no external API changes expected)
