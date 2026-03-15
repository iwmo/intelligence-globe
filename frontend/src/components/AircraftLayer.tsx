import { useEffect, useRef } from 'react';
import {
  Viewer,
  BillboardCollection,
  LabelCollection,
  LabelStyle,
  VerticalOrigin,
  HorizontalOrigin,
  PolylineCollection,
  ScreenSpaceEventHandler,
  ScreenSpaceEventType,
  Cartesian3,
  Cartesian2,
  ArcType,
  BlendOption,
  Color,
  Material,
  NearFarScalar,
  Math as CesiumMath,
} from 'cesium';
import { useAircraft } from '../hooks/useAircraft';
import { useAppStore } from '../store/useAppStore';
import { useSettingsStore } from '../store/useSettingsStore';
import { useReplaySnapshots, findAdjacentSnapshots } from '../hooks/useReplaySnapshots';

const POLL_INTERVAL_MS = 90_000;

// ---------------------------------------------------------------------------
// SVG-derived canvas icon — pre-rendered once at module scope.
// One canvas object per entity type. CesiumJS TextureAtlas deduplicates
// when the same canvas reference is passed to every billboard.add({ image }).
// NEVER create a canvas per entity — exhausts GPU TextureAtlas at 500+ entities.
// ---------------------------------------------------------------------------
function drawAircraftIcon(): HTMLCanvasElement {
  const SIZE = 32;
  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#FF8C00'; // aircraft orange — matches existing point color
  // Airplane silhouette: nose up, swept wings mid-body, twin tail fins
  ctx.beginPath();
  ctx.moveTo(SIZE / 2, 2);               // nose tip
  ctx.lineTo(SIZE * 0.85, SIZE * 0.65);  // starboard wingtip
  ctx.lineTo(SIZE / 2, SIZE * 0.55);     // fuselage-wing junction (starboard)
  ctx.lineTo(SIZE / 2 + 4, SIZE - 4);   // starboard tail fin
  ctx.lineTo(SIZE / 2, SIZE - 8);        // tail center
  ctx.lineTo(SIZE / 2 - 4, SIZE - 4);   // port tail fin
  ctx.lineTo(SIZE / 2, SIZE * 0.55);    // fuselage-wing junction (port)
  ctx.lineTo(SIZE * 0.15, SIZE * 0.65); // port wingtip
  ctx.closePath();
  ctx.fill();
  return canvas;
}
export const AIRCRAFT_ICON = drawAircraftIcon();

// ---------------------------------------------------------------------------
// Pure filter helper — module-level, no React deps
// ---------------------------------------------------------------------------

function matchesAircraftFilter(
  ac: { baro_altitude: number | null; latitude: number | null; longitude: number | null },
  filter: {
    altitudeRange: [number, number] | null;
    boundingBox: { minLat: number; maxLat: number; minLon: number; maxLon: number } | null;
  }
): boolean {
  if (filter.altitudeRange) {
    const alt = ac.baro_altitude ?? 0;
    if (alt < filter.altitudeRange[0] || alt > filter.altitudeRange[1]) return false;
  }

  if (filter.boundingBox && ac.latitude != null && ac.longitude != null) {
    const { minLat, maxLat, minLon, maxLon } = filter.boundingBox;
    if (
      ac.latitude < minLat || ac.latitude > maxLat ||
      ac.longitude < minLon || ac.longitude > maxLon
    ) return false;
  }

  return true;
}

// Module-scope maps — survive re-renders, reset on full unmount
const prevPositions = new Map<string, Cartesian3>();
const currPositions = new Map<string, Cartesian3>();
// NAV-01: debounce timer for LEFT_CLICK — prevents entity panel opening on
// first click of a double-click zoom gesture (CesiumJS issue #1171)
let clickTimer: ReturnType<typeof setTimeout> | null = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const billboardsByIcao24 = new Map<string, any>(); // Billboard reference
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const labelsByIcao24 = new Map<string, any>(); // Label reference — mirrors billboardsByIcao24
let lastUpdateTime = Date.now();
const scratchLerp = new Cartesian3(); // reused every frame — zero GC pressure

