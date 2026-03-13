# Roadmap: OpenSignal Globe

## Milestones

- ✅ **v1.0 MVP** — Phases 1-6 (shipped 2026-03-11) — [Archive](milestones/v1.0-ROADMAP.md)
- ✅ **v2.0 WorldView Parity** — Phases 7-12 (shipped 2026-03-12) — [Archive](milestones/v2.0-ROADMAP.md)
- ✅ **v3.0 UI Refinement** — Phases 13-16 (shipped 2026-03-13) — [Archive](milestones/v3.0-ROADMAP.md)
- ✅ **v4.0 Data Reliability & Freshness** — Phases 17-22 (shipped 2026-03-13) — [Archive](milestones/v4.0-ROADMAP.md)
- 🚧 **v5.0 Playback** — Phases 23-26 (in progress)

## Phases

<details>
<summary>✅ v1.0 MVP (Phases 1-6) — SHIPPED 2026-03-11</summary>

- [x] Phase 1: Foundation (3/3 plans) — completed 2026-03-11
- [x] Phase 2: Satellite Layer (4/4 plans) — completed 2026-03-11
- [x] Phase 3: Aircraft Layer (3/3 plans) — completed 2026-03-11
- [x] Phase 4: Controls and Polish (3/3 plans) — completed 2026-03-11
- [x] Phase 5: Performance (3/3 plans) — completed 2026-03-11
- [x] Phase 6: Deploy Hardening (1/1 plan) — completed 2026-03-11

</details>

<details>
<summary>✅ v2.0 WorldView Parity (Phases 7-12) — SHIPPED 2026-03-12</summary>

- [x] Phase 7: Visual Engine + Navigation (5/5 plans) — completed 2026-03-12
- [x] Phase 8: New Data Pipelines — Military + Maritime (6/6 plans) — completed 2026-03-12
- [x] Phase 9: GPS Jamming + Street Traffic (5/5 plans) — completed 2026-03-12
- [x] Phase 10: Snapshot Infrastructure (3/3 plans) — completed 2026-03-12
- [x] Phase 11: Replay Engine (4/4 plans) — completed 2026-03-12
- [x] Phase 12: OSINT Event Correlation (5/5 plans) — completed 2026-03-12

</details>

<details>
<summary>✅ v3.0 UI Refinement (Phases 13-16) — SHIPPED 2026-03-13</summary>

- [x] Phase 13: Collapsible Sidebar Layout (3/3 plans) — completed 2026-03-13
- [x] Phase 14: Entity Icons and Altitude Scaling (4/4 plans) — completed 2026-03-12
- [x] Phase 15: Camera Navigation Controls (3/3 plans) — completed 2026-03-13
- [x] Phase 16: Persistent Settings Panel (3/3 plans) — completed 2026-03-13

</details>

<details>
<summary>✅ v4.0 Data Reliability & Freshness (Phases 17-22) — SHIPPED 2026-03-13</summary>

- [x] Phase 17: Schema Migration (1/1 plans) — completed 2026-03-13
- [x] Phase 18: Shared Freshness Helper (1/1 plans) — completed 2026-03-13
- [x] Phase 19: Aircraft Ingest + Route (2/2 plans) — completed 2026-03-13
- [x] Phase 20: Military, Ships, and Jamming Ingest (3/3 plans) — completed 2026-03-13
- [x] Phase 21: API Route Filtering (3/3 plans) — completed 2026-03-13
- [x] Phase 22: Tests (3/3 plans) — completed 2026-03-13

</details>

### 🚧 v5.0 Playback (In Progress)

**Milestone Goal:** Audit and fix the 4D replay engine so all layers behave correctly — satellites use `replayTs`, nothing moves when paused, and end-to-end playback is verified reliable.

- [x] **Phase 23: Store Foundation + Viewer Clock** — Promote `isPlaying` to `useAppStore`, create `useViewerClock` hook, wire HUD and play button loading state (completed 2026-03-13)
- [x] **Phase 24: Satellite Propagation Fix** — Satellites propagate at `replayTs` in playback; propagation loop skips dispatch when paused (completed 2026-03-13)
- [x] **Phase 25: Layer Audit** — Aircraft, ships, military, GPS jamming, and street traffic all gated on `replayMode`; return-to-live triggers cache invalidation (completed 2026-03-13)
- [ ] **Phase 26: End-to-End Verification + Stale Indicators** — Full scrub test across 2-hour window, FPS gate, frontend stale entity visual degradation

