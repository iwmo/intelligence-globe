import { useQuery } from '@tanstack/react-query';
import { useAppStore } from '../store/useAppStore';
import { MilitaryAircraftRecord } from '../hooks/useMilitaryAircraft';

export function MilitaryDetailPanel() {
  const selectedMilitaryId = useAppStore(s => s.selectedMilitaryId);
  const setSelectedMilitaryId = useAppStore(s => s.setSelectedMilitaryId);
  const setSelectedAircraftId = useAppStore(s => s.setSelectedAircraftId);
  const setSelectedSatelliteId = useAppStore(s => s.setSelectedSatelliteId);
  const setSelectedShipId = useAppStore(s => s.setSelectedShipId);

  const { data, isLoading, isError } = useQuery<MilitaryAircraftRecord>({
    queryKey: ['military', selectedMilitaryId],
    queryFn: async () => {
      const res = await fetch(`/api/military/${selectedMilitaryId}`);
      if (!res.ok) throw new Error('Military aircraft not found');
      return res.json() as Promise<MilitaryAircraftRecord>;
    },
    enabled: selectedMilitaryId !== null,
    staleTime: 60_000,
  });

  if (!selectedMilitaryId) return null;

  function handleClose() {
    setSelectedMilitaryId(null);
    setSelectedAircraftId(null);
    setSelectedSatelliteId(null);
    setSelectedShipId(null);
  }

  return (
    <div style={{ padding: '1rem', color: '#e0e0e0', fontFamily: 'monospace', fontSize: '13px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <span style={{ color: '#F59E0B', fontWeight: 'bold', fontSize: '14px' }}>
          MILITARY
        </span>
        <button
          onClick={handleClose}
          style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: '16px' }}
        >
          &times;
        </button>
      </div>

      {isLoading && <div style={{ color: '#888' }}>Loading...</div>}
      {isError && <div style={{ color: '#ff4444' }}>Failed to load military aircraft data</div>}

      {data && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <div>
            <span style={{ color: '#888' }}>Callsign: </span>
            <span style={{ fontWeight: 'bold', letterSpacing: '0.05em' }}>
              {data.flight ? data.flight.trim() : 'Unknown'}
            </span>
          </div>
          <div>
            <span style={{ color: '#888' }}>ICAO24: </span>
            <span style={{ color: '#F59E0B' }}>{data.hex}</span>
          </div>
          <div>
            <span style={{ color: '#888' }}>Type: </span>
            <span>{data.aircraft_type ?? 'Unknown'}</span>
          </div>

          <div style={{ borderTop: '1px solid rgba(245,158,11,0.15)', paddingTop: '0.5rem', marginTop: '0.25rem' }} />

          <div>
            <span style={{ color: '#888' }}>Altitude: </span>
            <span>{data.alt_baro != null ? `${Math.round(data.alt_baro).toLocaleString()} ft` : 'Ground'}</span>
          </div>
          <div>
            <span style={{ color: '#888' }}>Speed: </span>
            <span>{data.gs != null ? `${data.gs.toFixed(1)} kts` : 'Unknown'}</span>
          </div>
          <div>
            <span style={{ color: '#888' }}>Heading: </span>
            <span>{data.track != null ? `${data.track.toFixed(1)}\u00b0` : 'Unknown'}</span>
          </div>
          {data.squawk && (
            <div>
              <span style={{ color: '#888' }}>Squawk: </span>
              <span>{data.squawk}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
