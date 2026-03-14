# Requirements: OpenSignal Globe

**Defined:** 2026-03-15
**Core Value:** A unified, visually impressive intelligence picture — satellites orbiting, aircraft moving, anomalies surfacing — all rendered on one polished 3D globe that feels operational and modern.

## v9.0 Requirements

Requirements for v9.0 Entity Labels milestone.

### Toggle Infrastructure

- [x] **LBL-01**: User can toggle entity labels on/off via a setting in the Settings panel
- [x] **LBL-02**: Label toggle state persists across browser refresh (localStorage via useSettingsStore)

### Satellite Labels

- [ ] **LBL-03**: When labels enabled, each satellite shows its `object_name` as floating text above its PointPrimitive
- [ ] **LBL-04**: Satellite labels are cyan (#00D4FF) monospace, sized to remain readable at all zoom levels

### Aircraft Labels

- [ ] **LBL-05**: When labels enabled, each commercial aircraft shows its callsign (or ICAO24 if no callsign) above its billboard
- [ ] **LBL-06**: Aircraft labels are orange (#FF8C00) to match the entity icon color

### Military Aircraft Labels

- [x] **LBL-07**: When labels enabled, each military aircraft shows its flight callsign (or hex if none) above its billboard
- [x] **LBL-08**: Military labels are red (#EF4444) to match the entity icon color

### Ship Labels

- [x] **LBL-09**: When labels enabled, each ship shows its vessel_name (or MMSI if none) above its billboard
- [x] **LBL-10**: Ship labels are green (#22C55E) to match the entity icon color

## Future Requirements

### Hover Tooltips

- **TLTP-01**: Hover over any entity to see a card with type-specific stats (altitude, speed, NORAD ID)

### Label Density Controls

- **LBL-F01**: Labels hide below a configurable camera altitude threshold
- **LBL-F02**: Label opacity fades with distance from camera

## Out of Scope

| Feature | Reason |
|---------|--------|
| Hover tooltip card | Deferred — always-on labels are the v9.0 scope |
| Label click-to-inspect | Already handled by existing click handlers |
| GDELT event labels | Point markers too dense; detail accessed via panel |
| Label clustering | Not needed — show all always per user preference |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| LBL-01 | Phase 37 | Complete |
| LBL-02 | Phase 37 | Complete |
| LBL-03 | Phase 37 | Pending |
| LBL-04 | Phase 37 | Pending |
| LBL-05 | Phase 37 | Pending |
| LBL-06 | Phase 37 | Pending |
| LBL-07 | Phase 37 | Complete |
| LBL-08 | Phase 37 | Complete |
| LBL-09 | Phase 37 | Complete |
| LBL-10 | Phase 37 | Complete |

**Coverage:**
- v9.0 requirements: 10 total
- Mapped to phases: 10
- Unmapped: 0 ✓

---
*Requirements defined: 2026-03-15*
*Last updated: 2026-03-15 after roadmap creation*
