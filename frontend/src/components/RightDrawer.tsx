import { useAppStore } from '../store/useAppStore';
import { SatelliteDetailPanel } from './SatelliteDetailPanel';
import { AircraftDetailPanel } from './AircraftDetailPanel';

export function RightDrawer() {
  const selectedSatelliteId = useAppStore(s => s.selectedSatelliteId);
  const selectedAircraftId = useAppStore(s => s.selectedAircraftId);

  const isOpen = selectedSatelliteId !== null || selectedAircraftId !== null;

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: '120px',
      right: '12px',
      width: '240px',
      height: 'auto',
      maxHeight: '320px',
      background: 'rgba(10, 14, 20, 0.92)',
      border: '1px solid rgba(0, 212, 255, 0.2)',
      borderRadius: '6px',
      zIndex: 100,
      overflowY: 'auto',
    }}>
      {selectedSatelliteId !== null && <SatelliteDetailPanel />}
      {selectedAircraftId !== null && <AircraftDetailPanel />}
    </div>
  );
}
