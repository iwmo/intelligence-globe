import { useState, useRef, useEffect } from 'react';
import type { Viewer } from 'cesium';
import { GlobeView } from './components/GlobeView';
import { LeftSidebar } from './components/LeftSidebar';
import { BottomStatusBar } from './components/BottomStatusBar';
import { RightSidebar } from './components/RightSidebar';
import { SatelliteLayer } from './components/SatelliteLayer';
import { AircraftLayer } from './components/AircraftLayer';
import { MilitaryAircraftLayer } from './components/MilitaryAircraftLayer';
import { ShipLayer } from './components/ShipLayer';
import { GpsJammingLayer } from './components/GpsJammingLayer';
import { StreetTrafficLayer } from './components/StreetTrafficLayer';
import { GdeltLayer } from './components/GdeltLayer';
import { registerViewer, flyToLandmark } from './lib/viewerRegistry';
import { useSettingsStore } from './store/useSettingsStore';
import { PostProcessEngine } from './components/PostProcessEngine';
import { CinematicHUD } from './components/CinematicHUD';
import { LandmarkNav } from './components/LandmarkNav';
import { PlaybackBar } from './components/PlaybackBar';
import { OsintEventPanel } from './components/OsintEventPanel';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { useViewerClock } from './hooks/useViewerClock';
import { useViewportBbox } from './hooks/useViewportBbox';
import { useAppStore } from './store/useAppStore';
import { useGdeltPrefsStore } from './store/useGdeltPrefsStore';

export default function App() {
  const [cesiumViewer, setCesiumViewer] = useState<Viewer | null>(null);
  const [satWorker, setSatWorker] = useState<Worker | null>(null);
  const satWorkerRef = useRef<Worker | null>(null);
  const [osintPanelOpen, setOsintPanelOpen] = useState(false);
  const { cleanUI } = useAppStore();
  const gdeltOsintPrefill = useAppStore(s => s.gdeltOsintPrefill);

  useKeyboardShortcuts();
  useViewerClock(cesiumViewer);
  useViewportBbox(cesiumViewer);

  useEffect(() => {
    satWorkerRef.current = satWorker;
  }, [satWorker]);

  useEffect(() => {
    if (gdeltOsintPrefill !== null) setOsintPanelOpen(true);
  }, [gdeltOsintPrefill]);

  useEffect(() => {
    const { gdeltVisible, gdeltQuadClassFilter } = useGdeltPrefsStore.getState();
    useAppStore.getState().setLayerVisible('gdelt', gdeltVisible);
    useAppStore.getState().setGdeltQuadClassFilter(gdeltQuadClassFilter);

    return useAppStore.subscribe((state, prev) => {
      if (state.layers.gdelt !== prev.layers.gdelt ||
          state.gdeltQuadClassFilter !== prev.gdeltQuadClassFilter) {
        useGdeltPrefsStore.getState().setGdeltVisible(state.layers.gdelt);
        useGdeltPrefsStore.getState().setGdeltQuadClassFilter(state.gdeltQuadClassFilter);
      }
    });
  }, []);

  return (
    <div style={{ width: '100vw', height: '100vh', overflow: 'hidden', background: '#000000' }}>
      <GlobeView onViewerReady={(v) => {
        registerViewer(v);
        setCesiumViewer(v);
        const s = useSettingsStore.getState();
        const appStore = useAppStore.getState();
        Object.entries(s.defaultLayers).forEach(([layer, visible]) => {
          appStore.setLayerVisible(layer as keyof typeof s.defaultLayers, visible);
        });
        appStore.setVisualPreset(s.defaultPreset);
        appStore.setReplayMode(s.defaultMode);
        if (s.defaultCamera) flyToLandmark(s.defaultCamera);
      }} />

      <SatelliteLayer viewer={cesiumViewer} onWorkerReady={setSatWorker} />
      <AircraftLayer viewer={cesiumViewer} />
      <MilitaryAircraftLayer viewer={cesiumViewer} />
      <ShipLayer viewer={cesiumViewer} />
      <GpsJammingLayer viewer={cesiumViewer} />
      <StreetTrafficLayer viewer={cesiumViewer} />
      <GdeltLayer viewer={cesiumViewer} />

      <PostProcessEngine viewer={cesiumViewer} />
      <CinematicHUD viewer={cesiumViewer} />

      <PlaybackBar onOpenOsintPanel={() => setOsintPanelOpen(true)} />

      <OsintEventPanel open={osintPanelOpen} onClose={() => {
        setOsintPanelOpen(false);
        useAppStore.getState().setGdeltOsintPrefill(null);
      }} />

      {!cleanUI && <LandmarkNav viewer={cesiumViewer} />}
      {!cleanUI && <LeftSidebar workerRef={satWorkerRef} />}
      {!cleanUI && <RightSidebar />}
      {!cleanUI && <BottomStatusBar />}
    </div>
  );
}
