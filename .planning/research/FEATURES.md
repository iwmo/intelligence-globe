# Feature Research

**Domain:** 4D Geospatial Replay Engine — Correctness Audit and Playback UX
**Researched:** 2026-03-13
**Confidence:** HIGH (codebase fully read; all implementation gaps confirmed by direct code inspection)

---

## Context: What Is Already Shipped

The following are built and are NOT features for this milestone. They are the foundation
against which new features are scoped:

- LIVE/PLAYBACK toggle (`replayMode` in `useAppStore`)
- Timeline scrubber with 1000-point integer precision
- Play/Pause with rAF advancement loop, auto-stop at window end
- 5 speed presets: 1m/s, 3m/s, 5m/s, 15m/s, 1h/s
- Snapshot binary-search interpolation for aircraft, military, ships
- OSINT event marker dots on scrubber track with category chip filter
- TLE staleness warning badge when TLE age > 7 days
- Satellite overpass arc lines to area-of-interest (via `COMPUTE_OVERPASS` with `replayTs`)
- `useReplaySnapshots` hook: fetches 2-hour window, builds `Map<entityId, SnapshotRecord[]>`, returns `isLoading`
- Freshness lifecycle columns on all four entity tables (v4.0)
- `is_active` filtering on `/api/aircraft`, `/api/military`, `/api/ships` (v4.0)

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features whose absence makes the replay feel broken or untrustworthy. Missing any of these
means "go back in time" is a lie — some layer still moves in real time during historical playback.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Satellite propagation uses `replayTs`, not `Date.now()` | Satellites are the most visually prominent layer. If they keep moving at live speed during playback, the entire "go back in time" premise collapses for the user. | MEDIUM | **Confirmed bug (line 260, SatelliteLayer.tsx):** `worker.postMessage({ type: 'PROPAGATE', payload: { timestamp: Date.now() } })` — should send `replayTs` when in playback mode. Worker already accepts a `timestamp` param; the fix is in the caller. Additionally, the propagation loop itself must pause entirely when `isPlaying === false` to prevent satellites from drifting forward during a paused replay. |
| Aircraft live-lerp stops in playback mode | The lerp loop animates aircraft using wall-clock `Date.now()` (line 253, AircraftLayer.tsx). During playback this loop still runs, advancing aircraft to positions extrapolated from live data. The snapshot interpolation effect also writes positions, causing a write conflict. | MEDIUM | Gate the lerp `animate()` function body: `if (replayMode === 'playback') { rafRef.current = requestAnimationFrame(lerp); return; }`. The existing snapshot interpolation effect already handles position in playback. `replayMode` must be readable inside the rAF closure — use `useAppStore.getState().replayMode` to avoid stale closure. |
| Ships stop live-updating in playback mode | Ships have no lerp, but `Effect 2` (useEffect on `ships.data`) directly writes billboard positions when new poll data arrives during playback. Historical snapshot positions get overwritten on the next 90-second live poll. | LOW | Gate `Effect 2` in ShipLayer.tsx: `if (replayMode === 'playback') return;` at the top of the effect. The snapshot interpolation effect already has its own `replayMode` guard. |
| Military aircraft stops live-updating in playback mode | Same issue as ships: `Effect 2` in MilitaryAircraftLayer.tsx writes billboard positions directly from `useMilitaryAircraft` data without checking `replayMode`. | LOW | Same fix: gate `Effect 2` behind `if (replayMode === 'playback') return;`. |
| GPS jamming layer discloses it is not historical | No historical H3 hexagon snapshots exist. Showing live jamming data while all other layers show historical creates a false intelligence picture — the user has no way to know the jamming overlay is current-time, not `replayTs`. | LOW | Show an amber "LIVE DATA" badge overlaid on the GPS jamming layer when `replayMode === 'playback'` and the layer is visible. Do NOT hide the layer — the data is still useful context, but must be labeled as present-tense. |
| Street traffic particles freeze when paused | The `StreetTrafficLayer` rAF `animate()` loop has no `replayMode` or `isPlaying` awareness. Particles continue flowing during a paused replay, which is visually incoherent when all entity layers are frozen at `replayTs`. | LOW | Check `useAppStore.getState().replayMode` inside the `animate()` function. When `replayMode === 'playback'` and the global `isPlaying === false`, skip advancing `p.t`. Particles may still move during active playback — they are a simulation, not historical data. Requires exposing `isPlaying` to the store or an equivalent read path. |
| End-to-end scrubbing: all layers respond to `replayTs` | Dragging the scrubber must move all entity-based layers simultaneously with no residual live movement. Aircraft/military/ships already respond via snapshot interpolation. Satellites do not. | MEDIUM | After PLAY-01 fix, all four entity layers respond. GPS jamming and street traffic are acknowledged as non-historical (badge). Manual scrub test across a 2-hour window with all layers active is the acceptance test. |
| Playback auto-stop at window end | Already implemented correctly in PlaybackBar.tsx. The rAF tick exits and sets `isPlaying(false)` when `next >= windowEnd`. | LOW | Already built. Verify button state resets and satellites also stop advancing at that moment. |

