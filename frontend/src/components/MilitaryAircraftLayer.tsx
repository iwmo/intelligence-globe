import { useEffect, useRef } from 'react';
import {
  Viewer,
  PointPrimitiveCollection,
  Cartesian3,
  BlendOption,
  Color,
} from 'cesium';
import { useMilitaryAircraft } from '../hooks/useMilitaryAircraft';
import { useAppStore } from '../store/useAppStore';
import { useReplaySnapshots, findAdjacentSnapshots } from '../hooks/useReplaySnapshots';

// Module-scope map — military updates every 300s, no lerp needed
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const militaryPointsByHex = new Map<string, any>();

export function MilitaryAircraftLayer({ viewer }: { viewer: Viewer | null }) {
  const militaryAircraft = useMilitaryAircraft();
  const collectionRef = useRef<PointPrimitiveCollection | null>(null);

  const layerVisible = useAppStore(s => s.layers.militaryAircraft);

  // Replay state — read by playback interpolation effect
  const replayMode  = useAppStore(s => s.replayMode);
  const replayTs    = useAppStore(s => s.replayTs);
  const windowStart = useAppStore(s => s.replayWindowStart);
  const windowEnd   = useAppStore(s => s.replayWindowEnd);

  // Fetch snapshots for military layer — only active in playback mode
  const { data: snapshotsByEntity } = useReplaySnapshots(
    'military',
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
      militaryPointsByHex.clear();
    };
  }, [viewer]);

  // Effect 2: Update point positions when new data arrives
  useEffect(() => {
    if (!viewer || viewer.isDestroyed() || !militaryAircraft.data?.length || !collectionRef.current) return;

    const collection = collectionRef.current;
    if (collection.isDestroyed()) return;

    for (const ac of militaryAircraft.data) {
      if (ac.lat == null || ac.lon == null || isNaN(ac.lat) || isNaN(ac.lon)) continue;

      const altMeters = (ac.alt_baro ?? 0) * 0.3048 + 1000;
      const pos = Cartesian3.fromDegrees(ac.lon, ac.lat, altMeters);

      const existing = militaryPointsByHex.get(ac.hex);
      if (existing) {
        existing.position = pos;
      } else {
        const point = collection.add({
          position: pos,
          pixelSize: 5,
          color: Color.fromCssColorString('#EF4444'), // red — distinct from aircraft orange
          id: `mil:${ac.hex}`,
          show: layerVisible,
        });
        militaryPointsByHex.set(ac.hex, point);
      }
    }
  }, [viewer, militaryAircraft.data, layerVisible]);

  // Effect 3: Visibility toggle
  useEffect(() => {
    for (const [, point] of militaryPointsByHex) {
      point.show = layerVisible;
    }
  }, [layerVisible]);

  // Effect: Playback snapshot interpolation
  // Runs only when replayMode === 'playback'. Does NOT modify live update logic.
  useEffect(() => {
    if (replayMode !== 'playback') return;
    if (!snapshotsByEntity || snapshotsByEntity.size === 0) return;

    for (const [hex, point] of militaryPointsByHex) {
      if (!point) continue;
      const snapshots = snapshotsByEntity.get(hex);
      if (!snapshots || snapshots.length === 0) continue;

      const [snapA, snapB] = findAdjacentSnapshots(snapshots, replayTs);
      if (!snapA) continue;

      const alpha = snapA && snapB
        ? Math.min((replayTs - snapA.ts) / (snapB.ts - snapA.ts), 1.0)
        : 1.0;
      const lat = snapA && snapB ? snapA.latitude + alpha * (snapB.latitude - snapA.latitude) : snapA.latitude;
      const lon = snapA && snapB ? snapA.longitude + alpha * (snapB.longitude - snapA.longitude) : snapA.longitude;
      const alt = (snapA.altitude ?? 0) * 0.3048 + 1000;

      point.position = Cartesian3.fromDegrees(lon, lat, alt);
    }
  }, [replayMode, replayTs, snapshotsByEntity]);

  return null;
}
