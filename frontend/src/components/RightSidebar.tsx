import React, { useState, useEffect } from 'react';
import { Compass, Settings } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { SatelliteDetailPanel } from './SatelliteDetailPanel';
import { AircraftDetailPanel } from './AircraftDetailPanel';
import { MilitaryDetailPanel } from './MilitaryDetailPanel';
import { ShipDetailPanel } from './ShipDetailPanel';
import { CameraControlWidget } from './CameraControlWidget';
import { SettingsPanel } from './SettingsPanel';
import { GdeltDetailPanel } from './GdeltDetailPanel';

type RightTab = 'camera' | 'settings' | null;

const ENTITY_COLORS: Record<string, string> = {
  'SATELLITE':   '#00D4FF',
  'AIRCRAFT':    '#FF8C00',
  'MILITARY':    '#F59E0B',
  'VESSEL':      '#06B6D4',
  'GDELT EVENT': '#EAB308',
};

export function RightSidebar() {
  const [activeRightTab, setActiveRightTab] = useState<RightTab>(null);

  const selectedSatelliteId  = useAppStore(s => s.selectedSatelliteId);
  const selectedAircraftId   = useAppStore(s => s.selectedAircraftId);
  const selectedMilitaryId   = useAppStore(s => s.selectedMilitaryId);
  const selectedShipId       = useAppStore(s => s.selectedShipId);
  const selectedGdeltEventId = useAppStore(s => s.selectedGdeltEventId);
  const setSelectedSatelliteId  = useAppStore(s => s.setSelectedSatelliteId);
  const setSelectedAircraftId   = useAppStore(s => s.setSelectedAircraftId);
  const setSelectedMilitaryId   = useAppStore(s => s.setSelectedMilitaryId);
  const setSelectedShipId       = useAppStore(s => s.setSelectedShipId);
  const setSelectedGdeltEventId = useAppStore(s => s.setSelectedGdeltEventId);

  // Keyboard shortcut: , for settings
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === ',') setActiveRightTab(t => t === 'settings' ? null : 'settings');
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

  const headerTitle = entityType ?? (
    activeRightTab === 'camera'   ? 'CAMERA'   :
    activeRightTab === 'settings' ? 'SETTINGS' : ''
  );
  const headerColor = ENTITY_COLORS[entityType ?? ''] ?? 'rgba(0,212,255,0.75)';

  function handleClose() {
    setSelectedSatelliteId(null);
    setSelectedAircraftId(null);
    setSelectedMilitaryId(null);
    setSelectedShipId(null);
    setSelectedGdeltEventId(null);
    setActiveRightTab(null);
  }

  function handleRightTabClick(tab: NonNullable<RightTab>) {
    if (hasEntity) return;
    setActiveRightTab(prev => prev === tab ? null : tab);
  }

  return (
    <>
      {/* Right icon rail */}
      <div style={{
        position: 'fixed',
        right: 0,
        top: 26,
        bottom: 28,
        width: 40,
        zIndex: 200,
        background: 'rgba(0,0,0,0.92)',
        borderLeft: '1px solid rgba(0,212,255,0.15)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        paddingTop: 8,
        gap: 2,
      }}>
        <RightTabIcon
          id="camera"
          icon={<Compass size={16} />}
          activeTab={hasEntity ? null : activeRightTab}
          onTabClick={handleRightTabClick}
          tooltip="Camera"
          disabled={hasEntity}
        />
        <RightTabIcon
          id="settings"
          icon={<Settings size={16} />}
          activeTab={hasEntity ? null : activeRightTab}
          onTabClick={handleRightTabClick}
          tooltip="Settings (,)"
          disabled={hasEntity}
        />

        <div style={{ flex: 1 }} />

        {/* Entity type indicator dot when entity selected */}
        {entityType && (
          <div style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: ENTITY_COLORS[entityType],
            marginBottom: 12,
            boxShadow: `0 0 6px ${ENTITY_COLORS[entityType]}`,
          }} />
        )}
      </div>

      {/* Context panel */}
      <div style={{
        position: 'fixed',
        right: 40,
        top: 62,
        bottom: 28,
        width: panelOpen ? 280 : 0,
        zIndex: 190,
        background: 'rgba(0,0,0,0.90)',
        borderLeft: panelOpen ? '1px solid rgba(0,212,255,0.15)' : 'none',
        overflow: 'hidden',
        transition: 'width 0.22s cubic-bezier(0.4,0,0.2,1)',
        display: 'flex',
        flexDirection: 'column',
      }}>
        {/* Panel header */}
        <div style={{
          height: 36,
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 12px',
          borderBottom: '1px solid rgba(0,212,255,0.12)',
          opacity: panelOpen ? 1 : 0,
          transition: 'opacity 0.15s ease',
        }}>
          <span style={{
            fontFamily: 'monospace',
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: '0.15em',
            color: headerColor,
            whiteSpace: 'nowrap',
          }}>
            {headerTitle}
          </span>
          <button
            onClick={handleClose}
            style={{
              background: 'none',
              border: '1px solid rgba(0,212,255,0.25)',
              borderRadius: 2,
              color: 'rgba(0,212,255,0.6)',
              cursor: 'pointer',
              width: 20,
              height: 20,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 13,
              lineHeight: 1,
              padding: 0,
              flexShrink: 0,
            }}
          >×</button>
        </div>

        {/* Scrollable content */}
        <div className="intel-panel-scroll" style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
          {selectedSatelliteId  !== null && <SatelliteDetailPanel />}
          {selectedAircraftId   !== null && <AircraftDetailPanel />}
          {selectedMilitaryId   !== null && <MilitaryDetailPanel />}
          {selectedShipId       !== null && <ShipDetailPanel />}
          {selectedGdeltEventId !== null && <GdeltDetailPanel />}
          {!hasEntity && activeRightTab === 'camera'   && <CameraControlWidget />}
          {!hasEntity && activeRightTab === 'settings' && <SettingsPanel />}
        </div>
      </div>
    </>
  );
}

interface RightTabIconProps {
  id: NonNullable<RightTab>;
  icon: React.ReactNode;
  activeTab: RightTab;
  onTabClick: (tab: NonNullable<RightTab>) => void;
  tooltip: string;
  disabled?: boolean;
}

function RightTabIcon({ id, icon, activeTab, onTabClick, tooltip, disabled }: RightTabIconProps) {
  const isActive = activeTab === id;
  return (
    <button
      title={tooltip}
      onClick={() => !disabled && onTabClick(id)}
      style={{
        width: 40,
        height: 38,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: isActive ? 'rgba(0,212,255,0.12)' : 'transparent',
        border: 'none',
        borderLeft: `2px solid ${isActive ? '#00D4FF' : 'transparent'}`,
        color: disabled ? 'rgba(255,255,255,0.2)' : (isActive ? '#00D4FF' : 'rgba(255,255,255,0.4)'),
        cursor: disabled ? 'default' : 'pointer',
        transition: 'all 0.12s ease',
        flexShrink: 0,
        padding: 0,
      }}
    >
      {icon}
    </button>
  );
}
