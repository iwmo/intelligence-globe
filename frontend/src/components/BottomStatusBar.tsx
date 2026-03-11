import { useHealthCheck } from '../lib/api';

export function BottomStatusBar() {
  const { data, isError, isLoading } = useHealthCheck();

  const status = isLoading
    ? 'connecting...'
    : isError
    ? 'disconnected'
    : `connected · v${data?.version}`;

  const statusColor = isError ? '#ff4444' : '#00D4FF';

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
        padding: '0 16px',
        zIndex: 100,
        gap: '16px',
      }}
    >
      <span style={{ color: '#00D4FF', fontSize: '12px', fontWeight: 600, letterSpacing: '0.1em' }}>
        OPENSIGNAL GLOBE
      </span>
      <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '12px' }}>|</span>
      <span style={{ color: statusColor, fontSize: '11px' }}>
        API {status}
      </span>
    </div>
  );
}
