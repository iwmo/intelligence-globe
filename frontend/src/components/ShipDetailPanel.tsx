import { useQuery } from '@tanstack/react-query';
import { useAppStore } from '../store/useAppStore';
import type { ShipRecord } from '../hooks/useShips';
import { ContactCard } from './ContactCard';
import { InspectorState } from './InspectorState';

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
    <>
      {isLoading && <InspectorState state="loading">Loading vessel telemetry…</InspectorState>}
      {isError && <InspectorState state="error">Failed to load vessel data</InspectorState>}

      {data && (
        <ContactCard
          kind="ship"
          id={data.mmsi}
          title={(data.vessel_name ?? data.mmsi).toUpperCase()}
          altitude="SEA"
          speed={data.sog != null ? `${data.sog.toFixed(1)} kts` : '--'}
          heading={headingDisplay(data.heading)}
          accent="#06B6D4"
          source="AIS"
          freshness={data.updated_at ?? data.last_update}
          position={{ lat: data.lat, lon: data.lon, altitudeMeters: 0 }}
          context={(
            <div className="contact-card__context-copy">
              {data.vessel_type ?? 'Unknown vessel type'}
              {data.nav_status !== null ? ` · Navigation status ${data.nav_status}` : ''}
            </div>
          )}
          history={(
            <div className="contact-card__history-copy">
              {data.is_stale ? 'Latest AIS observation is stale.' : `Last AIS update: ${formatLastUpdate(data.last_update)}`}
            </div>
          )}
        >
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
        </ContactCard>
      )}
    </>
  );
}
