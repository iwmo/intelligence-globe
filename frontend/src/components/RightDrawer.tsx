import { useAppStore } from '../store/useAppStore';
import { SatelliteDetailPanel } from './SatelliteDetailPanel';
import { AircraftDetailPanel } from './AircraftDetailPanel';
import { MilitaryDetailPanel } from './MilitaryDetailPanel';
import { ShipDetailPanel } from './ShipDetailPanel';
import { DraggablePanel } from './DraggablePanel';

export function RightDrawer() {
  const selectedSatelliteId = useAppStore(s => s.selectedSatelliteId);
  const selectedAircraftId = useAppStore(s => s.selectedAircraftId);
  const selectedMilitaryId = useAppStore(s => s.selectedMilitaryId);
  const selectedShipId = useAppStore(s => s.selectedShipId);
  const setSelectedSatelliteId = useAppStore(s => s.setSelectedSatelliteId);
  const setSelectedAircraftId = useAppStore(s => s.setSelectedAircraftId);
  const setSelectedMilitaryId = useAppStore(s => s.setSelectedMilitaryId);
  const setSelectedShipId = useAppStore(s => s.setSelectedShipId);

  const isOpen =
    selectedSatelliteId !== null ||
    selectedAircraftId !== null ||
    selectedMilitaryId !== null ||
    selectedShipId !== null;

  if (!isOpen) return null;

  const title =
    selectedSatelliteId !== null ? 'SATELLITE' :
    selectedAircraftId !== null ? 'AIRCRAFT' :
    selectedMilitaryId !== null ? 'MILITARY' :
    'VESSEL';

  function handleClose() {
    setSelectedSatelliteId(null);
    setSelectedAircraftId(null);
    setSelectedMilitaryId(null);
    setSelectedShipId(null);
  }

  const defaultX = typeof window !== 'undefined' ? window.innerWidth - 252 : 1668;

  return (
    <DraggablePanel
      id="detail-panel"
      title={title}
      defaultPos={{ x: defaultX, y: 120 }}
      defaultWidth={240}
      minWidth={180}
      onClose={handleClose}
    >
      {selectedSatelliteId !== null && <SatelliteDetailPanel />}
      {selectedAircraftId !== null && <AircraftDetailPanel />}
      {selectedMilitaryId !== null && <MilitaryDetailPanel />}
      {selectedShipId !== null && <ShipDetailPanel />}
    </DraggablePanel>
  );
}
