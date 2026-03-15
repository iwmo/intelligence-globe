import { useEffect, useRef, useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import { queryClient } from '../lib/queryClient';
import { useReplaySnapshots } from '../hooks/useReplaySnapshots';
import { useOsintEvents } from '../hooks/useOsintEvents';
import { EVENT_COLORS } from '../data/osintEvents';
import type { OsintEvent } from '../data/osintEvents';
import { useGdeltEvents } from '../hooks/useGdeltEvents';
import type { GdeltEvent } from '../hooks/useGdeltEvents';
import { QUAD_CLASS_HEX } from '../data/gdeltColors';

const SPEED_PRESETS = [
  { label: '1m/s',  value: 60 },
  { label: '3m/s',  value: 180 },
  { label: '5m/s',  value: 300 },
  { label: '15m/s', value: 900 },
  { label: '1h/s',  value: 3600 },
] as const;

const OSINT_CATEGORIES = ['KINETIC', 'AIRSPACE', 'MARITIME', 'SEISMIC', 'JAMMING'] as const;

interface PlaybackBarProps { onOpenOsintPanel?: () => void; }

export function PlaybackBar({ onOpenOsintPanel }: PlaybackBarProps) {
  const replayMode         = useAppStore(s => s.replayMode);
  const setReplayMode      = useAppStore(s => s.setReplayMode);
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

  // Live UTC clock for LIVE mode display
  const [utcTime, setUtcTime] = useState(() => new Date().toISOString().slice(0, 19) + 'Z');
  useEffect(() => {
    const id = setInterval(() => setUtcTime(new Date().toISOString().slice(0, 19) + 'Z'), 1000);
    return () => clearInterval(id);
  }, []);

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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [replayMode, isPlaying]);

  const scrubberValue =
    replayWindowStart != null && replayWindowEnd != null && replayWindowEnd > replayWindowStart
      ? Math.round(((replayTs - replayWindowStart) / (replayWindowEnd - replayWindowStart)) * 1000)
      : 0;

  const hasWindow = replayWindowStart != null && replayWindowEnd != null;
  const formattedTs = new Date(replayTs).toISOString().slice(0, 19) + 'Z';

  function handleModeToggle() {
    if (replayMode === 'live') {
      setReplayMode('playback');
    } else {
      useAppStore.getState().setIsPlaying(false);
      setReplayMode('live');
      useAppStore.getState().setReplayTs(Date.now());
      queryClient.invalidateQueries();
    }
  }

  const btnBase = {
    fontFamily: 'monospace', fontSize: '10px', cursor: 'pointer',
    border: '1px solid rgba(255,255,255,0.2)', borderRadius: '3px',
    padding: '2px 7px', background: 'rgba(255,255,255,0.08)', color: '#aaa',
  };

  return (
    <div style={{
      position: 'fixed', top: '26px', left: 40, right: 40,
      zIndex: 79,
      background: 'rgba(0,0,0,0.80)',
      backdropFilter: 'blur(6px)',
      WebkitBackdropFilter: 'blur(6px)',
      borderBottom: '1px solid rgba(255,255,255,0.07)',
      fontFamily: 'monospace', fontSize: '11px', color: '#ccc',
      pointerEvents: 'auto',
      height: replayMode === 'playback' ? 60 : 36,
      transition: 'height 0.18s ease',
      overflow: 'hidden',
      display: 'flex', flexDirection: 'column',
    }}>

      {/* Row 1 — always visible */}
      <div style={{
        height: 36, flexShrink: 0,
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '0 12px',
      }}>
        {replayMode === 'live' ? (
          <>
            <span style={{ color: '#ff3333', animation: 'hud-pulse 2s ease-in-out infinite', fontSize: 10 }}>●</span>
            <span style={{ color: '#00ff00', fontSize: 10, letterSpacing: '0.08em' }}>REC</span>
            <span style={{ color: '#00ff00', fontSize: 10, fontVariantNumeric: 'tabular-nums' }}>{utcTime}</span>
            <div style={{ flex: 1 }} />
            <button onClick={handleModeToggle} style={{ ...btnBase, fontWeight: 700, letterSpacing: '0.05em' }}>
              PLAYBACK ▶
            </button>
          </>
        ) : (
          <>
            <button onClick={handleModeToggle} style={{ ...btnBase, background: 'rgba(255,51,51,0.15)', color: '#ff6666', borderColor: 'rgba(255,51,51,0.4)', fontWeight: 700 }}>
              ← LIVE
            </button>
            <button
              onClick={() => setIsPlaying(p => !p)}
              disabled={!hasWindow || snapshotsLoading}
              style={{ ...btnBase, color: '#ccc', cursor: (hasWindow && !snapshotsLoading) ? 'pointer' : 'not-allowed' }}
            >
              {snapshotsLoading ? '...' : isPlaying ? 'PAUSE' : 'PLAY'}
            </button>
            {hasWindow
              ? <span style={{ color: '#88ff88', fontSize: 10, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{formattedTs}</span>
              : <span style={{ color: '#888', fontSize: 10, whiteSpace: 'nowrap' }}>No data</span>
            }
            <div style={{ flex: 1 }} />
            {SPEED_PRESETS.map(p => (
              <button key={p.value} onClick={() => setSpeedMultiplier(p.value)} style={{
                ...btnBase,
                color: speedMultiplier === p.value ? '#88ff88' : '#666',
                border: speedMultiplier === p.value ? '1px solid #88ff88' : '1px solid rgba(255,255,255,0.1)',
                fontWeight: speedMultiplier === p.value ? 700 : 400,
                padding: '2px 4px',
              }}>{p.label}</button>
            ))}
            <button onClick={() => onOpenOsintPanel?.()} style={{
              ...btnBase, background: 'rgba(0,212,255,0.12)',
              color: '#00D4FF', border: '1px solid rgba(0,212,255,0.4)', fontWeight: 700,
            }}>LOG</button>
            {tleStalenessWarning && (
              <span style={{ color: '#ff3333', fontSize: 9, flexShrink: 0, whiteSpace: 'nowrap' }}>TLE&gt;7d</span>
            )}
          </>
        )}
      </div>

      {/* Row 2 — PLAYBACK only: scrubber + category chips */}
      {replayMode === 'playback' && (
        <div style={{
          height: 24, flexShrink: 0,
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '0 12px',
        }}>
          {/* Timeline scrubber */}
          <div style={{ flex: 1, position: 'relative', height: 20, display: 'flex', alignItems: 'center' }}>
            <input type="range" min={0} max={1000} value={scrubberValue} disabled={!hasWindow}
              onChange={e => {
                if (!replayWindowStart || !replayWindowEnd) return;
                const frac = parseInt(e.target.value) / 1000;
                setReplayTs(replayWindowStart + frac * (replayWindowEnd - replayWindowStart));
              }}
              style={{ width: '100%', position: 'relative', zIndex: 1 }}
            />
            {hasWindow && (() => {
              const visibleEvents: OsintEvent[] = activeCategories.length === 0
                ? osintEvents : osintEvents.filter(e => activeCategories.includes(e.category));
              return visibleEvents.map(evt => {
                const frac = (evt.ts - replayWindowStart!) / (replayWindowEnd! - replayWindowStart!);
                if (frac < 0 || frac > 1) return null;
                return (
                  <div key={evt.id} data-event-id={evt.id} title={evt.label}
                    onClick={() => { setReplayTs(evt.ts); if (evt.latitude != null && evt.longitude != null) setAreaOfInterest({ lat: evt.latitude, lon: evt.longitude }); }}
                    style={{
                      position: 'absolute', left: `${frac * 100}%`, top: '50%',
                      transform: 'translate(-50%, -50%)',
                      width: 8, height: 8, minWidth: 16, minHeight: 16,
                      borderRadius: '50%', background: EVENT_COLORS[evt.category] ?? '#fff',
                      cursor: 'pointer', zIndex: 2,
                      border: '1px solid rgba(0,0,0,0.5)', padding: 4, boxSizing: 'border-box',
                    }}
                  />
                );
              });
            })()}
            {hasWindow && (() => (gdeltEvents ?? []).map((evt: GdeltEvent) => {
              const ts = new Date(evt.occurred_at).getTime();
              const frac = (ts - replayWindowStart!) / (replayWindowEnd! - replayWindowStart!);
              if (frac < 0 || frac > 1) return null;
              return (
                <div key={`gdelt-${evt.global_event_id}`} title={`GDELT Q${evt.quad_class} ${evt.occurred_at}`}
                  style={{
                    position: 'absolute', left: `${frac * 100}%`, top: '50%',
                    transform: 'translate(-50%, -50%)',
                    width: 8, height: 8, minWidth: 16, minHeight: 16,
                    borderRadius: '50%', background: QUAD_CLASS_HEX[evt.quad_class] ?? '#fff',
                    cursor: 'default', zIndex: 2,
                    border: '1px solid rgba(0,0,0,0.5)', padding: 4, boxSizing: 'border-box',
                  }}
                />
              );
            }))()}
          </div>

          {/* Category chips */}
          <div style={{ display: 'flex', gap: 3, flexShrink: 0 }}>
            {OSINT_CATEGORIES.map(cat => (
              <button key={cat} onClick={() => toggleCategory(cat)} style={{
                background: (activeCategories.length === 0 || activeCategories.includes(cat)) ? EVENT_COLORS[cat] : 'rgba(255,255,255,0.05)',
                color: '#fff', border: '1px solid rgba(255,255,255,0.2)',
                padding: '1px 4px', borderRadius: '2px', cursor: 'pointer',
                fontFamily: 'monospace', fontSize: '8px', fontWeight: 700,
                opacity: (activeCategories.length === 0 || activeCategories.includes(cat)) ? 1 : 0.35,
              }}>{cat}</button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