### Differentiators (Competitive Advantage)

Features beyond correctness that create a polished, trustworthy intelligence platform experience.
Competitors (Flightradar24, FlightAware replay) show only a single flight layer; none of this
multi-layer synchronised replay exists in free tools.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Stale entity visual indicator — VIS-01 (deferred from v4.0) | In live mode, entities with `is_active=false` or crossed staleness thresholds should visually degrade: opacity reduction, grey tint, or "STALE" badge in detail panel. Differentiates from platforms that silently show dead positions as live. | MEDIUM | Requires: (a) list API responses include an `is_stale: bool` flag per entity (aircraft freshness columns are in DB from v4.0; route serialisation must expose them), (b) billboard `color` or `alpha` tint applied when `is_stale=true` — use CesiumJS `Color.withAlpha(0.3)` or a grey override via `bb.color = Color.GRAY.withAlpha(0.5)`. Detail panels should show a "STALE — last seen N minutes ago" line. |
| Playback mode indicator on CinematicHUD | In playback mode the "REC" label and live timestamp in the HUD should switch to "REPLAY" with the `replayTs` ISO string. A screenshot of the globe during replay is immediately identifiable as historical, not live. | LOW | `CinematicHUD.tsx` already renders a timestamp from `Date.now()`. Add `replayMode`/`replayTs` from `useAppStore`; conditionally render "REPLAY [replayTs ISO]" vs "REC [Date.now() ISO]". No store changes needed. |
| Snapshot window loading indicator | When entering playback mode the `useReplaySnapshots` fetch takes 1–3 seconds for a 2-hour dense window. Currently no loading feedback exists — the play button is enabled immediately, leading users to press play and see nothing happen. | LOW | `useReplaySnapshots` already returns `isLoading` from react-query. Surface in PlaybackBar: disable play button and render "Loading snapshots…" label until `!isLoading`. Zero API changes needed. |
| `isPlaying` promoted from local state to `useAppStore` | Currently `isPlaying` lives in `PlaybackBar`'s local `useState`. This prevents the satellite propagation loop and street traffic particle loop from reading it without prop drilling. Promoting it unblocks correct pause behaviour across layers. | LOW | Add `isPlaying: boolean` and `setIsPlaying: (v: boolean) => void` to `useAppStore` (not `useSettingsStore` — it is transient runtime state). Remove local `useState(false)` in `PlaybackBar`. |
| Per-layer LIVE data badge for non-historical layers | A reusable component that renders an amber "LIVE" badge when a layer cannot serve historical data but is displayed inside a replay session. Makes the data-type contract visible to users. | LOW | Implement as `<LiveDataBadge visible={replayMode === 'playback'} />` — a small fixed `<div>` with amber border. Apply to GPS jamming and street traffic layers. |
| Replay speed indicator as text readout | The active speed preset is shown by border-colour on the preset buttons. Adding a compact "60×" or "1 h/s" text label beside the ISO timestamp makes the playback rate immediately readable without scanning the button row. | LOW | Add `{formatSpeedLabel(speedMultiplier)}` span beside timestamp in PlaybackBar. Pure presentation, no store changes. |
| Keyboard shortcuts: Space and L | Space for play/pause; L for LIVE/PLAYBACK toggle. Matches video player conventions. Power users operating the globe expect keyboard control. | LOW | Add to `useKeyboardShortcuts.ts`. Space → `store.setIsPlaying(!store.isPlaying)` when `replayMode === 'playback'`. L → `handleModeToggle()`. Guard: `if (document.activeElement` is an input, ignore. Requires `isPlaying` in store. |
| Replay window time-range display | Show the available replay window span (oldest to newest timestamp) as labels at the track ends of the scrubber. Users currently cannot see how far back they can scrub without pressing the leftmost position. | LOW | Format `replayWindowStart` and `replayWindowEnd` as short `DD MMM HH:MM` strings; render under the scrubber input at left and right edges. No API changes needed. |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| CZML-based replay | CesiumJS native time-dynamic format; seems like the obvious pattern. | At full entity density (thousands of aircraft/ships over 2 hours) a CZML document is hundreds of megabytes. It couples all entity state to the CesiumJS clock event, bypassing the custom rAF loop. Multi-source synchronisation (satellites + snapshots + OSINT) cannot be expressed in a single CZML document without custom extensions. Already explicitly ruled out in PROJECT.md decision log (v2.0). | Keep snapshot binary-search interpolation driven by `replayTs` via the rAF loop. This is confirmed correct and already partially working. |
| Rewind (play in reverse while button held) | Natural from video player conventions. | Satellites (SGP4) are bidirectional — propagation can run backward. But: street traffic particles have no reverse concept, GPS jamming has no historical snapshots, and the rAF loop only increments `replayTs`. Supporting reverse requires a separate decrement branch, inverse lerp validation, and particle "un-advance" logic. Disproportionate complexity with minimal intelligence value. | Pause, drag scrubber manually to an earlier timestamp, then resume forward. This is the correct UX for a multi-layer system with mixed historical and simulation layers. |
| Sub-minute snapshot resolution | Users want 1-second-resolution smooth replay. | Storage: 1 Hz snapshots for all entity layers over 7-day retention at full density is ~264 MB per hour vs the current 73 MB for the entire retention window. Would require a complete storage redesign. The existing 60s interval with frontend lerp interpolation is validated visually acceptable at all 5 speed presets. | Keep 60s snapshot interval + interpolation. The 1000-point scrubber precision provides smooth seeking within each interpolated segment. |
| Live streaming overlay inside playback | Show a live feed alongside historical replay for comparison. | Requires two parallel rendering passes per layer. Doubles draw calls; at 5,000+ satellites this would halve FPS on integrated GPU. No clear intelligence requirement identified; the current LIVE badge on non-historical layers already provides the relevant context. | Exit playback to observe live state, then re-enter. Use the per-layer LIVE badge to acknowledge non-historical layers during replay. |
| Per-entity scrubber bookmarks | Bookmark a specific entity at a specific time for later reference. | Requires entity-ID + timestamp pair storage, persistence across mode transitions, and visual indicator on scrubber track (now already crowded with OSINT event dots). Niche use case — adds complexity to the densest UI element. | OSINT event entry panel already serves this function for area-of-interest events. Log a manual OSINT event at the time and location to create a persistent marker. |
| "Jump to next event" button | Skip to the next OSINT event marker while playing. | Requires event-aware rAF advancement (current loop is purely arithmetic time advance). OSINT events are already at known timestamps; clicking a dot on the scrubber is equivalent and already works. | User clicks the event dot directly. PlaybackBar already supports `setReplayTs(evt.ts)` on dot click. |

