import { useEffect, useRef } from 'react';
import {
  Viewer,
  BillboardCollection,
  LabelCollection,
  LabelStyle,
  VerticalOrigin,
  HorizontalOrigin,
  Cartesian2,
  Cartesian3,
  BlendOption,
  NearFarScalar,
  Math as CesiumMath,
  Color,
} from 'cesium';
import { useMilitaryAircraft } from '../hooks/useMilitaryAircraft';
import { useAppStore } from '../store/useAppStore';
import { useSettingsStore } from '../store/useSettingsStore';
import { useReplaySnapshots, findAdjacentSnapshots } from '../hooks/useReplaySnapshots';

// ---------------------------------------------------------------------------
// SVG-derived canvas icon — pre-rendered once at module scope.
// Military aircraft shape: delta-wing silhouette, visually distinct from
// commercial aircraft. Red color matches existing military point color.
// ---------------------------------------------------------------------------
function drawMilitaryIcon(): HTMLCanvasElement {
  const SIZE = 32;
  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#EF4444'; // military red — matches existing point color
  // Delta-wing silhouette: broad swept wings, short body, pointed nose
  ctx.beginPath();
  ctx.moveTo(SIZE / 2, 2);           // nose tip
  ctx.lineTo(SIZE - 4, SIZE - 4);    // starboard rear corner
  ctx.lineTo(SIZE / 2 + 3, SIZE * 0.7); // notch into fuselage (starboard)
  ctx.lineTo(SIZE / 2, SIZE - 6);    // tail center
  ctx.lineTo(SIZE / 2 - 3, SIZE * 0.7); // notch into fuselage (port)
  ctx.lineTo(4, SIZE - 4);           // port rear corner
  ctx.closePath();
  ctx.fill();
  return canvas;
}
export const MILITARY_ICON = drawMilitaryIcon();

// Module-scope map — military updates every 300s, no lerp needed
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const militaryBillboardsByHex = new Map<string, any>(); // Billboard reference
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const militaryLabelsByHex = new Map<string, any>(); // Label reference

export function MilitaryAircraftLayer({ viewer }: { viewer: Viewer | null }) {
  const militaryAircraft = useMilitaryAircraft();
  const collectionRef = useRef<BillboardCollection | null>(null);
  const labelCollectionRef = useRef<LabelCollection | null>(null);

  const layerVisible = useAppStore(s => s.layers.militaryAircraft);
  const showEntityLabels = useSettingsStore(s => s.showEntityLabels);

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

  // Effect 1: Initialize BillboardCollection and LabelCollection
  useEffect(() => {
    if (!viewer || viewer.isDestroyed()) return;

    if (!collectionRef.current || collectionRef.current.isDestroyed()) {
      collectionRef.current = viewer.scene.primitives.add(
        new BillboardCollection({ blendOption: BlendOption.OPAQUE })
      );
    }

    if (!labelCollectionRef.current || labelCollectionRef.current.isDestroyed()) {
      labelCollectionRef.current = viewer.scene.primitives.add(new LabelCollection());
    }

    return () => {
      const col = collectionRef.current;
      if (col && !col.isDestroyed()) {
        viewer.scene.primitives.remove(col);
      }
      collectionRef.current = null;
      militaryBillboardsByHex.clear();
      const lc = labelCollectionRef.current;
      if (lc && !lc.isDestroyed()) { viewer.scene.primitives.remove(lc); }
      labelCollectionRef.current = null;
      militaryLabelsByHex.clear();
    };
  }, [viewer]);

  // Effect 2: Update billboard positions when new data arrives
  useEffect(() => {
    if (replayMode === 'playback') return;  // LAYR-02: guard — snapshot interpolation owns positions
    if (!viewer || viewer.isDestroyed() || !militaryAircraft.data?.length || !collectionRef.current) return;

    const collection = collectionRef.current;
    if (collection.isDestroyed()) return;

    for (const ac of militaryAircraft.data) {
      if (ac.lat == null || ac.lon == null || isNaN(ac.lat) || isNaN(ac.lon)) continue;

      const altMeters = (ac.alt_baro ?? 0) * 0.3048 + 1000;
      const pos = Cartesian3.fromDegrees(ac.lon, ac.lat, altMeters);

      // Military heading from track field (degrees clockwise from north)
      const rot = ac.track ?? 0;

      const existing = militaryBillboardsByHex.get(ac.hex);
      if (existing) {
        existing.position = pos;
        existing.rotation = CesiumMath.toRadians(-rot);
        // Update label position on data refresh
        const lbl = militaryLabelsByHex.get(ac.hex);
        if (lbl) lbl.position = pos;
      } else {
        const bb = collection.add({
          position: pos,
          image: MILITARY_ICON,
          width: 24,
          height: 24,
          rotation: CesiumMath.toRadians(-rot),
          alignedAxis: Cartesian3.ZERO,
          id: `mil:${ac.hex}`,
          scaleByDistance: new NearFarScalar(1e4, 1.5, 5e6, 0.4),
          show: layerVisible,
        });
        militaryBillboardsByHex.set(ac.hex, bb);
        if (!militaryLabelsByHex.has(ac.hex) && labelCollectionRef.current && !labelCollectionRef.current.isDestroyed()) {
          const lbl = labelCollectionRef.current.add({
            position: pos,
            text: (ac.flight?.trim() || ac.hex).toUpperCase(),
            font: '11px monospace',
            fillColor: Color.fromCssColorString('#EF4444'),
            outlineColor: Color.BLACK,
            outlineWidth: 2,
            style: LabelStyle.FILL_AND_OUTLINE,
            pixelOffset: new Cartesian2(0, -22),
            verticalOrigin: VerticalOrigin.BOTTOM,
            horizontalOrigin: HorizontalOrigin.CENTER,
            scaleByDistance: new NearFarScalar(1e4, 1.4, 5e6, 0.0),
            show: false,
          });
          militaryLabelsByHex.set(ac.hex, lbl);
        }
      }
    }
  }, [viewer, militaryAircraft.data, layerVisible, replayMode]);

  // Effect 3: Visibility toggle
  useEffect(() => {
    for (const [, bb] of militaryBillboardsByHex) {
      bb.show = layerVisible;
    }
  }, [layerVisible]);

  // Effect 4: Label visibility toggle
  useEffect(() => {
    for (const [hex, lbl] of militaryLabelsByHex) {
      const bb = militaryBillboardsByHex.get(hex);
      lbl.show = showEntityLabels && (bb?.show ?? false);
    }
  }, [showEntityLabels, layerVisible]);

  // Effect: Playback snapshot interpolation
  // Runs only when replayMode === 'playback'. Does NOT modify live update logic.
  useEffect(() => {
    if (replayMode !== 'playback') return;
    if (!snapshotsByEntity || snapshotsByEntity.size === 0) return;

    for (const [hex, bb] of militaryBillboardsByHex) {
      if (!bb) continue;
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

      bb.position = Cartesian3.fromDegrees(lon, lat, alt);
    }
  }, [replayMode, replayTs, snapshotsByEntity]);

  // Effect: Stale billboard tint (VIS-01)
  useEffect(() => {
    if (replayMode === 'playback') return;
    const byId = new Map(militaryAircraft.data?.map(m => [m.hex, m]) ?? []);
    for (const [hex, bb] of militaryBillboardsByHex) {
      const ac = byId.get(hex);
      if (!ac || !bb) continue;
      bb.color = ac.is_stale ? Color.GRAY.withAlpha(0.4) : Color.WHITE.clone();
    }
  }, [militaryAircraft.data, replayMode]);

  return null;
}
