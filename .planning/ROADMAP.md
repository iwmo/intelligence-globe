# Roadmap: OpenSignal Globe

## Milestones

- ✅ **v1.0 MVP** — Phases 1-6 (shipped 2026-03-11) — [Archive](milestones/v1.0-ROADMAP.md)
- ✅ **v2.0 WorldView Parity** — Phases 7-12 (shipped 2026-03-12) — [Archive](milestones/v2.0-ROADMAP.md)
- 🚧 **v3.0 UI Refinement** — Phases 13-16 (in progress)

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

### 🚧 v3.0 UI Refinement (In Progress)

**Milestone Goal:** Refine the globe UI with collapsible sidebar panels, zoom-scalable entity icons, improved camera navigation controls, and a persistent settings panel.

- [x] **Phase 13: Collapsible Sidebar Layout** — Sidebar restructured into named collapsible sections with smooth animation and no panel overlap (completed 2026-03-13)
- [x] **Phase 14: Entity Icons and Altitude Scaling** — Custom icons for aircraft, military, ships, and improved satellite markers, all scaling with camera altitude (completed 2026-03-12)
- [ ] **Phase 15: Camera Navigation Controls** — Double-click zoom toward cursor, tilt/pitch widget, and on-screen zoom buttons
- [ ] **Phase 16: Persistent Settings Panel** — Hidden settings panel with configurable defaults for layers, preset, camera position, and start mode

## Phase Details

### Phase 13: Collapsible Sidebar Layout
**Goal**: Users can navigate a structured sidebar where each section (LAYERS, FILTERS, SEARCH, VISUAL ENGINE) collapses and expands independently, with no visual overlap between panels
**Depends on**: Phase 12
**Requirements**: LAYOUT-01, LAYOUT-02, LAYOUT-03
**Success Criteria** (what must be TRUE):
  1. User can click a section header to collapse it; clicking again expands it with smooth animation (no jump or reflow)
  2. Each section (LAYERS, FILTERS, SEARCH, VISUAL ENGINE) is labeled and visually distinct from adjacent sections
  3. Visual preset sliders panel and aircraft filter panel no longer overlap each other at any sidebar scroll position
  4. Sidebar section open/closed state is independent — collapsing one section does not affect others
**Plans**: 3 plans

Plans:
- [ ] 13-01-PLAN.md — Add `sidebarSections` Zustand slice and `CollapsibleSection` component (TDD)
- [ ] 13-02-PLAN.md — Restructure `LeftSidebar.tsx` into four named sections; remove floating `PostProcessPanel` from `App.tsx`
- [ ] 13-03-PLAN.md — Start dev server; human verify animation smoothness, section independence, and overlap elimination

### Phase 14: Entity Icons and Altitude Scaling
**Goal**: Users can distinguish entity types at a glance by silhouette — aircraft, military flights, and ships display unique shaped icons on the globe, and all icons remain legible from orbital altitude to street level
**Depends on**: Phase 13
**Requirements**: ICONS-01, ICONS-02, ICONS-03, ICONS-04, ICONS-05
**Success Criteria** (what must be TRUE):
  1. Commercial aircraft appear as airplane silhouette icons (not dots) on the globe
  2. Military flights appear as a distinct military aircraft shape, visually different from commercial aircraft
  3. Ships appear as vessel hull silhouette icons (not dots) on the globe
  4. Satellites appear as improved orbital-cross markers (PointPrimitive, not billboard) — icons do not degrade to generic dots at any zoom level
  5. Aircraft, military, and ship icons grow larger as the camera zooms in and shrink as it zooms out, remaining legible from 20,000 km to 500 m altitude
**Plans**: 4 plans

