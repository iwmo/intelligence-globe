import { useAppStore } from '../store/useAppStore';
import { DraggablePanel } from './DraggablePanel';
import type { GdeltEvent } from '../hooks/useGdeltEvents';

interface GdeltDetailPanelProps {
  events: GdeltEvent[];
}

const LABEL_STYLE: React.CSSProperties = {
  color: 'rgba(0,212,255,0.6)',
  fontFamily: 'monospace',
  fontSize: '9px',
  letterSpacing: '0.08em',
  marginRight: '4px',
  flexShrink: 0,
};

const VALUE_STYLE: React.CSSProperties = {
  color: 'rgba(255,255,255,0.75)',
  fontFamily: 'monospace',
  fontSize: '9px',
  wordBreak: 'break-all',
};

const ROW_STYLE: React.CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  marginBottom: '4px',
};

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={ROW_STYLE}>
      <span style={LABEL_STYLE}>{label}:</span>
      <span style={VALUE_STYLE}>{children}</span>
    </div>
  );
}

export function GdeltDetailPanel({ events }: GdeltDetailPanelProps) {
  const selectedGdeltEventId = useAppStore(s => s.selectedGdeltEventId);
  const setSelectedGdeltEventId = useAppStore(s => s.setSelectedGdeltEventId);

  if (selectedGdeltEventId === null) return null;

  const event = events.find(e => e.global_event_id === selectedGdeltEventId);
  if (!event) return null;

  const defaultX = typeof window !== 'undefined' ? window.innerWidth - 300 : 900;

  return (
    <DraggablePanel
      id="gdelt-detail"
      title="GDELT EVENT"
      defaultPos={{ x: defaultX, y: 120 }}
      defaultWidth={280}
    >
      <div style={{ padding: '8px 10px' }}>
        {/* Close button */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '6px' }}>
          <button
            title="Close"
            onClick={() => setSelectedGdeltEventId(null)}
            style={{
              background: 'none',
              border: '1px solid rgba(0,212,255,0.3)',
              borderRadius: '2px',
              color: 'rgba(0,212,255,0.7)',
              cursor: 'pointer',
              fontFamily: 'monospace',
              fontSize: '11px',
              lineHeight: 1,
              width: '18px',
              height: '18px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 0,
            }}
          >
            X
          </button>
        </div>

        {/* Fields */}
        <FieldRow label="SOURCE">
          {event.source_url ? (
            <a
              href={event.source_url}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: 'rgba(0,212,255,0.8)', textDecoration: 'underline', fontFamily: 'monospace', fontSize: '9px', wordBreak: 'break-all' }}
            >
              {event.source_url}
            </a>
          ) : 'N/A'}
        </FieldRow>

        <FieldRow label="ACTOR 1">
          {event.actor1_name ?? 'N/A'}
        </FieldRow>

        <FieldRow label="ACTOR 2">
          {event.actor2_name ?? 'N/A'}
        </FieldRow>

        <FieldRow label="GOLDSTEIN">
          {event.goldstein_scale != null ? event.goldstein_scale.toFixed(1) : 'N/A'}
        </FieldRow>

        <FieldRow label="TONE">
          {event.avg_tone != null ? event.avg_tone.toFixed(1) : 'N/A'}
        </FieldRow>

        <FieldRow label="EVENT CODE">
          {event.event_code}
        </FieldRow>

        <FieldRow label="OCCURRED">
          {new Date(event.occurred_at).toUTCString()}
        </FieldRow>

        {/* Disclaimer */}
        <div style={{
          marginTop: '8px',
          paddingTop: '6px',
          borderTop: '1px solid rgba(255,255,255,0.08)',
          fontFamily: 'monospace',
          fontSize: '8px',
          color: 'rgba(255,255,255,0.35)',
          fontStyle: 'italic',
          lineHeight: 1.4,
        }}>
          Data extracted automatically by the GDELT Project. Verify independently.
        </div>

        {/* OSINT bridge button — Plan 05 */}
      </div>
    </DraggablePanel>
  );
}
