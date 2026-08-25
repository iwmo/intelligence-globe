import React, { useState, useRef, useEffect } from 'react';
import { Compass, Settings, Map, Users, Rocket } from 'lucide-react';
import { ContactsRoster } from './ContactsRoster';
import { LaunchesRoster } from './LaunchesRoster';
import { useAppStore } from '../store/useAppStore';
import { SatelliteDetailPanel } from './SatelliteDetailPanel';
import { AircraftDetailPanel } from './AircraftDetailPanel';
import { MilitaryDetailPanel } from './MilitaryDetailPanel';
import { ShipDetailPanel } from './ShipDetailPanel';
import { CameraControlWidget } from './CameraControlWidget';
import { SettingsPanel } from './SettingsPanel';
import { GdeltDetailPanel } from './GdeltDetailPanel';
import { MapTypePanel } from './MapTypePanel';
import { zoomStep } from '../lib/viewerRegistry';
import { DEFAULT_RIGHT_PANEL_WIDTH, clampPanelWidth, loadStoredPanelWidth } from '../lib/panelWidth';

type RightTab = 'camera' | 'settings' | 'map' | 'contacts' | 'launches' | null;

const ENTITY_COLORS: Record<string, string> = {
  'SATELLITE':   '#00D4FF',
  'AIRCRAFT':    '#FF8C00',
  'MILITARY':    '#F59E0B',
  'VESSEL':      '#06B6D4',
  'GDELT EVENT': '#EAB308',
};

function loadPanelWidth(): number {
  return loadStoredPanelWidth('right-panel-width', DEFAULT_RIGHT_PANEL_WIDTH);
}

export function RightSidebar() {
  const [activeRightTab, setActiveRightTab] = useState<RightTab>(null);
  const [panelWidth, setPanelWidth] = useState<number>(loadPanelWidth);
  const panelWidthRef = useRef(panelWidth);
  panelWidthRef.current = panelWidth;

  useEffect(() => {
    try { localStorage.setItem('right-panel-width', String(panelWidth)); } catch {}
  }, [panelWidth]);

  useEffect(() => {
    const onResize = () => {
      setPanelWidth(w => clampPanelWidth(w, DEFAULT_RIGHT_PANEL_WIDTH, window.innerWidth));
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

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

  const [railHover, setRailHover] = useState(false);
  const panelOpen = hasEntity || activeRightTab !== null;
  const railExpanded = railHover || panelOpen;
  const railWidth = railExpanded ? 40 : 8;

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
  const headerTitle = tabTitle || entityType || '';
  const headerColor = tabTitle
    ? 'rgba(0,212,255,0.75)'
    : (ENTITY_COLORS[entityType ?? ''] ?? 'rgba(0,212,255,0.75)');

  function handleClose() {
    clearSelection();
    setActiveRightTab(null);
  }

  function handleRightTabClick(tab: NonNullable<RightTab>) {
    setActiveRightTab(prev => prev === tab ? null : tab);
  }

  function startResize(e: React.MouseEvent) {
    e.preventDefault();
    const startX = e.clientX;
    const startW = panelWidthRef.current;
    function onMove(ev: MouseEvent) {
      const newW = clampPanelWidth(startW - (ev.clientX - startX), DEFAULT_RIGHT_PANEL_WIDTH, window.innerWidth);
      setPanelWidth(newW);
    }
    function onUp() {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    }
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }

  return (
    <>
      {/* Right icon rail — collapsed to an 8px hit edge until hover or a panel is open */}
      <div
        onMouseEnter={() => setRailHover(true)}
        onMouseLeave={() => setRailHover(false)}
        style={{
        position: 'fixed',
        right: 0,
        top: 0,
        bottom: 0,
        width: railWidth,
        zIndex: 200,
        background: railExpanded ? 'rgba(0,0,0,0.92)' : 'rgba(0,0,0,0.25)',
        borderLeft: railExpanded ? '1px solid rgba(255,255,255,0.12)' : '1px solid rgba(255,255,255,0.06)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        paddingTop: 8,
        gap: 2,
        overflow: 'hidden',
        transition: 'width 0.16s ease',
      }}>
        <RightTabIcon
          id="camera"
          icon={<Compass size={16} />}
          activeTab={activeRightTab}
          onTabClick={handleRightTabClick}
          tooltip="Camera"
        />
        <RightTabIcon
          id="settings"
          icon={<Settings size={16} />}
          activeTab={activeRightTab}
          onTabClick={handleRightTabClick}
          tooltip="Settings (,)"
        />
        <RightTabIcon
          id="map"
          icon={<Map size={16} />}
          activeTab={activeRightTab}
          onTabClick={handleRightTabClick}
          tooltip="Map Layer"
        />
        <RightTabIcon
          id="contacts"
          icon={<Users size={16} />}
          activeTab={activeRightTab}
          onTabClick={handleRightTabClick}
          tooltip="Contacts"
        />
        <RightTabIcon
          id="launches"
          icon={<Rocket size={16} />}
          activeTab={activeRightTab}
          onTabClick={handleRightTabClick}
          tooltip="Launches"
        />

        <div style={{ flex: 1 }} />

        {/* Entity type indicator dot when entity selected */}
        {entityType && (
          <div style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: ENTITY_COLORS[entityType],
            marginBottom: 4,
            boxShadow: `0 0 6px ${ENTITY_COLORS[entityType]}`,
          }} />
        )}

        {/* Zoom controls */}
        <button onClick={() => zoomStep('in')}  title="Zoom in"  style={zoomBtnStyle}>+</button>
        <button onClick={() => zoomStep('out')} title="Zoom out" style={{ ...zoomBtnStyle, marginBottom: 6 }}>−</button>
      </div>

      {/* Context panel */}
      <div style={{
        position: 'fixed',
        right: railWidth,
        top: 36,
        bottom: 48,
        width: panelOpen ? panelWidth : 0,
        zIndex: 190,
        background: 'rgba(0,0,0,0.90)',
        borderLeft: panelOpen ? '1px solid rgba(0,212,255,0.15)' : 'none',
        overflow: 'hidden',
        boxSizing: 'border-box',
        transition: panelOpen ? 'none' : 'width 0.22s cubic-bezier(0.4,0,0.2,1)',
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

        {/* Resize handle */}
        {panelOpen && (
          <div
            onMouseDown={startResize}
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              bottom: 0,
              width: 4,
              cursor: 'col-resize',
              background: 'transparent',
              zIndex: 10,
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = 'rgba(0,212,255,0.25)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = 'transparent'; }}
          />
        )}
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

const zoomBtnStyle: React.CSSProperties = {
  width: 32,
  height: 26,
  background: 'transparent',
  border: '1px solid rgba(0,212,255,0.2)',
  borderRadius: 3,
  color: '#00D4FF',
  cursor: 'pointer',
  fontFamily: 'monospace',
  fontSize: 16,
  lineHeight: 1,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 0,
  marginBottom: 2,
};
