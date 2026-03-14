# Roadmap: OpenSignal Globe

## Milestones

- ✅ **v1.0 MVP** — Phases 1-6 (shipped 2026-03-11) — [Archive](milestones/v1.0-ROADMAP.md)
- ✅ **v2.0 WorldView Parity** — Phases 7-12 (shipped 2026-03-12) — [Archive](milestones/v2.0-ROADMAP.md)
- ✅ **v3.0 UI Refinement** — Phases 13-16 (shipped 2026-03-13) — [Archive](milestones/v3.0-ROADMAP.md)
- ✅ **v4.0 Data Reliability & Freshness** — Phases 17-22 (shipped 2026-03-13) — [Archive](milestones/v4.0-ROADMAP.md)
- ✅ **v5.0 Playback** — Phases 23-26 (shipped 2026-03-14) — [Archive](milestones/v5.0-ROADMAP.md)
- ✅ **v6.0 Production Ready** — Phases 27-32 (shipped 2026-03-14) — [Archive](milestones/v6.0-ROADMAP.md)
- ✅ **v7.0 Viewport Culling** — Phase 33 (shipped 2026-03-14) — [Archive](milestones/v7.0-ROADMAP.md)
- ✅ **v8.0 GDELT Integration** — Phases 34-36 (shipped 2026-03-14) — [Archive](milestones/v8.0-ROADMAP.md)
- 🔄 **v9.0 Entity Labels** — Phase 37 (in progress)

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

<details>
<summary>✅ v5.0 Playback (Phases 23-26) — SHIPPED 2026-03-14</summary>

- [x] Phase 23: Store Foundation + Viewer Clock (4/4 plans) — completed 2026-03-13
- [x] Phase 24: Satellite Propagation Fix (2/2 plans) — completed 2026-03-13
- [x] Phase 25: Layer Audit (4/4 plans) — completed 2026-03-13
- [x] Phase 26: End-to-End Verification + Stale Indicators (4/4 plans) — completed 2026-03-13

</details>

<details>
<summary>✅ v6.0 Production Ready (Phases 27-32) — SHIPPED 2026-03-14</summary>

- [x] Phase 27: Secrets Cleanup (1/1 plan) — completed 2026-03-14
- [x] Phase 28: API Key Auth (1/1 plan) — completed 2026-03-14
- [x] Phase 29: Production Docker Stack (1/1 plan) — completed 2026-03-14
- [x] Phase 30: CI Pipeline (1/1 plan) — completed 2026-03-14
- [x] Phase 31: Documentation (1/1 plan) — completed 2026-03-14
- [x] Phase 32: API Key Wiring (2/2 plans) — completed 2026-03-14

</details>

<details>
<summary>✅ v7.0 Viewport Culling (Phase 33) — SHIPPED 2026-03-14</summary>

- [x] Phase 33: Viewport Culling (4/4 plans) — completed 2026-03-14

</details>

<details>
<summary>✅ v8.0 GDELT Integration (Phases 34-36) — SHIPPED 2026-03-14</summary>

- [x] Phase 34: Backend Foundation (4/4 plans) — completed 2026-03-14
- [x] Phase 35: Frontend Layer (5/5 plans) — completed 2026-03-14
- [x] Phase 36: Replay and Freshness (2/2 plans) — completed 2026-03-14

</details>

### v9.0 Entity Labels

- [ ] **Phase 37: Entity Labels** - Toggle infrastructure + all four layer label implementations

**Plans:** 3 plans

Plans:
- [ ] 37-01-PLAN.md — useSettingsStore showEntityLabels toggle + SettingsPanel checkbox
- [ ] 37-02-PLAN.md — Satellite labels (cyan) + Aircraft labels (orange)
- [ ] 37-03-PLAN.md — Military aircraft labels (red) + Ship labels (green)

## Phase Details

### Phase 37: Entity Labels
**Goal**: Users can see floating text labels above every tracked entity on the globe, with the feature switchable from the settings panel and the preference remembered across sessions
**Depends on**: Phase 16 (Persistent Settings Panel — useSettingsStore), Phase 14 (Entity Icons — BillboardCollections for aircraft/military/ships, PointPrimitiveCollection for satellites)
**Requirements**: LBL-01, LBL-02, LBL-03, LBL-04, LBL-05, LBL-06, LBL-07, LBL-08, LBL-09, LBL-10
**Success Criteria** (what must be TRUE):
  1. User can open the Settings panel, toggle "Entity Labels" on, and immediately see text identifiers appear above every visible satellite, aircraft, military flight, and ship on the globe
  2. User can toggle labels off and all floating text disappears without reloading the page
  3. After enabling labels and refreshing the browser, labels are still enabled when the globe reloads (preference survived localStorage round-trip)
  4. Satellite labels show the object_name in cyan monospace; commercial aircraft labels show callsign (or ICAO24) in orange; military aircraft labels show callsign (or hex) in red; ship labels show vessel_name (or MMSI) in green
  5. Labels remain readable at both close-up zoom and high-altitude global view (scaleByDistance applied)
**Plans**: 3 plans

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
| 25. Layer Audit | v5.0 | 4/4 | Complete | 2026-03-13 |
| 26. End-to-End Verification + Stale Indicators | v5.0 | 4/4 | Complete | 2026-03-13 |
| 27. Secrets Cleanup | v6.0 | 1/1 | Complete | 2026-03-14 |
| 28. API Key Auth | v6.0 | 1/1 | Complete | 2026-03-14 |
| 29. Production Docker Stack | v6.0 | 1/1 | Complete | 2026-03-14 |
| 30. CI Pipeline | v6.0 | 1/1 | Complete | 2026-03-14 |
| 31. Documentation | v6.0 | 1/1 | Complete | 2026-03-14 |
| 32. API Key Wiring | v6.0 | 2/2 | Complete | 2026-03-14 |
| 33. Viewport Culling | v7.0 | 4/4 | Complete | 2026-03-14 |
| 34. Backend Foundation | v8.0 | 4/4 | Complete | 2026-03-14 |
| 35. Frontend Layer | v8.0 | 5/5 | Complete | 2026-03-14 |
| 36. Replay and Freshness | v8.0 | 2/2 | Complete | 2026-03-14 |
| 37. Entity Labels | 1/3 | In Progress|  | - |
