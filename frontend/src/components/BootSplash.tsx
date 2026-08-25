import { useEffect, useState } from 'react';

export function BootSplash() {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const id = window.setTimeout(() => setVisible(false), 900);
    return () => window.clearTimeout(id);
  }, []);

  if (!visible) return null;

  return (
    <div
      aria-hidden
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 400,
        background: '#000',
        color: 'rgba(255,255,255,0.8)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'monospace',
        letterSpacing: '0.2em',
        pointerEvents: 'none',
      }}
    >
      <div style={{ fontSize: 18, fontWeight: 700 }}>INTELLIGENCE GLOBE</div>
      <div style={{ fontSize: 11, opacity: 0.5, marginTop: 8 }}>OSINT · LIVE</div>
    </div>
  );
}
