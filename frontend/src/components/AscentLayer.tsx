import { useEffect, useRef } from 'react';
import {
  Cartesian3,
  Color,
  ConstantProperty,
  CustomDataSource,
  Entity,
  PolylineGlowMaterialProperty,
  PolylineGraphics,
  type Viewer,
} from 'cesium';
import { useAppStore } from '../store/useAppStore';
import { estimateAscentPath } from '../lib/ascentEstimate';

export function AscentLayer({ viewer }: { viewer: Viewer | null }) {
  const estimate = useAppStore(s => s.ascentEstimate);
  const dataSourceRef = useRef<CustomDataSource | null>(null);

  useEffect(() => {
    if (!viewer || viewer.isDestroyed()) return;
    const ds = new CustomDataSource('ascent-estimate');
    viewer.dataSources.add(ds);
    dataSourceRef.current = ds;
    return () => {
      ds.entities.removeAll();
      if (!viewer.isDestroyed()) viewer.dataSources.remove(ds);
      dataSourceRef.current = null;
    };
  }, [viewer]);

  useEffect(() => {
    const ds = dataSourceRef.current;
    if (!ds) return;
    ds.entities.removeAll();
    if (!estimate) return;
    const samples = estimateAscentPath(estimate.lon, estimate.lat, estimate.headingDeg ?? 90);
    ds.entities.add(new Entity({
      id: `ascent:${estimate.id}`,
      polyline: new PolylineGraphics({
        positions: new ConstantProperty(samples.map(s => Cartesian3.fromDegrees(s.lon, s.lat, s.altM))),
        width: new ConstantProperty(3),
        material: new PolylineGlowMaterialProperty({
          glowPower: 0.25,
          color: Color.fromCssColorString('#38bdf8').withAlpha(0.85),
        }),
      }),
    }));
  }, [estimate]);

  if (!estimate) return null;
  return (
    <div style={{
      position: 'fixed', bottom: 80, left: 56, zIndex: 90,
      color: '#38bdf8', fontFamily: 'monospace', fontSize: 10, pointerEvents: 'none',
    }}>
      ASCENT ESTIMATE · {estimate.name}
    </div>
  );
}
