import { useEffect, useRef } from 'react';
import { Viewer, CustomDataSource, Entity, PointGraphics, ConstantProperty, Cartesian3, Color } from 'cesium';
import { useFires } from '../hooks/useFires';
import { useAppStore } from '../store/useAppStore';

export function FireLayer({ viewer }: { viewer: Viewer | null }) {
  const { data } = useFires();
  const visible = useAppStore(s => s.layers.fires);
  const bbox = useAppStore(s => s.viewportBbox);
  const dataSourceRef = useRef<CustomDataSource | null>(null);
  const span = bbox ? Math.max(bbox.maxLat - bbox.minLat, bbox.maxLon - bbox.minLon) : Infinity;

  useEffect(() => {
    if (!viewer || viewer.isDestroyed()) return;
    const ds = new CustomDataSource('fires');
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
    if (!visible || !data?.available || span > 10) return;
    for (const cell of data.cells) {
      ds.entities.add(new Entity({
        id: `fire:${cell.id}`,
        position: Cartesian3.fromDegrees(cell.lon, cell.lat),
        point: new PointGraphics({
          pixelSize: new ConstantProperty(5),
          color: new ConstantProperty(Color.fromCssColorString('#ff4d00').withAlpha(0.85)),
        }),
      }));
    }
  }, [data, visible, span]);

  if (!visible) return null;
  if (data && data.available === false) {
    return (
      <div style={{
        position: 'fixed', bottom: 48, left: 56, zIndex: 90,
        color: '#fb923c', fontFamily: 'monospace', fontSize: 10, pointerEvents: 'none',
      }}>FIRMS KEY NEEDED</div>
    );
  }
  if (span > 10) {
    return (
      <div style={{
        position: 'fixed', bottom: 48, left: 56, zIndex: 90,
        color: '#fb923c', fontFamily: 'monospace', fontSize: 10, pointerEvents: 'none',
      }}>FIRES · ZOOM IN</div>
    );
  }
  return null;
}
