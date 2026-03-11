import { useState, useRef, useEffect } from 'react';
import type { Viewer } from 'cesium';
import { GlobeView } from './components/GlobeView';
import { LeftSidebar } from './components/LeftSidebar';
import { BottomStatusBar } from './components/BottomStatusBar';
import { RightDrawer } from './components/RightDrawer';
import { SatelliteLayer } from './components/SatelliteLayer';
import { AircraftLayer } from './components/AircraftLayer';
import { registerViewer } from './lib/viewerRegistry';

export default function App() {
  const [cesiumViewer, setCesiumViewer] = useState<Viewer | null>(null);
  const [satWorker, setSatWorker] = useState<Worker | null>(null);
  const satWorkerRef = useRef<Worker | null>(null);

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
      {/* UI chrome overlays */}
      <LeftSidebar workerRef={satWorkerRef} />
      <RightDrawer />
      <BottomStatusBar />
    </div>
  );
}
