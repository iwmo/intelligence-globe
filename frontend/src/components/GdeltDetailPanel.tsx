import React from 'react';
import { useAppStore } from '../store/useAppStore';
import { useGdeltEvents } from '../hooks/useGdeltEvents';

const LABEL_STYLE: React.CSSProperties = {
  color: 'rgba(0,212,255,0.6)', fontFamily: 'monospace',
  fontSize: '9px', letterSpacing: '0.08em',
  marginRight: '4px', flexShrink: 0,
};
const VALUE_STYLE: React.CSSProperties = {
  color: 'rgba(255,255,255,0.75)', fontFamily: 'monospace',
  fontSize: '9px', wordBreak: 'break-all',
};
const ROW_STYLE: React.CSSProperties = {
  display: 'flex', alignItems: 'flex-start', marginBottom: '4px',
};

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={ROW_STYLE}>
      <span style={LABEL_STYLE}>{label}:</span>
      <span style={VALUE_STYLE}>{children}</span>
    </div>
  );
}

export function GdeltDetailPanel() {
  const selectedGdeltEventId = useAppStore(s => s.selectedGdeltEventId);
  const { data: events } = useGdeltEvents();

  if (selectedGdeltEventId === null) return null;

  const event = (events ?? []).find(e => e.global_event_id === selectedGdeltEventId);
  if (!event) return null;

  return (
    <div style={{ padding: '8px 10px' }}>
      <FieldRow label="SOURCE">
        {event.source_url ? (
          <a href={event.source_url} target="_blank" rel="noopener noreferrer"
            style={{ color: 'rgba(0,212,255,0.8)', textDecoration: 'underline', fontFamily: 'monospace', fontSize: '9px', wordBreak: 'break-all' }}>
            {event.source_url}
          </a>
        ) : 'N/A'}
      </FieldRow>
      <FieldRow label="ACTOR 1">{event.actor1_name ?? 'N/A'}</FieldRow>
      <FieldRow label="ACTOR 2">{event.actor2_name ?? 'N/A'}</FieldRow>
      <FieldRow label="GOLDSTEIN">{event.goldstein_scale != null ? event.goldstein_scale.toFixed(1) : 'N/A'}</FieldRow>
      <FieldRow label="TONE">{event.avg_tone != null ? event.avg_tone.toFixed(1) : 'N/A'}</FieldRow>
      <FieldRow label="EVENT CODE">{event.event_code}</FieldRow>
      <FieldRow label="OCCURRED">{new Date(event.occurred_at).toUTCString()}</FieldRow>

      <div style={{
        marginTop: '8px', paddingTop: '6px',
        borderTop: '1px solid rgba(255,255,255,0.08)',
        fontFamily: 'monospace', fontSize: '8px',
        color: 'rgba(255,255,255,0.35)', fontStyle: 'italic', lineHeight: 1.4,
      }}>
        Data extracted automatically by the GDELT Project. Verify independently.
      </div>

      <button
        onClick={() => {
          useAppStore.getState().setGdeltOsintPrefill({
            lat: event.latitude, lon: event.longitude,
            ts: event.occurred_at, sourceUrl: event.source_url,
          });
        }}
        style={{
          width: '100%', marginTop: '8px',
          background: 'rgba(0,212,255,0.1)',
          border: '1px solid rgba(0,212,255,0.4)',
          color: '#00D4FF', fontFamily: 'monospace',
          fontSize: '10px', padding: '5px', cursor: 'pointer',
        }}
      >
        LOG AS OSINT EVENT
      </button>
    </div>
  );
}
