import { useEffect, useRef } from 'react';
import { Viewer, CustomDataSource, Entity, PointGraphics, ConstantProperty, Cartesian3, Color } from 'cesium';
import { useLaunches } from '../hooks/useLaunches';
import { useAppStore } from '../store/useAppStore';

export function LaunchLayer({ viewer }: { viewer: Viewer | null }) {
  const { data } = useLaunches();
  const visible = useAppStore(s => s.layers.launches);
  const dataSourceRef = useRef<CustomDataSource | null>(null);

  useEffect(() => {
    if (!viewer || viewer.isDestroyed()) return;
    const ds = new CustomDataSource('launches');
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
    if (!visible) return;
    for (const launch of data?.launches ?? []) {
      if (launch.lat == null || launch.lon == null) continue;
      ds.entities.add(new Entity({
        id: `launch:${launch.id}`,
        position: Cartesian3.fromDegrees(launch.lon, launch.lat),
        point: new PointGraphics({
          pixelSize: new ConstantProperty(8),
          color: new ConstantProperty(Color.fromCssColorString('#38bdf8')),
          outlineColor: new ConstantProperty(Color.WHITE),
          outlineWidth: new ConstantProperty(1),
        }),
      }));
    }
  }, [data, visible]);

  return null;
}
