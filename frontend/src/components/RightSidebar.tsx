import { useEffect, type CSSProperties } from 'react';
import { Compass, Map, Rocket, Settings, Users, ZoomIn, ZoomOut } from 'lucide-react';
import { ContactsRoster } from './ContactsRoster';
import { LaunchesRoster } from './LaunchesRoster';
import { useAppStore, type RightPanel } from '../store/useAppStore';
import { SatelliteDetailPanel } from './SatelliteDetailPanel';
import { AircraftDetailPanel } from './AircraftDetailPanel';
import { MilitaryDetailPanel } from './MilitaryDetailPanel';
import { ShipDetailPanel } from './ShipDetailPanel';
import { CameraControlWidget } from './CameraControlWidget';
import { SettingsPanel } from './SettingsPanel';
import { GdeltDetailPanel } from './GdeltDetailPanel';
import { MapTypePanel } from './MapTypePanel';
import { zoomStep } from '../lib/viewerRegistry';
import { DEFAULT_RIGHT_PANEL_WIDTH } from '../lib/panelWidth';
import { OperationalDrawer } from './shell/OperationalDrawer';
import './context-inspector.css';

const ENTITY_COLORS: Record<string, string> = {
  'SATELLITE':   '#00D4FF',
  'AIRCRAFT':    '#FF8C00',
  'MILITARY':    '#F59E0B',
  'VESSEL':      '#06B6D4',
  'GDELT EVENT': '#EAB308',
};

const RAIL_ITEMS = [
  { id: 'contacts' as const, label: 'Contacts', icon: <Users aria-hidden="true" /> },
  { id: 'launches' as const, label: 'Launches', icon: <Rocket aria-hidden="true" /> },
  { id: 'camera' as const, label: 'Camera controls', icon: <Compass aria-hidden="true" /> },
  { id: 'map' as const, label: 'Map configuration', icon: <Map aria-hidden="true" /> },
  { id: 'settings' as const, label: 'Settings (,)', icon: <Settings aria-hidden="true" /> },
];

export function RightSidebar() {
  const activeRightTab = useAppStore(s => s.activeRightPanel);
  const setActiveRightTab = useAppStore(s => s.setActiveRightPanel);

  const selectedSatelliteId  = useAppStore(s => s.selectedSatelliteId);
  const selectedAircraftId   = useAppStore(s => s.selectedAircraftId);
  const selectedMilitaryId   = useAppStore(s => s.selectedMilitaryId);
  const selectedShipId       = useAppStore(s => s.selectedShipId);
  const selectedGdeltEventId = useAppStore(s => s.selectedGdeltEventId);
  const clearSelection = useAppStore(s => s.clearSelection);

  // Keyboard shortcut: , for settings
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === ',') {
        const current = useAppStore.getState().activeRightPanel;
        useAppStore.getState().setActiveRightPanel(current === 'settings' ? null : 'settings');
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const hasEntity =
    selectedSatelliteId  !== null ||
    selectedAircraftId   !== null ||
    selectedMilitaryId   !== null ||
    selectedShipId       !== null ||
    selectedGdeltEventId !== null;

  const panelOpen = hasEntity || activeRightTab !== null;

  const entityType =
    selectedSatelliteId  !== null ? 'SATELLITE'    :
    selectedAircraftId   !== null ? 'AIRCRAFT'     :
    selectedMilitaryId   !== null ? 'MILITARY'     :
    selectedShipId       !== null ? 'VESSEL'       :
    selectedGdeltEventId !== null ? 'GDELT EVENT'  : null;

  const tabTitle =
    activeRightTab === 'camera'   ? 'CAMERA'   :
    activeRightTab === 'settings' ? 'SETTINGS' :
    activeRightTab === 'map'      ? 'MAP LAYER' :
    activeRightTab === 'contacts' ? 'CONTACTS'  :
    activeRightTab === 'launches' ? 'LAUNCHES'  : '';
  const headerTitle = tabTitle || (entityType ? `SELECTION · ${entityType}` : 'CONTEXT INSPECTOR');
  const headerColor = tabTitle
    ? 'var(--status-connecting)'
    : (ENTITY_COLORS[entityType ?? ''] ?? 'var(--status-connecting)');

  function handleClose() {
    if (activeRightTab !== null) {
      setActiveRightTab(null);
      return;
    }
    clearSelection();
  }

  function handleRightTabClick(tab: NonNullable<RightPanel>) {
    setActiveRightTab(activeRightTab === tab ? null : tab);
  }

  return (
    <OperationalDrawer
      side="right"
      title={headerTitle}
      open={panelOpen}
      activeItem={activeRightTab}
      items={RAIL_ITEMS}
      widthKey="right-panel-width"
      defaultWidth={DEFAULT_RIGHT_PANEL_WIDTH}
      accent={headerColor}
      onItemClick={handleRightTabClick}
      onClose={handleClose}
      railFooter={
        <>
          {entityType && (
            <button
              type="button"
              className="operational-drawer__rail-button context-inspector__selection-button"
              style={{ '--selection-color': ENTITY_COLORS[entityType] } as CSSProperties}
              title={`Return to ${entityType.toLowerCase()} selection`}
              aria-label={`Return to ${entityType.toLowerCase()} selection`}
              data-active={activeRightTab === null}
              onClick={() => setActiveRightTab(null)}
            >
              <span className="context-inspector__selection-indicator" />
            </button>
          )}
          <button
            type="button"
            className="operational-drawer__rail-button"
            onClick={() => zoomStep('in')}
            aria-label="Zoom in"
            title="Zoom in"
          >
            <ZoomIn aria-hidden="true" />
          </button>
          <button
            type="button"
            className="operational-drawer__rail-button"
            onClick={() => zoomStep('out')}
            aria-label="Zoom out"
            title="Zoom out"
          >
            <ZoomOut aria-hidden="true" />
          </button>
        </>
      }
    >
      <div className="context-inspector">
          {activeRightTab === 'camera'   && <CameraControlWidget />}
          {activeRightTab === 'settings' && <SettingsPanel />}
          {activeRightTab === 'map'      && <MapTypePanel />}
          {activeRightTab === 'contacts' && <ContactsRoster />}
          {activeRightTab === 'launches' && <LaunchesRoster />}
          {activeRightTab === null && selectedSatelliteId  !== null && <SatelliteDetailPanel />}
          {activeRightTab === null && selectedAircraftId   !== null && <AircraftDetailPanel />}
          {activeRightTab === null && selectedMilitaryId   !== null && <MilitaryDetailPanel />}
          {activeRightTab === null && selectedShipId       !== null && <ShipDetailPanel />}
          {activeRightTab === null && selectedGdeltEventId !== null && <GdeltDetailPanel />}
      </div>
    </OperationalDrawer>
  );
}
