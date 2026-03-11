import { useEffect } from 'react';
import { useHealthCheck } from '../lib/api';
import { useAppStore } from '../store/useAppStore';

export function BottomStatusBar() {
  const { data, isError, isLoading } = useHealthCheck();
  const tleLastUpdated = useAppStore(s => s.tleLastUpdated);
  const setTleLastUpdated = useAppStore(s => s.setTleLastUpdated);

  // Fetch TLE freshness once on mount
  useEffect(() => {
    fetch('/api/satellites/freshness')
      .then(r => r.json())
      .then((d: { last_updated?: string | null }) => setTleLastUpdated(d.last_updated ?? null))
      .catch(() => {});
  }, [setTleLastUpdated]);

  const apiStatus = isLoading
    ? 'connecting...'
    : isError
    ? 'disconnected'
    : `connected · v${data?.version}`;

  const apiStatusColor = isError ? '#ff4444' : '#00D4FF';

  const formattedTle = tleLastUpdated
    ? `TLE: ${new Date(tleLastUpdated).toUTCString().slice(0, 25)}`
    : 'TLE: loading...';

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
      <span style={{ color: tleLastUpdated ? '#00D4FF' : '#666', fontSize: '11px', fontFamily: 'monospace' }}>
        {formattedTle}
      </span>
    </div>
  );
}