---

## Feature Dependencies

```
[PLAY-01: Satellite uses replayTs]
    └──requires──> replayMode and replayTs readable in SatelliteLayer effect
                       └──already available: useAppStore selectors
    └──requires──> isPlaying accessible outside PlaybackBar
                       └──MISSING: isPlaying is local state in PlaybackBar
                       └──fix: promote isPlaying to useAppStore
    └──note: worker PROPAGATE handler already accepts {timestamp} — only caller is wrong

[PLAY-03: Live lerp guard for aircraft]
    └──requires──> replayMode in store
                       └──already available
    └──requires──> replayMode readable inside rAF closure without stale capture
                       └──use useAppStore.getState().replayMode — reads current value
    └──note: snapshots effect already has guard; lerp loop does not

[PLAY-02: Ships and military live-update gate]
    └──requires──> replayMode in store
                       └──already available
    └──LOW complexity: add single guard line to each layer's Effect 2

[PLAY-02: GPS jamming LIVE badge]
    └──requires──> replayMode in store
                       └──already available
    └──LOW complexity: conditional render in GpsJammingLayer or App

[PLAY-02: Street traffic particle pause]
    └──requires──> isPlaying accessible in rAF loop
                       └──MISSING: requires isPlaying in store (see PLAY-01 dependency)
    └──alternative: use replayMode only — freeze particles entirely during playback
                       └──simpler, acceptable: particles are not historical anyway

[PLAY-04: End-to-end verification]
    └──requires──> PLAY-01, PLAY-02, PLAY-03 all complete
    └──requires──> snapshot data present in DB (at least one 2-hour window with all layers)

[VIS-01: Stale entity visual indicator]
    └──requires──> is_stale flag in list API responses per entity
                       └──PARTIALLY AVAILABLE: freshness columns in DB from v4.0
                       └──MISSING: serialisation layer does not expose is_stale per entity yet
    └──requires──> CesiumJS billboard color/alpha mutation
                       └──already available: bb.color = Color.GRAY.withAlpha(0.5)

[isPlaying in useAppStore]
    └──enables──> [PLAY-01 satellite propagation pause]
    └──enables──> [Street traffic particle freeze on pause]
    └──enables──> [Keyboard shortcut: Space bar]
    └──enables──> [Snapshot loading indicator: disable play button]

[Playback mode badge on CinematicHUD]
    └──requires──> replayMode, replayTs in store (already available)
    └──enhances──> PLAY-01: HUD timestamp is misleading if satellite layer still shows live time

[Snapshot loading indicator]
    └──requires──> useReplaySnapshots isLoading (already returned by react-query)
    └──requires──> isPlaying in store (to disable button conditionally)
```

