import { useQuery } from '@tanstack/react-query';
import { useAppStore } from '../store/useAppStore';

interface SatelliteDetail {
  norad_cat_id: number;
  object_name: string;
  constellation: string | null;
  epoch: string;
  altitude_km: number;
  velocity_km_s: number;
  inclination: number;
  eccentricity: number;
  tle_updated_at: string | null;
}

export function SatelliteDetailPanel() {
  const selectedId = useAppStore(s => s.selectedSatelliteId);
  const clearSelection = useAppStore(s => s.setSelectedSatelliteId);

  const { data, isLoading, isError } = useQuery<SatelliteDetail>({
    queryKey: ['satellite', selectedId],
    queryFn: async () => {
      const res = await fetch(`/api/satellites/${selectedId}`);
      if (!res.ok) throw new Error('Satellite not found');
      return res.json() as Promise<SatelliteDetail>;
    },
    enabled: selectedId !== null,
    staleTime: 60_000,
  });

  if (!selectedId) return null;

  return (
    <div style={{ padding: '1rem', color: '#e0e0e0', fontFamily: 'monospace', fontSize: '13px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <span style={{ color: '#00D4FF', fontWeight: 'bold', fontSize: '14px' }}>
          SATELLITE
        </span>
        <button
          onClick={() => clearSelection(null)}
          style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: '16px' }}
        >
          &times;
        </button>
      </div>

      {isLoading && <div style={{ color: '#888' }}>Loading...</div>}
      {isError && <div style={{ color: '#ff4444' }}>Failed to load satellite data</div>}

      {data && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <div>
            <span style={{ color: '#888' }}>Name: </span>
            <span>{data.object_name}</span>
          </div>
          <div>
            <span style={{ color: '#888' }}>NORAD ID: </span>
            <span style={{ color: '#00D4FF' }}>{data.norad_cat_id}</span>
          </div>
          <div>
            <span style={{ color: '#888' }}>Constellation: </span>
            <span>{data.constellation ?? 'Unknown'}</span>
          </div>
          <div>
            <span style={{ color: '#888' }}>Altitude: </span>
            <span>{data.altitude_km} km</span>
          </div>
          <div>
            <span style={{ color: '#888' }}>Velocity: </span>
            <span>{data.velocity_km_s} km/s</span>
          </div>
          <div>
            <span style={{ color: '#888' }}>Inclination: </span>
            <span>{data.inclination.toFixed(2)}&deg;</span>
          </div>
          <div>
            <span style={{ color: '#888' }}>TLE Epoch: </span>
            <span>{data.epoch}</span>
          </div>
        </div>
      )}
    </div>
  );
}
