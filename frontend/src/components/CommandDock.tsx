import { useEffect, useState } from 'react';
import { Mic } from 'lucide-react';
import { useAppStore, type VisualPreset } from '../store/useAppStore';
import { flyToLandmark } from '../lib/viewerRegistry';
import landmarksData from '../data/landmarks.json';
import { fetchVoiceStatus, startVoiceSession } from '../lib/voiceSession';

const PRESETS: { id: VisualPreset; key: string; label: string }[] = [
  { id: 'normal', key: '1', label: 'NORMAL' },
  { id: 'nvg', key: '2', label: 'NVG' },
  { id: 'crt', key: '3', label: 'CRT' },
  { id: 'flir', key: '4', label: 'FLIR' },
  { id: 'noir', key: '5', label: 'NOIR' },
];

export function CommandDock() {
  const [open, setOpen] = useState(false);
  const [voiceAvailable, setVoiceAvailable] = useState(false);
  const [voiceLive, setVoiceLive] = useState(false);
  const visualPreset = useAppStore(s => s.visualPreset);
  const setVisualPreset = useAppStore(s => s.setVisualPreset);

  useEffect(() => {
    fetchVoiceStatus().then(s => setVoiceAvailable(s.available)).catch(() => setVoiceAvailable(false));
  }, []);

  return (
    <div
      style={{
        position: 'fixed',
        left: '50%',
        bottom: 10,
        transform: 'translateX(-50%)',
        zIndex: 210,
        width: 'min(720px, calc(100vw - 32px))',
        pointerEvents: 'auto',
        fontFamily: 'monospace',
      }}
    >
      {open && (
        <div style={{
          marginBottom: 6,
          background: 'rgba(0,0,0,0.82)',
          border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: 4,
          padding: '8px 10px',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {PRESETS.map(p => {
              const active = visualPreset === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setVisualPreset(p.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '4px 8px',
                    background: active ? 'rgba(255,255,255,0.12)' : 'transparent',
                    border: `1px solid ${active ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.12)'}`,
                    borderRadius: 3,
                    color: active ? '#fff' : 'rgba(255,255,255,0.6)',
                    cursor: 'pointer',
                    fontFamily: 'monospace',
                    fontSize: 10,
                    letterSpacing: '0.08em',
                  }}
                >
                  <span style={{ opacity: 0.5 }}>{p.key}</span>
                  {p.label}
                </button>
              );
            })}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {landmarksData.landmarks.map(lm => (
              <button
                key={lm.id}
                type="button"
                onClick={() => flyToLandmark(lm)}
                title={`Press ${lm.shortcut}`}
                style={{
                  padding: '4px 8px',
                  background: 'transparent',
                  border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: 3,
                  color: 'rgba(255,255,255,0.7)',
                  cursor: 'pointer',
                  fontFamily: 'monospace',
                  fontSize: 10,
                }}
              >
                [{lm.shortcut}] {lm.name}
              </button>
            ))}
          </div>
        </div>
      )}

      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        height: 28,
        padding: '0 10px',
        background: 'rgba(0,0,0,0.72)',
        border: '1px solid rgba(255,255,255,0.12)',
        borderRadius: 4,
        color: 'rgba(255,255,255,0.7)',
        fontSize: 11,
      }}>
        <button
          type="button"
          onClick={() => setOpen(v => !v)}
          style={{
            background: 'none',
            border: 'none',
            color: 'inherit',
            cursor: 'pointer',
            fontFamily: 'monospace',
            fontSize: 11,
            padding: 0,
          }}
        >
          Style: {visualPreset.toUpperCase()} · Location: --
        </button>
        <div style={{ flex: 1 }} />
        <button
          type="button"
          disabled={!voiceAvailable}
          title={voiceAvailable ? (voiceLive ? 'Stop voice' : 'Voice') : 'Voice unavailable'}
          aria-label={voiceAvailable ? (voiceLive ? 'Stop voice' : 'Voice') : 'Voice unavailable'}
          onClick={async () => {
            if (!voiceAvailable) return;
            if (voiceLive) {
              setVoiceLive(false);
              return;
            }
            try {
              const session = await startVoiceSession();
              setVoiceLive(true);
              window.setTimeout(() => {
                session.stop();
                setVoiceLive(false);
              }, 8 * 60 * 1000);
            } catch {
              setVoiceLive(false);
            }
          }}
          style={{
            background: 'none',
            border: 'none',
            color: voiceAvailable ? 'rgba(255,255,255,0.75)' : 'rgba(255,255,255,0.25)',
            cursor: voiceAvailable ? 'pointer' : 'default',
            display: 'flex',
            alignItems: 'center',
            padding: 0,
          }}
        >
          <Mic size={13} />
        </button>
      </div>
    </div>
  );
}
