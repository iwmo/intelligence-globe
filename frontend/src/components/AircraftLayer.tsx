import { useEffect, useRef } from 'react';
import {
  Viewer,
  PointPrimitiveCollection,
  PolylineCollection,
  ScreenSpaceEventHandler,
  ScreenSpaceEventType,
  Cartesian3,
  Cartesian2,
  ArcType,
  BlendOption,
  Color,
  Material,
} from 'cesium';
import { useAircraft } from '../hooks/useAircraft';
import { useAppStore } from '../store/useAppStore';

const POLL_INTERVAL_MS = 90_000;

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
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const pointsByIcao24 = new Map<string, any>(); // PointPrimitive reference
let lastUpdateTime = Date.now();

export function AircraftLayer({ viewer }: { viewer: Viewer | null }) {
  const aircraft = useAircraft();
  const collectionRef = useRef<PointPrimitiveCollection | null>(null);
  const trailCollectionRef = useRef<PolylineCollection | null>(null);
  const handlerRef = useRef<ScreenSpaceEventHandler | null>(null);
  const rafRef = useRef<number>(0);
  const rafRunningRef = useRef<boolean>(false);

  const selectedAircraftId = useAppStore(s => s.selectedAircraftId);

  // Effect 1: Initialize PointPrimitiveCollection and manage aircraft points + lerp loop
  useEffect(() => {
    if (!viewer || viewer.isDestroyed()) return;

    // Create collection once per viewer mount
    if (!collectionRef.current || collectionRef.current.isDestroyed()) {
      collectionRef.current = viewer.scene.primitives.add(new PointPrimitiveCollection({ blendOption: BlendOption.OPAQUE }));
    }

    // Set up unified click handler (once per viewer).
    // Both satellite and aircraft clicks are dispatched here to avoid the
    // dual-handler race condition where two ScreenSpaceEventHandlers call
    // scene.pick() independently on the same LEFT_CLICK event.
    if (!handlerRef.current) {
      const handler = new ScreenSpaceEventHandler(viewer.scene.canvas);
      handlerRef.current = handler;
      handler.setInputAction((click: { position: Cartesian2 }) => {
        const picked = viewer.scene.pick(click.position);
        if (!picked) return;
        if (typeof picked.id === 'string') {
          // Aircraft: ICAO24 is a hex string (e.g. "3c6581")
          useAppStore.getState().setSelectedAircraftId(picked.id);
          useAppStore.getState().setSelectedSatelliteId(null);
        } else if (typeof picked.id === 'number' && picked.id > 1000) {
          // Satellite: NORAD catalog ID is a number > 1000
          useAppStore.getState().setSelectedSatelliteId(picked.id);
          useAppStore.getState().setSelectedAircraftId(null);
        } else {
          // Clicked globe background or unrecognised primitive — clear both
          useAppStore.getState().setSelectedSatelliteId(null);
          useAppStore.getState().setSelectedAircraftId(null);
        }
      }, ScreenSpaceEventType.LEFT_CLICK);
    }

    return () => {
      cancelAnimationFrame(rafRef.current);
      rafRunningRef.current = false;
      if (handlerRef.current) {
        handlerRef.current.destroy();
        handlerRef.current = null;
      }
      const col = collectionRef.current;
      if (col && !col.isDestroyed()) {
        viewer.scene.primitives.remove(col);
      }
      collectionRef.current = null;
      const trail = trailCollectionRef.current;
      if (trail && !trail.isDestroyed()) {
        viewer.scene.primitives.remove(trail);
      }
      trailCollectionRef.current = null;
      // Clear module-scope maps on unmount
      prevPositions.clear();
      currPositions.clear();
      pointsByIcao24.clear();
    };
  }, [viewer]);

  // Effect 2: Update lerp maps and point collection when new aircraft data arrives
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

      // Add new point primitive if not yet in collection
      if (!pointsByIcao24.has(ac.icao24)) {
        const point = collection.add({
          position: nextPos,
          pixelSize: 4,
          color: Color.fromCssColorString('#FF8C00'),
          id: ac.icao24,
        });
        pointsByIcao24.set(ac.icao24, point);
      }
    }

    lastUpdateTime = Date.now();

    // Start rAF lerp loop if not already running
    if (!rafRunningRef.current) {
      rafRunningRef.current = true;

      function lerp() {
        if (!rafRunningRef.current) return;
        const alpha = Math.min((Date.now() - lastUpdateTime) / POLL_INTERVAL_MS, 1.0);
        for (const [icao24, point] of pointsByIcao24) {
          const prev = prevPositions.get(icao24);
          const curr = currPositions.get(icao24);
          if (prev && curr && point && !collection.isDestroyed()) {
            point.position = Cartesian3.lerp(prev, curr, alpha, new Cartesian3());
          }
        }
        rafRef.current = requestAnimationFrame(lerp);
      }

      rafRef.current = requestAnimationFrame(lerp);
    }
  }, [viewer, aircraft.data]);

  // Combined filter + visibility effect (replaces Plan 02 visibility-only effect)
  // Single effect setting point.show — avoids conflict between two effects both writing show
  const aircraftFilter = useAppStore(s => s.aircraftFilter);
  const layerVisible = useAppStore(s => s.layers.aircraft);
  useEffect(() => {
    for (const [icao24, point] of pointsByIcao24) {
      const ac = aircraft.data?.find(a => a.icao24 === icao24);
      if (!ac) continue;
      point.show = layerVisible && matchesAircraftFilter(ac, aircraftFilter);
    }
  }, [aircraftFilter, aircraft.data, layerVisible]);

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

  return null;
}
