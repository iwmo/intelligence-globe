import { useEffect, useRef, useState } from 'react';
import {
  Ion,
  Viewer,
  Color,
  EllipsoidTerrainProvider,
  UrlTemplateImageryProvider,
  ScreenSpaceEventHandler,
  ScreenSpaceEventType,
  Cartesian2,
  Cartesian3,
  Cartographic,
  defined,
} from 'cesium';
import 'cesium/Build/Cesium/Widgets/widgets.css';
import '../styles/globe.css';

interface GlobeViewProps {
  onViewerReady?: (viewer: Viewer) => void;
}

export function GlobeView({ onViewerReady }: GlobeViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<Viewer | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!containerRef.current || viewerRef.current) return;

    // Only use ion token if one is actually provided
    const ionToken = import.meta.env.VITE_CESIUM_ION_TOKEN as string | undefined;
    if (ionToken) Ion.defaultAccessToken = ionToken;

    const container = containerRef.current;

    async function initViewer() {
      try {
        if (!containerRef.current || viewerRef.current) return;

        // ESRI World Imagery — high-resolution satellite photos, free, no token
        const imageryProvider = new UrlTemplateImageryProvider({
          url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
          maximumLevel: 19,
          credit: 'Tiles © Esri — Source: Esri, Maxar, Earthstar Geographics',
        });

        if (!containerRef.current || viewerRef.current) return;

        const viewer = new Viewer(containerRef.current, {
          animation: false,
          baseLayerPicker: false,
          fullscreenButton: false,
          geocoder: false,
          homeButton: false,
          infoBox: false,
          sceneModePicker: false,
          selectionIndicator: false,
          timeline: false,
          navigationHelpButton: false,
          useDefaultRenderLoop: true,
          // Flat ellipsoid terrain — no ion token required
          terrainProvider: new EllipsoidTerrainProvider(),
          baseLayer: false, // we'll add imagery ourselves below
        });

        // Add the bundled imagery layer
        viewer.imageryLayers.addImageryProvider(imageryProvider);

        // Cinematic settings
        viewer.scene.globe.enableLighting = true;
        viewer.scene.globe.dynamicAtmosphereLighting = true;
        viewer.scene.backgroundColor = Color.BLACK;
        viewer.scene.screenSpaceCameraController.enableZoom = true;

        // Guard resize — viewer may have been destroyed by StrictMode cleanup
        const rafId = requestAnimationFrame(() => {
          if (viewerRef.current && !viewerRef.current.isDestroyed()) {
            viewerRef.current.resize();
          }
        });

        viewerRef.current = viewer;
        onViewerReady?.(viewer);

        // NAV-01: Remove CesiumJS built-in entity-tracking double-click BEFORE
        // registering custom handler. Without this, two conflicting camera flights
        // fire simultaneously (STATE.md locked decision).
        viewer.cesiumWidget.screenSpaceEventHandler.removeInputAction(
          ScreenSpaceEventType.LEFT_DOUBLE_CLICK
        );

        // NAV-01: Register custom double-click zoom toward cursor point
        const dblHandler = new ScreenSpaceEventHandler(viewer.scene.canvas);
        dblHandler.setInputAction((event: { position: Cartesian2 }) => {
          // Primary: pick terrain/water surface position
          let picked: Cartesian3 | undefined = viewer.scene.pickPosition(event.position);

          // Fallback: if pickPosition fails (e.g. billboard/entity surface, sky edge),
          // project click to nearest ellipsoid point. This handles entities where
          // scene.pickPosition returns undefined (pitfall 3 from research).
          if (!defined(picked)) {
            const ellipsoidPick = viewer.scene.camera.pickEllipsoid(event.position);
            picked = ellipsoidPick ?? undefined;
          }

          // Sky guard: if still undefined, click hit sky — do nothing (NAV-01 requirement)
          if (!picked) return;

          const carto = Cartographic.fromCartesian(picked);
          const currentAlt = viewer.camera.positionCartographic.height;
          // Zoom ~2.5x per double-click; 500m minimum prevents zooming into terrain
          const targetAlt = Math.max(500, currentAlt * 0.4);

          viewer.camera.flyTo({
            destination: Cartesian3.fromRadians(carto.longitude, carto.latitude, targetAlt),
            duration: 0.6,
            orientation: {
              heading: viewer.camera.heading,
              pitch: viewer.camera.pitch,
              roll: 0,
            },
          });
        }, ScreenSpaceEventType.LEFT_DOUBLE_CLICK);

        // Direct wheel handler — bypasses CesiumJS canvas-level listener
        const onWheel = (e: WheelEvent) => {
          e.preventDefault();
          const v = viewerRef.current;
          if (!v || v.isDestroyed()) return;
          const altitude = v.camera.positionCartographic.height;
          const zoomStep = altitude * 0.12;
          if (e.deltaY > 0) v.camera.zoomOut(zoomStep);
          else v.camera.zoomIn(zoomStep);
        };

        container.addEventListener('wheel', onWheel, { passive: false });

        (viewer as unknown as { _cleanup?: () => void; _dblHandler?: ScreenSpaceEventHandler })._dblHandler = dblHandler;
        (viewer as unknown as { _cleanup?: () => void })._cleanup = () => {
          container.removeEventListener('wheel', onWheel);
          cancelAnimationFrame(rafId);
          dblHandler.destroy(); // cleanup double-click handler
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error('CesiumJS init error:', err);
        setError(msg);
      }
    }

    initViewer();

    return () => {
      const v = viewerRef.current;
      if (v) {
        (v as unknown as { _cleanup?: () => void })._cleanup?.();
        if (!v.isDestroyed()) v.destroy();
        viewerRef.current = null;
      }
    };
  }, []);

  if (error) {
    return (
      <div style={{
        position: 'absolute', inset: 0, background: '#000', color: '#ff4444',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexDirection: 'column', fontFamily: 'monospace', padding: '2rem', zIndex: 999,
      }}>
        <div style={{ fontSize: '18px', marginBottom: '1rem' }}>CesiumJS Error</div>
        <div style={{ fontSize: '13px', maxWidth: '600px', wordBreak: 'break-all' }}>{error}</div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      id="cesiumContainer"
      style={{ width: '100%', height: '100%' }}
    />
  );
}