### Dependency Notes

- **`isPlaying` is the single biggest dependency gap.** It is currently local state inside `PlaybackBar`. Promoting it to `useAppStore` is LOW complexity (two lines) and unlocks correct satellite pause, street traffic freeze, keyboard shortcuts, and the loading indicator. It must be in `useAppStore` (not `useSettingsStore`) because it is transient runtime state that must not persist to localStorage.

- **PLAY-01 fix sequence:** (1) promote `isPlaying` to store, (2) in `SatelliteLayer` Effect 1 rAF loop, check `useAppStore.getState().replayMode`; if `playback`, send `replayTs` instead of `Date.now()`; if `playback && !isPlaying`, skip the PROPAGATE dispatch entirely.

- **PLAY-03 aircraft lerp guard:** The lerp loop reads positions via module-scope maps (`prevPositions`, `currPositions`) that were populated by live data. In playback, the snapshot effect overwrites `bb.position` after the lerp, so the lerp is redundant and counterproductive. The guard does not need to freeze a position — it just needs to stop writing to `bb.position` so the snapshot effect's write is the last one per frame.

- **VIS-01 backend dependency:** The v4.0 freshness columns (`time_position`, `is_active`, `fetched_at`) are in the DB. The `/api/aircraft` list route must be extended to serialise an `is_stale` boolean per entity (derived from `time_position` vs threshold). Military and ships need the same addition. This is a backend-only change with no schema migration needed.

- **GPS jamming LIVE badge vs refetch pause:** Two approaches exist: (a) pause `useGpsJamming` refetch during playback so the layer stays frozen at playback-start data, or (b) keep refetching and show a badge. Approach (b) is recommended — it preserves live context and is more honest. Hiding the live layer during replay removes potentially useful current-state intelligence.

---

## MVP Definition

### Launch With (v5.0 — Core Correctness Audit)

The minimum requirement: all layers behave correctly. No entity moves in real time during
a historical replay session.