export function AircraftLayer({ viewer }: { viewer: Viewer | null }) {
  const aircraft = useAircraft();
  const collectionRef = useRef<BillboardCollection | null>(null);
  const labelCollectionRef = useRef<LabelCollection | null>(null);
  const trailCollectionRef = useRef<PolylineCollection | null>(null);
  const handlerRef = useRef<ScreenSpaceEventHandler | null>(null);
  const rafRef = useRef<number>(0);
  const rafRunningRef = useRef<boolean>(false);

  const selectedAircraftId = useAppStore(s => s.selectedAircraftId);

  // Replay state — read by playback interpolation effect
  const replayMode  = useAppStore(s => s.replayMode);
  const replayTs    = useAppStore(s => s.replayTs);
  const windowStart = useAppStore(s => s.replayWindowStart);
  const windowEnd   = useAppStore(s => s.replayWindowEnd);

  // Fetch snapshots for aircraft layer — only active in playback mode
  const { data: snapshotsByEntity } = useReplaySnapshots(
    'aircraft',
    windowStart,
    windowEnd,
    replayMode === 'playback',
  );

  // Effect 1: Initialize BillboardCollection and manage aircraft billboards + lerp loop
  useEffect(() => {
    if (!viewer || viewer.isDestroyed()) return;

    // Create collection once per viewer mount
    if (!collectionRef.current || collectionRef.current.isDestroyed()) {
      collectionRef.current = viewer.scene.primitives.add(new BillboardCollection({ blendOption: BlendOption.OPAQUE }));
    }

    // Create parallel LabelCollection for entity labels
    if (!labelCollectionRef.current || labelCollectionRef.current.isDestroyed()) {
      labelCollectionRef.current = viewer.scene.primitives.add(new LabelCollection());
    }

    // Set up unified click handler (once per viewer).
    // Both satellite and aircraft clicks are dispatched here to avoid the
    // dual-handler race condition where two ScreenSpaceEventHandlers call
    // scene.pick() independently on the same LEFT_CLICK event.
    if (!handlerRef.current) {
      const handler = new ScreenSpaceEventHandler(viewer.scene.canvas);
      handlerRef.current = handler;
      handler.setInputAction((click: { position: Cartesian2 }) => {
        // NAV-01: 200ms debounce prevents entity panel opening on the first click
        // of a double-click gesture. CesiumJS fires LEFT_CLICK before
        // LEFT_DOUBLE_CLICK (issue #1171 — STATE.md locked decision).
        if (clickTimer !== null) clearTimeout(clickTimer);
        clickTimer = setTimeout(() => {
          clickTimer = null;
          const picked = viewer.scene.pick(click.position);
          if (!picked) return;
          // Normalise the picked ID: BillboardCollection/Primitive puts the raw
          // value on picked.id directly; CustomDataSource Entity puts the string
          // id on picked.id.id (picked.id is the Entity object).
          const rawId = picked.id;
          const resolvedId: string | number | null =
            typeof rawId === 'string' || typeof rawId === 'number'
              ? rawId
              : rawId && typeof rawId === 'object' && typeof rawId.id === 'string'
              ? rawId.id
              : null;
          if (typeof resolvedId === 'string') {
            if (resolvedId.startsWith('gdelt:')) {
              const eventId = resolvedId.slice(6); // string — matches DB String(20) type
              useAppStore.getState().setSelectedGdeltEventId(eventId);
              useAppStore.getState().setSelectedAircraftId(null);
              useAppStore.getState().setSelectedMilitaryId(null);
              useAppStore.getState().setSelectedShipId(null);
              useAppStore.getState().setSelectedSatelliteId(null);
            } else if (resolvedId.startsWith('mmsi:')) {
              const mmsi = resolvedId.slice(5);
              useAppStore.getState().setSelectedShipId(mmsi);
              useAppStore.getState().setSelectedMilitaryId(null);
              useAppStore.getState().setSelectedAircraftId(null);
              useAppStore.getState().setSelectedSatelliteId(null);
            } else if (resolvedId.startsWith('mil:')) {
              const hex = resolvedId.slice(4);
              useAppStore.getState().setSelectedMilitaryId(hex);
              useAppStore.getState().setSelectedShipId(null);
              useAppStore.getState().setSelectedAircraftId(null);
              useAppStore.getState().setSelectedSatelliteId(null);
            } else {
              // Commercial aircraft: bare ICAO24 string (no prefix)
              useAppStore.getState().setSelectedAircraftId(resolvedId);
              useAppStore.getState().setSelectedMilitaryId(null);
              useAppStore.getState().setSelectedShipId(null);
              useAppStore.getState().setSelectedSatelliteId(null);
            }
          } else if (typeof resolvedId === 'number' && resolvedId > 1000) {
            // Satellite: NORAD catalog ID is a number > 1000
            useAppStore.getState().setSelectedSatelliteId(resolvedId);
            useAppStore.getState().setSelectedAircraftId(null);
            useAppStore.getState().setSelectedMilitaryId(null);
            useAppStore.getState().setSelectedShipId(null);
          } else {
            // Clicked globe background or unrecognised primitive — clear all
            useAppStore.getState().setSelectedSatelliteId(null);
            useAppStore.getState().setSelectedAircraftId(null);
            useAppStore.getState().setSelectedMilitaryId(null);
            useAppStore.getState().setSelectedShipId(null);
            useAppStore.getState().setSelectedGdeltEventId(null);
          }
        }, 200);
      }, ScreenSpaceEventType.LEFT_CLICK);
    }

    return () => {
      cancelAnimationFrame(rafRef.current);
      rafRunningRef.current = false;
      if (clickTimer !== null) { clearTimeout(clickTimer); clickTimer = null; }
      if (handlerRef.current) {
        handlerRef.current.destroy();
        handlerRef.current = null;
      }
      const col = collectionRef.current;
      if (col && !col.isDestroyed()) {
        viewer.scene.primitives.remove(col);
      }
      collectionRef.current = null;
      const lc = labelCollectionRef.current;
      if (lc && !lc.isDestroyed()) { viewer.scene.primitives.remove(lc); }
      labelCollectionRef.current = null;
      labelsByIcao24.clear();
      const trail = trailCollectionRef.current;
      if (trail && !trail.isDestroyed()) {
        viewer.scene.primitives.remove(trail);
      }
      trailCollectionRef.current = null;
      // Clear module-scope maps on unmount
      prevPositions.clear();
      currPositions.clear();
      billboardsByIcao24.clear();
    };
  }, [viewer]);

  // Effect 2: Update lerp maps and billboard collection when new aircraft data arrives
  useEffect(() => {
    if (!viewer || viewer.isDestroyed() || !aircraft.data || !collectionRef.current) return;

    const collection = collectionRef.current;
    if (collection.isDestroyed()) return;

    for (const ac of aircraft.data) {
      if (
        ac.latitude == null || ac.longitude == null ||
        isNaN(ac.latitude) || isNaN(ac.longitude)
      ) continue;

      const nextPos = Cartesian3.fromDegrees(
        ac.longitude,
        ac.latitude,
        (ac.baro_altitude ?? 0) + 1000,
      );

      // Shift current → previous for lerp; on first appearance, set prev = curr
      const existing = currPositions.get(ac.icao24);
      prevPositions.set(ac.icao24, existing ?? nextPos);
      currPositions.set(ac.icao24, nextPos);

      // Add new billboard if not yet in collection
      if (!billboardsByIcao24.has(ac.icao24)) {
        const bb = collection.add({
          position: nextPos,
          image: AIRCRAFT_ICON,
          width: 24,
          height: 24,
          rotation: CesiumMath.toRadians(-(ac.true_track ?? 0)),
          alignedAxis: Cartesian3.ZERO,
          id: ac.icao24,         // bare icao24 — no prefix — click handler unchanged
          scaleByDistance: new NearFarScalar(1e4, 1.5, 5e6, 0.4),
        });
        billboardsByIcao24.set(ac.icao24, bb);
        // Add parallel label (hidden by default; visibility controlled by showEntityLabels)
        if (!labelsByIcao24.has(ac.icao24) && labelCollectionRef.current && !labelCollectionRef.current.isDestroyed()) {
          const lbl = labelCollectionRef.current.add({
            position: nextPos,
            text: (ac.callsign?.trim() || ac.icao24).toUpperCase(),
            font: '11px monospace',
            fillColor: Color.fromCssColorString('#FF8C00'),
            outlineColor: Color.BLACK,
            outlineWidth: 2,
            style: LabelStyle.FILL_AND_OUTLINE,
            pixelOffset: new Cartesian2(0, -22),
            verticalOrigin: VerticalOrigin.BOTTOM,
            horizontalOrigin: HorizontalOrigin.CENTER,
            scaleByDistance: new NearFarScalar(1e4, 1.4, 2e6, 0.3),
            show: false,
          });
          labelsByIcao24.set(ac.icao24, lbl);
        }
      } else {
        // Update heading for existing aircraft
        const existingBb = billboardsByIcao24.get(ac.icao24);
        if (existingBb) existingBb.rotation = CesiumMath.toRadians(-(ac.true_track ?? 0));
      }
    }

    lastUpdateTime = Date.now();

    // Start rAF lerp loop if not already running
    if (!rafRunningRef.current) {
      rafRunningRef.current = true;

      function lerp() {
        if (!rafRunningRef.current) return;
        // LAYR-01: snapshot interpolation has exclusive bb.position ownership in playback
        if (useAppStore.getState().replayMode === 'playback') {
          rafRef.current = requestAnimationFrame(lerp);
          return;
        }
        const alpha = Math.min((Date.now() - lastUpdateTime) / POLL_INTERVAL_MS, 1.0);
        for (const [icao24, bb] of billboardsByIcao24) {
          const prev = prevPositions.get(icao24);
          const curr = currPositions.get(icao24);
          if (prev && curr && bb && !collection.isDestroyed()) {
            bb.position = Cartesian3.lerp(prev, curr, alpha, scratchLerp);
            // Sync label position alongside billboard
            const lbl = labelsByIcao24.get(icao24);
            if (lbl) lbl.position = Cartesian3.lerp(prev, curr, alpha, scratchLerp);
          }
        }
        rafRef.current = requestAnimationFrame(lerp);
      }

      rafRef.current = requestAnimationFrame(lerp);
    }
  }, [viewer, aircraft.data]);

  // Combined filter + visibility effect (replaces Plan 02 visibility-only effect)
  // Single effect setting bb.show — avoids conflict between two effects both writing show
  const aircraftFilter = useAppStore(s => s.aircraftFilter);
  const layerVisible = useAppStore(s => s.layers.aircraft);
  useEffect(() => {
    const byIcao = new Map(aircraft.data?.map(a => [a.icao24, a]) ?? []);
    for (const [icao24, bb] of billboardsByIcao24) {
      const ac = byIcao.get(icao24);
      if (!ac) continue;
      bb.show = layerVisible && matchesAircraftFilter(ac, aircraftFilter);
    }
  }, [aircraftFilter, aircraft.data, layerVisible]);

  // Label visibility effect: sync LabelCollection show state with showAircraftLabels toggle
  const showEntityLabels = useSettingsStore(s => s.showAircraftLabels);
  useEffect(() => {
    for (const [icao24, lbl] of labelsByIcao24) {
      const bb = billboardsByIcao24.get(icao24);
      lbl.show = showEntityLabels && (bb?.show ?? false);
    }
  }, [showEntityLabels, aircraftFilter, aircraft.data, layerVisible]);

  // Effect 3: Trail-on-selection — show trail polyline for selected aircraft
  useEffect(() => {
    if (!viewer || viewer.isDestroyed()) return;

    // Remove any existing trail
    if (trailCollectionRef.current && !trailCollectionRef.current.isDestroyed()) {
      viewer.scene.primitives.remove(trailCollectionRef.current);
      trailCollectionRef.current = null;
    }

    if (selectedAircraftId && aircraft.data) {
      const selected = aircraft.data.find(ac => ac.icao24 === selectedAircraftId);
      if (selected && selected.trail.length > 1) {
        const polys = viewer.scene.primitives.add(new PolylineCollection());
        trailCollectionRef.current = polys;

        const trailPositions = selected.trail
          .filter(p => p.lon != null && p.lat != null && !isNaN(p.lon) && !isNaN(p.lat))
          .map(p => Cartesian3.fromDegrees(p.lon, p.lat, (p.alt ?? 0) + 1000));

        if (trailPositions.length > 1) {
          polys.add({
            positions: trailPositions,
            width: 1.5,
            material: Material.fromType('Color', {
              color: Color.fromCssColorString('#FF8C00').withAlpha(0.5),
            }),
            arcType: ArcType.NONE,
          });
        }
      }
    }
  }, [selectedAircraftId, viewer, aircraft.data]);

  // Effect: Playback snapshot interpolation
  // Runs only when replayMode === 'playback'. Does NOT modify live lerp logic.
  useEffect(() => {
    if (replayMode !== 'playback') return;
    if (!snapshotsByEntity || snapshotsByEntity.size === 0) return;

    for (const [icao24, bb] of billboardsByIcao24) {
      if (!bb) continue;
      const snapshots = snapshotsByEntity.get(icao24);
      if (!snapshots || snapshots.length === 0) continue;

      const [snapA, snapB] = findAdjacentSnapshots(snapshots, replayTs);
      if (!snapA) continue;

      const alpha = snapA && snapB
        ? Math.min((replayTs - snapA.ts) / (snapB.ts - snapA.ts), 1.0)
        : 1.0;
      const lat = snapA && snapB ? snapA.latitude + alpha * (snapB.latitude - snapA.latitude) : snapA.latitude;
      const lon = snapA && snapB ? snapA.longitude + alpha * (snapB.longitude - snapA.longitude) : snapA.longitude;
      const alt = (snapA.altitude ?? 0) + 1000;

      bb.position = Cartesian3.fromDegrees(lon, lat, alt);
    }
  }, [replayMode, replayTs, snapshotsByEntity]);

  // Effect: Stale billboard tint (VIS-01)
  // LIVE mode only — in playback mode, snapshot data has no is_stale field.
  // Uses Color.GRAY.withAlpha(0.4) for stale entities (returns new Color instance).
  // Uses Color.WHITE.clone() for fresh entities (avoids mutating Color.WHITE singleton).
  useEffect(() => {
    if (replayMode === 'playback') return;
    const byId = new Map(aircraft.data?.map(a => [a.icao24, a]) ?? []);
    for (const [icao24, bb] of billboardsByIcao24) {
      const ac = byId.get(icao24);
      if (!ac || !bb) continue;
      bb.color = ac.is_stale ? Color.GRAY.withAlpha(0.4) : Color.WHITE.clone();
    }
  }, [aircraft.data, replayMode]);

  return null;
}
