import type { CSSProperties } from 'react';
import { MapPin, Pin, PinOff, ScrollText } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { useGdeltEvents } from '../hooks/useGdeltEvents';
import { flyToPosition } from '../lib/viewerRegistry';
import { InspectorState } from './InspectorState';
import './contact-card.css';

export function GdeltDetailPanel() {
  const selectedGdeltEventId = useAppStore(s => s.selectedGdeltEventId);
  const { data: events } = useGdeltEvents();
  const pinnedContacts = useAppStore(s => s.pinnedContacts);
  const togglePinnedContact = useAppStore(s => s.togglePinnedContact);

  if (selectedGdeltEventId === null) return null;

  const event = (events ?? []).find(e => e.global_event_id === selectedGdeltEventId);
  if (!event) {
    return <InspectorState state="empty">This event is no longer available in the current feed.</InspectorState>;
  }
  const isPinned = pinnedContacts.some(contact =>
    contact.kind === 'gdelt' && String(contact.id) === String(event.global_event_id)
  );

  return (
    <article
      className="contact-card"
      style={{ '--contact-accent': 'var(--status-connecting)' } as CSSProperties}
    >
      <header className="contact-card__selection">
        <div className="contact-card__eyebrow">
          <span>GDELT EVENT</span>
          <time>{new Date(event.occurred_at).toLocaleString()}</time>
        </div>
        <h3>{event.actor1_name || event.actor2_name
          ? `${event.actor1_name ?? 'Unknown'} ↔ ${event.actor2_name ?? 'Unknown'}`
          : `EVENT ${event.global_event_id}`}</h3>
        <dl className="contact-card__telemetry">
          <div><dt>TONE</dt><dd>{event.avg_tone?.toFixed(1) ?? 'N/A'}</dd></div>
          <div><dt>IMPACT</dt><dd>{event.goldstein_scale?.toFixed(1) ?? 'N/A'}</dd></div>
          <div><dt>CODE</dt><dd>{event.event_code}</dd></div>
        </dl>
      </header>

      <section className="contact-card__section" aria-labelledby={`event-actions-${event.global_event_id}`}>
        <h4 id={`event-actions-${event.global_event_id}`}>Actions</h4>
        <div className="contact-card__actions">
          <button
            type="button"
            onClick={() => flyToPosition(event.longitude, event.latitude, 80_000)}
          >
            <MapPin aria-hidden="true" />
            Center
          </button>
          <button
            type="button"
            data-active={isPinned}
            onClick={() => togglePinnedContact({ kind: 'gdelt', id: event.global_event_id })}
          >
            {isPinned ? <PinOff aria-hidden="true" /> : <Pin aria-hidden="true" />}
            {isPinned ? 'Unpin' : 'Pin'}
          </button>
          <button
            type="button"
            onClick={() => {
              useAppStore.getState().setGdeltOsintPrefill({
                lat: event.latitude,
                lon: event.longitude,
                ts: event.occurred_at,
                sourceUrl: event.source_url,
              });
            }}
          >
            <ScrollText aria-hidden="true" />
            LOG AS OSINT EVENT
          </button>
        </div>
      </section>

      <section className="contact-card__section" aria-labelledby={`event-context-${event.global_event_id}`}>
        <h4 id={`event-context-${event.global_event_id}`}>Context</h4>
        <dl className="contact-card__facts">
          <div><dt>Actor 1</dt><dd>{event.actor1_name ?? 'N/A'}</dd></div>
          <div><dt>Actor 2</dt><dd>{event.actor2_name ?? 'N/A'}</dd></div>
          <div><dt>Latitude</dt><dd>{event.latitude.toFixed(4)}</dd></div>
          <div><dt>Longitude</dt><dd>{event.longitude.toFixed(4)}</dd></div>
        </dl>
        <div className="contact-card__context-copy">
          {event.source_url ? (
            <a href={event.source_url} target="_blank" rel="noopener noreferrer">
              Open source report
            </a>
          ) : 'Source URL unavailable'}
        </div>
      </section>

      <section className="contact-card__section" aria-labelledby={`event-history-${event.global_event_id}`}>
        <h4 id={`event-history-${event.global_event_id}`}>History</h4>
        <div className="contact-card__history-copy">
          Occurred {new Date(event.occurred_at).toUTCString()}.
        </div>
      </section>

      <details className="contact-card__details">
        <summary>Details</summary>
        <div>
          Event ID {event.global_event_id}. Data extracted automatically by the GDELT Project.
          Verify independently before operational use.
        </div>
      </details>
    </article>
  );
}
