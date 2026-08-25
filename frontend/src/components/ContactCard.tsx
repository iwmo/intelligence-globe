import type { ReactNode } from 'react';
import { useAppStore, type TrackableKind } from '../store/useAppStore';
import { canEnterCockpit } from '../lib/trackContact';

interface ContactCardProps {
  kind: TrackableKind;
  id: string | number;
  title: string;
  altitude: string;
  speed: string;
  accent: string;
  children?: ReactNode;
  trackable?: boolean;
}

export function ContactCard({
  kind,
  id,
  title,
  altitude,
  speed,
  accent,
  children,
  trackable = true,
}: ContactCardProps) {
  const tracked = useAppStore(s => s.trackedEntity);
  const setTrackedEntity = useAppStore(s => s.setTrackedEntity);
  const cockpitMode = useAppStore(s => s.cockpitMode);
  const setCockpitMode = useAppStore(s => s.setCockpitMode);
  const isTracked = tracked?.kind === kind && String(tracked.id) === String(id);

  return (
    <div style={{ padding: '12px 12px 14px', color: '#e0e0e0', fontFamily: 'monospace', fontSize: 12 }}>
      <div style={{ fontSize: 9, letterSpacing: '0.14em', color: accent, marginBottom: 6 }}>
        {kind.toUpperCase()}
      </div>
      <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: '0.04em', marginBottom: 8 }}>
        {title}
      </div>
      <div style={{ display: 'flex', gap: 16, marginBottom: 10, color: 'rgba(255,255,255,0.8)' }}>
        <div>
          <div style={{ fontSize: 9, opacity: 0.5 }}>ALT</div>
          <div>{altitude}</div>
        </div>
        <div>
          <div style={{ fontSize: 9, opacity: 0.5 }}>SPD</div>
          <div>{speed}</div>
        </div>
      </div>
      {trackable && (
        <button
          type="button"
          onClick={() => setTrackedEntity(isTracked ? null : { kind, id })}
          style={{
            width: '100%',
            marginBottom: 10,
            padding: '6px 8px',
            background: isTracked ? 'rgba(255,255,255,0.12)' : 'transparent',
            border: `1px solid ${isTracked ? accent : 'rgba(255,255,255,0.2)'}`,
            borderRadius: 3,
            color: isTracked ? accent : 'rgba(255,255,255,0.75)',
            cursor: 'pointer',
            fontFamily: 'monospace',
            fontSize: 11,
            letterSpacing: '0.12em',
            fontWeight: 700,
          }}
        >
          {isTracked ? 'TRACKING' : 'TRACK'}
        </button>
      )}
      {trackable && canEnterCockpit(kind) && isTracked && (
        <button
          type="button"
          onClick={() => setCockpitMode(!cockpitMode)}
          style={{
            width: '100%',
            marginBottom: 10,
            padding: '6px 8px',
            background: cockpitMode ? 'rgba(255,255,255,0.12)' : 'transparent',
            border: `1px solid ${cockpitMode ? accent : 'rgba(255,255,255,0.2)'}`,
            borderRadius: 3,
            color: cockpitMode ? accent : 'rgba(255,255,255,0.75)',
            cursor: 'pointer',
            fontFamily: 'monospace',
            fontSize: 11,
            letterSpacing: '0.12em',
            fontWeight: 700,
          }}
        >
          {cockpitMode ? 'COCKPIT' : 'ENTER COCKPIT'}
        </button>
      )}
      {children}
    </div>
  );
}
