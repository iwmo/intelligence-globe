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

const ALTITUDE_BANDS: Record<string, [number, number]> = {
  'LEO': [0, 2000],
  'MEO': [2000, 35000],
  'GEO': [35000, 36500],
  'HEO': [36500, 99999],
};

const ALTITUDE_BAND_LABELS: Record<string, string> = {
  'LEO': 'LEO (0–2000 km)',
  'MEO': 'MEO (2000–35000 km)',
  'GEO': 'GEO (35000–36500 km)',
  'HEO': 'HEO (>36500 km)',
};

export function FilterPanel() {
  const satelliteFilter = useAppStore(s => s.satelliteFilter);
  const setSatelliteFilter = useAppStore(s => s.setSatelliteFilter);
  const aircraftFilter = useAppStore(s => s.aircraftFilter);
  const setAircraftFilter = useAppStore(s => s.setAircraftFilter);

  // Derived labels for current altitude band
  const currentBandKey = satelliteFilter.altitudeBand
    ? Object.entries(ALTITUDE_BANDS).find(
        ([, v]) =>
          v[0] === satelliteFilter.altitudeBand![0] &&
          v[1] === satelliteFilter.altitudeBand![1]
      )?.[0] ?? null
    : null;

  const handleConstellationChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setSatelliteFilter({ constellation: val === 'All' ? null : val });
  };

  const handleAltitudeBandChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    if (val === 'All') {
      setSatelliteFilter({ altitudeBand: null });
    } else {
      setSatelliteFilter({ altitudeBand: ALTITUDE_BANDS[val] ?? null });
    }
  };

  const handleAircraftMinAlt = (e: React.ChangeEvent<HTMLInputElement>) => {
    const min = parseFloat(e.target.value);
    const existing = aircraftFilter.altitudeRange;
    const max = existing ? existing[1] : 15000;
    if (!isNaN(min)) {
      setAircraftFilter({ altitudeRange: [min, max] });
    } else if (existing) {
      setAircraftFilter({ altitudeRange: [0, existing[1]] });
    }
  };

  const handleAircraftMaxAlt = (e: React.ChangeEvent<HTMLInputElement>) => {
    const max = parseFloat(e.target.value);
    const existing = aircraftFilter.altitudeRange;
    const min = existing ? existing[0] : 0;
    if (!isNaN(max)) {
      setAircraftFilter({ altitudeRange: [min, max] });
    } else if (existing) {
      setAircraftFilter({ altitudeRange: [existing[0], 15000] });
    }
  };

  const handleBboxChange = (field: keyof NonNullable<typeof aircraftFilter.boundingBox>) => (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const val = parseFloat(e.target.value);
    const existing = aircraftFilter.boundingBox ?? { minLat: -90, maxLat: 90, minLon: -180, maxLon: 180 };
    if (!isNaN(val)) {
      setAircraftFilter({ boundingBox: { ...existing, [field]: val } });
    }
  };

  const resetSatelliteFilters = () => {
    setSatelliteFilter({ constellation: null, altitudeBand: null });
  };

  const resetAircraftFilters = () => {
    setAircraftFilter({ altitudeRange: null, boundingBox: null });
  };

  return (
    <div style={{ padding: '12px' }}>
      {/* Satellite Filters */}
      <div style={{ marginBottom: '16px' }}>
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
            <option value="GPS">GPS</option>
            <option value="ISS">ISS</option>
            <option value="Iridium">Iridium</option>
            <option value="OneWeb">OneWeb</option>
            <option value="Other">Other</option>
          </select>
        </div>

        <div style={{ marginBottom: '8px' }}>
          <label style={labelStyle}>Altitude Band</label>
          <select
            style={selectStyle}
            value={currentBandKey ?? 'All'}
            onChange={handleAltitudeBandChange}
          >
            <option value="All">All</option>
            {Object.entries(ALTITUDE_BAND_LABELS).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        </div>

        <button style={resetButtonStyle} onClick={resetSatelliteFilters}>
          RESET
        </button>
      </div>

      {/* Aircraft Filters */}
      <div>
        <div style={{
          color: 'rgba(255,140,0,0.6)',
          fontSize: '10px',
          fontWeight: 700,
          letterSpacing: '0.12em',
          marginBottom: '10px',
          paddingBottom: '4px',
          borderBottom: '1px solid rgba(255,140,0,0.1)',
        }}>
          AIRCRAFT
        </div>

        <div style={{ marginBottom: '8px' }}>
          <label style={labelStyle}>Altitude Range</label>
          <div style={{ display: 'flex', gap: '6px' }}>
            <div style={{ flex: 1 }}>
              <label style={{ ...labelStyle, color: 'rgba(255,255,255,0.35)', marginBottom: '2px' }}>
                Min alt (m)
              </label>
              <input
                type="number"
                style={{ ...inputStyle, width: '100%', boxSizing: 'border-box' }}
                placeholder="0"
                value={aircraftFilter.altitudeRange ? aircraftFilter.altitudeRange[0] : ''}
                onChange={handleAircraftMinAlt}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ ...labelStyle, color: 'rgba(255,255,255,0.35)', marginBottom: '2px' }}>
                Max alt (m)
              </label>
              <input
                type="number"
                style={{ ...inputStyle, width: '100%', boxSizing: 'border-box' }}
                placeholder="15000"
                value={aircraftFilter.altitudeRange ? aircraftFilter.altitudeRange[1] : ''}
                onChange={handleAircraftMaxAlt}
              />
            </div>
          </div>
        </div>

        <div style={{ marginBottom: '8px' }}>
          <label style={labelStyle}>Bounding Box</label>
          <div style={{ display: 'flex', gap: '6px', marginBottom: '4px' }}>
            <div style={{ flex: 1 }}>
              <label style={{ ...labelStyle, color: 'rgba(255,255,255,0.35)', marginBottom: '2px' }}>
                Min Lat
              </label>
              <input
                type="number"
                style={{ ...inputStyle, width: '100%', boxSizing: 'border-box' }}
                placeholder="-90"
                value={aircraftFilter.boundingBox ? aircraftFilter.boundingBox.minLat : ''}
                onChange={handleBboxChange('minLat')}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ ...labelStyle, color: 'rgba(255,255,255,0.35)', marginBottom: '2px' }}>
                Max Lat
              </label>
              <input
                type="number"
                style={{ ...inputStyle, width: '100%', boxSizing: 'border-box' }}
                placeholder="90"
                value={aircraftFilter.boundingBox ? aircraftFilter.boundingBox.maxLat : ''}
                onChange={handleBboxChange('maxLat')}
              />
            </div>
          </div>
          <div style={{ display: 'flex', gap: '6px' }}>
            <div style={{ flex: 1 }}>
              <label style={{ ...labelStyle, color: 'rgba(255,255,255,0.35)', marginBottom: '2px' }}>
                Min Lon
              </label>
              <input
                type="number"
                style={{ ...inputStyle, width: '100%', boxSizing: 'border-box' }}
                placeholder="-180"
                value={aircraftFilter.boundingBox ? aircraftFilter.boundingBox.minLon : ''}
                onChange={handleBboxChange('minLon')}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ ...labelStyle, color: 'rgba(255,255,255,0.35)', marginBottom: '2px' }}>
                Max Lon
              </label>
              <input
                type="number"
                style={{ ...inputStyle, width: '100%', boxSizing: 'border-box' }}
                placeholder="180"
                value={aircraftFilter.boundingBox ? aircraftFilter.boundingBox.maxLon : ''}
                onChange={handleBboxChange('maxLon')}
              />
            </div>
          </div>
        </div>

        <button style={resetButtonStyle} onClick={resetAircraftFilters}>
          RESET
        </button>
      </div>
    </div>
  );
}
