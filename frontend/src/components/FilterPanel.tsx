import { useAppStore } from '../store/useAppStore';

const inputStyle: React.CSSProperties = {
  background: 'rgba(0,0,0,0.4)',
  border: '1px solid rgba(0,212,255,0.2)',
  color: '#e0e0e0',
  fontSize: '11px',
  borderRadius: '4px',
  padding: '4px 8px',
};

const selectStyle: React.CSSProperties = {
  ...inputStyle,
  width: '100%',
};

const labelStyle: React.CSSProperties = {
  color: 'rgba(0,212,255,0.6)',
  fontSize: '10px',
  fontWeight: 600,
  letterSpacing: '0.08em',
  display: 'block',
  marginBottom: '4px',
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

// API serves LEO-only (mean_motion >= 11.25 rev/day, altitude < 2000 km)
const ALTITUDE_BANDS: Record<string, [number, number]> = {
  'LEO': [0, 2000],
};

export function FilterPanel() {
  const satelliteFilter = useAppStore(s => s.satelliteFilter);
  const setSatelliteFilter = useAppStore(s => s.setSatelliteFilter);

  const handleConstellationChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setSatelliteFilter({ constellation: val === 'All' ? null : val });
  };

  const resetSatelliteFilters = () => {
    setSatelliteFilter({ constellation: null, altitudeBand: null });
  };

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
        <select
          style={selectStyle}
          value={satelliteFilter.constellation ?? 'All'}
          onChange={handleConstellationChange}
        >
          <option value="All">All</option>
          <option value="Starlink">Starlink</option>
          <option value="ISS">ISS</option>
          <option value="Iridium">Iridium</option>
          <option value="OneWeb">OneWeb</option>
          <option value="Other">Other</option>
        </select>
      </div>

      <button style={resetButtonStyle} onClick={resetSatelliteFilters}>
        RESET
      </button>
    </div>
  );
}
