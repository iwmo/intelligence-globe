import { useEffect, useRef } from 'react';
import {
  Viewer,
  CustomDataSource,
  Entity,
  PointGraphics,
  Cartesian3,
  Color,
  EntityCluster,
  NearFarScalar,
} from 'cesium';
import { useGdeltEvents } from '../hooks/useGdeltEvents';
import { useAppStore } from '../store/useAppStore';

// ---------------------------------------------------------------------------
// QuadClass colour map (module-level, allocated once)
// 1 = Verbal Cooperation   → blue
// 2 = Material Cooperation → green
// 3 = Verbal Conflict      → yellow
// 4 = Material Conflict    → red
// ---------------------------------------------------------------------------
const QUAD_CLASS_COLORS: Record<number, Color> = {
  1: Color.fromCssColorString('#3B82F6'),
  2: Color.fromCssColorString('#22C55E'),
  3: Color.fromCssColorString('#EAB308'),
  4: Color.fromCssColorString('#EF4444'),
};

// ---------------------------------------------------------------------------
// GdeltLayer
//
// Renders null to the DOM. All rendering is done via a CesiumJS
// CustomDataSource with EntityCluster so GDELT event PointGraphics cluster
// automatically. DO NOT create a ScreenSpaceEventHandler here — the unified
// click handler lives in AircraftLayer to avoid the dual-pick race condition.
// ---------------------------------------------------------------------------
export function GdeltLayer({ viewer }: { viewer: Viewer | null }) {
  const { data: events } = useGdeltEvents();
  const gdeltQuadClassFilter = useAppStore(s => s.gdeltQuadClassFilter);
  const layerVisible = useAppStore(s => s.layers.gdelt);

  const dataSourceRef = useRef<CustomDataSource | null>(null);

  // Effect 1 — init DataSource (deps: [viewer])
  // Creates the CustomDataSource + EntityCluster once per viewer mount and
  // registers a cleanup that removes it from the viewer on unmount.
  useEffect(() => {
    if (!viewer || viewer.isDestroyed()) return;

    const dataSource = new CustomDataSource('gdelt');
    // Clustering disabled: clicking a cluster entity returns a synthetic cluster
    // object (no gdelt: id), making individual event selection impossible.
    // Re-enable with a clusterEvent handler if event volume grows beyond ~5k.
    dataSource.clustering = new EntityCluster({ enabled: false });

    viewer.dataSources.add(dataSource);
    dataSourceRef.current = dataSource;

    return () => {
      dataSource.entities.removeAll();
      if (!viewer.isDestroyed()) {
        viewer.dataSources.remove(dataSource);
      }
      dataSourceRef.current = null;
    };
  }, [viewer]);

  // Effect 2 — sync entities (deps: [events, gdeltQuadClassFilter, layerVisible, viewer])
  // Full rebuild on every data refresh — GDELT events are immutable once ingested.
  // ANTI-PATTERN avoided: no per-render iteration; batch set inside single effect.
  useEffect(() => {
    if (!viewer || viewer.isDestroyed() || !dataSourceRef.current) return;

    const dataSource = dataSourceRef.current;

    // Full rebuild — removeAll then re-add
    dataSource.entities.removeAll();

    // Layer visibility controls the whole data source
    dataSource.show = layerVisible;

    for (const event of events ?? []) {
      const entity = new Entity({
        id: `gdelt:${event.global_event_id}`,
        position: Cartesian3.fromDegrees(event.longitude, event.latitude, 0),
        point: new PointGraphics({
          color: QUAD_CLASS_COLORS[event.quad_class] ?? Color.WHITE,
          pixelSize: 12,
          outlineColor: Color.BLACK.withAlpha(0.4),
          outlineWidth: 1,
          show: gdeltQuadClassFilter.includes(event.quad_class),
          // Prevent depth-culling when zoomed in close to the globe surface
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
          scaleByDistance: new NearFarScalar(1e3, 1.5, 1e7, 0.8),
        }),
      });
      dataSource.entities.add(entity);
    }
  }, [events, gdeltQuadClassFilter, layerVisible, viewer]);

  return null;
}
