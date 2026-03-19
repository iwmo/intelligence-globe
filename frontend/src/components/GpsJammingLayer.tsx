import React, { useEffect, useRef } from 'react';
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
import { useGpsJamming } from '../hooks/useGpsJamming';
import type { GpsJammingCell } from '../hooks/useGpsJamming';
import { useAppStore } from '../store/useAppStore';

interface GpsJammingLayerProps {
  viewer: Viewer | null;
}

// Severity-based fill colours for GPS jamming cells (matches backend thresholds:
// red >= 0.3 bad ratio, yellow >= 0.1, green < 0.1).
const SEVERITY_COLORS: Record<string, Color> = {
  red: Color.RED.withAlpha(0.55),
  yellow: Color.YELLOW.withAlpha(0.5),
  green: Color.GREEN.withAlpha(0.35),
};

// GroundPrimitive drapes geometry onto the terrain surface using Cesium's shadow-volume
// technique, which correctly handles depth testing against the globe without z-fighting.
// EllipsoidTerrainProvider IS supported by GroundPrimitive (the ellipsoid IS the terrain).
// The vertexFormat must match PerInstanceColorAppearance.FLAT_VERTEX_FORMAT — this was
// the bug in the original code that caused GroundPrimitive to appear broken.
function buildHexPrimitive(cells: GpsJammingCell[]): GroundPrimitive | null {
  const instances: GeometryInstance[] = [];

  for (const { h3index, severity } of cells) {
    try {
      const boundary = cellToBoundary(h3index);
      // CRITICAL: swap [lat,lng] to [lng,lat] for CesiumJS
      const positions = Cartesian3.fromDegreesArray(
        boundary.flatMap(([lat, lng]) => [lng, lat])
      );
      const color = SEVERITY_COLORS[severity] ?? SEVERITY_COLORS.green;
      instances.push(new GeometryInstance({
        geometry: new PolygonGeometry({
          polygonHierarchy: new PolygonHierarchy(positions),
          // vertexFormat must match PerInstanceColorAppearance.FLAT_VERTEX_FORMAT —
          // without this, GroundPrimitive silently produces no geometry.
          vertexFormat: PerInstanceColorAppearance.FLAT_VERTEX_FORMAT,
        }),
        id: `gps-jam:${h3index}`,
        attributes: { color: ColorGeometryInstanceAttribute.fromColor(color) },
      }));
    } catch {
      // Skip invalid H3 cells silently
    }
  }

  // Guard: if every cell failed, return null so the caller skips primitive creation.
  if (instances.length === 0) return null;

  return new GroundPrimitive({
    geometryInstances: instances,
    appearance: new PerInstanceColorAppearance({ flat: true, translucent: true }),
    asynchronous: true,
  });
}

export function GpsJammingLayer({ viewer }: GpsJammingLayerProps): React.ReactElement | null {
  const primitiveRef = useRef<GroundPrimitive | null>(null);
  const gpsJamming = useGpsJamming();
  const layerVisible = useAppStore((s) => s.layers.gpsJamming);
  const replayMode   = useAppStore((s) => s.replayMode);

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
    if (!newPrimitive) return; // all cells were invalid — nothing to render
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

  if (replayMode === 'playback' && layerVisible) {
    return (
      <div style={{
        position: 'fixed',
        top: '60px',
        right: '12px',
        zIndex: 100,
        background: 'rgba(245, 158, 11, 0.15)',
        border: '1px solid #F59E0B',
        color: '#F59E0B',
        fontFamily: 'monospace',
        fontSize: '10px',
        fontWeight: 700,
        padding: '2px 6px',
        borderRadius: '3px',
        pointerEvents: 'none',
      }}>
        GPS LIVE DATA
      </div>
    );
  }
  return null;
}
