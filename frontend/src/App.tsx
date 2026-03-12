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
import { registerViewer } from './lib/viewerRegistry';
import { PostProcessEngine } from './components/PostProcessEngine';
import { PostProcessPanel } from './components/PostProcessPanel';
import { CinematicHUD } from './components/CinematicHUD';
import { LandmarkNav } from './components/LandmarkNav';
import { PlaybackBar } from './components/PlaybackBar';
import { OsintEventPanel } from './components/OsintEventPanel';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { useAppStore } from './store/useAppStore';

export default function App() {
  const [cesiumViewer, setCesiumViewer] = useState<Viewer | null>(null);
  const [satWorker, setSatWorker] = useState<Worker | null>(null);
  const satWorkerRef = useRef<Worker | null>(null);
  const [osintPanelOpen, setOsintPanelOpen] = useState(false);
  const { cleanUI } = useAppStore();

  useKeyboardShortcuts();

  useEffect(() => {
    satWorkerRef.current = satWorker;
  }, [satWorker]);

  return (
    <div style={{ width: '100vw', height: '100vh', overflow: 'hidden', background: '#000000' }}>
      {/* Globe fills the entire viewport */}
      <GlobeView onViewerReady={(v) => { registerViewer(v); setCesiumViewer(v); }} />
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

      {/* UI chrome overlays — gated by cleanUI (VIS-04) */}
      {!cleanUI && <LeftSidebar workerRef={satWorkerRef} />}
      {!cleanUI && <RightDrawer />}
      {!cleanUI && <BottomStatusBar />}

      {/* Phase 7: Post-process control panel — left side, below hamburger */}
      {!cleanUI && (
        <div style={{
          position: 'fixed',
          top: '84px',
          left: '12px',
          zIndex: 75,
        }}>
          <PostProcessPanel />
        </div>
      )}
    </div>
  );
}