- [ ] **PLAY-01** — Satellite propagation sends `replayTs` to worker when `replayMode === 'playback'`; propagation loop skips dispatch when `isPlaying === false`
- [ ] **PLAY-02a** — Aircraft live-lerp rAF loop does not advance entity positions when `replayMode === 'playback'`
- [ ] **PLAY-02b** — Ships `Effect 2` gated by `replayMode !== 'playback'`; live poll data does not overwrite snapshot positions
- [ ] **PLAY-02c** — Military `Effect 2` gated by `replayMode !== 'playback'`
- [ ] **PLAY-02d** — GPS jamming: amber "LIVE DATA" badge visible when `replayMode === 'playback'` and layer is on
- [ ] **PLAY-02e** — Street traffic: particle `animate()` loop skips advancing `p.t` when paused during playback
- [ ] **PLAY-03** — `isPlaying` promoted to `useAppStore`; all guards use store-read value, not stale closure
- [ ] **PLAY-04** — End-to-end: scrub 2-hour window with all layers active, verify frozen pause, correct entity movement, auto-stop at window end

### Add After Correctness Validation (v5.1)

- [ ] **VIS-01** — Frontend stale entity visual indicator: grey tint or opacity reduction for stale aircraft/military/ships in live mode. Requires extending list API serialisation to include `is_stale` per entity.
- [ ] **CinematicHUD REPLAY badge** — Switch "REC" to "REPLAY [replayTs]" in playback mode
- [ ] **Snapshot loading indicator** — Disable play button, show "Loading snapshots…" while `isLoading === true`
- [ ] **Freshness endpoints** — `/api/military/freshness` and `/api/ships/freshness` (FRESH-03, deferred from v4.0)

### Future Consideration (v6.0+)

- [ ] **Keyboard shortcuts** — Space for play/pause, L for LIVE/PLAYBACK (depends on `isPlaying` in store)
- [ ] **Per-layer LIVE badge component** — Reusable `<LiveDataBadge>` for any non-historical layer in replay
- [ ] **Replay speed readout** — Compact text label "60×" beside timestamp in scrubber bar
- [ ] **Replay window time-range display** — Oldest/newest labels at scrubber track ends
- [ ] **Entity count badge** — "N entities at this timestamp" derived from snapshot map

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| PLAY-01 Satellite uses replayTs | HIGH | MEDIUM | P1 |
| PLAY-02a Aircraft lerp guard | HIGH | LOW | P1 |
| PLAY-02b Ships live-update gate | HIGH | LOW | P1 |
| PLAY-02c Military live-update gate | HIGH | LOW | P1 |
| PLAY-02d GPS jamming LIVE badge | MEDIUM | LOW | P1 |
| PLAY-02e Street traffic particle pause | MEDIUM | LOW | P1 |
| PLAY-03 isPlaying in useAppStore | HIGH | LOW | P1 |
| PLAY-04 End-to-end verification | HIGH | MEDIUM | P1 |
| VIS-01 Stale entity visual indicator | HIGH | MEDIUM | P2 |
| CinematicHUD REPLAY badge | MEDIUM | LOW | P2 |
| Snapshot loading indicator | MEDIUM | LOW | P2 |
| Freshness endpoints (military, ships) | LOW | LOW | P2 |
| Keyboard shortcuts | LOW | LOW | P3 |
| Per-layer LIVE badge component | LOW | LOW | P3 |
| Replay speed readout | LOW | LOW | P3 |
| Replay window range display | LOW | LOW | P3 |

**Priority key:**
- P1: Correctness requirement — blocks v5.0 milestone close
- P2: Polish — ship before v6.0 scoping
- P3: Nice to have — opportunistic

---

## Layer-Specific Playback Behaviour Contract

Acceptance criteria for PLAY-02 audit. Each row defines the correct behaviour per layer.

