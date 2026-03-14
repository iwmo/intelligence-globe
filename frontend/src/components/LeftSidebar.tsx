import type { RefObject } from 'react';
import { Satellite, Plane, ShieldAlert, Anchor, Radio, Car, Zap } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { SearchBar } from './SearchBar';
import { FilterPanel } from './FilterPanel';
import { PostProcessPanel } from './PostProcessPanel';
import { DraggablePanel } from './DraggablePanel';

interface LeftSidebarProps {
  workerRef: RefObject<Worker | null>;
}

export function LeftSidebar({ workerRef }: LeftSidebarProps) {
  const { layers, setLayerVisible, gdeltQuadClassFilter, toggleGdeltQuadClass } = useAppStore();

  return (
    <>
      <DraggablePanel id="layers" title="LAYERS" defaultPos={{ x: 12, y: 40 }}>
        <div style={{ padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
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
          <LayerToggleButton
            label="GEO"
            active={layers.gdelt}
            icon={<Zap size={12} />}
            onToggle={() => setLayerVisible('gdelt', !layers.gdelt)}
          />
          {layers.gdelt && (
            <div style={{ marginTop: '6px', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '5px' }}>
              <div style={{ color: '#666', fontSize: '9px', marginBottom: '4px', letterSpacing: '0.05em' }}>QUAD CLASS</div>
              {([1, 2, 3, 4] as const).map(qc => {
                const labels: Record<number, string> = { 1: 'V.COOP', 2: 'M.COOP', 3: 'V.CONF', 4: 'M.CONF' };
                const colors: Record<number, string> = { 1: '#3B82F6', 2: '#22C55E', 3: '#EAB308', 4: '#EF4444' };
                const active = gdeltQuadClassFilter.includes(qc);
                return (
                  <button
                    key={qc}
                    onClick={() => toggleGdeltQuadClass(qc)}
                    style={{
                      display: 'block',
                      width: '100%',
                      padding: '2px 6px',
                      marginBottom: '2px',
                      background: active ? `${colors[qc]}22` : 'transparent',
                      border: `1px solid ${active ? colors[qc] : 'rgba(255,255,255,0.15)'}`,
                      color: active ? colors[qc] : '#666',
                      fontFamily: 'monospace',
                      fontSize: '9px',
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    {labels[qc]}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </DraggablePanel>

      <DraggablePanel id="search" title="SEARCH" defaultPos={{ x: 12, y: 220 }}>
        <SearchBar workerRef={workerRef} />
      </DraggablePanel>

      <DraggablePanel id="filters" title="FILTERS" defaultPos={{ x: 12, y: 340 }}>
        <FilterPanel />
      </DraggablePanel>

      <DraggablePanel id="visual-engine" title="VISUAL ENGINE" defaultPos={{ x: 12, y: 520 }}>
        <div style={{ padding: '4px 0' }}>
          <PostProcessPanel />
        </div>
      </DraggablePanel>
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
        width: '100%',
      }}
    >
      {icon}
      {label}
    </button>
  );
}
