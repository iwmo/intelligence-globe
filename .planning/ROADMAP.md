# Roadmap: OpenSignal Globe

## Milestones

- ✅ **v1.0 MVP** — Phases 1-6 (shipped 2026-03-11) — [Archive](milestones/v1.0-ROADMAP.md)
- ✅ **v2.0 WorldView Parity** — Phases 7-12 (shipped 2026-03-12) — [Archive](milestones/v2.0-ROADMAP.md)
- ✅ **v3.0 UI Refinement** — Phases 13-16 (shipped 2026-03-13) — [Archive](milestones/v3.0-ROADMAP.md)
- ✅ **v4.0 Data Reliability & Freshness** — Phases 17-22 (shipped 2026-03-13) — [Archive](milestones/v4.0-ROADMAP.md)
- ✅ **v5.0 Playback** — Phases 23-26 (shipped 2026-03-14) — [Archive](milestones/v5.0-ROADMAP.md)
- ✅ **v6.0 Production Ready** — Phases 27-32 (shipped 2026-03-14) — [Archive](milestones/v6.0-ROADMAP.md)
- ✅ **v7.0 Viewport Culling** — Phase 33 (shipped 2026-03-14) — [Archive](milestones/v7.0-ROADMAP.md)
- 🔄 **v8.0 GDELT Integration** — Phases 34-36 (in progress)

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

<details open>
<summary>🔄 v8.0 GDELT Integration (Phases 34-36) — IN PROGRESS</summary>

- [x] **Phase 34: Backend Foundation** - 4 plans (completed 2026-03-14)
  - [x] 34-01-PLAN.md — Alembic migration, GdeltEvent ORM model, test scaffold (Wave 1)
  - [x] 34-02-PLAN.md — RQ ingest worker with 3-layer dedup and 7-day cleanup (Wave 2)
  - [x] 34-03-PLAN.md — GET /api/gdelt-events route with bbox + time-range filtering (Wave 2)
  - [x] 34-04-PLAN.md — Worker registration, full test suite, human verification (Wave 3)
- [ ] **Phase 35: Frontend Layer** - Globe markers, layer toggle, filter chips, inspect panel, OSINT bridge
- [ ] **Phase 36: Replay and Freshness** - Replay load-once, PlaybackBar dots, stale indicator

</details>

## Phase Details

### Phase 34: Backend Foundation
**Goal**: GDELT geopolitical events flow into PostgreSQL every 15 minutes and are queryable via a bbox-filtered API endpoint
**Depends on**: Phase 33 (Viewport Culling) — bbox pattern reused in route
**Requirements**: GDELT-01, GDELT-02, GDELT-03, GDELT-04
**Success Criteria** (what must be TRUE):
  1. `gdelt_events` table exists with UNIQUE `global_event_id`, `occurred_at` (from SQLDATE), `discovered_at` (from DATEADDED), lat/lon floats, `quad_class`, `goldstein_scale`, `event_code` as VARCHAR(4), `actor1_name`, `actor2_name`, `source_url`, `avg_tone`, `num_mentions`, `source_is_stale` — schema correct from day one with no post-deploy changes needed
  2. RQ worker polls `lastupdate.txt` every 15 minutes, downloads the bulk CSV ZIP in-memory, applies conflict-relevant QuadClass filter at ingest time, and `ON CONFLICT DO NOTHING` on `global_event_id` — running two overlapping ingest cycles produces zero duplicate rows
  3. `GET /api/gdelt-events` returns events filtered by `min_lat`/`max_lat`/`min_lon`/`max_lon` bbox, optional `quad_class`, and `since`/`until` time-range params; response includes `source_is_stale` field
  4. 7-day rolling cleanup runs as part of the ingest worker; `SELECT COUNT(*)` on `gdelt_events` stays below 150k rows after one week of ingestion
**Plans**: 4 plans

Plans:
- [x] 34-01-PLAN.md — Alembic migration, GdeltEvent ORM model, test scaffold
- [x] 34-02-PLAN.md — RQ ingest worker with 3-layer dedup and 7-day cleanup
- [x] 34-03-PLAN.md — GET /api/gdelt-events route with bbox + time-range filtering
- [x] 34-04-PLAN.md — Worker registration, full test suite, human verification

### Phase 35: Frontend Layer
**Goal**: GDELT events are visible on the globe as clustered, colour-coded markers that users can toggle, filter by QuadClass, and click to inspect with an OSINT bridge
**Depends on**: Phase 34 — API must be serving real data before rendering is meaningful
**Requirements**: GDELT-05, GDELT-06, GDELT-07, GDELT-08, GDELT-09
**Success Criteria** (what must be TRUE):
  1. GDELT event markers appear on the globe as `PointGraphics` within a `CustomDataSource` + `EntityCluster`; blue/green/yellow/red colour coding reflects QuadClass; markers cluster at global zoom and expand at regional zoom without GPU exhaustion
  2. A layer toggle in the sidebar hides and shows all GDELT markers; the hook suppresses bbox params and stops the 15-minute refetch interval when in replay mode (VPC-08 pattern)
  3. Four QuadClass filter chips (Verbal Cooperation / Material Cooperation / Verbal Conflict / Material Conflict) filter visible markers in real time without a page reload; chip state persists across layer toggle
  4. Clicking a GDELT marker opens a `GdeltDetailPanel` (DraggablePanel) showing source URL, actor names, GoldsteinScale score, avg tone, and an automated-extraction disclaimer; panel is draggable and collapsible
  5. The `GdeltDetailPanel` "Log as OSINT Event" button pre-populates `OsintEventPanel` with the event's lat/lon, `occurred_at` timestamp, and source URL; no manual re-entry required
**Plans**: TBD

### Phase 36: Replay and Freshness
**Goal**: GDELT events are correctly integrated into the 4D replay timeline — accumulating at their SQLDATE position as the scrubber advances — and the layer card honestly reports data freshness
**Depends on**: Phase 35 — layer must be functional before replay wiring is meaningful
**Requirements**: GDELT-10, GDELT-11, GDELT-12
**Success Criteria** (what must be TRUE):
  1. In replay mode, `useGdeltEvents` fires exactly one API request per session using a `since`/`until` window covering the replay range; browser DevTools Network tab shows zero additional GDELT requests as the scrubber advances at any speed
  2. GDELT events accumulate on the globe as the scrubber advances, appearing at their `occurred_at` (SQLDATE) position — events future to the current scrubber position are invisible; past events remain visible; no flicker on scrub
  3. Coloured dots representing GDELT events appear on the PlaybackBar timeline track at their `occurred_at` positions, using the same QuadClass colour scheme as the globe markers
  4. The GDELT layer card displays a `source_is_stale` freshness indicator when the last ingest cycle is stale, using the same visual treatment as the GPS jamming layer card
**Plans**: TBD

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
| 35. Frontend Layer | v8.0 | 0/TBD | Not started | - |
| 36. Replay and Freshness | v8.0 | 0/TBD | Not started | - |
