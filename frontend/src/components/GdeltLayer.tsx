import { useEffect, useRef } from 'react';
import {
  Viewer,
  CustomDataSource,
  Entity,
  PointGraphics,
  ConstantProperty,
  Cartesian3,
  Color,
  EntityCluster,
  HeightReference,
} from 'cesium';
import { QUAD_CLASS_HEX } from '../data/gdeltColors';
import { useGdeltEvents } from '../hooks/useGdeltEvents';
import { useAppStore } from '../store/useAppStore';

// ---------------------------------------------------------------------------
// QuadClass colour map (module-level, allocated once)
// Derived from the canonical QUAD_CLASS_HEX palette in gdeltColors.ts so that
// PlaybackBar (Plan 02) can share the same hex values for CSS backgrounds.
// ---------------------------------------------------------------------------
const QUAD_CLASS_COLORS: Record<number, Color> = Object.fromEntries(
  Object.entries(QUAD_CLASS_HEX).map(([k, hex]) => [Number(k), Color.fromCssColorString(hex)])
);

// ---------------------------------------------------------------------------
// GdeltLayer
//
// Renders null to the DOM (or a GEO STALE indicator if source data is stale).
// All globe rendering is done via a CesiumJS CustomDataSource.
//
// Effect 1: init DataSource (deps: [viewer])
// Effect 2: sync entities on new data (deps: [events, gdeltQuadClassFilter, layerVisible, viewer])
// Effect 3: per-tick temporal visibility (deps: [replayTs, replayMode, gdeltQuadClassFilter])
//
// DO NOT create a ScreenSpaceEventHandler here — the unified click handler
// lives in AircraftLayer to avoid the dual-pick race condition.
// ---------------------------------------------------------------------------
export function GdeltLayer({ viewer }: { viewer: Viewer | null }) {
  const { data: events } = useGdeltEvents();
  const gdeltQuadClassFilter = useAppStore(s => s.gdeltQuadClassFilter);
  const layerVisible = useAppStore(s => s.layers.gdelt);
  const replayMode = useAppStore(s => s.replayMode);
  const replayTs = useAppStore(s => s.replayTs);

  const dataSourceRef = useRef<CustomDataSource | null>(null);

  // Maps for Effect 3: keyed on global_event_id (without the 'gdelt:' prefix)
  const tsMapRef = useRef<Map<string, number>>(new Map());
  const quadMapRef = useRef<Map<string, number>>(new Map());

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
  // Effect 3 owns temporal visibility; Effect 2 only sets initial QuadClass show state.
  // ANTI-PATTERN avoided: no per-render iteration; batch set inside single effect.
  useEffect(() => {
    if (!viewer || viewer.isDestroyed() || !dataSourceRef.current) return;

    const dataSource = dataSourceRef.current;

    // Clear temporal/quad maps before rebuild
    tsMapRef.current.clear();
    quadMapRef.current.clear();

    // Full rebuild — removeAll then re-add
    dataSource.entities.removeAll();

    // Layer visibility controls the whole data source
    dataSource.show = layerVisible;

    for (const event of events ?? []) {
      // Populate per-event maps for Effect 3 lookups
      // Always use String() to guard against numeric ids in test fixtures vs real string ids.
      const evtKey = String(event.global_event_id);
      tsMapRef.current.set(evtKey, new Date(event.occurred_at).getTime());
      quadMapRef.current.set(evtKey, event.quad_class);

      const entity = new Entity({
        id: `gdelt:${event.global_event_id}`,
        position: Cartesian3.fromDegrees(event.longitude, event.latitude, 0),
        point: new PointGraphics({
          color: QUAD_CLASS_COLORS[event.quad_class] ?? Color.WHITE,
          pixelSize: 12,
          outlineColor: Color.BLACK.withAlpha(0.4),
          outlineWidth: 1,
          // Initial show based on QuadClass filter only; temporal state is set by Effect 3
          show: gdeltQuadClassFilter.includes(event.quad_class),
          // CLAMP_TO_GROUND pins the point to the terrain surface.
          // No disableDepthTestDistance — depth testing hides dots on the
          // far side of the globe and CLAMP_TO_GROUND handles terrain occlusion.
          heightReference: HeightReference.CLAMP_TO_GROUND,
        }),
      });
      dataSource.entities.add(entity);
    }
  }, [events, gdeltQuadClassFilter, layerVisible, viewer]);

  // Effect 3 — per-tick temporal visibility (deps: [replayTs, replayMode, gdeltQuadClassFilter])
  // Runs on every scrubber tick. Updates entity.point.show based on occurred_at vs replayTs.
  // Does NOT rebuild entities — tsMapRef/quadMapRef are the O(1) lookup tables.
  // In live mode, currentTs = Infinity so all events are visible.
  useEffect(() => {
    const ds = dataSourceRef.current;
    if (!ds) return;
    const currentTs = replayMode === 'live' ? Infinity : replayTs;
    for (const entity of ds.entities.values) {
      if (!entity.point) continue;
      const evtId = entity.id?.replace('gdelt:', '');
      if (!evtId) continue;
      const occurredAt = tsMapRef.current.get(evtId);
      const quadClass  = quadMapRef.current.get(evtId);
      const temporalOk  = occurredAt !== undefined ? occurredAt <= currentTs : true;
      const quadClassOk = quadClass !== undefined
        ? gdeltQuadClassFilter.includes(quadClass)
        : true;
      // ConstantProperty wraps a plain boolean so CesiumJS tracks it correctly
      // for entities initialised with a plain boolean show at construction time.
      entity.point.show = new ConstantProperty(temporalOk && quadClassOk);
    }
  }, [replayTs, replayMode, gdeltQuadClassFilter]);

  // Stale indicator: render a fixed overlay when any event reports a stale source
  const sourceIsStale = events?.some(e => e.source_is_stale) ?? false;

  if (layerVisible && sourceIsStale) {
    return (
      <div style={{
        position: 'fixed', top: '85px', right: '12px', zIndex: 100,
        background: 'rgba(245, 158, 11, 0.15)',
        border: '1px solid #F59E0B', color: '#F59E0B',
        fontFamily: 'monospace', fontSize: '10px', fontWeight: 700,
        padding: '2px 6px', borderRadius: '3px', pointerEvents: 'none',
      }}>
        GEO STALE
      </div>
    );
  }

  return null;
}
