import { useEffect, useRef } from 'react';
import {
  Viewer,
  PointPrimitiveCollection,
  PolylineCollection,
  LabelCollection,
  LabelStyle,
  VerticalOrigin,
  HorizontalOrigin,
  Cartesian3,
  ArcType,
  BlendOption,
  Color,
  Material,
  ScreenSpaceEventHandler,
  ScreenSpaceEventType,
  Ellipsoid,
  Math as CesiumMath,
  Cartesian2,
  NearFarScalar,
} from 'cesium';
import { useSatellites } from '../hooks/useSatellites';
import { useAppStore } from '../store/useAppStore';
import { useSettingsStore } from '../store/useSettingsStore';
import { flyToCartesian } from '../lib/viewerRegistry';
import { resolveTimestamp } from '../lib/resolveTimestamp';
import type { OverheadSat } from '../workers/overpassElevation';

// ---------------------------------------------------------------------------
// Pure filter helpers — module-level, no React deps
// ---------------------------------------------------------------------------

function satelliteAltitudeKm(omm: Record<string, unknown>): number {
  const mu = 398600.4418;
  const re = 6371.0;
  const meanMotion = (omm.MEAN_MOTION as number) ?? 14;
  const n = meanMotion * 2 * Math.PI / 86400;
  const a = Math.cbrt(mu / (n * n));
  return a - re;
}

function deriveConstellation(objectName: string): string {
  const upper = (objectName ?? '').toUpperCase();
  if (upper.startsWith('STARLINK')) return 'Starlink';
  if (upper.startsWith('GPS')) return 'GPS';
  if (upper === 'ISS (ZARYA)' || upper === 'ISS') return 'ISS';
  if (upper.startsWith('IRIDIUM')) return 'Iridium';
  if (upper.startsWith('ONEWEB')) return 'OneWeb';
  return 'Other';
}

function matchesSatelliteFilter(
  sat: { norad_cat_id: number; omm: Record<string, unknown> },
  filter: { constellation: string | null; altitudeBand: [number, number] | null }
): boolean {
  const omm = sat.omm as Record<string, unknown>;

  if (filter.constellation) {
    const satConst = (omm.constellation as string | undefined)
      ?? deriveConstellation((omm.OBJECT_NAME as string) ?? '');
    if (satConst !== filter.constellation) return false;
  }

  if (filter.altitudeBand) {
    const altKm = satelliteAltitudeKm(omm);
    if (altKm < filter.altitudeBand[0] || altKm > filter.altitudeBand[1]) return false;
  }

  return true;
}

interface OrbitResultMessage {
  type: 'ORBIT_RESULT';
  orbitPoints: number[][];
  groundPoints: number[][];
}

interface LoadedMessage {
  type: 'LOADED';
  count: number;
}

interface PositionsMessage {
  type: 'POSITIONS';
  buf: Float64Array;
}

interface PositionResultMessage {
  type: 'POSITION_RESULT';
  norad: number;
  position: { x: number; y: number; z: number } | null;
}

interface OverpassResultMessage {
  type: 'OVERPASS_RESULT';
  overhead: OverheadSat[];
  timestamp: number;
}

type WorkerOutMessage = LoadedMessage | PositionsMessage | OrbitResultMessage | PositionResultMessage | OverpassResultMessage;

interface SatelliteLayerProps {
  viewer?: Viewer | null;
  onWorkerReady?: (worker: Worker) => void;
}

