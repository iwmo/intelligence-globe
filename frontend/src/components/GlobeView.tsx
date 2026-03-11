import { useEffect, useRef } from 'react';
import {
  Ion,
  Viewer,
  createWorldTerrainAsync,
  Color,
} from 'cesium';
import 'cesium/Build/Cesium/Widgets/widgets.css';
import '../styles/globe.css';

export function GlobeView() {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<Viewer | null>(null);

  useEffect(() => {
    if (!containerRef.current || viewerRef.current) return;

    const ionToken = import.meta.env.VITE_CESIUM_ION_TOKEN as string | undefined;
    Ion.defaultAccessToken = ionToken ?? '';

    async function initViewer() {
      if (!containerRef.current) return;

      const terrainProvider = ionToken
        ? await createWorldTerrainAsync()
        : undefined;

      // Guard again after await — StrictMode may have unmounted
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
        terrainProvider,
      });

      // Cinematic settings
      viewer.scene.globe.enableLighting = true;
      viewer.scene.globe.dynamicAtmosphereLighting = true;
      viewer.scene.backgroundColor = Color.BLACK;

      // Force resize so canvas dimensions match container after CSS positioning
      viewer.resize();

      viewerRef.current = viewer;
    }

    initViewer();

    return () => {
      if (viewerRef.current && !viewerRef.current.isDestroyed()) {
        viewerRef.current.destroy();
        viewerRef.current = null;
      }
    };
  }, []);

  return (
    <div
      ref={containerRef}
      id="cesiumContainer"
      style={{ width: '100%', height: '100%' }}
    />
  );
}
