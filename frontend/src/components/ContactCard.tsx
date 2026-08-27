import type { CSSProperties, ReactNode } from 'react';
import { Crosshair, MapPin, Pin, PinOff } from 'lucide-react';
import { useAppStore, type TrackableKind } from '../store/useAppStore';
import { canEnterCockpit } from '../lib/trackContact';
import { flyToPosition } from '../lib/viewerRegistry';
import './contact-card.css';

interface ContactCardProps {
  kind: TrackableKind;
  id: string | number;
  title: string;
  altitude: string;
  speed: string;
  heading?: string;
  accent: string;
  source: string;
  freshness?: string | null;
  position?: { lat: number; lon: number; altitudeMeters?: number | null };
  notice?: ReactNode;
  context?: ReactNode;
  history?: ReactNode;
  children?: ReactNode;
  trackable?: boolean;
}

function freshnessLabel(value?: string | null): string {
  if (!value) return 'Freshness unavailable';
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return value;
  const ageSeconds = Math.max(0, Math.round((Date.now() - timestamp) / 1000));
  if (ageSeconds < 60) return `${ageSeconds}s ago`;
  if (ageSeconds < 3600) return `${Math.floor(ageSeconds / 60)}m ago`;
  return `${Math.floor(ageSeconds / 3600)}h ago`;
}

export function ContactCard({
  kind,
  id,
  title,
  altitude,
  speed,
  heading = '--',
  accent,
  source,
  freshness,
  position,
  notice,
  context,
  history,
  children,
  trackable = true,
}: ContactCardProps) {
  const tracked = useAppStore(s => s.trackedEntity);
  const setTrackedEntity = useAppStore(s => s.setTrackedEntity);
  const cockpitMode = useAppStore(s => s.cockpitMode);
  const setCockpitMode = useAppStore(s => s.setCockpitMode);
  const pinnedContacts = useAppStore(s => s.pinnedContacts);
  const togglePinnedContact = useAppStore(s => s.togglePinnedContact);
  const isTracked = tracked?.kind === kind && String(tracked.id) === String(id);
  const isPinned = pinnedContacts.some(contact =>
    contact.kind === kind && String(contact.id) === String(id)
  );

  return (
    <article
      className="contact-card"
      style={{ '--contact-accent': accent } as CSSProperties}
    >
      <header className="contact-card__selection">
        <div className="contact-card__eyebrow">
          <span>{kind.toUpperCase()}</span>
          <time>{freshnessLabel(freshness)}</time>
        </div>
        <h3>{title}</h3>
        <dl className="contact-card__telemetry">
          <div><dt>ALT</dt><dd>{altitude}</dd></div>
          <div><dt>SPD</dt><dd>{speed}</dd></div>
          <div><dt>HDG</dt><dd>{heading}</dd></div>
        </dl>
        {notice}
      </header>

      <section className="contact-card__section" aria-labelledby={`actions-${kind}-${id}`}>
        <h4 id={`actions-${kind}-${id}`}>Actions</h4>
        <div className="contact-card__actions">
          {trackable && (
            <button
              type="button"
              data-active={isTracked}
              onClick={() => setTrackedEntity(isTracked ? null : { kind, id })}
            >
              <Crosshair aria-hidden="true" />
              {isTracked ? 'Tracking' : 'Track'}
            </button>
          )}
          {position && (
            <button
              type="button"
              onClick={() => flyToPosition(
                position.lon,
                position.lat,
                position.altitudeMeters ?? 10_000,
              )}
            >
              <MapPin aria-hidden="true" />
              Center
            </button>
          )}
          <button
            type="button"
            data-active={isPinned}
            onClick={() => togglePinnedContact({ kind, id })}
          >
            {isPinned ? <PinOff aria-hidden="true" /> : <Pin aria-hidden="true" />}
            {isPinned ? 'Unpin' : 'Pin'}
          </button>
          {trackable && canEnterCockpit(kind) && isTracked && (
            <button
              type="button"
              data-active={cockpitMode}
              onClick={() => setCockpitMode(!cockpitMode)}
            >
              {cockpitMode ? 'Exit cockpit' : 'Cockpit'}
            </button>
          )}
        </div>
      </section>

      <section className="contact-card__section" aria-labelledby={`context-${kind}-${id}`}>
        <h4 id={`context-${kind}-${id}`}>Context</h4>
        <dl className="contact-card__facts">
          <div><dt>Source</dt><dd>{source}</dd></div>
          <div><dt>Identifier</dt><dd>{id}</dd></div>
        </dl>
        {context}
      </section>

      {history && (
        <section className="contact-card__section" aria-labelledby={`history-${kind}-${id}`}>
          <h4 id={`history-${kind}-${id}`}>History</h4>
          {history}
        </section>
      )}

      {children && (
        <details className="contact-card__details" open>
          <summary>Details</summary>
          <div>{children}</div>
        </details>
      )}
    </article>
  );
}
