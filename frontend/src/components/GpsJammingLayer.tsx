import { useEffect, useRef } from 'react';
import { cellToBoundary } from 'h3-js';
import {
  Viewer,
  GroundPrimitive,
  GeometryInstance,
  PolygonGeometry,
  PolygonHierarchy,
  Cartesian3,
  ColorGeometryInstanceAttribute,
  PerInstanceColorAppearance,
  Color,
} from 'cesium';
import { useGpsJamming, GpsJammingCell } from '../hooks/useGpsJamming';
import { useAppStore } from '../store/useAppStore';

interface GpsJammingLayerProps {
  viewer: Viewer | null;
}

function buildHexPrimitive(cells: GpsJammingCell[]): GroundPrimitive {
  const instances = cells.map(({ h3index, severity }) => {
    const boundary = cellToBoundary(h3index);
    // CRITICAL: swap [lat,lng] to [lng,lat] for CesiumJS
    const positions = Cartesian3.fromDegreesArray(
      boundary.flatMap(([lat, lng]) => [lng, lat])
    );
    const color =
      severity === 'red'
        ? Color.RED.withAlpha(0.55)
        : severity === 'yellow'
          ? Color.YELLOW.withAlpha(0.45)
          : Color.GREEN.withAlpha(0.35);
    return new GeometryInstance({
      geometry: new PolygonGeometry({ polygonHierarchy: new PolygonHierarchy(positions) }),
      id: `gps-jam:${h3index}`,
      attributes: { color: ColorGeometryInstanceAttribute.fromColor(color) },
    });
  });
  return new GroundPrimitive({
    geometryInstances: instances,
    appearance: new PerInstanceColorAppearance({ flat: true }),
    asynchronous: true,
  });
}

export function GpsJammingLayer({ viewer }: GpsJammingLayerProps): null {
  const primitiveRef = useRef<GroundPrimitive | null>(null);
  const gpsJamming = useGpsJamming();
  const layerVisible = useAppStore((s) => s.layers.gpsJamming);

  // Effect 1 — Primitive lifecycle
  useEffect(() => {
    if (!viewer || viewer.isDestroyed()) return;

    const removePrimitive = () => {
      const prim = primitiveRef.current;
      if (prim && !prim.isDestroyed()) {
        viewer.scene.primitives.remove(prim);
      }
      primitiveRef.current = null;
    };

    if (!layerVisible) {
      removePrimitive();
      return;
    }

    const cells = gpsJamming.data?.cells;
    if (!cells || cells.length === 0) {
      removePrimitive();
      return;
    }

    // Remove old primitive before creating new one (GroundPrimitive geometry is immutable)
    removePrimitive();

    const newPrimitive = buildHexPrimitive(cells);
    viewer.scene.primitives.add(newPrimitive);
    primitiveRef.current = newPrimitive;
  }, [gpsJamming.data, layerVisible, viewer]);

  // Effect 2 — Cleanup on unmount
  useEffect(() => {
    return () => {
      const prim = primitiveRef.current;
      if (prim && viewer && !viewer.isDestroyed() && !prim.isDestroyed()) {
        viewer.scene.primitives.remove(prim);
      }
      primitiveRef.current = null;
    };
  }, [viewer]);

  return null;
}
