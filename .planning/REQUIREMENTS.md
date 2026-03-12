# Requirements: OpenSignal Globe

**Defined:** 2026-03-12
**Milestone:** v3.0 UI Refinement
**Core Value:** A unified, visually impressive intelligence picture — satellites orbiting, aircraft moving, anomalies surfacing — all rendered on one polished 3D globe that feels operational and modern.

## v3.0 Requirements

### LAYOUT — Panel Organization

- [ ] **LAYOUT-01**: User can collapse and expand each sidebar section independently with smooth animation
- [ ] **LAYOUT-02**: Visual preset sliders and aircraft filter panels no longer visually overlap
- [ ] **LAYOUT-03**: Sidebar content is grouped into named sections (LAYERS / FILTERS / NAVIGATION / PRESETS) with clear visual hierarchy

### ICONS — Entity Icons

- [ ] **ICONS-01**: Commercial aircraft displayed as airplane-shaped SVG billboard icons on the globe
- [ ] **ICONS-02**: Military flights displayed as a distinct military aircraft SVG billboard icon
- [ ] **ICONS-03**: Ships displayed as vessel-shaped SVG billboard icons
- [ ] **ICONS-04**: Satellites displayed as improved orbital-cross markers (PointPrimitive — billboard not used at 5,000+ entity count due to GPU texture limit)
- [ ] **ICONS-05**: Aircraft, military, and ship icons scale proportionally with camera altitude

### NAV — Navigation Controls

- [ ] **NAV-01**: Double-clicking the globe zooms the camera smoothly toward the clicked point
- [ ] **NAV-02**: Tilt/pitch control widget visible on globe with Top-down / 45° Oblique / Horizon presets
- [ ] **NAV-03**: On-screen +/− zoom buttons as alternative to scroll wheel

### CONFIG — Default Settings Panel

- [ ] **CONFIG-01**: Hidden settings panel accessible via keyboard shortcut or icon (not cluttering main view)
- [ ] **CONFIG-02**: User can configure which layers are enabled on initial load
- [ ] **CONFIG-03**: User can set the default visual preset (Normal, NVG, CRT, FLIR, Noir)
- [ ] **CONFIG-04**: User can set the default camera starting position, zoom level, and tilt
- [ ] **CONFIG-05**: User can set whether the app starts in LIVE or PLAYBACK mode
- [ ] **CONFIG-06**: All settings persist in localStorage and apply on next load

## Future Requirements (v3.1)

### Data Layers

- **LAY-05**: Earthquake layer — USGS 24h GeoJSON feed, magnitude-scaled markers
- **LAY-06**: Weather radar overlay — NOAA NEXRAD WMS tiles on globe

## Out of Scope

| Feature | Reason |
|---------|--------|
| Satellite billboard icons | GPU TextureAtlas limit — 5,000+ entities requires PointPrimitive; visual improvement via marker shape instead |
| Radar sweep animation on globe | Cosmetic only, deferred — focus on functional improvements first |
| Angular bracket panel borders | Deferred — user chose to skip styling changes for this milestone |
| framer-motion animation library | Unnecessary overhead — `grid-template-rows` CSS transition achieves same result |
| Full radial/circular layout | Too disruptive to existing panel structure; deferred to future milestone |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| LAYOUT-01 | Phase 13 | Pending |
| LAYOUT-02 | Phase 13 | Pending |
| LAYOUT-03 | Phase 13 | Pending |
| ICONS-01 | Phase 14 | Pending |
| ICONS-02 | Phase 14 | Pending |
| ICONS-03 | Phase 14 | Pending |
| ICONS-04 | Phase 14 | Pending |
| ICONS-05 | Phase 14 | Pending |
| NAV-01 | Phase 15 | Pending |
| NAV-02 | Phase 15 | Pending |
| NAV-03 | Phase 15 | Pending |
| CONFIG-01 | Phase 16 | Pending |
| CONFIG-02 | Phase 16 | Pending |
| CONFIG-03 | Phase 16 | Pending |
| CONFIG-04 | Phase 16 | Pending |
| CONFIG-05 | Phase 16 | Pending |
| CONFIG-06 | Phase 16 | Pending |

**Coverage:**
- v3.0 requirements: 15 total
- Mapped to phases: 15
- Unmapped: 0 ✓

---
*Requirements defined: 2026-03-12*
*Last updated: 2026-03-12 after initial v3.0 definition*
