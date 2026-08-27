import { useEffect, useRef, type CSSProperties } from 'react';
import { ChevronDown, ChevronUp, Pause, Play, ScrollText } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { useReplaySnapshots } from '../hooks/useReplaySnapshots';
import { useOsintEvents } from '../hooks/useOsintEvents';
import { EVENT_COLORS } from '../data/osintEvents';
import type { OsintEvent } from '../data/osintEvents';
import { useGdeltEvents } from '../hooks/useGdeltEvents';
import type { GdeltEvent } from '../hooks/useGdeltEvents';
import { QUAD_CLASS_HEX } from '../data/gdeltColors';
import './playback-drawer.css';

const SPEED_PRESETS = [
  { label: '60×',   value: 60 },
  { label: '180×',  value: 180 },
  { label: '300×',  value: 300 },
  { label: '900×',  value: 900 },
  { label: '3600×', value: 3600 },
] as const;

const OSINT_CATEGORIES = ['KINETIC', 'AIRSPACE', 'MARITIME', 'SEISMIC', 'JAMMING'] as const;

interface PlaybackBarProps { onOpenOsintPanel?: () => void; }

export function PlaybackBar({ onOpenOsintPanel }: PlaybackBarProps) {
  const replayMode         = useAppStore(s => s.replayMode);
  const replayTs           = useAppStore(s => s.replayTs);
  const setReplayTs        = useAppStore(s => s.setReplayTs);
  const replayWindowStart  = useAppStore(s => s.replayWindowStart);
  const replayWindowEnd    = useAppStore(s => s.replayWindowEnd);
  const setReplayWindow    = useAppStore(s => s.setReplayWindow);
  const speedMultiplier    = useAppStore(s => s.replaySpeedMultiplier);
  const setSpeedMultiplier = useAppStore(s => s.setReplaySpeedMultiplier);
  const activeCategories   = useAppStore(s => s.activeCategories);
  const toggleCategory     = useAppStore(s => s.toggleCategory);
  const setAreaOfInterest  = useAppStore(s => s.setAreaOfInterest);
  const tleLastUpdated     = useAppStore(s => s.tleLastUpdated);
  const isPlaying          = useAppStore(s => s.isPlaying);
  const setIsPlaying       = useAppStore(s => s.setIsPlaying);
  const expanded           = useAppStore(s => s.replayTimelineExpanded);
  const setExpanded        = useAppStore(s => s.setReplayTimelineExpanded);
  const pinnedContacts     = useAppStore(s => s.pinnedContacts);
  const selectedAircraftId = useAppStore(s => s.selectedAircraftId);
  const selectedMilitaryId = useAppStore(s => s.selectedMilitaryId);
  const selectedShipId = useAppStore(s => s.selectedShipId);
  const selectedSatelliteId = useAppStore(s => s.selectedSatelliteId);
  const selectedGdeltEventId = useAppStore(s => s.selectedGdeltEventId);

  const TLE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
  const tleAge = tleLastUpdated ? Date.now() - new Date(tleLastUpdated).getTime() : 0;
  const tleStalenessWarning = replayMode === 'playback' && tleLastUpdated != null && tleAge > TLE_MAX_AGE_MS;

  const { events: osintEvents } = useOsintEvents(replayMode === 'playback');
  const { data: gdeltEvents } = useGdeltEvents();

  useEffect(() => {
    fetch('/api/replay/window')
      .then(r => r.ok ? r.json() : null)
      .then((body: { oldest_ts: string | null; newest_ts: string | null } | null) => {
        if (!body?.oldest_ts || !body?.newest_ts) return;
        const start = new Date(body.oldest_ts).getTime();
        const end   = new Date(body.newest_ts).getTime();
        setReplayWindow(start, end);
        useAppStore.getState().setReplayTs(end);
      })
      .catch(() => {});
  }, [setReplayWindow]);

  const snapshotWindowStart = replayWindowEnd ? replayWindowEnd - 2 * 60 * 60 * 1000 : null;
  const snapshotWindowEnd   = replayWindowEnd;
  const { isLoading: snapshotsLoading } = useReplaySnapshots(
    'all', snapshotWindowStart, snapshotWindowEnd, replayMode === 'playback'
  );

  const rafRef        = useRef<number>(0);
  const rafRunningRef = useRef<boolean>(false);
  const lastFrameRef  = useRef<number>(0);

  useEffect(() => {
    if (replayMode !== 'playback' || !isPlaying) {
      rafRunningRef.current = false;
      cancelAnimationFrame(rafRef.current);
      lastFrameRef.current = 0;
      return;
    }
    rafRunningRef.current = true;
    lastFrameRef.current = 0;
    function tick(now: number) {
      if (!rafRunningRef.current) return;
      const dt = lastFrameRef.current ? (now - lastFrameRef.current) / 1000 : 0;
      lastFrameRef.current = now;
      const { replayTs: current, replaySpeedMultiplier: speed,
              replayWindowEnd: windowEnd, setReplayTs: setTs } = useAppStore.getState();
      const next = current + dt * speed * 1000;
      if (windowEnd && next >= windowEnd) {
        setTs(windowEnd);
        rafRunningRef.current = false;
        useAppStore.getState().setIsPlaying(false);
        return;
      }
      setTs(next);
      rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => { rafRunningRef.current = false; cancelAnimationFrame(rafRef.current); };
  }, [replayMode, isPlaying]);

  const scrubberValue =
    replayWindowStart != null && replayWindowEnd != null && replayWindowEnd > replayWindowStart
      ? Math.round(((replayTs - replayWindowStart) / (replayWindowEnd - replayWindowStart)) * 1000)
      : 0;

  const hasWindow =
    replayWindowStart != null &&
    replayWindowEnd != null &&
    replayWindowEnd > replayWindowStart;
  const formattedTs = new Date(replayTs).toISOString().slice(0, 19) + 'Z';
  const selectedSummary =
    selectedAircraftId != null ? `AIRCRAFT ${selectedAircraftId}` :
    selectedMilitaryId != null ? `MILITARY ${selectedMilitaryId}` :
    selectedShipId != null ? `VESSEL ${selectedShipId}` :
    selectedSatelliteId != null ? `SATELLITE ${selectedSatelliteId}` :
    selectedGdeltEventId != null ? `EVENT ${selectedGdeltEventId}` :
    'NO SELECTION';
  const visibleEvents: OsintEvent[] = activeCategories.length === 0
    ? osintEvents
    : osintEvents.filter(event => activeCategories.includes(event.category));

  if (replayMode !== 'playback') return null;

  return (
    <section
      className="playback-drawer"
      data-expanded={expanded}
      aria-label="Replay timeline"
    >
      <header className="playback-drawer__header">
        <div className="playback-drawer__identity">
          <span>HISTORY</span>
          <strong>REPLAY TIMELINE</strong>
          <span className="playback-drawer__selection" title={selectedSummary}>
            {selectedSummary}
          </span>
        </div>
        <div className="playback-drawer__transport">
          <time dateTime={new Date(replayTs).toISOString()}>
            {hasWindow ? formattedTs : 'NO REPLAY DATA'}
          </time>
          {tleStalenessWarning && (
            <span className="playback-drawer__warning">TLE &gt; 7 DAYS</span>
          )}
          <button
            type="button"
            className="playback-drawer__play"
            onClick={() => setIsPlaying(previous => !previous)}
            disabled={!hasWindow || snapshotsLoading}
            aria-label={isPlaying ? 'Pause replay' : 'Play replay'}
          >
            {isPlaying ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}
            {snapshotsLoading ? '...' : isPlaying ? 'PAUSE' : 'PLAY'}
          </button>
          <button
            type="button"
            className="playback-drawer__log"
            onClick={() => onOpenOsintPanel?.()}
          >
            <ScrollText aria-hidden="true" />
            LOG EVENT
          </button>
          <button
            type="button"
            className="playback-drawer__collapse"
            onClick={() => setExpanded(!expanded)}
            aria-expanded={expanded}
            aria-label={expanded ? 'Collapse replay timeline' : 'Expand replay timeline'}
          >
            {expanded ? <ChevronDown aria-hidden="true" /> : <ChevronUp aria-hidden="true" />}
          </button>
        </div>
      </header>

      {expanded && (
        <div className="playback-drawer__body">
          <div className="playback-drawer__timeline">
            <label htmlFor="replay-timeline-range">Replay position</label>
            <div className="playback-drawer__track">
              <input
                id="replay-timeline-range"
                type="range"
                min={0}
                max={1000}
                value={scrubberValue}
                disabled={!hasWindow}
                aria-valuetext={hasWindow ? formattedTs : 'No replay data'}
                onChange={event => {
                  if (replayWindowStart == null || replayWindowEnd == null) return;
                  const fraction = Number.parseInt(event.target.value, 10) / 1000;
                  setReplayTs(replayWindowStart + fraction * (replayWindowEnd - replayWindowStart));
                }}
              />
              {hasWindow && visibleEvents.map(event => {
                const fraction = (event.ts - replayWindowStart) / (replayWindowEnd - replayWindowStart);
                if (fraction < 0 || fraction > 1) return null;
                return (
                  <button
                    key={event.id}
                    type="button"
                    className="playback-drawer__marker"
                    data-event-id={event.id}
                    title={event.label}
                    aria-label={`Jump to ${event.label}`}
                    onClick={() => {
                      setReplayTs(event.ts);
                      if (event.latitude != null && event.longitude != null) {
                        setAreaOfInterest({ lat: event.latitude, lon: event.longitude });
                      }
                    }}
                    style={{
                      left: `${fraction * 100}%`,
                      background: EVENT_COLORS[event.category] ?? '#fff',
                    }}
                  />
                );
              })}
              {hasWindow && (gdeltEvents ?? []).map((event: GdeltEvent) => {
                const timestamp = new Date(event.occurred_at).getTime();
                const fraction = (timestamp - replayWindowStart) / (replayWindowEnd - replayWindowStart);
                if (fraction < 0 || fraction > 1) return null;
                return (
                  <button
                    key={`gdelt-${event.global_event_id}`}
                    type="button"
                    className="playback-drawer__marker"
                    data-testid={`gdelt-dot-${event.global_event_id}`}
                    title={`GDELT Q${event.quad_class} ${event.occurred_at}`}
                    aria-label={`Jump to GDELT event ${event.global_event_id}`}
                    onClick={() => {
                      setReplayTs(timestamp);
                      setAreaOfInterest({ lat: event.latitude, lon: event.longitude });
                    }}
                    style={{
                      left: `${fraction * 100}%`,
                      background: QUAD_CLASS_HEX[event.quad_class] ?? '#fff',
                    }}
                  />
                );
              })}
            </div>
            <div className="playback-drawer__range">
              <span>{hasWindow ? new Date(replayWindowStart).toISOString().slice(11, 19) : '--:--:--'}</span>
              <span>{hasWindow ? new Date(replayWindowEnd).toISOString().slice(11, 19) : '--:--:--'}</span>
            </div>
          </div>

          <div className="playback-drawer__controls">
            <div className="playback-drawer__control-group" aria-label="Replay speed">
              <span>SPEED</span>
              <div>
                {SPEED_PRESETS.map(preset => (
                  <button
                    key={preset.value}
                    type="button"
                    aria-pressed={speedMultiplier === preset.value}
                    onClick={() => setSpeedMultiplier(preset.value)}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="playback-drawer__control-group" aria-label="Event categories">
              <span>EVENT FILTERS</span>
              <div>
                {OSINT_CATEGORIES.map(category => {
                  const active = activeCategories.length === 0 || activeCategories.includes(category);
                  return (
                    <button
                      key={category}
                      type="button"
                      aria-pressed={active}
                      data-category={category}
                      onClick={() => toggleCategory(category)}
                      style={{ '--category-color': EVENT_COLORS[category] } as CSSProperties}
                    >
                      {category}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <footer className="playback-drawer__footer">
            <span>{pinnedContacts.length} PINNED PRESERVED</span>
            <span>{snapshotsLoading ? 'LOADING HISTORY' : hasWindow ? 'HISTORY READY' : 'HISTORY UNAVAILABLE'}</span>
          </footer>
        </div>
      )}
    </section>
  );
}
