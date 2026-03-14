import { useQuery } from '@tanstack/react-query';
import { useAppStore } from '../store/useAppStore';
import type { ShipRecord } from '../hooks/useShips';

function formatLastUpdate(lastUpdate: string | null): string {
  if (!lastUpdate) return 'Unknown';
  try {
    const date = new Date(lastUpdate);
    if (isNaN(date.getTime())) return lastUpdate;
    return date.toUTCString().replace('GMT', 'UTC');
  } catch {
    return lastUpdate;
  }
}

export function ShipDetailPanel() {
  const selectedShipId = useAppStore(s => s.selectedShipId);
  const setSelectedShipId = useAppStore(s => s.setSelectedShipId);

  const { data, isLoading, isError } = useQuery<ShipRecord>({
    queryKey: ['ship', selectedShipId],
    queryFn: async () => {
      const res = await fetch(`/api/ships/${selectedShipId}`);
      if (!res.ok) throw new Error('Ship not found');
      return res.json() as Promise<ShipRecord>;
    },
    enabled: selectedShipId !== null,
    staleTime: 60_000,
  });

  if (!selectedShipId) return null;

  // Heading 511 = not available in AIS standard
  const headingDisplay = (heading: number | null): string => {
    if (heading === null) return 'N/A';
    if (heading === 511) return 'N/A';
    return `${heading.toFixed(1)}\u00b0`;
  };

  return (
    <div style={{ padding: '1rem', color: '#e0e0e0', fontFamily: 'monospace', fontSize: '13px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <span style={{ color: '#06B6D4', fontWeight: 'bold', fontSize: '14px' }}>
          VESSEL
        </span>
        <button
          onClick={() => setSelectedShipId(null)}
          style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: '16px' }}
        >
          &times;
        </button>
      </div>

      {isLoading && <div style={{ color: '#888' }}>Loading...</div>}
      {isError && <div style={{ color: '#ff4444' }}>Failed to load vessel data</div>}

      {data && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <div>
            <span style={{ color: '#888' }}>Name: </span>
            <span style={{ fontWeight: 'bold', letterSpacing: '0.05em' }}>
              {data.vessel_name ?? 'Unknown'}
            </span>
          </div>
          <div>
            <span style={{ color: '#888' }}>MMSI: </span>
            <span style={{ color: '#06B6D4' }}>{data.mmsi}</span>
          </div>
          <div>
            <span style={{ color: '#888' }}>Type: </span>
            <span>{data.vessel_type ?? 'Unknown'}</span>
          </div>

          <div style={{ borderTop: '1px solid rgba(6,182,212,0.15)', paddingTop: '0.5rem', marginTop: '0.25rem' }} />

          <div>
            <span style={{ color: '#888' }}>Speed: </span>
            <span>{data.sog != null ? `${data.sog.toFixed(1)} kts` : 'Unknown'}</span>
          </div>
          <div>
            <span style={{ color: '#888' }}>Heading: </span>
            <span>{headingDisplay(data.heading)}</span>
          </div>
          {data.nav_status !== null && (
            <div>
              <span style={{ color: '#888' }}>Nav Status: </span>
              <span>{data.nav_status}</span>
            </div>
          )}
          <div>
            <span style={{ color: '#888' }}>Last Update: </span>
            <span style={{ color: '#aaa', fontSize: '11px' }}>
              {formatLastUpdate(data.last_update)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
