import { useEffect, useRef } from 'react';
import { Cartesian3, Color, ConstantProperty, CustomDataSource, Entity, PointGraphics, type Viewer } from 'cesium';
import { useInstallations, installationsViewportOk } from '../hooks/useInstallations';
import { useAppStore } from '../store/useAppStore';

const KIND_COLOR: Record<string, string> = {
  airfield: '#e2e8f0',
  plant: '#fbbf24',
  dam: '#38bdf8',
  datacenter: '#c084fc',
  prison: '#fb7185',
  site: '#94a3b8',
};

export function InstallationLayer({ viewer }: { viewer: Viewer | null }) {
  const { data } = useInstallations();
  const visible = useAppStore(s => s.layers.installations);
  const bbox = useAppStore(s => s.viewportBbox);
  const dataSourceRef = useRef<CustomDataSource | null>(null);
  const clipped = installationsViewportOk(bbox);

  useEffect(() => {
    if (!viewer || viewer.isDestroyed()) return;
    const ds = new CustomDataSource('installations');
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
    if (!visible || !clipped) return;
    for (const row of data ?? []) {
      ds.entities.add(new Entity({
        id: `osm:${row.id}`,
        position: Cartesian3.fromDegrees(row.lon, row.lat),
        point: new PointGraphics({
          pixelSize: new ConstantProperty(6),
          color: new ConstantProperty(Color.fromCssColorString(KIND_COLOR[row.kind] ?? KIND_COLOR.site)),
          outlineColor: new ConstantProperty(Color.BLACK),
          outlineWidth: new ConstantProperty(1),
        }),
      }));
    }
  }, [data, visible, clipped]);

  if (visible && !clipped) {
    return (
      <div style={{
        position: 'fixed', bottom: 64, left: 56, zIndex: 90,
        color: '#94a3b8', fontFamily: 'monospace', fontSize: 10, pointerEvents: 'none',
      }}>INSTALLATIONS · ZOOM IN</div>
    );
  }
  return null;
}
