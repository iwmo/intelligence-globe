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

const POLL_INTERVAL_MS = 300_000;

// Module-scope maps — distinct names to avoid collisions with AircraftLayer maps
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const militaryPointsByHex = new Map<string, any>(); // PointPrimitive reference
const militaryPrevPositions = new Map<string, Cartesian3>();
const militaryCurrPositions = new Map<string, Cartesian3>();
let militaryLastUpdateTime = Date.now();

export function MilitaryAircraftLayer({ viewer }: { viewer: Viewer | null }) {
  const militaryAircraft = useMilitaryAircraft();
  const collectionRef = useRef<PointPrimitiveCollection | null>(null);
  const rafRef = useRef<number>(0);
  const rafRunningRef = useRef<boolean>(false);

  const layerVisible = useAppStore(s => s.layers.militaryAircraft);

  // Effect 1: Initialize PointPrimitiveCollection
  useEffect(() => {
    if (!viewer || viewer.isDestroyed()) return;

    if (!collectionRef.current || collectionRef.current.isDestroyed()) {
      collectionRef.current = viewer.scene.primitives.add(
        new PointPrimitiveCollection({ blendOption: BlendOption.OPAQUE })
      );
    }

    return () => {
      cancelAnimationFrame(rafRef.current);
      rafRunningRef.current = false;
      const col = collectionRef.current;
      if (col && !col.isDestroyed()) {
        viewer.scene.primitives.remove(col);
      }
      collectionRef.current = null;
      // Clear module-scope maps on unmount
      militaryPointsByHex.clear();
      militaryPrevPositions.clear();
      militaryCurrPositions.clear();
    };
  }, [viewer]);

  // Effect 2: Update lerp maps and point collection when new military data arrives
  useEffect(() => {
    if (!viewer || viewer.isDestroyed() || !militaryAircraft.data || !collectionRef.current) return;

    const collection = collectionRef.current;
    if (collection.isDestroyed()) return;

    for (const ac of militaryAircraft.data) {
      if (
        ac.latitude == null || ac.longitude == null ||
        isNaN(ac.latitude) || isNaN(ac.longitude)
      ) continue;

      // Convert feet to meters (airplanes.live uses feet — RESEARCH.md Pitfall)
      const altMeters = (ac.alt_baro ?? 0) * 0.3048 + 1000;

      const nextPos = Cartesian3.fromDegrees(ac.longitude, ac.latitude, altMeters);

      // Shift current → previous for lerp; on first appearance, set prev = curr
      const existing = militaryCurrPositions.get(ac.hex);
      militaryPrevPositions.set(ac.hex, existing ?? nextPos);
      militaryCurrPositions.set(ac.hex, nextPos);

      // Add new point primitive if not yet in collection
      if (!militaryPointsByHex.has(ac.hex)) {
        const point = collection.add({
          position: nextPos,
          pixelSize: 4,
          color: Color.fromCssColorString('#F59E0B'), // amber
          id: `mil:${ac.hex}`,
        });
        militaryPointsByHex.set(ac.hex, point);
      }
    }

    militaryLastUpdateTime = Date.now();

    // Start rAF lerp loop if not already running
    if (!rafRunningRef.current) {
      rafRunningRef.current = true;

      function lerp() {
        if (!rafRunningRef.current) return;
        const col = collectionRef.current;
        if (!col || col.isDestroyed()) return;
        const alpha = Math.min((Date.now() - militaryLastUpdateTime) / POLL_INTERVAL_MS, 1.0);
        for (const [hex, point] of militaryPointsByHex) {
          const prev = militaryPrevPositions.get(hex);
          const curr = militaryCurrPositions.get(hex);
          if (prev && curr && point && !col.isDestroyed()) {
            point.position = Cartesian3.lerp(prev, curr, alpha, new Cartesian3());
          }
        }
        rafRef.current = requestAnimationFrame(lerp);
      }

      rafRef.current = requestAnimationFrame(lerp);
    }
  }, [viewer, militaryAircraft.data]);

  // Effect 3: Visibility toggle
  useEffect(() => {
    for (const [, point] of militaryPointsByHex) {
      point.show = layerVisible;
    }
  }, [layerVisible]);

  return null;
}
