import { useEffect } from 'react';
import { useHealthCheck } from '../lib/api';
import { useAppStore } from '../store/useAppStore';

export function BottomStatusBar() {
  const { data, isError, isLoading } = useHealthCheck();
  const tleLastUpdated = useAppStore(s => s.tleLastUpdated);
  const setTleLastUpdated = useAppStore(s => s.setTleLastUpdated);
  const aircraftLastUpdated = useAppStore(s => s.aircraftLastUpdated);
  const setAircraftLastUpdated = useAppStore(s => s.setAircraftLastUpdated);
  const layers = useAppStore(s => s.layers);

  // Fetch TLE freshness once on mount
  useEffect(() => {
    fetch('/api/satellites/freshness')
      .then(r => r.json())
      .then((d: { last_updated?: string | null }) => setTleLastUpdated(d.last_updated ?? null))
      .catch(() => {});
  }, [setTleLastUpdated]);

  // Fetch aircraft freshness on mount and every 90s
  useEffect(() => {
    const fetchAircraftFreshness = () =>
      fetch('/api/aircraft/freshness')
        .then(r => r.json())
        .then((d: { last_updated?: string | null }) =>
          setAircraftLastUpdated(d.last_updated ?? null))
        .catch(() => {});
    fetchAircraftFreshness();
    const id = setInterval(fetchAircraftFreshness, 90_000);
    return () => clearInterval(id);
  }, [setAircraftLastUpdated]);

  const apiStatus = isLoading
    ? 'connecting...'
    : isError
    ? 'disconnected'
    : `connected · v${data?.version}`;

  const apiStatusColor = isError ? '#ff4444' : '#00D4FF';

  const formattedTle = tleLastUpdated
    ? `TLE: ${new Date(tleLastUpdated).toUTCString().slice(0, 25)}`
    : 'TLE: loading...';

  const formattedAcf = aircraftLastUpdated
    ? `ACF: ${new Date(aircraftLastUpdated).toUTCString().slice(0, 25)}`
    : 'ACF: loading...';

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        height: '32px',
        background: 'rgba(0, 0, 0, 0.85)',
        borderTop: '1px solid rgba(0, 212, 255, 0.2)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 16px',
        zIndex: 100,
        gap: '16px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <span style={{ color: '#00D4FF', fontSize: '12px', fontWeight: 600, letterSpacing: '0.1em' }}>
          OPENSIGNAL GLOBE
        </span>
        <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '12px' }}>|</span>
        <span style={{ color: apiStatusColor, fontSize: '11px' }}>
          API {apiStatus}
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', justifyContent: 'flex-end', minWidth: 0 }}>
        {layers.satellites && tleLastUpdated && (
          <span style={{ color: '#00D4FF', fontSize: '11px', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
            {formattedTle}
          </span>
        )}
        {layers.aircraft && aircraftLastUpdated && (
          <span style={{ color: '#FF8C00', fontSize: '11px', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
            {formattedAcf}
          </span>
        )}
      </div>
    </div>
  );
}