## Phase Details

### Phase 23: Store Foundation + Viewer Clock
**Goal**: `isPlaying` is the global source of truth in `useAppStore`, the CesiumJS globe day/night shading tracks `replayTs`, and the HUD and play button correctly reflect playback state — unblocking all layer guards in subsequent phases
**Depends on**: Phase 22 (v4.0 complete)
**Requirements**: PLAY-01, PLAY-03, VIS-02, VIS-03
**Success Criteria** (what must be TRUE):
  1. Scrubbing to a nighttime historical timestamp causes the globe lighting to visibly go dark within one render frame
  2. CinematicHUD displays `REPLAY [ISO timestamp]` instead of `REC` while in playback mode
  3. Play button shows "Loading snapshots..." and is non-interactive while snapshot fetch is in progress; becomes active when data is ready
  4. `isPlaying` removed from `PlaybackBar` local state — toggling play/pause in one component is reflected everywhere that reads the store
**Plans**: 4 plans

Plans:
- [ ] 23-01-PLAN.md — Wave 0 test scaffolding: isPlaying slice tests, useViewerClock.test.ts, CinematicHUD.test.tsx, PlaybackBar mock updates
- [ ] 23-02-PLAN.md — Promote isPlaying to useAppStore; migrate PlaybackBar from useState to store selector
- [ ] 23-03-PLAN.md — Create useViewerClock hook; wire in App.tsx
- [ ] 23-04-PLAN.md — CinematicHUD conditional REC/REPLAY render; PlaybackBar snapshot loading gate

### Phase 24: Satellite Propagation Fix
**Goal**: Satellites render at their historical orbital positions during playback and freeze completely when paused — the most visually prominent layer no longer contradicts the replay timestamp
**Depends on**: Phase 23
**Requirements**: PLAY-02
**Success Criteria** (what must be TRUE):
  1. Scrubbing to a timestamp 6 hours ago places satellites at positions consistent with that historical time, visibly different from their current real-world positions
  2. Pressing pause during playback causes all satellite positions to freeze instantly with no further movement
  3. Orbit ring overlay and click-to-fly destination for a selected satellite match the replay timestamp, not wall-clock time
**Plans**: 2 plans

Plans:
- [ ] 24-01-PLAN.md — TDD: resolveTimestamp pure function + PLAY-02 test coverage (propagation.test.ts extension)
- [ ] 24-02-PLAN.md — Apply three-file surgery: SatelliteLayer loop + COMPUTE_ORBIT, worker handler timestamps, SearchBar GET_POSITION

### Phase 25: Layer Audit
**Goal**: Every remaining layer — aircraft, ships, military, GPS jamming, and street traffic — is inert in playback mode; snapshot interpolation has exclusive position ownership; returning to LIVE delivers fresh data immediately
**Depends on**: Phase 24
**Requirements**: PLAY-04, LAYR-01, LAYR-02, LAYR-03, LAYR-04
**Success Criteria** (what must be TRUE):
  1. Aircraft billboard positions do not flicker or revert to live coordinates while the scrubber is moving; snapshot interpolation is the sole writer of `bb.position` during playback
  2. Ships and military entities hold their snapshot positions even when the browser tab regains focus (no background React Query refetch override)
  3. GPS jamming layer shows an amber "LIVE DATA" badge while playback is active, and its underlying data does not refresh on the daily poll interval during playback
  4. Street traffic particles are hidden during playback and reappear immediately on return to LIVE
  5. Switching from PLAYBACK back to LIVE shows current-time entity positions within 5 seconds (no 90-second stale data window)
**Plans**: 4 plans

Plans:
- [ ] 25-01-PLAN.md — Wave 0: extract queryClient.ts module + write failing tests for all LAYR-01..04 and PLAY-04 behaviors
- [ ] 25-02-PLAN.md — LAYR-01 aircraft lerp guard + LAYR-02 ships/military Effect 2 guards
- [ ] 25-03-PLAN.md — LAYR-03: useGpsJamming refetchInterval freeze + amber badge in GpsJammingLayer
- [ ] 25-04-PLAN.md — LAYR-04: street traffic playback hide + PLAY-04: invalidateQueries on return to LIVE

