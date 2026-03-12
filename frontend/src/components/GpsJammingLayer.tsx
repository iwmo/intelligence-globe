import { useEffect, useRef } from 'react';
import { cellToBoundary } from 'h3-js';
import {
  Viewer,
  Primitive,
  GeometryInstance,
  PolygonGeometry,
  PolygonHierarchy,
  Cartesian3,
  ColorGeometryInstanceAttribute,
  PerInstanceColorAppearance,
  Color,
} from 'cesium';
import { useGpsJamming } from '../hooks/useGpsJamming';
import type { GpsJammingCell } from '../hooks/useGpsJamming';
import { useAppStore } from '../store/useAppStore';

interface GpsJammingLayerProps {
  viewer: Viewer | null;
}

// Slight elevation above the ellipsoid to avoid z-fighting with the globe surface.
// EllipsoidTerrainProvider has no elevation data, so GroundPrimitive terrain-clamping
// is not needed; a regular Primitive at fixed height is more reliable.
const HEX_HEIGHT_M = 5000;

function buildHexPrimitive(cells: GpsJammingCell[]): Primitive {
  const instances: GeometryInstance[] = [];

  for (const { h3index, severity } of cells) {
    try {
      const boundary = cellToBoundary(h3index);
      // CRITICAL: swap [lat,lng] to [lng,lat] for CesiumJS
      const positions = Cartesian3.fromDegreesArray(
        boundary.flatMap(([lat, lng]) => [lng, lat])
      );
      const color =
        severity === 'red'
          ? Color.RED.withAlpha(0.6)
          : severity === 'yellow'
            ? Color.YELLOW.withAlpha(0.5)
            : Color.fromCssColorString('#00ff88').withAlpha(0.25);
      instances.push(new GeometryInstance({
        geometry: new PolygonGeometry({
          polygonHierarchy: new PolygonHierarchy(positions),
          vertexFormat: PerInstanceColorAppearance.FLAT_VERTEX_FORMAT,
          height: HEX_HEIGHT_M,
        }),
        id: `gps-jam:${h3index}`,
        attributes: { color: ColorGeometryInstanceAttribute.fromColor(color) },
      }));
    } catch {
      // Skip invalid H3 cells silently
    }
  }

  return new Primitive({
    geometryInstances: instances,
    appearance: new PerInstanceColorAppearance({ flat: true, translucent: true }),
    asynchronous: true,
  });
}

export function GpsJammingLayer({ viewer }: GpsJammingLayerProps): null {
  const primitiveRef = useRef<Primitive | null>(null);
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

    // Remove old primitive before creating new one (geometry is immutable)
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
