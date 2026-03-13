import { useState, useEffect } from 'react';
import type { Viewer } from 'cesium';
import { Math as CesiumMath } from 'cesium';
import { forward } from 'mgrs';
import { useAppStore } from '../store/useAppStore';

/**
 * getCameraGridRef — pure helper for MGRS conversion.
 * Takes [lon, lat] in degrees, returns MGRS string.
 * Returns 'UPS' for polar regions (lat > 84 or lat < -80).
 * Returns '---' on any conversion error.
 */
export function getCameraGridRef(lonLat: [number, number]): string {
  const [, lat] = lonLat;
  if (lat > 84 || lat < -80) {
    return 'UPS';
  }
  try {
    return forward(lonLat, 4);
  } catch {
    return '---';
  }
}

interface CinematicHUDProps {
  viewer: Viewer | null;
}

/**
 * CinematicHUD — persistent tactical overlay.
 * Full-viewport overlay with pointer-events: none on the root.
 * Only the Clean UI toggle button re-enables pointer events.
 */
export function CinematicHUD({ viewer }: CinematicHUDProps) {
  const cleanUI             = useAppStore(s => s.cleanUI);
  const setCleanUI          = useAppStore(s => s.setCleanUI);
  const selectedSatelliteId = useAppStore(s => s.selectedSatelliteId);
  const replayMode          = useAppStore(s => s.replayMode);
  const replayTs            = useAppStore(s => s.replayTs);
  const [mgrsStr, setMgrsStr] = useState('...');
  const [altKm, setAltKm] = useState(0);
  const [latLon, setLatLon] = useState<[string, string]>(['0.0000', '0.0000']);
  const [utcTime, setUtcTime] = useState(() => new Date().toISOString().replace('.000Z', 'Z'));

  // MGRS update on camera move
  useEffect(() => {
    if (!viewer) return;
    const handler = () => {
      const cart = viewer.camera.positionCartographic;
      const lon = CesiumMath.toDegrees(cart.longitude);
      const lat = CesiumMath.toDegrees(cart.latitude);
      setMgrsStr(getCameraGridRef([lon, lat]));
      setAltKm(Math.round(cart.height / 1000));
      setLatLon([lat.toFixed(4), lon.toFixed(4)]);
    };
    viewer.camera.moveEnd.addEventListener(handler);
    return () => viewer.camera.moveEnd.removeEventListener(handler);
  }, [viewer]);

  // Live UTC clock updated every second
  useEffect(() => {
    const id = setInterval(() => {
      setUtcTime(new Date().toISOString().slice(0, 19) + 'Z');
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const pulseStyle: React.CSSProperties = {
    display: 'inline-block',
    color: '#ff3333',
    animation: 'hud-pulse 2s ease-in-out infinite',
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 80,
        pointerEvents: 'none',
        fontFamily: 'monospace',
      }}
    >
      {/* Keyframe animation injected as a style tag */}
      <style>{`
        @keyframes hud-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>

      {/* 1. Classification Banner — top center */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          background: 'rgba(0, 80, 0, 0.7)',
          color: '#00ff00',
          textAlign: 'center',
          padding: '4px 0',
          fontSize: '11px',
          fontFamily: 'monospace',
          letterSpacing: '0.15em',
          textTransform: 'uppercase',
          userSelect: 'none',
        }}
      >
        TOP SECRET // SI // TK // NOFORN
      </div>

      {/* 2. MGRS Readout — top-right, below PlaybackBar */}
      <div
        style={{
          position: 'absolute',
          top: 62,
          right: 12,
          color: '#00ff00',
          fontSize: '12px',
          lineHeight: '1.6',
          textAlign: 'right',
          userSelect: 'none',
        }}
      >
        <div style={{ fontSize: '14px', fontWeight: 'bold', letterSpacing: '0.1em' }}>
          {mgrsStr}
        </div>
        <div>ALT: {altKm} km</div>
        <div>
          {latLon[0]}° N / {latLon[1]}° E
        </div>
      </div>

      {/* 3. Telemetry Panel — bottom-right */}
      <div
        style={{
          position: 'absolute',
          bottom: 40,
          right: 12,
          color: '#00ff00',
          fontSize: '11px',
          lineHeight: '1.8',
          textAlign: 'right',
          userSelect: 'none',
        }}
      >
        <div style={{ marginBottom: 4, letterSpacing: '0.08em', opacity: 0.7 }}>
          {selectedSatelliteId !== null ? `SAT ID: ${selectedSatelliteId}` : 'NO SAT SELECTED'}
        </div>
        <div>ORB: --</div>
        <div>PASS: --</div>
        <div>GSD: --</div>
        <div>SUN EL: --</div>
      </div>

      {/* 4. REC / REPLAY Timestamp — top-left, below PlaybackBar */}
      <div
        style={{
          position: 'absolute',
          top: 62,
          left: 8,
          color: '#00ff00',
          fontSize: '12px',
          lineHeight: '1.6',
          userSelect: 'none',
        }}
      >
        {replayMode === 'live' ? (
          <>
            <div>
              <span style={pulseStyle}>&#9679;</span>
              {' '}REC
            </div>
            <div>{utcTime}</div>
          </>
        ) : (
          <>
            <div>REPLAY</div>
            <div>{new Date(replayTs).toISOString().slice(0, 19) + 'Z'}</div>
          </>
        )}
      </div>

      {/* 5. Clean UI Toggle — bottom-left, offset right to clear SAT/AIR layer toggles */}
      <button
        onClick={() => setCleanUI(!cleanUI)}
        style={{
          position: 'absolute',
          bottom: 40,
          left: 80,
          pointerEvents: 'auto',
          background: 'rgba(0, 0, 0, 0.6)',
          border: '1px solid rgba(0, 255, 0, 0.5)',
          color: '#00ff00',
          fontFamily: 'monospace',
          fontSize: '11px',
          padding: '4px 10px',
          cursor: 'pointer',
          letterSpacing: '0.1em',
          userSelect: 'none',
        }}
      >
        {cleanUI ? '[FULL UI]' : '[CLEAN UI]'}
      </button>
    </div>
  );
}
