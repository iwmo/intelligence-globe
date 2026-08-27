import { useQuery } from '@tanstack/react-query';
import { useAppStore } from '../store/useAppStore';
import type { MilitaryAircraftRecord } from '../hooks/useMilitaryAircraft';
import { ContactCard } from './ContactCard';
import { InspectorState } from './InspectorState';

export function MilitaryDetailPanel() {
  const selectedMilitaryId = useAppStore(s => s.selectedMilitaryId);

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

  return (
    <>
      {isLoading && <InspectorState state="loading">Loading military telemetry…</InspectorState>}
      {isError && <InspectorState state="error">Failed to load military aircraft data</InspectorState>}

      {data && (
        <ContactCard
          kind="military"
          id={data.hex}
          title={(data.flight?.trim() || data.hex).toUpperCase()}
          altitude={data.alt_baro != null ? `${Math.round(data.alt_baro).toLocaleString()} ft` : 'Ground'}
          speed={data.gs != null ? `${Math.round(data.gs)} kts` : '--'}
          heading={data.track != null ? `${data.track.toFixed(1)}°` : '--'}
          accent="#F59E0B"
          source="ADS-B military classification"
          freshness={data.updated_at}
          position={{ lat: data.lat, lon: data.lon, altitudeMeters: data.alt_baro != null ? data.alt_baro * 0.3048 : 0 }}
          context={(
            <div className="contact-card__context-copy">
              {data.aircraft_type ?? 'Unknown aircraft type'}
              {data.squawk ? ` · Squawk ${data.squawk}` : ''}
            </div>
          )}
          history={(
            <div className="contact-card__history-copy">
              {data.is_stale ? 'Latest observation is stale.' : 'Latest observation is within the live freshness window.'}
            </div>
          )}
        >
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
        </ContactCard>
      )}
    </>
  );
}
