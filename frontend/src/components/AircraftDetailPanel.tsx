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

function formatAirport(a: Airport | null): string {
  if (!a) return '?';
  const code = a.iata ?? a.icao ?? '?';
  const place = a.city ?? a.country ?? '';
  return place ? `${code} · ${place}` : code;
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

  const hasRoute = routeData && (routeData.origin || routeData.destination);

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
        </div>
      )}
    </div>
  );
}
