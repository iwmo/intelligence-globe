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
  Color,
  Material,
} from 'cesium';
import { useSatellites } from '../hooks/useSatellites';
import { useAppStore } from '../store/useAppStore';

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

type WorkerOutMessage = LoadedMessage | PositionsMessage | OrbitResultMessage;

export function SatelliteLayer({ viewer }: { viewer: Viewer | null }) {
  const satellites = useSatellites();
  const workerRef = useRef<Worker | null>(null);
  const collectionRef = useRef<PointPrimitiveCollection | null>(null);
  const orbitCollectionRef = useRef<PolylineCollection | null>(null);
  const indexMapRef = useRef<Map<number, number>>(new Map());
  const rafRef = useRef<number>(0);
  const handlerRef = useRef<ScreenSpaceEventHandler | null>(null);

  // Effect 1: Initialize worker and point collection when viewer + data are ready
  useEffect(() => {
    if (!viewer || viewer.isDestroyed() || !satellites.data) return;

    // Create PointPrimitiveCollection once
    const collection = viewer.scene.primitives.add(new PointPrimitiveCollection());
    collectionRef.current = collection;

    // Spawn worker
    const worker = new Worker(
      new URL('../workers/propagation.worker.ts', import.meta.url),
      { type: 'module' }
    );
    workerRef.current = worker;

    // Capture satellites.data in closure so the onmessage handler has stable reference
    const satData = satellites.data;

    worker.onmessage = (e: MessageEvent<WorkerOutMessage>) => {
      const msg = e.data;

      if (msg.type === 'LOADED') {
        const count: number = msg.count;
        const map = indexMapRef.current;
        for (let i = 0; i < satData.length && i < count; i++) {
          collection.add({
            position: Cartesian3.ZERO,
            pixelSize: 3,
            color: Color.fromCssColorString('#00D4FF').withAlpha(0.85),
            id: satData[i].norad_cat_id,  // scene.pick() returns this as picked.id
          });
          map.set(satData[i].norad_cat_id, i);
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

    // Click handler
    const handler = new ScreenSpaceEventHandler(viewer.scene.canvas);
    handlerRef.current = handler;
    handler.setInputAction((click: { position: Cartesian2 }) => {
      const picked = viewer.scene.pick(click.position);
      if (picked && typeof picked.id === 'number' && picked.id > 1000) {
        useAppStore.getState().setSelectedSatelliteId(picked.id);
      }
    }, ScreenSpaceEventType.LEFT_CLICK);

    // Propagation loop at 1 Hz
    let lastProp = 0;
    function loop(ts: number) {
      if (ts - lastProp > 1000) {
        worker.postMessage({ type: 'PROPAGATE', payload: { timestamp: Date.now() } });
        lastProp = ts;
      }
      rafRef.current = requestAnimationFrame(loop);
    }
    rafRef.current = requestAnimationFrame(loop);

    // Cleanup
    return () => {
      cancelAnimationFrame(rafRef.current);
      worker.terminate();
      handler.destroy();
      if (collection && !collection.isDestroyed()) {
        viewer.scene.primitives.remove(collection);
      }
      if (orbitCollectionRef.current && !orbitCollectionRef.current.isDestroyed()) {
        viewer.scene.primitives.remove(orbitCollectionRef.current);
      }
      collectionRef.current = null;
      orbitCollectionRef.current = null;
      workerRef.current = null;
      handlerRef.current = null;
      indexMapRef.current = new Map();
    };
  }, [viewer, satellites.data]);

  // Effect 2: Watch selectedSatelliteId to trigger COMPUTE_ORBIT
  const selectedId = useAppStore(s => s.selectedSatelliteId);
  useEffect(() => {
    if (!selectedId || !satellites.data || !workerRef.current || !viewer) return;
    const sat = satellites.data.find(s => s.norad_cat_id === selectedId);
    if (!sat) return;
    // Estimate orbital period from MEAN_MOTION (revolutions/day → period in seconds)
    const meanMotion = (sat.omm as Record<string, number>).MEAN_MOTION ?? 14;
    const periodSeconds = Math.round(86400 / meanMotion);
    workerRef.current.postMessage({
      type: 'COMPUTE_ORBIT',
      payload: { omm: sat.omm, periodSeconds },
    });
  }, [selectedId, satellites.data, viewer]);

  // Effect 3: Clear orbit polylines when selection is cleared
  useEffect(() => {
    if (selectedId === null && orbitCollectionRef.current && !orbitCollectionRef.current.isDestroyed() && viewer && !viewer.isDestroyed()) {
      viewer.scene.primitives.remove(orbitCollectionRef.current);
      orbitCollectionRef.current = null;
    }
  }, [selectedId, viewer]);

  return null;
}
