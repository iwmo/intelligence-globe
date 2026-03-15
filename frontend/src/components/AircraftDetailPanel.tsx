import { useQuery } from '@tanstack/react-query';
import { useAppStore } from '../store/useAppStore';

interface AircraftDetail {
  icao24: string;
  callsign: string | null;
  origin_country: string | null;
  latitude: number;
  longitude: number;
  baro_altitude: number | null;
  velocity: number | null;
  true_track: number | null;
  trail: Array<{ lon: number; lat: number; alt: number | null; ts: number | null }>;
  emergency: string | null;
  nav_modes: string[] | null;
  ias: number | null;
  tas: number | null;
  mach: number | null;
  registration: string | null;
  type_code: string | null;
}

interface Airport {
  icao: string | null;
  iata: string | null;
  name: string | null;
  city: string | null;
  country: string | null;
}

interface AircraftRoute {
  origin: Airport | null;
  destination: Airport | null;
}

export function AircraftDetailPanel() {
  const selectedId = useAppStore(s => s.selectedAircraftId);
  const clearSelection = useAppStore(s => s.setSelectedAircraftId);

  const { data, isLoading, isError } = useQuery<AircraftDetail>({
    queryKey: ['aircraft', selectedId],
    queryFn: async () => {
      const res = await fetch(`/api/aircraft/${selectedId}`);
      if (!res.ok) throw new Error('Aircraft not found');
      return res.json() as Promise<AircraftDetail>;
    },
    enabled: selectedId !== null,
    staleTime: 60_000,
  });

  // Route fetch: per-selection, cached for 5 minutes.
  const { data: routeData, isLoading: routeLoading } = useQuery<AircraftRoute>({
    queryKey: ['aircraft-route', selectedId],
    queryFn: async () => {
      const res = await fetch(`/api/aircraft/${selectedId}/route`);
      if (!res.ok) return { origin: null, destination: null };
      return res.json() as Promise<AircraftRoute>;
    },
    enabled: selectedId !== null,
    staleTime: 300_000,
    retry: false,
  });

  if (!selectedId) return null;

  return (
    <div style={{ padding: '1rem', color: '#e0e0e0', fontFamily: 'monospace', fontSize: '13px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <span style={{ color: '#FF8C00', fontWeight: 'bold', fontSize: '14px' }}>
          AIRCRAFT
        </span>
        <button
          onClick={() => clearSelection(null)}
          style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: '16px' }}
        >
          &times;
        </button>
      </div>

      {isLoading && <div style={{ color: '#888' }}>Loading...</div>}
      {isError && <div style={{ color: '#ff4444' }}>Failed to load aircraft data</div>}

      {data && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <div>
            <span style={{ color: '#888' }}>Flight: </span>
            <span style={{ fontWeight: 'bold', letterSpacing: '0.05em' }}>
              {data.callsign ? data.callsign.trim() : 'Unknown'}
            </span>
          </div>

          {/* Emergency badge — absent for null or "none" */}
          {data.emergency && data.emergency !== 'none' && (
            <div
              data-testid="emergency-badge"
              style={{
                display: 'inline-block',
                background: '#7f1d1d',
                border: '1px solid #ef4444',
                color: '#fca5a5',
                borderRadius: '4px',
                padding: '2px 8px',
                fontWeight: 'bold',
                fontSize: '11px',
                letterSpacing: '0.08em',
              }}
            >
              EMERGENCY: {data.emergency.toUpperCase()}
            </div>
          )}

          {/* Origin */}
          <div>
            <span style={{ color: '#888' }}>From: </span>
            {routeLoading ? (
              <span style={{ color: '#666' }}>...</span>
            ) : routeData?.origin ? (
              <span>
                <span style={{ color: '#FF8C00' }}>{routeData.origin.iata ?? routeData.origin.icao}</span>
                {routeData.origin.name && (
                  <span style={{ color: '#aaa' }}> · {routeData.origin.name}</span>
                )}
              </span>
            ) : (
              <span style={{ color: '#555' }}>Unavailable</span>
            )}
          </div>

          {/* Destination */}
          <div>
            <span style={{ color: '#888' }}>To: </span>
            {routeLoading ? (
              <span style={{ color: '#666' }}>...</span>
            ) : routeData?.destination ? (
              <span>
                <span style={{ color: '#FF8C00' }}>{routeData.destination.iata ?? routeData.destination.icao}</span>
                {routeData.destination.name && (
                  <span style={{ color: '#aaa' }}> · {routeData.destination.name}</span>
                )}
              </span>
            ) : (
              <span style={{ color: '#555' }}>Unavailable</span>
            )}
          </div>

          <div style={{ borderTop: '1px solid rgba(255,140,0,0.15)', paddingTop: '0.5rem', marginTop: '0.25rem' }} />

          <div>
            <span style={{ color: '#888' }}>ICAO24: </span>
            <span style={{ color: '#FF8C00' }}>{data.icao24}</span>
          </div>
          <div>
            <span style={{ color: '#888' }}>Altitude: </span>
            <span>{data.baro_altitude != null ? `${Math.round(data.baro_altitude)} m` : 'Unknown'}</span>
          </div>
          <div>
            <span style={{ color: '#888' }}>Speed: </span>
            <span>{data.velocity != null ? `${data.velocity.toFixed(1)} m/s` : 'Unknown'}</span>
          </div>
          <div>
            <span style={{ color: '#888' }}>Heading: </span>
            <span>{data.true_track != null ? `${data.true_track.toFixed(1)}\u00b0` : 'Unknown'}</span>
          </div>
          <div>
            <span style={{ color: '#888' }}>Country: </span>
            <span>{data.origin_country ?? 'Unknown'}</span>
          </div>

          {/* IAS — absent when null */}
          {data.ias != null && (
            <div data-testid="ias-row">
              <span style={{ color: '#888' }}>IAS: </span>
              <span>{data.ias.toFixed(1)} kts</span>
            </div>
          )}

          {/* TAS — absent when null */}
          {data.tas != null && (
            <div data-testid="tas-row">
              <span style={{ color: '#888' }}>TAS: </span>
              <span>{data.tas.toFixed(1)} kts</span>
            </div>
          )}

          {/* Mach — absent when null */}
          {data.mach != null && (
            <div data-testid="mach-row">
              <span style={{ color: '#888' }}>Mach: </span>
              <span>{data.mach.toFixed(3)}</span>
            </div>
          )}

          {/* Registration — absent when null */}
          {data.registration != null && (
            <div data-testid="registration-row">
              <span style={{ color: '#888' }}>Reg: </span>
              <span>{data.registration}</span>
            </div>
          )}

          {/* Type — absent when null */}
          {data.type_code != null && (
            <div data-testid="type-row">
              <span style={{ color: '#888' }}>Type: </span>
              <span>{data.type_code}</span>
            </div>
          )}

          {/* Nav modes chips — absent when null or empty */}
          {data.nav_modes && data.nav_modes.length > 0 && (
            <div data-testid="nav-modes-section">
              <div style={{ color: '#888', marginBottom: '4px' }}>Nav Modes:</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                {data.nav_modes.map(mode => (
                  <span
                    key={mode}
                    style={{
                      background: 'rgba(255,140,0,0.15)',
                      border: '1px solid rgba(255,140,0,0.4)',
                      color: '#FF8C00',
                      borderRadius: '3px',
                      padding: '1px 6px',
                      fontSize: '11px',
                      fontWeight: 'bold',
                      letterSpacing: '0.05em',
                    }}
                  >
                    {mode.toUpperCase()}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
