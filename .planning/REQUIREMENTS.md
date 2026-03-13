# Requirements: OpenSignal Globe

**Defined:** 2026-03-13
**Core Value:** A unified, visually impressive intelligence picture — satellites orbiting, aircraft moving, anomalies surfacing — all rendered on one polished 3D globe that feels operational and modern.

## v5.0 Requirements

Requirements for the Playback milestone. Each maps to roadmap phases.

### Playback Engine

- [ ] **PLAY-01**: `isPlaying` promoted from `PlaybackBar` local state to `useAppStore` so all layer components can read it
- [ ] **PLAY-02**: Satellites propagate at `replayTs` during playback; propagation loop skips dispatch when `isPlaying` is false
- [ ] **PLAY-03**: Globe day/night shading follows `replayTs` via new `useViewerClock` hook syncing `viewer.clock.currentTime`
- [ ] **PLAY-04**: Returning to LIVE triggers `queryClient.invalidateQueries()` — no 90-second stale-data window after mode switch

### Layer Behaviour

- [ ] **LAYR-01**: Aircraft live lerp returns early in playback mode; snapshot interpolation has exclusive `bb.position` ownership in playback
- [ ] **LAYR-02**: Ships + military `Effect 2` gated by `replayMode` — background React Query refetches cannot overwrite snapshot positions
- [ ] **LAYR-03**: GPS jamming `refetchInterval` frozen in playback; amber "LIVE DATA" badge visible when layer is on in playback
- [ ] **LAYR-04**: Street traffic particles hidden during playback (no historical road data exists)

### Visual Feedback

- [ ] **VIS-01**: Stale entities show visual degradation (grey tint / opacity reduction) in LIVE mode — requires backend to serialise `is_stale` per entity from v4.0 freshness columns
- [ ] **VIS-02**: CinematicHUD shows `REPLAY [ISO timestamp]` instead of `REC` when in playback mode
- [ ] **VIS-03**: Play button disabled with "Loading snapshots…" indicator while snapshot fetch is in progress

### Verification

- [ ] **VRFY-01**: End-to-end scrub test across 2-hour window — pause freeze, all speed presets, auto-stop at window end, all layers correct
- [ ] **VRFY-02**: FPS gate above 30 at 15m/s+ with aircraft + ships active; optimisation applied if gate fails

## v6.0 Requirements

Deferred to future milestone.

### Playback Polish

- **KYBD-01**: Keyboard shortcuts — Space for play/pause, L for LIVE/PLAYBACK toggle (depends on PLAY-01 store promotion, which ships in v5.0)
- **LIVE-01**: Reusable `<LiveDataBadge>` component shared across GPS jamming and street traffic layers
- **LIVE-02**: Replay speed text readout ("60×") beside timestamp display
- **LIVE-03**: Replay window time-range labels at scrubber track ends

### Data Freshness

- **FRESH-03**: Dedicated `/api/military/freshness` and `/api/ships/freshness` endpoints parallel to `/api/aircraft/freshness` (deferred from v4.0)

### New Layers

- **LAY-05**: Earthquake layer — USGS 24h GeoJSON feed, magnitude-scaled markers
- **LAY-06**: Weather radar overlay — NOAA NEXRAD WMS tiles on globe

## Out of Scope

| Feature | Reason |
|---------|--------|
| CZML-based replay | Ruled out at v2.0 — wrong pattern for snapshot-driven dynamic data at full entity density |
| Sub-minute snapshot resolution | Storage cost prohibitive; 60s + frontend interpolation is visually acceptable at all speed presets |
| Reverse playback | Disproportionate complexity; simulation layers (street traffic, GPS jamming) have no reverse concept |
| Live streaming overlay inside playback | Doubles draw calls; no intelligence requirement identified |
| Real-time collaboration | Single-user tool |
| Mobile app | Web-first |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| PLAY-01 | Phase 23 | Pending |
| PLAY-03 | Phase 23 | Pending |
| VIS-02 | Phase 23 | Pending |
| VIS-03 | Phase 23 | Pending |
| PLAY-02 | Phase 24 | Pending |
| PLAY-04 | Phase 25 | Pending |
| LAYR-01 | Phase 25 | Pending |
| LAYR-02 | Phase 25 | Pending |
| LAYR-03 | Phase 25 | Pending |
| LAYR-04 | Phase 25 | Pending |
| VIS-01 | Phase 26 | Pending |
| VRFY-01 | Phase 26 | Pending |
| VRFY-02 | Phase 26 | Pending |

**Coverage:**
- v5.0 requirements: 13 total
- Mapped to phases: 13
- Unmapped: 0 ✓

---
*Requirements defined: 2026-03-13*
*Last updated: 2026-03-13 — traceability updated for v5.0 roadmap (phases 23-26)*
