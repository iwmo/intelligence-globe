import { useState, useRef, useEffect } from 'react';
import type { Viewer } from 'cesium';
import { GlobeView } from './components/GlobeView';
import { LeftSidebar } from './components/LeftSidebar';
import { BottomStatusBar } from './components/BottomStatusBar';
import { RightDrawer } from './components/RightDrawer';
import { SatelliteLayer } from './components/SatelliteLayer';
import { AircraftLayer } from './components/AircraftLayer';
import { MilitaryAircraftLayer } from './components/MilitaryAircraftLayer';
import { ShipLayer } from './components/ShipLayer';
import { GpsJammingLayer } from './components/GpsJammingLayer';
import { StreetTrafficLayer } from './components/StreetTrafficLayer';
import { registerViewer, flyToLandmark } from './lib/viewerRegistry';
import { useSettingsStore } from './store/useSettingsStore';
import { PostProcessEngine } from './components/PostProcessEngine';
import { CinematicHUD } from './components/CinematicHUD';
import { LandmarkNav } from './components/LandmarkNav';
import { PlaybackBar } from './components/PlaybackBar';
import { OsintEventPanel } from './components/OsintEventPanel';
import { SettingsPanel } from './components/SettingsPanel';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { useAppStore } from './store/useAppStore';
import { CameraControlWidget } from './components/CameraControlWidget';
import { Settings } from 'lucide-react';

export default function App() {
  const [cesiumViewer, setCesiumViewer] = useState<Viewer | null>(null);
  const [satWorker, setSatWorker] = useState<Worker | null>(null);
  const satWorkerRef = useRef<Worker | null>(null);
  const [osintPanelOpen, setOsintPanelOpen] = useState(false);
  const [settingsPanelOpen, setSettingsPanelOpen] = useState(false);
  const { cleanUI } = useAppStore();

  useKeyboardShortcuts();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === ',') setSettingsPanelOpen(v => !v);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  useEffect(() => {
    satWorkerRef.current = satWorker;
  }, [satWorker]);

  return (
    <div style={{ width: '100vw', height: '100vh', overflow: 'hidden', background: '#000000' }}>
      {/* Globe fills the entire viewport */}
      <GlobeView onViewerReady={(v) => {
        registerViewer(v);
        setCesiumViewer(v);
        // Apply persisted settings defaults after viewer is live
        const s = useSettingsStore.getState();
        const appStore = useAppStore.getState();
        Object.entries(s.defaultLayers).forEach(([layer, visible]) => {
          appStore.setLayerVisible(layer as keyof typeof s.defaultLayers, visible);
        });
        appStore.setVisualPreset(s.defaultPreset);
        appStore.setReplayMode(s.defaultMode);
        if (s.defaultCamera) {
          flyToLandmark(s.defaultCamera);
        }
      }} />
      {/* Satellite layer — renders null to DOM, manages CesiumJS primitives */}
      <SatelliteLayer viewer={cesiumViewer} onWorkerReady={setSatWorker} />
      {/* Aircraft layer — renders null to DOM, manages aircraft CesiumJS primitives */}
      <AircraftLayer viewer={cesiumViewer} />
      {/* Phase 8: Military aircraft layer — amber dots, manages own visibility via store */}
      <MilitaryAircraftLayer viewer={cesiumViewer} />
      {/* Phase 8: Ship layer — cyan dots, manages own visibility via store */}
      <ShipLayer viewer={cesiumViewer} />
      {/* Phase 9: GPS Jamming layer — H3 hexagons, manages own visibility via store */}
      <GpsJammingLayer viewer={cesiumViewer} />
      {/* Phase 9: Street Traffic layer — particle dots on roads, manages own visibility via store */}
      <StreetTrafficLayer viewer={cesiumViewer} />

      {/* Phase 7: Post-processing (invisible, manages WebGL stages) */}
      <PostProcessEngine viewer={cesiumViewer} />

      {/* Phase 7: HUD — ALWAYS rendered, not gated by cleanUI */}
      <CinematicHUD viewer={cesiumViewer} />

      {/* Phase 7: Navigation bar — visible in both modes */}
      <LandmarkNav viewer={cesiumViewer} />

      {/* Phase 11: PlaybackBar — ALWAYS rendered, not gated by cleanUI */}
      <PlaybackBar onOpenOsintPanel={() => setOsintPanelOpen(true)} />

      {/* Phase 12: OsintEventPanel — ALWAYS mounted, controlled by osintPanelOpen state */}
      <OsintEventPanel open={osintPanelOpen} onClose={() => setOsintPanelOpen(false)} />

      {/* Phase 15: Camera control widget — zoom +/− and tilt presets — unconditional like LandmarkNav */}
      <CameraControlWidget />

      {/* Phase 16: Gear icon — always visible, not gated by cleanUI so settings are always reachable */}
      <button
        onClick={() => setSettingsPanelOpen(v => !v)}
        title="Settings (,)"
        style={{
          position: 'fixed',
          bottom: '200px',
          right: '12px',
          zIndex: 1000,
          background: 'rgba(0,0,0,0.7)',
          border: '1px solid rgba(0,212,255,0.3)',
          borderRadius: '4px',
          color: 'rgba(0,212,255,0.8)',
          cursor: 'pointer',
          width: '32px',
          height: '32px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 0,
        }}
        aria-label="Open settings"
      >
        <Settings size={16} />
      </button>

      {/* Phase 16: Settings panel — unmount-based toggle (not display:none) */}
      {settingsPanelOpen && <SettingsPanel onClose={() => setSettingsPanelOpen(false)} />}

      {/* UI chrome overlays — gated by cleanUI (VIS-04) */}
      {!cleanUI && <LeftSidebar workerRef={satWorkerRef} />}
      {!cleanUI && <RightDrawer />}
      {!cleanUI && <BottomStatusBar />}

    </div>
  );
}