### Phase 26: End-to-End Verification + Stale Indicators
**Goal**: The complete replay experience is verified correct across a real 2-hour data window at all speed presets, FPS stays above 30 at high speed with all layers active, and live-mode entities with stale backend data are visually distinct
**Depends on**: Phase 25
**Requirements**: VIS-01, VRFY-01, VRFY-02
**Success Criteria** (what must be TRUE):
  1. A 2-hour replay scrub with aircraft, ships, military, GPS jamming, and satellites all active completes without any layer showing live-data contamination or freezing at wrong positions
  2. Playback auto-stops at the window end boundary and the play button returns to its initial state
  3. Frame rate stays at or above 30 FPS at 15m/s playback speed with aircraft and ships layers visible; if it fails, an optimisation pass is applied and the gate is re-run
  4. In LIVE mode, entities whose backend `is_stale=true` are rendered with visible grey tint or reduced opacity, distinguishing them from fresh entities without removing them from the globe
**Plans**: 4 plans

Plans:
- [ ] 26-01-PLAN.md — Wave 0: VIS-01 stale-tint contract tests + VRFY-01 tick boundary contracts
- [ ] 26-02-PLAN.md — VIS-01: extend 3 hook interfaces with is_stale + stale-tint effects in 3 layer components
- [ ] 26-03-PLAN.md — VRFY-01: start app + manual 2h scrub verification checkpoint
- [ ] 26-04-PLAN.md — VRFY-02: FPS gate measurement + conditional interpolation throttle optimisation

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Foundation | v1.0 | 3/3 | Complete | 2026-03-11 |
| 2. Satellite Layer | v1.0 | 4/4 | Complete | 2026-03-11 |
| 3. Aircraft Layer | v1.0 | 3/3 | Complete | 2026-03-11 |
| 4. Controls and Polish | v1.0 | 3/3 | Complete | 2026-03-11 |
| 5. Performance | v1.0 | 3/3 | Complete | 2026-03-11 |
| 6. Deploy Hardening | v1.0 | 1/1 | Complete | 2026-03-11 |
| 7. Visual Engine + Navigation | v2.0 | 5/5 | Complete | 2026-03-12 |
| 8. Military + Maritime Pipelines | v2.0 | 6/6 | Complete | 2026-03-12 |
| 9. GPS Jamming + Street Traffic | v2.0 | 5/5 | Complete | 2026-03-12 |
| 10. Snapshot Infrastructure | v2.0 | 3/3 | Complete | 2026-03-12 |
| 11. Replay Engine | v2.0 | 4/4 | Complete | 2026-03-12 |
| 12. OSINT Event Correlation | v2.0 | 5/5 | Complete | 2026-03-12 |
| 13. Collapsible Sidebar Layout | v3.0 | 3/3 | Complete | 2026-03-13 |
| 14. Entity Icons and Altitude Scaling | v3.0 | 4/4 | Complete | 2026-03-12 |
| 15. Camera Navigation Controls | v3.0 | 3/3 | Complete | 2026-03-13 |
| 16. Persistent Settings Panel | v3.0 | 3/3 | Complete | 2026-03-13 |
| 17. Schema Migration | v4.0 | 1/1 | Complete | 2026-03-13 |
| 18. Shared Freshness Helper | v4.0 | 1/1 | Complete | 2026-03-13 |
| 19. Aircraft Ingest + Route | v4.0 | 2/2 | Complete | 2026-03-13 |
| 20. Military, Ships, and Jamming Ingest | v4.0 | 3/3 | Complete | 2026-03-13 |
| 21. API Route Filtering | v4.0 | 3/3 | Complete | 2026-03-13 |
| 22. Tests | v4.0 | 3/3 | Complete | 2026-03-13 |
| 23. Store Foundation + Viewer Clock | v5.0 | 4/4 | Complete | 2026-03-13 |
| 24. Satellite Propagation Fix | v5.0 | 2/2 | Complete | 2026-03-13 |
| 25. Layer Audit | 4/4 | Complete    | 2026-03-13 | - |
| 26. End-to-End Verification + Stale Indicators | v5.0 | 0/? | Not started | - |
