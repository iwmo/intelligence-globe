import { useEffect, useRef, useState } from 'react';
import {
  Ion,
  Viewer,
  Color,
  EllipsoidTerrainProvider,
  TileMapServiceImageryProvider,
  buildModuleUrl,
} from 'cesium';
import 'cesium/Build/Cesium/Widgets/widgets.css';
import '../styles/globe.css';

export function GlobeView() {
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

        // Bundled NaturalEarth II — no ion token required
        const imageryProvider = await TileMapServiceImageryProvider.fromUrl(
          buildModuleUrl('Assets/Textures/NaturalEarthII'),
          { fileExtension: 'jpg' }
        );

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

        (viewer as unknown as { _cleanup?: () => void })._cleanup = () => {
          container.removeEventListener('wheel', onWheel);
          cancelAnimationFrame(rafId);
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
