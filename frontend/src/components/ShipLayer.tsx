import { useEffect, useRef } from 'react';
import {
  Viewer,
  BillboardCollection,
  Cartesian3,
  BlendOption,
  NearFarScalar,
  Math as CesiumMath,
} from 'cesium';
import { useShips } from '../hooks/useShips';
import { useAppStore } from '../store/useAppStore';
import { useReplaySnapshots, findAdjacentSnapshots } from '../hooks/useReplaySnapshots';

// ---------------------------------------------------------------------------
// SVG-derived canvas icon — pre-rendered once at module scope.
// Ship hull silhouette: vessel shape viewed from above. Green color matches
// existing ship point color.
// ---------------------------------------------------------------------------
function drawShipIcon(): HTMLCanvasElement {
  const SIZE = 32;
  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#22C55E'; // ship green — matches existing point color
  // Vessel hull from above: pointed bow, wider stern, rectangular midship
  ctx.beginPath();
  ctx.moveTo(SIZE / 2, 2);               // bow tip
  ctx.lineTo(SIZE * 0.75, SIZE * 0.25);  // starboard shoulder
  ctx.lineTo(SIZE * 0.75, SIZE * 0.8);   // starboard stern quarter
  ctx.lineTo(SIZE * 0.55, SIZE - 4);     // starboard stern corner
  ctx.lineTo(SIZE * 0.45, SIZE - 4);     // port stern corner
  ctx.lineTo(SIZE * 0.25, SIZE * 0.8);   // port stern quarter
  ctx.lineTo(SIZE * 0.25, SIZE * 0.25);  // port shoulder
  ctx.closePath();
  ctx.fill();
  return canvas;
}
export const SHIP_ICON = drawShipIcon();

// Module-scope map — ships are slow, no lerp needed
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const shipBillboardsByMmsi = new Map<string, any>(); // Billboard reference

export function ShipLayer({ viewer }: { viewer: Viewer | null }) {
  const ships = useShips();
  const collectionRef = useRef<BillboardCollection | null>(null);

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

  // Effect 1: Initialize BillboardCollection
  useEffect(() => {
    if (!viewer || viewer.isDestroyed()) return;

    if (!collectionRef.current || collectionRef.current.isDestroyed()) {
      collectionRef.current = viewer.scene.primitives.add(
        new BillboardCollection({ blendOption: BlendOption.OPAQUE })
      );
    }

    return () => {
      const col = collectionRef.current;
      if (col && !col.isDestroyed()) {
        viewer.scene.primitives.remove(col);
      }
      collectionRef.current = null;
      // Clear module-scope map on unmount
      shipBillboardsByMmsi.clear();
    };
  }, [viewer]);

  // Effect 2: Update billboard positions directly on data refresh (no lerp — ships move slowly)
  useEffect(() => {
    if (replayMode === 'playback') return;  // LAYR-02: guard — snapshot interpolation owns positions
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

      // Heading rotation with 511-sentinel fallback to cog
      const rot = (ship.heading !== null && ship.heading !== 511)
        ? ship.heading
        : (ship.cog ?? 0);

      if (shipBillboardsByMmsi.has(ship.mmsi)) {
        // Direct position and heading update — no lerp needed for slow-moving ships
        const bb = shipBillboardsByMmsi.get(ship.mmsi);
        bb.position = pos;
        bb.rotation = CesiumMath.toRadians(-rot);
      } else {
        const bb = collection.add({
          position: pos,
          image: SHIP_ICON,
          width: 20,
          height: 20,
          rotation: CesiumMath.toRadians(-rot),
          alignedAxis: Cartesian3.ZERO,
          id: `mmsi:${ship.mmsi}`,
          scaleByDistance: new NearFarScalar(1e4, 1.5, 5e6, 0.4),
          show: layerVisible,
        });
        shipBillboardsByMmsi.set(ship.mmsi, bb);
      }
    }
  }, [viewer, ships.data, layerVisible, replayMode]);

  // Effect 3: Visibility toggle
  useEffect(() => {
    for (const [, bb] of shipBillboardsByMmsi) {
      bb.show = layerVisible;
    }
  }, [layerVisible]);

  // Effect: Playback snapshot interpolation
  // Runs only when replayMode === 'playback'. Ships have no live lerp — this is purely additive.
  useEffect(() => {
    if (replayMode !== 'playback') return;
    if (!snapshotsByEntity || snapshotsByEntity.size === 0) return;

    for (const [mmsi, bb] of shipBillboardsByMmsi) {
      if (!bb) continue;
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
      bb.position = Cartesian3.fromDegrees(lon, lat, 100);
    }
  }, [replayMode, replayTs, snapshotsByEntity]);

  return null;
}
