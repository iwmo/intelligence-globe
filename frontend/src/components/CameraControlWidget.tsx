import React, { useState, useEffect, useRef } from 'react';
import { Math as CesiumMath } from 'cesium';
import { zoomStep, setPitchPreset, setHeading, getViewer } from '../lib/viewerRegistry';

const STEP = 5;

const PITCH_PRESETS: { label: string; angle: number }[] = [
  { label: 'HRZ', angle: 10 },
  { label: '30°', angle: 30 },
  { label: '45°', angle: 45 },
  { label: '60°', angle: 60 },
  { label: '75°', angle: 75 },
  { label: 'TOP', angle: 90 },
];

const HEADING_PRESETS: { label: string; deg: number }[] = [
  { label: 'N', deg: 0 },
  { label: 'E', deg: 90 },
  { label: 'S', deg: 180 },
  { label: 'W', deg: 270 },
];

function ArrowBtn({ label, onStep, children }: { label: string; onStep: () => void; children: React.ReactNode }) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const start = (e: React.MouseEvent) => {
    e.preventDefault();
    onStep();
    timerRef.current = setTimeout(() => {
      intervalRef.current = setInterval(onStep, 80);
    }, 350);
  };

  const stop = () => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
  };

  return (
    <button
      aria-label={label}
      onMouseDown={start}
      onMouseUp={stop}
      onMouseLeave={stop}
      style={{
        fontFamily: 'monospace', fontSize: 14, lineHeight: 1,
        padding: '4px 10px',
        background: 'rgba(0,0,0,0.5)',
        border: '1px solid rgba(0,212,255,0.25)',
        borderRadius: 3, color: 'rgba(0,212,255,0.85)',
        cursor: 'pointer', userSelect: 'none',
      }}
    >{children}</button>
  );
}

const sectionLabelStyle: React.CSSProperties = {
  fontFamily: 'monospace', fontSize: 9,
  letterSpacing: '0.10em', color: 'rgba(0,212,255,0.55)',
};

const valueStyle: React.CSSProperties = {
  fontFamily: 'monospace', fontSize: 11,
  color: 'rgba(0,212,255,0.9)',
  fontVariantNumeric: 'tabular-nums',
  minWidth: 36, textAlign: 'right',
};

const chipBase: React.CSSProperties = {
  fontFamily: 'monospace', fontSize: 9,
  padding: '2px 5px',
  background: 'rgba(0,0,0,0.5)',
  border: '1px solid rgba(0,212,255,0.2)',
  borderRadius: 2, color: 'rgba(0,212,255,0.6)',
  cursor: 'pointer', letterSpacing: '0.06em', lineHeight: 1.4,
};

const chipActive: React.CSSProperties = {
  background: 'rgba(0,212,255,0.15)',
  border: '1px solid rgba(0,212,255,0.55)',
  color: 'rgba(0,212,255,0.95)',
};

export function CameraControlWidget(): React.ReactElement {
  const [pitchAngle, setPitchAngle] = useState(45);
  const [headingDeg, setHeadingState] = useState(0);

  const pitchRef = useRef(45);
  pitchRef.current = pitchAngle;
  const headingRef = useRef(0);
  headingRef.current = headingDeg;

  useEffect(() => {
    let cleanup: (() => void) | null = null;

    function trySetup(): boolean {
      const v = getViewer();
      if (!v || v.isDestroyed()) return false;

      const sync = () => {
        const vv = getViewer();
        if (!vv || vv.isDestroyed()) return;
        setPitchAngle(Math.round(Math.abs(CesiumMath.toDegrees(vv.camera.pitch))));
        setHeadingState(Math.round(((CesiumMath.toDegrees(vv.camera.heading) % 360) + 360) % 360));
      };

      sync();
      v.camera.moveEnd.addEventListener(sync);
      cleanup = () => {
        try { if (!v.isDestroyed()) v.camera.moveEnd.removeEventListener(sync); } catch {}
      };
      return true;
    }

    if (!trySetup()) {
      const interval = setInterval(() => { if (trySetup()) clearInterval(interval); }, 200);
      return () => { clearInterval(interval); cleanup?.(); };
    }
    return () => cleanup?.();
  }, []);

  function stepPitch(delta: number) {
    const next = Math.max(0, Math.min(90, pitchRef.current + delta));
    setPitchAngle(next);
    setPitchPreset(-next);
  }

  function stepHeading(delta: number) {
    const next = ((headingRef.current + delta) % 360 + 360) % 360;
    setHeadingState(next);
    setHeading(next);
  }

  function applyPitch(angle: number) { setPitchAngle(angle); setPitchPreset(-angle); }
  function applyHeading(deg: number) { setHeadingState(deg); setHeading(deg); }

  return (
    <div style={{ padding: '6px 8px', display: 'flex', flexDirection: 'column', gap: 0 }}>
      {/* Zoom */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
        <button aria-label="zoom in" onClick={() => zoomStep('in')} style={{
          flex: 1, fontFamily: 'monospace', fontSize: 16, lineHeight: 1,
          background: 'transparent', border: '1px solid rgba(0,212,255,0.25)',
          borderRadius: 3, color: '#00d4ff', cursor: 'pointer', padding: '3px 0',
        }}>+</button>
        <button aria-label="zoom out" onClick={() => zoomStep('out')} style={{
          flex: 1, fontFamily: 'monospace', fontSize: 16, lineHeight: 1,
          background: 'transparent', border: '1px solid rgba(0,212,255,0.25)',
          borderRadius: 3, color: '#00d4ff', cursor: 'pointer', padding: '3px 0',
        }}>−</button>
      </div>

      {/* Pitch */}
      <div style={{ borderTop: '1px solid rgba(0,212,255,0.12)', paddingTop: 7, marginBottom: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <span style={sectionLabelStyle}>PITCH</span>
          <span style={valueStyle}>{pitchAngle}°</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
          <ArrowBtn label="pitch up" onStep={() => stepPitch(-STEP)}>▲</ArrowBtn>
          <ArrowBtn label="pitch down" onStep={() => stepPitch(+STEP)}>▼</ArrowBtn>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
          {PITCH_PRESETS.map((p) => (
            <button key={p.label} style={{ ...chipBase, ...(pitchAngle === p.angle ? chipActive : {}) }}
              onClick={() => applyPitch(p.angle)}>{p.label}</button>
          ))}
        </div>
      </div>

      {/* Heading */}
      <div style={{ borderTop: '1px solid rgba(0,212,255,0.12)', paddingTop: 7 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <span style={sectionLabelStyle}>HDG</span>
          <span style={valueStyle}>{headingDeg}°</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
          <ArrowBtn label="heading left" onStep={() => stepHeading(-STEP)}>◄</ArrowBtn>
          <ArrowBtn label="heading right" onStep={() => stepHeading(+STEP)}>►</ArrowBtn>
        </div>
        <div style={{ display: 'flex', gap: 3 }}>
          {HEADING_PRESETS.map((p) => (
            <button key={p.label}
              style={{ ...chipBase, flex: 1, textAlign: 'center', ...(headingDeg === p.deg ? chipActive : {}) }}
              onClick={() => applyHeading(p.deg)}>{p.label}</button>
          ))}
        </div>
      </div>
    </div>
  );
}
