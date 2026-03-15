import React, { useState } from 'react';
import type { RefObject } from 'react';
import { Layers, Search, SlidersHorizontal, Monitor } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { SearchBar } from './SearchBar';
import { FilterPanel } from './FilterPanel';
import { PostProcessPanel } from './PostProcessPanel';
import { zoomStep } from '../lib/viewerRegistry';

type LeftTab = 'layers' | 'search' | 'filters' | 'visual' | null;

const TAB_TITLES: Record<NonNullable<LeftTab>, string> = {
  layers: 'LAYERS',
  search: 'SEARCH',
  filters: 'FILTERS',
  visual: 'VISUAL ENGINE',
};

function loadTab(): LeftTab {
  try { return JSON.parse(localStorage.getItem('left-sidebar-tab') ?? 'null') as LeftTab; }
  catch { return null; }
}

interface LeftSidebarProps {
  workerRef: RefObject<Worker | null>;
}

export function LeftSidebar({ workerRef }: LeftSidebarProps) {
  const [activeTab, setActiveTab] = useState<LeftTab>(() => loadTab());
  const cleanUI = useAppStore(s => s.cleanUI);
  const setCleanUI = useAppStore(s => s.setCleanUI);

  function handleTabClick(tab: NonNullable<LeftTab>) {
    const next: LeftTab = activeTab === tab ? null : tab;
    setActiveTab(next);
    try { localStorage.setItem('left-sidebar-tab', JSON.stringify(next)); } catch {}
  }

  const panelOpen = activeTab !== null;

  return (
    <>
      {/* Left icon rail — always visible when !cleanUI */}
      <div style={{
        position: 'fixed',
        left: 0,
        top: 26,
        bottom: 28,
        width: 40,
        zIndex: 200,
        background: 'rgba(0,0,0,0.92)',
        borderRight: '1px solid rgba(0,212,255,0.15)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        paddingTop: 8,
        gap: 2,
      }}>
        <TabIcon id="layers"  icon={<Layers size={16} />}            activeTab={activeTab} onTabClick={handleTabClick} tooltip="Layers" />
        <TabIcon id="search"  icon={<Search size={16} />}            activeTab={activeTab} onTabClick={handleTabClick} tooltip="Search" />
        <TabIcon id="filters" icon={<SlidersHorizontal size={16} />} activeTab={activeTab} onTabClick={handleTabClick} tooltip="Filters" />
        <TabIcon id="visual"  icon={<Monitor size={16} />}           activeTab={activeTab} onTabClick={handleTabClick} tooltip="Visual Engine" />

        <div style={{ flex: 1 }} />

        {/* Zoom controls */}
        <button onClick={() => zoomStep('in')}  title="Zoom in"  style={zoomBtnStyle}>+</button>
        <button onClick={() => zoomStep('out')} title="Zoom out" style={{ ...zoomBtnStyle, marginBottom: 6 }}>−</button>

        {/* Clean UI toggle */}
        <button
          onClick={() => setCleanUI(!cleanUI)}
          title="Clean UI"
          style={{
            width: 40,
            height: 26,
            background: 'none',
            border: 'none',
            borderTop: '1px solid rgba(0,212,255,0.1)',
            color: 'rgba(255,255,255,0.3)',
            cursor: 'pointer',
            fontSize: 8,
            fontFamily: 'monospace',
            letterSpacing: '0.05em',
            marginBottom: 2,
          }}
        >
          CLEAN
        </button>
      </div>

      {/* Sliding left panel */}
      <div style={{
        position: 'fixed',
        left: 40,
        top: 26,
        bottom: 28,
        width: panelOpen ? 260 : 0,
        zIndex: 190,
        background: 'rgba(0,0,0,0.90)',
        borderRight: panelOpen ? '1px solid rgba(0,212,255,0.15)' : 'none',
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
          pointerEvents: panelOpen ? 'auto' : 'none',
        }}>
          <span style={{
            fontFamily: 'monospace',
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: '0.15em',
            color: 'rgba(0,212,255,0.75)',
            whiteSpace: 'nowrap',
          }}>
            {activeTab ? TAB_TITLES[activeTab] : ''}
          </span>
          <button
            onClick={() => activeTab && handleTabClick(activeTab)}
            style={{
              background: 'none',
              border: '1px solid rgba(0,212,255,0.25)',
              borderRadius: 2,
              color: 'rgba(0,212,255,0.6)',
              cursor: 'pointer',
              fontSize: 11,
              width: 20,
              height: 20,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 0,
              flexShrink: 0,
            }}
          >←</button>
        </div>

        {/* Scrollable content */}
        <div className="intel-panel-scroll" style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
          {activeTab === 'layers'  && <LayersTabContent />}
          {activeTab === 'search'  && <SearchBar workerRef={workerRef} />}
          {activeTab === 'filters' && <FilterPanel />}
          {activeTab === 'visual'  && <div style={{ padding: '4px 0' }}><PostProcessPanel /></div>}
        </div>
      </div>
    </>
  );
}

