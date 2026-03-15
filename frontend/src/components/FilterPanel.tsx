import { useAppStore } from '../store/useAppStore';

const CONSTELLATIONS = ['Starlink', 'ISS', 'Iridium', 'OneWeb', 'Other'];

const labelStyle: React.CSSProperties = {
  color: 'rgba(0,212,255,0.6)',
  fontSize: '10px',
  fontWeight: 600,
  letterSpacing: '0.08em',
  display: 'block',
  marginBottom: '6px',
};

const chipBase: React.CSSProperties = {
  fontFamily: 'monospace',
  fontSize: '9px',
  padding: '2px 6px',
  background: 'rgba(0,0,0,0.4)',
  border: '1px solid rgba(0,212,255,0.2)',
  borderRadius: '2px',
  color: 'rgba(0,212,255,0.55)',
  cursor: 'pointer',
  letterSpacing: '0.06em',
  lineHeight: 1.4,
  userSelect: 'none',
};

const chipActive: React.CSSProperties = {
  background: 'rgba(0,212,255,0.15)',
  border: '1px solid rgba(0,212,255,0.55)',
  color: 'rgba(0,212,255,0.95)',
};

const resetButtonStyle: React.CSSProperties = {
  marginTop: '8px',
  padding: '4px 10px',
  background: 'rgba(0,0,0,0.4)',
  border: '1px solid rgba(0,212,255,0.2)',
  borderRadius: '4px',
  color: 'rgba(0,212,255,0.7)',
  fontSize: '10px',
  cursor: 'pointer',
  letterSpacing: '0.08em',
};

export function FilterPanel() {
  const satelliteFilter = useAppStore(s => s.satelliteFilter);
  const setSatelliteFilter = useAppStore(s => s.setSatelliteFilter);

  const selected = satelliteFilter.constellation ?? [];

  function toggleConstellation(name: string) {
    const next = selected.includes(name)
      ? selected.filter(c => c !== name)
      : [...selected, name];
    setSatelliteFilter({ constellation: next.length > 0 ? next : null });
  }

  function resetSatelliteFilters() {
    setSatelliteFilter({ constellation: null, altitudeBand: null });
  }

  return (
    <div style={{ padding: '12px' }}>
      <div style={{
        color: 'rgba(0,212,255,0.5)',
        fontSize: '10px',
        fontWeight: 700,
        letterSpacing: '0.12em',
        marginBottom: '10px',
        paddingBottom: '4px',
        borderBottom: '1px solid rgba(0,212,255,0.08)',
      }}>
        SATELLITES
      </div>

      <div style={{ marginBottom: '8px' }}>
        <label style={labelStyle}>Constellation</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
          {CONSTELLATIONS.map(name => (
            <button
              key={name}
              style={{ ...chipBase, ...(selected.includes(name) ? chipActive : {}) }}
              onClick={() => toggleConstellation(name)}
            >
              {name}
            </button>
          ))}
        </div>
      </div>

      <button style={resetButtonStyle} onClick={resetSatelliteFilters}>
        RESET
      </button>
    </div>
  );
}
