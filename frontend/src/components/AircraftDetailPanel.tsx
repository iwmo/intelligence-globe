import { useQuery } from '@tanstack/react-query';
import { useAppStore } from '../store/useAppStore';
import { ContactCard } from './ContactCard';
import { InspectorState } from './InspectorState';
import { metersToFeet, msToKnots } from '../lib/hudContact';

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
  roll: number | null;
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

  const title = data?.callsign?.trim() || selectedId;
  const altitude = data?.baro_altitude != null ? `${Math.round(metersToFeet(data.baro_altitude))} ft` : '--';
  const speed = data?.velocity != null ? `${Math.round(msToKnots(data.velocity))} kts` : '--';

  return (
    <>
      {isLoading && <InspectorState state="loading">Loading aircraft telemetry…</InspectorState>}
      {isError && <InspectorState state="error">Failed to load aircraft data</InspectorState>}
      {data && (
        <ContactCard
          kind="aircraft"
          id={data.icao24}
          title={title.toUpperCase()}
          altitude={altitude}
          speed={speed}
          heading={data.true_track != null ? `${data.true_track.toFixed(1)}°` : '--'}
          accent="#FF8C00"
          source="ADS-B"
          freshness={(() => {
            const timestamp = data.trail.at(-1)?.ts;
            if (timestamp == null) return null;
            return new Date(timestamp > 1_000_000_000_000 ? timestamp : timestamp * 1000).toISOString();
          })()}
          position={{
            lat: data.latitude,
            lon: data.longitude,
            altitudeMeters: data.baro_altitude,
          }}
          notice={data.emergency && data.emergency !== 'none' ? (
            <div
              data-testid="emergency-badge"
              style={{
                display: 'inline-block',
                background: '#7f1d1d',
                border: '1px solid #ef4444',
                color: '#fca5a5',
                borderRadius: 4,
                padding: '2px 8px',
                fontWeight: 'bold',
                fontSize: 11,
                letterSpacing: '0.08em',
                marginTop: 8,
              }}
            >
              EMERGENCY: {data.emergency.toUpperCase()}
            </div>
          ) : null}
          context={(
            <div className="contact-card__context-copy">
              {routeLoading
                ? 'Resolving route…'
                : `${routeData?.origin?.iata ?? routeData?.origin?.icao ?? 'Unknown origin'} → ${routeData?.destination?.iata ?? routeData?.destination?.icao ?? 'Unknown destination'}`}
              <br />
              {data.origin_country ?? 'Country unavailable'}
            </div>
          )}
          history={(
            <div className="contact-card__history-copy">
              {data.trail.length > 0
                ? `${data.trail.length} recorded positions available for recent-path context.`
                : 'No recent path is available for this contact.'}
            </div>
          )}
        >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
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
              {data.ias != null && (
                <div data-testid="ias-row">
                  <span style={{ color: '#888' }}>IAS: </span>
                  <span>{data.ias.toFixed(1)} kts</span>
                </div>
              )}
              {data.tas != null && (
                <div data-testid="tas-row">
                  <span style={{ color: '#888' }}>TAS: </span>
                  <span>{data.tas.toFixed(1)} kts</span>
                </div>
              )}
              {data.mach != null && (
                <div data-testid="mach-row">
                  <span style={{ color: '#888' }}>Mach: </span>
                  <span>{data.mach.toFixed(3)}</span>
                </div>
              )}
              {data.registration != null && (
                <div data-testid="registration-row">
                  <span style={{ color: '#888' }}>Reg: </span>
                  <span>{data.registration}</span>
                </div>
              )}
              {data.type_code != null && (
                <div data-testid="type-row">
                  <span style={{ color: '#888' }}>Type: </span>
                  <span>{data.type_code}</span>
                </div>
              )}
              {data.nav_modes && data.nav_modes.length > 0 && (
                <div data-testid="nav-modes-section">
                  <div style={{ color: '#888', marginBottom: 4 }}>Nav Modes:</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {data.nav_modes.map(mode => (
                      <span
                        key={mode}
                        style={{
                          background: 'rgba(255,140,0,0.15)',
                          border: '1px solid rgba(255,140,0,0.4)',
                          color: '#FF8C00',
                          borderRadius: 3,
                          padding: '1px 6px',
                          fontSize: 11,
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
        </ContactCard>
      )}
    </>
  );
}