interface TabIconProps {
  id: NonNullable<LeftTab>;
  icon: React.ReactNode;
  activeTab: LeftTab;
  onTabClick: (tab: NonNullable<LeftTab>) => void;
  tooltip: string;
}

function TabIcon({ id, icon, activeTab, onTabClick, tooltip }: TabIconProps) {
  const isActive = activeTab === id;
  return (
    <button
      title={tooltip}
      onClick={() => onTabClick(id)}
      style={{
        width: 40,
        height: 38,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: isActive ? 'rgba(0,212,255,0.12)' : 'transparent',
        border: 'none',
        borderRight: `2px solid ${isActive ? '#00D4FF' : 'transparent'}`,
        color: isActive ? '#00D4FF' : 'rgba(255,255,255,0.4)',
        cursor: 'pointer',
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

function LayersTabContent() {
  const { layers, setLayerVisible, gdeltQuadClassFilter, toggleGdeltQuadClass } = useAppStore();

  const LAYER_BUTTONS = [
    { key: 'satellites'      as const, label: 'SAT',  icon: '◉' },
    { key: 'aircraft'        as const, label: 'AIR',  icon: '✈' },
    { key: 'militaryAircraft'as const, label: 'MIL',  icon: '⚔' },
    { key: 'ships'           as const, label: 'SHIP', icon: '⚓' },
    { key: 'gpsJamming'      as const, label: 'JAM',  icon: '⚡' },
    { key: 'streetTraffic'   as const, label: 'TFC',  icon: '🚗' },
    { key: 'gdelt'           as const, label: 'GEO',  icon: '⬡' },
  ] as const;

  return (
    <div style={{ padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 5 }}>
      {LAYER_BUTTONS.map(({ key, label }) => {
        const active = layers[key];
        return (
          <button
            key={key}
            onClick={() => setLayerVisible(key, !active)}
            title={`Toggle ${label} layer`}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 10px',
              background: active ? 'rgba(0,212,255,0.15)' : 'rgba(0,0,0,0.5)',
              border: `1px solid ${active ? 'rgba(0,212,255,0.6)' : 'rgba(255,255,255,0.12)'}`,
              borderRadius: 3,
              cursor: 'pointer',
              color: active ? '#00D4FF' : 'rgba(255,255,255,0.4)',
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: '0.08em',
              fontFamily: 'monospace',
              transition: 'all 0.15s ease',
              width: '100%',
            }}
          >
            <span style={{ fontSize: 10, opacity: 0.7 }}>
              {active ? '●' : '○'}
            </span>
            {label}
          </button>
        );
      })}

      {layers.gdelt && (
        <div style={{ marginTop: 6, borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 5 }}>
          <div style={{ color: '#555', fontSize: 9, marginBottom: 4, letterSpacing: '0.05em', fontFamily: 'monospace' }}>
            QUAD CLASS
          </div>
          {([1, 2, 3, 4] as const).map(qc => {
            const labels: Record<number, string> = { 1: 'VERBAL COOP', 2: 'MAT COOP', 3: 'VERBAL CONF', 4: 'MAT CONF' };
            const colors: Record<number, string> = { 1: '#3B82F6', 2: '#22C55E', 3: '#EAB308', 4: '#EF4444' };
            const active = gdeltQuadClassFilter.includes(qc);
            return (
              <button
                key={qc}
                onClick={() => toggleGdeltQuadClass(qc)}
                style={{
                  display: 'block',
                  width: '100%',
                  padding: '3px 8px',
                  marginBottom: 2,
                  background: active ? `${colors[qc]}22` : 'transparent',
                  border: `1px solid ${active ? colors[qc] : 'rgba(255,255,255,0.12)'}`,
                  color: active ? colors[qc] : '#555',
                  fontFamily: 'monospace',
                  fontSize: 9,
                  cursor: 'pointer',
                  textAlign: 'left',
                  borderRadius: 2,
                }}
              >
                {labels[qc]}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
