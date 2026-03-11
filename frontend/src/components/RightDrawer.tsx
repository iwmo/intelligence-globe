import { useAppStore } from '../store/useAppStore';
import { SatelliteDetailPanel } from './SatelliteDetailPanel';

export function RightDrawer() {
  const selectedId = useAppStore(s => s.selectedSatelliteId);

  return (
    <div style={{
      position: 'absolute',
      top: 0,
      right: selectedId !== null ? 0 : '-320px',
      width: '300px',
      height: '100%',
      background: 'rgba(10, 14, 20, 0.92)',
      borderLeft: '1px solid rgba(0, 212, 255, 0.2)',
      transition: 'right 0.25s ease',
      zIndex: 100,
      overflowY: 'auto',
    }}>
      <SatelliteDetailPanel />
    </div>
  );
}