Plans:
- [ ] 14-01-PLAN.md — Pre-render module-scope SVG canvas icons (AIRCRAFT_ICON, MILITARY_ICON, SHIP_ICON) in the three billboard layer files
- [ ] 14-02-PLAN.md — Migrate `ShipLayer.tsx` and `MilitaryAircraftLayer.tsx` to `BillboardCollection` with `scaleByDistance` NearFarScalar; remove old PointPrimitiveCollection atomically
- [ ] 14-03-PLAN.md — Migrate `AircraftLayer.tsx` to `BillboardCollection`; update rAF lerp loop to write billboard positions; preserve unified LEFT_CLICK dispatcher
- [ ] 14-04-PLAN.md — Add `scaleByDistance` NearFarScalar to `SatelliteLayer.tsx` PointPrimitive entries; human verify zoom legibility from 20,000 km to 500 m

### Phase 15: Camera Navigation Controls
**Goal**: Users can navigate the globe using double-click zoom toward the cursor, on-screen zoom buttons, and a tilt/pitch widget — covering both scroll-wheel-absent input and deliberate camera orientation control
**Depends on**: Phase 13
**Requirements**: NAV-01, NAV-02, NAV-03
**Success Criteria** (what must be TRUE):
  1. Double-clicking anywhere on the globe zooms the camera smoothly toward the clicked point (not the screen center); double-clicking sky does nothing
  2. Double-clicking does not open an entity detail panel even when an entity is under the cursor
  3. On-screen + and − buttons zoom the camera in and out as an alternative to the scroll wheel
  4. Tilt/pitch widget offers Top-down, 45° Oblique, and Horizon preset buttons that reorient the camera to the corresponding pitch
**Plans**: 3 plans

Plans:
- [ ] 15-01-PLAN.md — Add `zoomStep` and `setPitchPreset` helpers to `viewerRegistry.ts`; build `CameraControlWidget.tsx` with zoom +/− and tilt preset buttons (TDD)
- [ ] 15-02-PLAN.md — Register custom `LEFT_DOUBLE_CLICK` handler in `GlobeView.tsx`; apply 200ms debounce to `LEFT_CLICK` in `AircraftLayer.tsx`; mount widget in `App.tsx`
- [ ] 15-03-PLAN.md — Human browser validation: double-click zoom on terrain/water/sky, entity panel debounce, widget layout

### Phase 16: Persistent Settings Panel
**Goal**: Users can configure the application's startup defaults through a hidden settings panel — which layers load, which visual preset is active, where the camera starts, and whether the app opens in LIVE or PLAYBACK mode — and those settings survive page reload
**Depends on**: Phase 13
**Requirements**: CONFIG-01, CONFIG-02, CONFIG-03, CONFIG-04, CONFIG-05, CONFIG-06
**Success Criteria** (what must be TRUE):
  1. Settings panel is not visible in the main UI by default; it opens via a keyboard shortcut or settings icon and closes the same way
  2. User can toggle which layers are enabled on initial load and those choices take effect on the next page load
  3. User can select a default visual preset (Normal, NVG, CRT, FLIR, Noir) and the globe opens with that preset active on next load
  4. User can set a default camera starting position, zoom level, and tilt — the globe flies to that view on next load instead of the default position
  5. User can choose whether the app starts in LIVE or PLAYBACK mode — that choice is applied immediately on next page load
  6. All settings changes are saved to localStorage automatically; closing and reopening the browser tab restores all configured defaults
**Plans**: TBD

Plans:
- [ ] 16-01: Define settings schema and `useSettingsStore` Zustand slice with localStorage persistence; write unit tests
- [ ] 16-02: Build `SettingsPanel.tsx` UI (layer defaults, visual preset selector, camera defaults, start mode toggle); keyboard shortcut and icon toggle
- [ ] 16-03: Wire settings to application boot sequence — apply layer defaults, preset, camera starting position, and start mode on mount; validate all settings survive hard reload

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
| 13. Collapsible Sidebar Layout | 3/3 | Complete    | 2026-03-13 | — |
| 14. Entity Icons and Altitude Scaling | 4/4 | Complete    | 2026-03-12 | — |
| 15. Camera Navigation Controls | 2/3 | In Progress|  | — |
| 16. Persistent Settings Panel | v3.0 | 0/3 | Not started | — |
