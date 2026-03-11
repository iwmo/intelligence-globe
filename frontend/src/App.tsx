import { useState } from 'react';
import type { Viewer } from 'cesium';
import { GlobeView } from './components/GlobeView';
import { LeftSidebar } from './components/LeftSidebar';
import { BottomStatusBar } from './components/BottomStatusBar';
import { RightDrawer } from './components/RightDrawer';
import { SatelliteLayer } from './components/SatelliteLayer';
import { AircraftLayer } from './components/AircraftLayer';

export default function App() {
  const [cesiumViewer, setCesiumViewer] = useState<Viewer | null>(null);

  return (
    <div style={{ width: '100vw', height: '100vh', overflow: 'hidden', background: '#000000' }}>
      {/* Globe fills the entire viewport */}
      <GlobeView onViewerReady={setCesiumViewer} />
      {/* Satellite layer — renders null to DOM, manages CesiumJS primitives */}
      <SatelliteLayer viewer={cesiumViewer} />
      {/* Aircraft layer — renders null to DOM, manages aircraft CesiumJS primitives */}
      <AircraftLayer viewer={cesiumViewer} />
      {/* UI chrome overlays */}
      <LeftSidebar />
      <RightDrawer />
      <BottomStatusBar />
    </div>
  );
}
