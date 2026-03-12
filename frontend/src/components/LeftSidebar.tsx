import type { RefObject } from 'react';
import { Satellite, Plane, ShieldAlert, Anchor, Radio, Car } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { SearchBar } from './SearchBar';
import { FilterPanel } from './FilterPanel';
import { CollapsibleSection } from './CollapsibleSection';
import { PostProcessPanel } from './PostProcessPanel';

interface LeftSidebarProps {
  workerRef: RefObject<Worker | null>;
}

export function LeftSidebar({ workerRef }: LeftSidebarProps) {
  const { sidebarOpen, setSidebarOpen, layers, setLayerVisible, sidebarSections, toggleSidebarSection } = useAppStore();

  return (
    <>
      {/* Hamburger button — always visible top-left */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        title={sidebarOpen ? 'Close panel' : 'Open panel'}
        style={{
          position: 'fixed', top: '32px', left: '12px', zIndex: 85,
          display: 'flex', flexDirection: 'column', gap: '4px',
          padding: '8px', background: 'rgba(0,0,0,0.75)',
          border: '1px solid rgba(0,212,255,0.25)', borderRadius: '4px',
          cursor: 'pointer',
        }}
      >
        {[0, 1, 2].map((i) => (
          <span key={i} style={{ display: 'block', width: '16px', height: '2px', background: 'rgba(0,212,255,0.8)' }} />
        ))}
      </button>

      {/* Persistent layer toggle strip — always visible bottom-left */}
      <div style={{
        position: 'fixed', bottom: '40px', left: '12px',
        display: 'flex', flexDirection: 'column', gap: '6px', zIndex: 60,
      }}>
        <LayerToggleButton
          label="SAT"
          active={layers.satellites}
          icon={<Satellite size={12} />}
          onToggle={() => setLayerVisible('satellites', !layers.satellites)}
        />
        <LayerToggleButton
          label="AIR"
          active={layers.aircraft}
          icon={<Plane size={12} />}
          onToggle={() => setLayerVisible('aircraft', !layers.aircraft)}
        />
        <LayerToggleButton
          label="MIL"
          active={layers.militaryAircraft}
          icon={<ShieldAlert size={12} />}
          onToggle={() => setLayerVisible('militaryAircraft', !layers.militaryAircraft)}
        />
        <LayerToggleButton
          label="SHIP"
          active={layers.ships}
          icon={<Anchor size={12} />}
          onToggle={() => setLayerVisible('ships', !layers.ships)}
        />
        <LayerToggleButton
          label="JAM"
          active={layers.gpsJamming}
          icon={<Radio size={12} />}
          onToggle={() => setLayerVisible('gpsJamming', !layers.gpsJamming)}
        />
        <LayerToggleButton
          label="TFC"
          active={layers.streetTraffic}
          icon={<Car size={12} />}
          onToggle={() => setLayerVisible('streetTraffic', !layers.streetTraffic)}
        />
      </div>

      {/* Sliding sidebar panel */}
      {sidebarOpen && (
        <div
          style={{
            position: 'fixed', left: 0, top: 0, bottom: '32px',
            width: 'min(280px, calc(100vw - 24px))',
            background: 'rgba(0,0,0,0.92)',
            borderRight: '1px solid rgba(0,212,255,0.15)',
            zIndex: 50,
            overflowY: 'auto',
          }}
        >
          {/* LAYERS section */}
          <CollapsibleSection
            title="LAYERS"
            open={sidebarSections.layers}
            onToggle={() => toggleSidebarSection('layers')}
          >
            <div style={{ padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <LayerToggleButton
                label="SAT"
                active={layers.satellites}
                icon={<Satellite size={12} />}
                onToggle={() => setLayerVisible('satellites', !layers.satellites)}
              />
              <LayerToggleButton
                label="AIR"
                active={layers.aircraft}
                icon={<Plane size={12} />}
                onToggle={() => setLayerVisible('aircraft', !layers.aircraft)}
              />
              <LayerToggleButton
                label="MIL"
                active={layers.militaryAircraft}
                icon={<ShieldAlert size={12} />}
                onToggle={() => setLayerVisible('militaryAircraft', !layers.militaryAircraft)}
              />
              <LayerToggleButton
                label="SHIP"
                active={layers.ships}
                icon={<Anchor size={12} />}
                onToggle={() => setLayerVisible('ships', !layers.ships)}
              />
              <LayerToggleButton
                label="JAM"
                active={layers.gpsJamming}
                icon={<Radio size={12} />}
                onToggle={() => setLayerVisible('gpsJamming', !layers.gpsJamming)}
              />
              <LayerToggleButton
                label="TFC"
                active={layers.streetTraffic}
                icon={<Car size={12} />}
                onToggle={() => setLayerVisible('streetTraffic', !layers.streetTraffic)}
              />
            </div>
          </CollapsibleSection>

          {/* SEARCH section */}
          <CollapsibleSection
            title="SEARCH"
            open={sidebarSections.search}
            onToggle={() => toggleSidebarSection('search')}
          >
            <SearchBar workerRef={workerRef} />
          </CollapsibleSection>

          {/* FILTERS section */}
          <CollapsibleSection
            title="FILTERS"
            open={sidebarSections.filters}
            onToggle={() => toggleSidebarSection('filters')}
          >
            <FilterPanel />
          </CollapsibleSection>

          {/* VISUAL ENGINE section */}
          <CollapsibleSection
            title="VISUAL ENGINE"
            open={sidebarSections.visualEngine}
            onToggle={() => toggleSidebarSection('visualEngine')}
          >
            <div style={{ padding: '4px 0' }}>
              <PostProcessPanel />
            </div>
          </CollapsibleSection>
        </div>
      )}
    </>
  );
}

interface LayerToggleButtonProps {
  label: string;
  active: boolean;
  icon: React.ReactNode;
  onToggle: () => void;
}

function LayerToggleButton({ label, active, icon, onToggle }: LayerToggleButtonProps) {
  return (
    <button
      onClick={onToggle}
      title={`Toggle ${label} layer`}
      style={{
        display: 'flex', alignItems: 'center', gap: '6px',
        padding: '6px 10px',
        background: active ? 'rgba(0,212,255,0.15)' : 'rgba(0,0,0,0.7)',
        border: `1px solid ${active ? 'rgba(0,212,255,0.6)' : 'rgba(255,255,255,0.15)'}`,
        borderRadius: '4px', cursor: 'pointer',
        color: active ? '#00D4FF' : 'rgba(255,255,255,0.4)',
        fontSize: '11px', fontWeight: 600, letterSpacing: '0.08em',
        transition: 'all 0.15s ease',
      }}
    >
      {icon}
      {label}
    </button>
  );
}
