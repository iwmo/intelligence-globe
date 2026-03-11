import { useState, useRef, useEffect } from 'react';
import type { Viewer } from 'cesium';
import { GlobeView } from './components/GlobeView';
import { LeftSidebar } from './components/LeftSidebar';
import { BottomStatusBar } from './components/BottomStatusBar';
import { RightDrawer } from './components/RightDrawer';
import { SatelliteLayer } from './components/SatelliteLayer';
import { AircraftLayer } from './components/AircraftLayer';
import { registerViewer } from './lib/viewerRegistry';
import { PostProcessEngine } from './components/PostProcessEngine';
import { PostProcessPanel } from './components/PostProcessPanel';
import { CinematicHUD } from './components/CinematicHUD';
import { LandmarkNav } from './components/LandmarkNav';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { useAppStore } from './store/useAppStore';

export default function App() {
  const [cesiumViewer, setCesiumViewer] = useState<Viewer | null>(null);
  const [satWorker, setSatWorker] = useState<Worker | null>(null);
  const satWorkerRef = useRef<Worker | null>(null);
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

      {/* Phase 7: Post-processing (invisible, manages WebGL stages) */}
      <PostProcessEngine viewer={cesiumViewer} />

      {/* Phase 7: HUD — ALWAYS rendered, not gated by cleanUI */}
      <CinematicHUD viewer={cesiumViewer} />

      {/* Phase 7: Navigation bar — visible in both modes */}
      <LandmarkNav viewer={cesiumViewer} />

      {/* UI chrome overlays — gated by cleanUI (VIS-04) */}
      {!cleanUI && <LeftSidebar workerRef={satWorkerRef} />}
      {!cleanUI && <RightDrawer />}
      {!cleanUI && <BottomStatusBar />}

      {/* Phase 7: Post-process control panel — floating panel (RightDrawer has no children slot) */}
      {!cleanUI && (
        <div style={{
          position: 'fixed',
          top: '80px',
          right: '12px',
          zIndex: 70,
        }}>
          <PostProcessPanel />
        </div>
      )}
    </div>
  );
}