export function SatelliteLayer({ viewer = null, onWorkerReady }: SatelliteLayerProps) {
  const satellites = useSatellites();
  const workerRef = useRef<Worker | null>(null);
  const collectionRef = useRef<PointPrimitiveCollection | null>(null);
  const labelCollectionRef = useRef<LabelCollection | null>(null);
  const orbitCollectionRef = useRef<PolylineCollection | null>(null);
  const overpassCollectionRef = useRef<PolylineCollection | null>(null);
  const aoiCollectionRef = useRef<PointPrimitiveCollection | null>(null);
  const indexMapRef = useRef<Map<number, number>>(new Map());
  const rafRef = useRef<number>(0);
  const handlerRef = useRef<ScreenSpaceEventHandler | null>(null);

  // Phase 12: TLE staleness check for warning display
  const tleLastUpdated = useAppStore(s => s.tleLastUpdated);
  const replayMode = useAppStore(s => s.replayMode);
  const replayTs = useAppStore(s => s.replayTs);
  const areaOfInterest = useAppStore(s => s.areaOfInterest);

  const TLE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
  const tleAge = tleLastUpdated ? Date.now() - new Date(tleLastUpdated).getTime() : Infinity;
  const tleStalenessWarning = replayMode === 'playback' && tleAge > TLE_MAX_AGE_MS;

  // Effect 1: Initialize worker and point collection when viewer + data are ready
  useEffect(() => {
    if (!viewer || viewer.isDestroyed() || !satellites.data) return;

    // Create PointPrimitiveCollection once
    const collection = viewer.scene.primitives.add(new PointPrimitiveCollection({ blendOption: BlendOption.OPAQUE }));
    collectionRef.current = collection;

    // Create parallel LabelCollection for entity labels
    const labelColl = viewer.scene.primitives.add(new LabelCollection());
    labelCollectionRef.current = labelColl;

    // Spawn worker
    const worker = new Worker(
      new URL('../workers/propagation.worker.ts', import.meta.url),
      { type: 'module' }
    );
    workerRef.current = worker;
    if (onWorkerReady) onWorkerReady(worker);

    // Capture satellites.data in closure so the onmessage handler has stable reference
    const satData = satellites.data;

    worker.onmessage = (e: MessageEvent<WorkerOutMessage>) => {
      const msg = e.data;

      if (msg.type === 'LOADED') {
        const count: number = msg.count;
        const map = indexMapRef.current;
        for (let i = 0; i < satData.length && i < count; i++) {
          const pt = collection.add({
            position: Cartesian3.ZERO,
            pixelSize: 3,
            color: Color.fromCssColorString('#00D4FF'),
            id: satData[i].norad_cat_id,  // scene.pick() returns this as picked.id
          });
          pt.scaleByDistance = new NearFarScalar(5e5, 1.5, 5e7, 0.3);
          map.set(satData[i].norad_cat_id, i);
          // Add parallel label (hidden by default; visibility controlled by showEntityLabels)
          labelColl.add({
            position: Cartesian3.ZERO,
            text: (satData[i].omm['OBJECT_NAME'] as string) ?? String(satData[i].norad_cat_id),
            font: '11px monospace',
            fillColor: Color.fromCssColorString('#00D4FF'),
            outlineColor: Color.BLACK,
            outlineWidth: 2,
            style: LabelStyle.FILL_AND_OUTLINE,
            pixelOffset: new Cartesian2(0, -18),
            verticalOrigin: VerticalOrigin.BOTTOM,
            horizontalOrigin: HorizontalOrigin.CENTER,
            scaleByDistance: new NearFarScalar(5e5, 1.2, 5e7, 0.0),
            show: false,
          });
        }
      }

      if (msg.type === 'POSITIONS') {
        const buf: Float64Array = msg.buf;
        for (let i = 0; i < buf.length; i += 4) {
          const x = buf[i], y = buf[i + 1], z = buf[i + 2];
          if (isNaN(x)) continue;
          const pt = collection.get(i / 4);
          if (pt && !collection.isDestroyed()) {
            pt.position = new Cartesian3(x, y, z);
          }
          // Sync label position to match point
          const lbl2 = labelColl.get(i / 4);
          if (lbl2 && !labelColl.isDestroyed()) {
            lbl2.position = new Cartesian3(x, y, z);
          }
        }
      }

      if (msg.type === 'POSITION_RESULT') {
        const posMsg = msg as { type: 'POSITION_RESULT'; norad: number; position: { x: number; y: number; z: number } | null };
        if (posMsg.position) {
          flyToCartesian(new Cartesian3(posMsg.position.x, posMsg.position.y, posMsg.position.z));
        }
      }

      if (msg.type === 'OVERPASS_RESULT') {
        const ovMsg = msg as OverpassResultMessage;
        // Stale guard: discard result if > 2000ms out of sync with current replayTs
        const { replayTs: currentTs, areaOfInterest: aoi } = useAppStore.getState();
        if (Math.abs(ovMsg.timestamp - currentTs) > 2000) return;
        // Remove previous overpass collection
        if (overpassCollectionRef.current && !overpassCollectionRef.current.isDestroyed()) {
          viewer?.scene.primitives.remove(overpassCollectionRef.current);
        }
        overpassCollectionRef.current = null;
        if (!aoi || !viewer || viewer.isDestroyed()) return;
        // Build new overpass arc PolylineCollection
        const ovColl = viewer.scene.primitives.add(new PolylineCollection());
        overpassCollectionRef.current = ovColl;
        for (const sat of ovMsg.overhead) {
          ovColl.add({
            positions: [
              new Cartesian3(sat.ecf.x, sat.ecf.y, sat.ecf.z),
              Cartesian3.fromDegrees(aoi.lon, aoi.lat, 0),
            ],
            width: 1.5,
            arcType: ArcType.GEODESIC,
            material: Material.fromType('Color', {
              color: Color.fromCssColorString('#00D4FF').withAlpha(0.5),
            }),
          });
        }
      }

      if (msg.type === 'ORBIT_RESULT') {
        // Remove previous orbit polylines
        if (orbitCollectionRef.current && !orbitCollectionRef.current.isDestroyed()) {
          viewer.scene.primitives.remove(orbitCollectionRef.current);
        }
        const polys = viewer.scene.primitives.add(new PolylineCollection());
        orbitCollectionRef.current = polys;

        // orbitPoints is number[][] from worker — each element is [x_m, y_m, z_m]
        const orbitPoints: number[][] = msg.orbitPoints;
        const groundPoints: number[][] = msg.groundPoints;

        // Orbit path: ECEF positions above atmosphere (ArcType.NONE — straight ECEF segments)
        if (orbitPoints.length > 1) {
          const orbitPositions = orbitPoints.map(
            ([x, y, z]) => new Cartesian3(x, y, z)
          );
          polys.add({
            positions: orbitPositions,
            width: 1.5,
            material: Material.fromType('Color', {
              color: Color.fromCssColorString('#00D4FF').withAlpha(0.5),
            }),
            arcType: ArcType.NONE,
          });
        }

        // Ground track: geodetic lon/lat radians → Cartesian3 at 10 km altitude
        if (groundPoints.length > 1) {
          const groundPositions = groundPoints.map(
            ([lon, lat]) => Cartesian3.fromRadians(lon, lat, 10_000)
          );
          polys.add({
            positions: groundPositions,
            width: 1.0,
            material: Material.fromType('Color', {
              color: Color.fromCssColorString('#FFD700').withAlpha(0.4),
            }),
            arcType: ArcType.NONE,
          });
        }
      }
    };

    // Send OMM records to worker
    worker.postMessage({ type: 'LOAD_OMM', payload: satData });

    // Click handling is owned by AircraftLayer (unified dispatcher) — no handler here.

    // Propagation loop at 1 Hz
    let lastProp = 0;
    function loop(ts: number) {
      const { replayMode, replayTs, isPlaying } = useAppStore.getState();
      const timestamp = resolveTimestamp(replayMode, isPlaying, replayTs);
      if (timestamp === null) {
        // Paused in playback: keep rAF alive for instant resume, skip dispatch
        rafRef.current = requestAnimationFrame(loop);
        return;
      }
      if (ts - lastProp > 1000) {
        worker.postMessage({ type: 'PROPAGATE', payload: { timestamp } });
        lastProp = ts;
      }
      rafRef.current = requestAnimationFrame(loop);
    }
    rafRef.current = requestAnimationFrame(loop);

    // Cleanup
    return () => {
      cancelAnimationFrame(rafRef.current);
      worker.terminate();
      if (collection && !collection.isDestroyed()) {
        viewer.scene.primitives.remove(collection);
      }
      if (labelCollectionRef.current && !labelCollectionRef.current.isDestroyed()) {
        viewer.scene.primitives.remove(labelCollectionRef.current);
      }
      labelCollectionRef.current = null;
      if (orbitCollectionRef.current && !orbitCollectionRef.current.isDestroyed()) {
        viewer.scene.primitives.remove(orbitCollectionRef.current);
      }
      if (overpassCollectionRef.current && !overpassCollectionRef.current.isDestroyed()) {
        viewer.scene.primitives.remove(overpassCollectionRef.current);
      }
      collectionRef.current = null;
      orbitCollectionRef.current = null;
      overpassCollectionRef.current = null;
      workerRef.current = null;
      indexMapRef.current = new Map();
    };
  }, [viewer, satellites.data, onWorkerReady]);

  // Effect 4: Combined filter + visibility effect (replaces Plan 02 visibility-only effect)
  const satelliteFilter = useAppStore(s => s.satelliteFilter);
  const layerVisible = useAppStore(s => s.layers.satellites);
  useEffect(() => {
    if (!collectionRef.current || collectionRef.current.isDestroyed()) return;
    const collection = collectionRef.current;
    if (collection.length === 0) return; // guard — not yet populated
    const satData = satellites.data ?? [];

    for (let i = 0; i < collection.length; i++) {
      const pt = collection.get(i);
      const sat = satData[i];
      if (!sat) { pt.show = false; continue; }
      pt.show = layerVisible && matchesSatelliteFilter(sat, satelliteFilter);
    }
  }, [satelliteFilter, satellites.data, layerVisible]);

  // Label visibility effect: sync LabelCollection show state with showEntityLabels toggle
  const showEntityLabels = useSettingsStore(s => s.showEntityLabels);
  useEffect(() => {
    if (!labelCollectionRef.current || labelCollectionRef.current.isDestroyed()) return;
    const labelColl = labelCollectionRef.current;
    if (labelColl.length === 0) return;
    for (let i = 0; i < labelColl.length; i++) {
      const lbl = labelColl.get(i);
      const pt = collectionRef.current?.get(i);
      lbl.show = showEntityLabels && (pt?.show ?? false);
    }
  }, [showEntityLabels, satelliteFilter, satellites.data, layerVisible]);

  // Effect 2: Watch selectedSatelliteId to trigger COMPUTE_ORBIT
  const selectedId = useAppStore(s => s.selectedSatelliteId);
  useEffect(() => {
    if (!selectedId || !satellites.data || !workerRef.current || !viewer) return;
    const sat = satellites.data.find(s => s.norad_cat_id === selectedId);
    if (!sat) return;
    // Estimate orbital period from MEAN_MOTION (revolutions/day → period in seconds)
    const meanMotion = (sat.omm as Record<string, number>).MEAN_MOTION ?? 14;
    const periodSeconds = Math.round(86400 / meanMotion);
    const { replayMode: rm, replayTs: rts } = useAppStore.getState();
    const orbitTimestamp = rm === 'playback' ? rts : Date.now();
    workerRef.current.postMessage({
      type: 'COMPUTE_ORBIT',
      payload: { omm: sat.omm, periodSeconds, timestamp: orbitTimestamp },
    });
    // Globe click fly-to: request historical position so POSITION_RESULT triggers flyToCartesian
    workerRef.current.postMessage({
      type: 'GET_POSITION',
      payload: { norad: selectedId, timestamp: orbitTimestamp },
    });
  }, [selectedId, satellites.data, viewer]);
  // NOTE: replayTs deliberately NOT in deps — orbit and position are anchored to selection time

  // Effect 3: Clear orbit polylines when selection is cleared
  useEffect(() => {
    if (selectedId === null && orbitCollectionRef.current && !orbitCollectionRef.current.isDestroyed() && viewer && !viewer.isDestroyed()) {
      viewer.scene.primitives.remove(orbitCollectionRef.current);
      orbitCollectionRef.current = null;
    }
  }, [selectedId, viewer]);

  // Effect 5: AOI right-click handler — sets AOI in store + renders crosshair point
  useEffect(() => {
    if (!viewer || viewer.isDestroyed()) return;
    const aoiColl = viewer.scene.primitives.add(new PointPrimitiveCollection());
    aoiCollectionRef.current = aoiColl;
    const handler = new ScreenSpaceEventHandler(viewer.scene.canvas);
    handlerRef.current = handler;
    handler.setInputAction((click: { position: Cartesian2 }) => {
      const earthPos = viewer.scene.pickPosition(click.position);
      if (!earthPos) return;
      const carto = Ellipsoid.WGS84.cartesianToCartographic(earthPos);
      const lat = CesiumMath.toDegrees(carto.latitude);
      const lon = CesiumMath.toDegrees(carto.longitude);
      useAppStore.getState().setAreaOfInterest({ lat, lon });
      aoiColl.removeAll();
      aoiColl.add({
        position: Cartesian3.fromDegrees(lon, lat, 0),
        pixelSize: 8,
        color: Color.fromCssColorString('#ffffff').withAlpha(0.9),
      });
    }, ScreenSpaceEventType.RIGHT_CLICK);
    return () => {
      handler.destroy();
      if (!aoiColl.isDestroyed()) viewer.scene.primitives.remove(aoiColl);
      aoiCollectionRef.current = null;
      handlerRef.current = null;
    };
  }, [viewer]);

  // Effect 6: COMPUTE_OVERPASS dispatch — debounced 1s on replayTs / replayMode / areaOfInterest change
  useEffect(() => {
    if (replayMode !== 'playback' || !areaOfInterest || !workerRef.current) return;
    if (tleStalenessWarning) return;  // TLE stale — suppress dispatch
    const timer = setTimeout(() => {
      workerRef.current?.postMessage({
        type: 'COMPUTE_OVERPASS',
        payload: {
          lat: areaOfInterest.lat,
          lon: areaOfInterest.lon,
          timestamp: replayTs,
          elevationThresholdDeg: 10,
        },
      });
    }, 1000);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [replayTs, replayMode, areaOfInterest, tleStalenessWarning]);

  // Effect 7: Clear overpass lines when switching back to live mode
  useEffect(() => {
    if (replayMode === 'live' && overpassCollectionRef.current && !overpassCollectionRef.current.isDestroyed() && viewer && !viewer.isDestroyed()) {
      viewer.scene.primitives.remove(overpassCollectionRef.current);
      overpassCollectionRef.current = null;
    }
  }, [replayMode, viewer]);

  // Render TLE staleness warning as a DOM element so tests can assert on it
  if (tleStalenessWarning) {
    return (
      <div
        data-testid="tle-stale-warning"
        role="alert"
        style={{
          position: 'fixed',
          bottom: '48px',
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'rgba(255,0,0,0.15)',
          border: '1px solid #ff3333',
          color: '#ff3333',
          fontFamily: 'monospace',
          fontSize: '10px',
          padding: '3px 10px',
          zIndex: 80,
          pointerEvents: 'none',
        }}
      >
        TLE &gt;7d old — overpass suppressed
      </div>
    );
  }

  return null;
}