| Layer | Position Source During Playback | Behaviour When Paused | Historical Data? | LIVE Badge? | Key Implementation Gap |
|-------|--------------------------------|-----------------------|-----------------|-------------|----------------------|
| Satellites | SGP4 propagation at `replayTs` | Propagation loop stops; satellites frozen | Yes (deterministic) | No | PROPAGATE sends `Date.now()` — must send `replayTs` |
| Commercial aircraft | Snapshot binary-search interpolation | Snapshot effect frozen (depends on `replayTs` not changing) | Yes (snapshots) | No | Live lerp rAF loop still runs — must be gated |
| Military aircraft | Snapshot binary-search interpolation | Same — no live effect overwriting | Yes (snapshots) | No | Effect 2 not gated — must add `replayMode` guard |
| Ships | Snapshot binary-search interpolation | Same — no live effect overwriting | Yes (snapshots) | No | Effect 2 not gated — must add `replayMode` guard |
| GPS Jamming | Live data (no historical snapshots) | Static heatmap from last live fetch | No | **Yes — amber** | `useGpsJamming` unaware of replay mode |
| Street traffic | Simulation (no real historical data) | Particles stop advancing | No | **Yes — amber** | rAF `animate()` has no `isPlaying`/`replayMode` guard |
| OSINT events | Already historical (stored `ts` in DB) | Dots positioned by stored `ts`; no change | Yes (DB) | No | Already correct |
| Satellite overpass arcs | `COMPUTE_OVERPASS` already uses `replayTs` | Already suppressed when TLE stale | Yes (deterministic) | No | Already correct; stale guard in place |

---

## Competitor Feature Analysis

| Feature | Flightradar24 Playback | FlightAware Replay | Our Approach (v5.0 target) |
|---------|------------------------|-------------------|---------------------------|
| Multi-layer time sync | Single layer (flights only) | Single layer (flights only) | 6 layers synchronised to `replayTs` |
| Scrubber precision | Date/time picker | Fixed 10×/50×/100× speed only | 1000-point scrub + 5 speed presets |
| Event markers on scrubber | None | None | OSINT event dots with category filter |
| Non-historical layer disclosure | Not applicable (single layer) | Not applicable | Per-layer LIVE badge for GPS jamming and street traffic |
| Satellite overpass integration | Not available | Not available | `COMPUTE_OVERPASS` with `replayTs`, TLE staleness suppression |
| Freeze on pause | Single-layer freeze | Single-layer freeze | Multi-layer freeze across 6 layers (this milestone's goal) |
| Stale entity visual | Not disclosed | Not disclosed | VIS-01: opacity/tint for `is_stale=true` entities (v5.1) |

---

## Sources

- **Code inspection — confirmed bugs:**
  - `frontend/src/components/SatelliteLayer.tsx` line 260: `timestamp: Date.now()` hardcoded in PROPAGATE — should be `replayTs` in playback mode
  - `frontend/src/workers/propagation.worker.ts` lines 63–88: worker accepts `{timestamp}` param correctly; bug is exclusively in the caller
  - `frontend/src/components/AircraftLayer.tsx` line 253: lerp reads `Date.now()` with no `replayMode` guard
  - `frontend/src/components/MilitaryAircraftLayer.tsx` lines 85–119: `Effect 2` has no `replayMode` guard
  - `frontend/src/components/ShipLayer.tsx` lines 87–127: `Effect 2` has no `replayMode` guard
  - `frontend/src/components/GpsJammingLayer.tsx`: no replay mode awareness; `useGpsJamming` polls unconditionally
  - `frontend/src/components/StreetTrafficLayer.tsx` lines 152–188: `animate()` loop has no `replayMode` or `isPlaying` guard
  - `frontend/src/components/PlaybackBar.tsx` line 45: `isPlaying` is `useState(false)` — local state, not accessible to layer components
- **Code inspection — already correct:**
  - `frontend/src/hooks/useReplaySnapshots.ts`: `isLoading` returned; snapshot interpolation correctly uses `replayTs`
  - `frontend/src/components/SatelliteLayer.tsx` Effect 6: `COMPUTE_OVERPASS` uses `replayTs`; stale guard in place
  - `frontend/src/components/PlaybackBar.tsx`: auto-stop at window end correct; speed presets correct
- `.planning/PROJECT.md` — v5.0 active requirements (PLAY-01 through PLAY-04, VIS-01)
- [Flightradar24 playback blog](https://www.flightradar24.com/blog/inside-flightradar24/playback-is-now-available-in-the-flightradar24-app/) — competitor reference for single-layer replay UX expectations
- [FlightAware Flight Replay introduction](https://blog.flightaware.com/201710-introducing-flight-replay-and-track-visualization) — competitor reference for speed control patterns

---

*Feature research for: OpenSignal Globe v5.0 — 4D Replay Engine Correctness Audit*
*Researched: 2026-03-13*
