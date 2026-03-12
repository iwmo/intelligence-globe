import { useEffect, useRef, useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import { useReplaySnapshots } from '../hooks/useReplaySnapshots';
import { OSINT_EVENTS, EVENT_COLORS } from '../data/osintEvents';
import type { OsintEvent } from '../data/osintEvents';

const SPEED_PRESETS = [
  { label: '1m/s',  value: 60 },
  { label: '3m/s',  value: 180 },
  { label: '5m/s',  value: 300 },
  { label: '15m/s', value: 900 },
  { label: '1h/s',  value: 3600 },
] as const;

export function PlaybackBar() {
  const replayMode         = useAppStore(s => s.replayMode);
  const setReplayMode      = useAppStore(s => s.setReplayMode);
  const replayTs           = useAppStore(s => s.replayTs);
  const setReplayTs        = useAppStore(s => s.setReplayTs);
  const replayWindowStart  = useAppStore(s => s.replayWindowStart);
  const replayWindowEnd    = useAppStore(s => s.replayWindowEnd);
  const setReplayWindow    = useAppStore(s => s.setReplayWindow);
  const speedMultiplier    = useAppStore(s => s.replaySpeedMultiplier);
  const setSpeedMultiplier = useAppStore(s => s.setReplaySpeedMultiplier);

  const [isPlaying, setIsPlaying] = useState(false);

  // Fetch available replay window on mount and when mode changes
  useEffect(() => {
    fetch('/api/replay/window')
      .then(r => r.ok ? r.json() : null)
      .then((body: { oldest_ts: string | null; newest_ts: string | null } | null) => {
        if (!body?.oldest_ts || !body?.newest_ts) return;
        const start = new Date(body.oldest_ts).getTime();
        const end   = new Date(body.newest_ts).getTime();
        setReplayWindow(start, end);
        // Initialize replayTs to window end (most recent data)
        useAppStore.getState().setReplayTs(end);
      })
      .catch(() => { /* no data — scrubber shows disabled state */ });
  }, [setReplayWindow]);

  // Fetch 2-hour snapshot window when entering playback mode
  // replayWindowEnd is used as the center; fetch ±1 hour around it
  const snapshotWindowStart = replayWindowEnd ? replayWindowEnd - 2 * 60 * 60 * 1000 : null;
  const snapshotWindowEnd   = replayWindowEnd;
  useReplaySnapshots('all', snapshotWindowStart, snapshotWindowEnd, replayMode === 'playback');

  // rAF playback advancement loop
  const rafRef         = useRef<number>(0);
  const rafRunningRef  = useRef<boolean>(false);
  const lastFrameRef   = useRef<number>(0);

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

      // Read latest values via getState() to avoid stale closure
      const { replayTs: current, replaySpeedMultiplier: speed,
              replayWindowEnd: windowEnd, setReplayTs: setTs } = useAppStore.getState();
      const next = current + dt * speed * 1000; // ms
      if (windowEnd && next >= windowEnd) {
        setTs(windowEnd);
        rafRunningRef.current = false;
        setIsPlaying(false);
        return;
      }
      setTs(next);
      rafRef.current = requestAnimationFrame(tick);
    }

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      rafRunningRef.current = false;
      cancelAnimationFrame(rafRef.current);
    };
  // replayTs is intentionally NOT in deps — it's written by this loop, not read.
  // Reads happen inside tick() via useAppStore.getState() to avoid stale closure.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [replayMode, isPlaying]);

  // Scrubber 0-1000 integer
  const scrubberValue =
    replayWindowStart != null && replayWindowEnd != null && replayWindowEnd > replayWindowStart
      ? Math.round(((replayTs - replayWindowStart) / (replayWindowEnd - replayWindowStart)) * 1000)
      : 0;

  const hasWindow = replayWindowStart != null && replayWindowEnd != null;
  const formattedTs = new Date(replayTs).toISOString().slice(0, 19) + 'Z';

  // Toggle mode
  function handleModeToggle() {
    if (replayMode === 'live') {
      setReplayMode('playback');
    } else {
      setIsPlaying(false);
      setReplayMode('live');
      // Reset replayTs to now on return to live
      useAppStore.getState().setReplayTs(Date.now());
    }
  }

  return (
    <div style={{
      position: 'fixed',
      top: '26px',
      left: 0,
      right: 0,
      zIndex: 79,
      background: 'rgba(0,0,0,0.75)',
      borderBottom: '1px solid rgba(255,255,255,0.08)',
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      padding: '4px 12px',
      fontFamily: 'monospace',
      fontSize: '11px',
      color: '#ccc',
      pointerEvents: 'auto',
    }}>
      {/* LIVE / PLAYBACK toggle */}
      <button
        onClick={handleModeToggle}
        style={{
          background: replayMode === 'playback' ? '#ff3333' : 'rgba(255,255,255,0.1)',
          color: replayMode === 'playback' ? '#fff' : '#aaa',
          border: '1px solid rgba(255,255,255,0.2)',
          padding: '2px 8px',
          borderRadius: '3px',
          cursor: 'pointer',
          fontFamily: 'monospace',
          fontSize: '10px',
          fontWeight: 700,
          letterSpacing: '0.05em',
        }}
      >
        {replayMode === 'live' ? 'PLAYBACK' : 'LIVE'}
      </button>

      {replayMode === 'playback' && (
        <>
          {/* Play / Pause */}
          <button
            onClick={() => setIsPlaying(p => !p)}
            disabled={!hasWindow}
            style={{
              background: 'rgba(255,255,255,0.1)',
              color: '#ccc',
              border: '1px solid rgba(255,255,255,0.2)',
              padding: '2px 6px',
              borderRadius: '3px',
              cursor: hasWindow ? 'pointer' : 'not-allowed',
              fontFamily: 'monospace',
              fontSize: '10px',
            }}
          >
            {isPlaying ? 'PAUSE' : 'PLAY'}
          </button>

          {/* Timeline scrubber + event markers */}
          <div style={{ flex: 1, position: 'relative', height: '20px', display: 'flex', alignItems: 'center' }}>
            <input
              type="range"
              min={0}
              max={1000}
              value={scrubberValue}
              disabled={!hasWindow}
              onChange={e => {
                if (!replayWindowStart || !replayWindowEnd) return;
                const frac = parseInt(e.target.value) / 1000;
                setReplayTs(replayWindowStart + frac * (replayWindowEnd - replayWindowStart));
              }}
              style={{ width: '100%', position: 'relative', zIndex: 1 }}
            />
            {/* OSINT event marker dots overlaid on scrubber track */}
            {hasWindow && (OSINT_EVENTS as OsintEvent[]).map(evt => {
              const frac = (evt.ts - replayWindowStart!) / (replayWindowEnd! - replayWindowStart!);
              if (frac < 0 || frac > 1) return null;
              return (
                <div
                  key={evt.id}
                  data-event-id={evt.id}
                  title={evt.label}
                  onClick={() => setReplayTs(evt.ts)}
                  style={{
                    position: 'absolute',
                    left: `${frac * 100}%`,
                    top: '50%',
                    transform: 'translate(-50%, -50%)',
                    width: '8px',
                    height: '8px',
                    minWidth: '16px',
                    minHeight: '16px',
                    borderRadius: '50%',
                    background: EVENT_COLORS[evt.category] ?? '#fff',
                    cursor: 'pointer',
                    zIndex: 2,
                    border: '1px solid rgba(0,0,0,0.5)',
                    padding: '4px',
                    boxSizing: 'border-box',
                  }}
                />
              );
            })}
          </div>

          {/* Current timestamp */}
          {hasWindow ? (
            <span style={{ whiteSpace: 'nowrap', color: '#88ff88', fontSize: '10px' }}>
              {formattedTs}
            </span>
          ) : (
            <span style={{ whiteSpace: 'nowrap', color: '#888', fontSize: '10px' }}>
              No historical data
            </span>
          )}

          {/* Speed presets */}
          {SPEED_PRESETS.map(p => (
            <button
              key={p.value}
              onClick={() => setSpeedMultiplier(p.value)}
              style={{
                background: 'rgba(255,255,255,0.05)',
                color: speedMultiplier === p.value ? '#88ff88' : '#888',
                border: speedMultiplier === p.value
                  ? '1px solid #88ff88'
                  : '1px solid rgba(255,255,255,0.1)',
                padding: '2px 5px',
                borderRadius: '2px',
                cursor: 'pointer',
                fontFamily: 'monospace',
                fontSize: '10px',
                fontWeight: speedMultiplier === p.value ? 700 : 400,
              }}
            >
              {p.label}
            </button>
          ))}
        </>
      )}
    </div>
  );
}
