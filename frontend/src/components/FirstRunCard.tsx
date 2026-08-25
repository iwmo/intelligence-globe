import { useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import { flyToLandmark } from '../lib/viewerRegistry';

const KEY = 'ig-first-run-dismissed';

function alreadyDismissed(): boolean {
  try { return sessionStorage.getItem(KEY) === '1'; } catch { return false; }
}

export function FirstRunCard() {
  const [open, setOpen] = useState(() => !alreadyDismissed());
  const setLayerVisible = useAppStore(s => s.setLayerVisible);

  if (!open) return null;

  function dismiss() {
    try { sessionStorage.setItem(KEY, '1'); } catch { /* ignore */ }
    setOpen(false);
  }

  return (
    <div style={{
      position: 'fixed',
      top: 56,
      left: 16,
      zIndex: 220,
      width: 280,
      background: 'rgba(0,0,0,0.86)',
      border: '1px solid rgba(255,255,255,0.14)',
      borderRadius: 4,
      padding: 12,
      fontFamily: 'monospace',
      color: 'rgba(255,255,255,0.85)',
    }}>
      <div style={{ fontSize: 11, letterSpacing: '0.12em', marginBottom: 8 }}>START</div>
      <button type="button" onClick={() => { setLayerVisible('aircraft', true); dismiss(); }} style={btn}>
        Live contacts
      </button>
      <button type="button" onClick={() => {
        setLayerVisible('gdelt', true);
        setLayerVisible('gpsJamming', true);
        dismiss();
      }} style={btn}>
        Intel picture
      </button>
      <button type="button" onClick={() => {
        setLayerVisible('earthquakes', true);
        setLayerVisible('fires', true);
        setLayerVisible('launches', true);
        flyToLandmark({ lon: -120, lat: 38, altMeters: 2_500_000, pitch: -70 });
        dismiss();
      }} style={btn}>
        Live earth
      </button>
      <button type="button" onClick={() => {
        flyToLandmark({ lon: 0, lat: 20, altMeters: 18_000_000, pitch: -90 });
        dismiss();
      }} style={btn}>
        Explore
      </button>
      <button type="button" onClick={dismiss} style={{ ...btn, opacity: 0.6 }}>Dismiss</button>
    </div>
  );
}

const btn: React.CSSProperties = {
  display: 'block',
  width: '100%',
  textAlign: 'left',
  marginBottom: 6,
  padding: '6px 8px',
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: 3,
  color: 'inherit',
  cursor: 'pointer',
  fontFamily: 'monospace',
  fontSize: 12,
};
