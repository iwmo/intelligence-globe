import { GlobeView } from './components/GlobeView';
import { LeftSidebar } from './components/LeftSidebar';
import { BottomStatusBar } from './components/BottomStatusBar';
import { RightDrawer } from './components/RightDrawer';

export default function App() {
  return (
    <div style={{ width: '100vw', height: '100vh', overflow: 'hidden', background: '#000000' }}>
      {/* Globe fills the entire viewport */}
      <GlobeView />
      {/* UI chrome overlays */}
      <LeftSidebar />
      <RightDrawer />
      <BottomStatusBar />
    </div>
  );
}
