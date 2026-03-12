import { useEffect, useRef } from 'react';
import {
  Viewer,
  PointPrimitiveCollection,
  Cartesian3,
  BlendOption,
  Color,
} from 'cesium';
import { useShips } from '../hooks/useShips';
import { useAppStore } from '../store/useAppStore';
import { useReplaySnapshots, findAdjacentSnapshots } from '../hooks/useReplaySnapshots';

// Module-scope map — ships are slow, no lerp needed
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const shipPointsByMmsi = new Map<string, any>(); // PointPrimitive reference

export function ShipLayer({ viewer }: { viewer: Viewer | null }) {
  const ships = useShips();
  const collectionRef = useRef<PointPrimitiveCollection | null>(null);

  const layerVisible = useAppStore(s => s.layers.ships);

  // Replay state — read by playback interpolation effect
  const replayMode  = useAppStore(s => s.replayMode);
  const replayTs    = useAppStore(s => s.replayTs);
  const windowStart = useAppStore(s => s.replayWindowStart);
  const windowEnd   = useAppStore(s => s.replayWindowEnd);

  // Fetch snapshots for ship layer — only active in playback mode
  const { data: snapshotsByEntity } = useReplaySnapshots(
    'ship',
    windowStart,
    windowEnd,
    replayMode === 'playback',
  );

  // Effect 1: Initialize PointPrimitiveCollection
  useEffect(() => {
    if (!viewer || viewer.isDestroyed()) return;

    if (!collectionRef.current || collectionRef.current.isDestroyed()) {
      collectionRef.current = viewer.scene.primitives.add(
        new PointPrimitiveCollection({ blendOption: BlendOption.OPAQUE })
      );
    }

    return () => {
      const col = collectionRef.current;
      if (col && !col.isDestroyed()) {
        viewer.scene.primitives.remove(col);
      }
      collectionRef.current = null;
      // Clear module-scope map on unmount
      shipPointsByMmsi.clear();
    };
  }, [viewer]);

  // Effect 2: Update point positions directly on data refresh (no lerp — ships move slowly)
  useEffect(() => {
    if (!viewer || viewer.isDestroyed() || !ships.data || !collectionRef.current) return;

    const collection = collectionRef.current;
    if (collection.isDestroyed()) return;

    for (const ship of ships.data) {
      if (
        ship.lat == null || ship.lon == null ||
        isNaN(ship.lat) || isNaN(ship.lon)
      ) continue;

      // Ships at sea level + 100m
      const pos = Cartesian3.fromDegrees(ship.lon, ship.lat, 100);

      if (shipPointsByMmsi.has(ship.mmsi)) {
        // Direct position update — no lerp needed for slow-moving ships
        shipPointsByMmsi.get(ship.mmsi).position = pos;
      } else {
        const point = collection.add({
          position: pos,
          pixelSize: 4,
          color: Color.fromCssColorString('#22C55E'), // green — distinct from sat (#00D4FF), air (#FF8C00), mil (#EF4444)
          id: `mmsi:${ship.mmsi}`,
          show: layerVisible,
        });
        shipPointsByMmsi.set(ship.mmsi, point);
      }
    }
  }, [viewer, ships.data, layerVisible]);

  // Effect 3: Visibility toggle
  useEffect(() => {
    for (const [, point] of shipPointsByMmsi) {
      point.show = layerVisible;
    }
  }, [layerVisible]);

  // Effect: Playback snapshot interpolation
  // Runs only when replayMode === 'playback'. Ships have no live lerp — this is purely additive.
  useEffect(() => {
    if (replayMode !== 'playback') return;
    if (!snapshotsByEntity || snapshotsByEntity.size === 0) return;

    for (const [mmsi, point] of shipPointsByMmsi) {
      if (!point) continue;
      const snapshots = snapshotsByEntity.get(mmsi);
      if (!snapshots || snapshots.length === 0) continue;

      const [snapA, snapB] = findAdjacentSnapshots(snapshots, replayTs);
      if (!snapA) continue;

      const alpha = snapA && snapB
        ? Math.min((replayTs - snapA.ts) / (snapB.ts - snapA.ts), 1.0)
        : 1.0;
      const lat = snapA && snapB ? snapA.latitude + alpha * (snapB.latitude - snapA.latitude) : snapA.latitude;
      const lon = snapA && snapB ? snapA.longitude + alpha * (snapB.longitude - snapA.longitude) : snapA.longitude;

      // Ships at sea level + 100m (same as live mode)
      point.position = Cartesian3.fromDegrees(lon, lat, 100);
    }
  }, [replayMode, replayTs, snapshotsByEntity]);

  return null;
}
