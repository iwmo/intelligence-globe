import { useEffect, useRef } from 'react';
import { Viewer, CustomDataSource, Entity, PointGraphics, ConstantProperty, Cartesian3, Color } from 'cesium';
import { useEarthquakes } from '../hooks/useEarthquakes';
import { useAppStore } from '../store/useAppStore';

function magColor(mag: number | null): Color {
  if (mag == null) return Color.fromCssColorString('#facc15');
  if (mag >= 6) return Color.fromCssColorString('#ef4444');
  if (mag >= 4) return Color.fromCssColorString('#f97316');
  return Color.fromCssColorString('#facc15');
}

export function EarthquakeLayer({ viewer }: { viewer: Viewer | null }) {
  const { data } = useEarthquakes();
  const visible = useAppStore(s => s.layers.earthquakes);
  const dataSourceRef = useRef<CustomDataSource | null>(null);

  useEffect(() => {
    if (!viewer || viewer.isDestroyed()) return;
    const ds = new CustomDataSource('earthquakes');
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
    for (const ev of data?.events ?? []) {
      ds.entities.add(new Entity({
        id: `quake:${ev.id}`,
        position: Cartesian3.fromDegrees(ev.lon, ev.lat),
        point: new PointGraphics({
          pixelSize: new ConstantProperty(Math.max(6, Math.min(16, 6 + (ev.mag ?? 0) * 1.4))),
          color: new ConstantProperty(magColor(ev.mag)),
          outlineColor: new ConstantProperty(Color.BLACK),
          outlineWidth: new ConstantProperty(1),
        }),
      }));
    }
  }, [data, visible]);

  if (visible && data?.source_is_stale) {
    return (
      <div style={{
        position: 'fixed', bottom: 48, left: 56, zIndex: 90,
        color: '#facc15', fontFamily: 'monospace', fontSize: 10, pointerEvents: 'none',
      }}>USGS STALE</div>
    );
  }
  return null;
}
