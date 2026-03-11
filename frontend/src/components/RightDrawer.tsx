import { useAppStore } from '../store/useAppStore';
import { SatelliteDetailPanel } from './SatelliteDetailPanel';
import { AircraftDetailPanel } from './AircraftDetailPanel';

export function RightDrawer() {
  const selectedSatelliteId = useAppStore(s => s.selectedSatelliteId);
  const selectedAircraftId = useAppStore(s => s.selectedAircraftId);

  const isOpen = selectedSatelliteId !== null || selectedAircraftId !== null;

  const drawerWidth = 'min(300px, calc(100vw - 48px))';

  return (
    <div style={{
      position: 'absolute',
      top: 0,
      right: isOpen ? '0' : `calc(-1 * ${drawerWidth})`,
      width: drawerWidth,
      height: '100%',
      background: 'rgba(10, 14, 20, 0.92)',
      borderLeft: '1px solid rgba(0, 212, 255, 0.2)',
      transition: 'right 0.25s ease',
      zIndex: 100,
      overflowY: 'auto',
    }}>
      {selectedSatelliteId !== null && <SatelliteDetailPanel />}
      {selectedAircraftId !== null && <AircraftDetailPanel />}
    </div>
  );
}
