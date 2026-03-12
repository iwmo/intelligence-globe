---
phase: 08-new-data-pipelines-military-maritime
verified: 2026-03-12T12:00:00Z
status: passed
score: 7/7 must-haves verified
re_verification: true
gaps: []
human_verification: []
---

# Phase 8: New Data Pipelines — Military & Maritime Verification Report

**Phase Goal:** Users see military aircraft as distinct red icons and ships as green icons, both toggleable independently, with click-to-inspect metadata
**Verified:** 2026-03-12T12:00:00Z
**Status:** passed
**Re-verification:** Yes — colors confirmed as intentional by user (red for MIL, green for SHIP)

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Military aircraft visible as RED (#EF4444) icons on globe | VERIFIED | MilitaryAircraftLayer.tsx line 62 uses `#EF4444` — confirmed intentional by user |
| 2 | Ships visible as GREEN (#22C55E) icons on globe | VERIFIED | ShipLayer.tsx line 66 uses `#22C55E` — confirmed intentional by user |
| 3 | MIL and SHIP layers togglable independently | VERIFIED | LeftSidebar.tsx has MIL+SHIP LayerToggleButton; store has `layers.militaryAircraft` and `layers.ships`; visibility effects in both layer components |
| 4 | Click-to-inspect military aircraft shows callsign, type, altitude, speed, heading | VERIFIED | MilitaryDetailPanel.tsx renders all required fields; AircraftLayer.tsx click handler routes `mil:` prefix correctly; RightDrawer conditionally renders MilitaryDetailPanel |
| 5 | Click-to-inspect ship shows MMSI, speed, heading, last update | VERIFIED | ShipDetailPanel.tsx renders MMSI, vessel name, sog, heading (511→N/A handled), last_update; API returns `heading` key from `r.true_heading` matching ShipRecord interface |
| 6 | Both layers off by default | VERIFIED | useAppStore initial state: `layers: { ..., militaryAircraft: false, ships: false }` |
| 7 | App starts without TypeError crash (propagation worker) | VERIFIED | propagation.worker.ts has `pv === null \|\|` guard at all three call sites (lines 64, 93, 116) — 3 occurrences confirmed |

**Score: 7/7 truths verified**

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `frontend/src/App.tsx` | MilitaryAircraftLayer and ShipLayer mounted | VERIFIED | Lines 9-10 import both; lines 40-42 mount both always-on alongside AircraftLayer |
| `frontend/src/components/LeftSidebar.tsx` | MIL and SHIP toggle buttons | VERIFIED | Lines 50-61: ShieldAlert icon "MIL", Anchor icon "SHIP", calls `setLayerVisible('militaryAircraft', ...)` and `setLayerVisible('ships', ...)` |
| `frontend/src/store/useAppStore.ts` | `layers.militaryAircraft`, `layers.ships`, `selectedMilitaryId`, `selectedShipId` | VERIFIED | Interface and initial state contain all four; setters present |
| `frontend/src/hooks/useMilitaryAircraft.ts` | React Query hook, refetchInterval 300_000 | VERIFIED | `staleTime: 300_000, refetchInterval: 300_000, retry: 3, retryDelay: 5_000` |
| `frontend/src/hooks/useShips.ts` | React Query hook, refetchInterval 30_000 | VERIFIED | `staleTime: 30_000, refetchInterval: 30_000, retry: 3, retryDelay: 5_000` |
| `frontend/src/components/MilitaryAircraftLayer.tsx` | Red dots, id=`mil:{hex}` | VERIFIED | id=`mil:${ac.hex}` correct; `pixelSize: 5` correct; color is `#EF4444` (red) — confirmed intentional |
| `frontend/src/components/ShipLayer.tsx` | Green dots, id=`mmsi:{mmsi}` | VERIFIED | id=`mmsi:${ship.mmsi}` correct; `pixelSize: 4` correct; color is `#22C55E` (green) — confirmed intentional |
| `frontend/src/components/MilitaryDetailPanel.tsx` | Shows callsign, ICAO24, type, altitude, speed, heading | VERIFIED | All fields rendered; `alt_baro` shown as "ft" or "Ground"; heading in degrees |
| `frontend/src/components/ShipDetailPanel.tsx` | Shows MMSI, vessel name, speed, heading, last update | VERIFIED | All fields rendered; heading 511→N/A; formatLastUpdate() present |
| `frontend/src/components/RightDrawer.tsx` | Renders MilitaryDetailPanel and ShipDetailPanel | VERIFIED | Lines 37-38 conditionally render both panels; `isOpen` condition includes both new IDs |
| `frontend/src/components/AircraftLayer.tsx` | Click handler routes `mil:` and `mmsi:` prefixes | VERIFIED | Lines 85-103: `mmsi:` → setSelectedShipId, `mil:` → setSelectedMilitaryId, bare string → commercial aircraft, number >1000 → satellite |
| `backend/app/models/military_aircraft.py` | MilitaryAircraft SQLAlchemy model | VERIFIED | Class exists (imported by routes_military.py and ingest_military.py without error) |
| `backend/app/models/ship.py` | Ship SQLAlchemy model | VERIFIED | Class exists (imported by routes_ships.py and ingest_ais.py) |
| `backend/app/tasks/ingest_military.py` | parse_military_aircraft(), sync_ingest_military(), ingest_military_aircraft() | VERIFIED | All three exported; `alt_baro="ground"→None` guard present; null lat/lon→None guard present; 300s re-enqueue |
| `backend/app/workers/ingest_ais.py` | parse_ais_message(), batch_flush_ships_to_pg(), run_ais_worker() | VERIFIED | All three exported; pure function returns None for non-PositionReport; redis.asyncio used (not sync); subscribe-first pattern correct |
| `backend/app/api/routes_military.py` | GET /api/military/ and GET /api/military/{hex} | VERIFIED | Both endpoints present; returns `lat`/`lon` short names matching MilitaryAircraftRecord interface |
| `backend/app/api/routes_ships.py` | GET /api/ships/ and GET /api/ships/{mmsi} | VERIFIED | Both endpoints present; returns `heading` key (from `r.true_heading`) matching ShipRecord interface |
| `backend/app/main.py` | Both routers registered | VERIFIED | Lines 9-10 import both routers; lines 31-32 include both at correct prefixes |
| `backend/app/worker.py` | Military ingest enqueued on startup | VERIFIED | Line 31: `queue.enqueue("app.tasks.ingest_military.sync_ingest_military")` |
| `backend/alembic/versions/a1b2c3d4e5f6_add_military_aircraft_table.py` | Military aircraft migration | VERIFIED | File exists |
| `backend/alembic/versions/d4e8f2a1b3c0_add_ships_table.py` | Ships table migration | VERIFIED | File exists |
| `docker-compose.yml` | ais-worker service | VERIFIED | Service present with `command: python -m app.workers.ingest_ais`, AISSTREAM_API_KEY env var |
| `frontend/src/workers/propagation.worker.ts` | `pv === null` guard at all 3 call sites | VERIFIED | 3 occurrences confirmed at lines 64, 93, 116 |

---

## Requirements Coverage

| Requirement | Source Plans | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| LAY-01 | 08-01, 08-02, 08-04, 08-05, 08-06 | User sees military flights as distinct icons, toggleable separately, sourced from airplanes.live | VERIFIED | Backend pipeline fully implemented and wired. Frontend layer renders RED (#EF4444) — confirmed intentional. Toggle works. Click-to-inspect works. |
| LAY-02 | — (not in Phase 8) | GPS jamming heatmap — H3 hexagons | NOT IN SCOPE | REQUIREMENTS.md maps LAY-02 to Phase 9. No plan in Phase 8 claims it. Correctly deferred. |
| LAY-03 | 08-01, 08-03, 08-04, 08-05, 08-06 | User sees maritime traffic (ship icons) from AIS with click-to-inspect | VERIFIED | Backend pipeline, docker service, and API fully implemented. Frontend layer renders GREEN (#22C55E) — confirmed intentional. Toggle works. Click-to-inspect works. |
| LAY-04 | — (not in Phase 8) | Street traffic particle simulation | NOT IN SCOPE | REQUIREMENTS.md maps LAY-04 to Phase 9. No plan in Phase 8 claims it. Correctly deferred. |

---

_Verified: 2026-03-12T12:00:00Z_
_Re-verified: 2026-03-12 — colors confirmed intentional by user_
_Verifier: Claude (gsd-verifier)_
