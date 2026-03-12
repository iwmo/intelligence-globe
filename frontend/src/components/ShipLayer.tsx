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

// Module-scope map — ships are slow, no lerp needed
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const shipPointsByMmsi = new Map<string, any>(); // PointPrimitive reference

export function ShipLayer({ viewer }: { viewer: Viewer | null }) {
  const ships = useShips();
  const collectionRef = useRef<PointPrimitiveCollection | null>(null);

  const layerVisible = useAppStore(s => s.layers.ships);

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
        ship.latitude == null || ship.longitude == null ||
        isNaN(ship.latitude) || isNaN(ship.longitude)
      ) continue;

      // Ships at sea level + 100m
      const pos = Cartesian3.fromDegrees(ship.longitude, ship.latitude, 100);

      if (shipPointsByMmsi.has(ship.mmsi)) {
        // Direct position update — no lerp needed for slow-moving ships
        shipPointsByMmsi.get(ship.mmsi).position = pos;
      } else {
        const point = collection.add({
          position: pos,
          pixelSize: 4,
          color: Color.fromCssColorString('#06B6D4'), // cyan
          id: `mmsi:${ship.mmsi}`,
        });
        shipPointsByMmsi.set(ship.mmsi, point);
      }
    }
  }, [viewer, ships.data]);

  // Effect 3: Visibility toggle
  useEffect(() => {
    for (const [, point] of shipPointsByMmsi) {
      point.show = layerVisible;
    }
  }, [layerVisible]);

  return null;
}
