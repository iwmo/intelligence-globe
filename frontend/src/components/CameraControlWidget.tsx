import React, { useState, useEffect } from 'react';
import { Math as CesiumMath } from 'cesium';
import { zoomStep, setPitchPreset, setHeading, getViewer } from '../lib/viewerRegistry';
import { DraggablePanel } from './DraggablePanel';

// Pitch presets expressed as degrees-below-horizontal (0 = horizontal, 90 = straight down).
// Cesium pitch = -angle.
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

const sectionLabelStyle: React.CSSProperties = {
  fontFamily: 'monospace',
  fontSize: 9,
  letterSpacing: '0.10em',
  color: 'rgba(0,212,255,0.55)',
};

const valueStyle: React.CSSProperties = {
  fontFamily: 'monospace',
  fontSize: 10,
  color: 'rgba(0,212,255,0.9)',
  fontVariantNumeric: 'tabular-nums',
};

const sliderStyle: React.CSSProperties = {
  width: '100%',
  accentColor: '#00d4ff',
  cursor: 'pointer',
  margin: '4px 0 6px',
  display: 'block',
};

const chipBase: React.CSSProperties = {
  fontFamily: 'monospace',
  fontSize: 9,
  padding: '2px 5px',
  background: 'rgba(0,0,0,0.5)',
  border: '1px solid rgba(0,212,255,0.2)',
  borderRadius: 2,
  color: 'rgba(0,212,255,0.6)',
  cursor: 'pointer',
  letterSpacing: '0.06em',
  lineHeight: 1.4,
};

const chipActive: React.CSSProperties = {
  background: 'rgba(0,212,255,0.15)',
  border: '1px solid rgba(0,212,255,0.55)',
  color: 'rgba(0,212,255,0.95)',
};

export function CameraControlWidget(): React.ReactElement {
  const defaultX = typeof window !== 'undefined' ? window.innerWidth - 220 : 1700;

  // pitchAngle: degrees below horizontal (0 = horizontal, 90 = straight down)
  const [pitchAngle, setPitchAngle] = useState(45);
  const [headingDeg, setHeadingState] = useState(0);

  // Subscribe to camera.moveEnd to keep sliders in sync when user pans/flies
  useEffect(() => {
    let cleanup: (() => void) | null = null;

    function trySetup(): boolean {
      const v = getViewer();
      if (!v || v.isDestroyed()) return false;

      const sync = () => {
        const vv = getViewer();
        if (!vv || vv.isDestroyed()) return;
        // Cesium pitch is -90..0 → convert to 0..90 display range
        setPitchAngle(Math.round(Math.abs(CesiumMath.toDegrees(vv.camera.pitch))));
        setHeadingState(Math.round(((CesiumMath.toDegrees(vv.camera.heading) % 360) + 360) % 360));
      };

      sync(); // init from current camera state
      v.camera.moveEnd.addEventListener(sync);
      cleanup = () => v.camera.moveEnd.removeEventListener(sync);
      return true;
    }

    if (!trySetup()) {
      const interval = setInterval(() => { if (trySetup()) clearInterval(interval); }, 200);
      return () => { clearInterval(interval); cleanup?.(); };
    }
    return () => cleanup?.();
  }, []);

  function applyPitch(angle: number) {
    setPitchAngle(angle);
    setPitchPreset(-angle);
  }

  function applyHeading(deg: number) {
    setHeadingState(deg);
    setHeading(deg);
  }

  return (
    <DraggablePanel id="camera-controls" title="CAMERA" defaultPos={{ x: defaultX, y: 150 }} defaultWidth={210} minWidth={160}>
      <div style={{ padding: '6px 8px', display: 'flex', flexDirection: 'column', gap: 0 }}>

        {/* Zoom */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
          <button
            aria-label="zoom in"
            onClick={() => zoomStep('in')}
            style={{
              flex: 1, fontFamily: 'monospace', fontSize: 16, lineHeight: 1,
              background: 'transparent', border: '1px solid rgba(0,212,255,0.25)',
              borderRadius: 3, color: '#00d4ff', cursor: 'pointer', padding: '3px 0',
            }}
          >+</button>
          <button
            aria-label="zoom out"
            onClick={() => zoomStep('out')}
            style={{
              flex: 1, fontFamily: 'monospace', fontSize: 16, lineHeight: 1,
              background: 'transparent', border: '1px solid rgba(0,212,255,0.25)',
              borderRadius: 3, color: '#00d4ff', cursor: 'pointer', padding: '3px 0',
            }}
          >−</button>
        </div>

        {/* Pitch */}
        <div style={{ borderTop: '1px solid rgba(0,212,255,0.12)', paddingTop: 7, marginBottom: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 2 }}>
            <span style={sectionLabelStyle}>PITCH</span>
            <span style={valueStyle}>{pitchAngle}°</span>
          </div>
          <input
            type="range"
            min={0}
            max={90}
            step={1}
            value={pitchAngle}
            aria-label="pitch angle"
            style={sliderStyle}
            onChange={(e) => applyPitch(Number(e.target.value))}
          />
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
            {PITCH_PRESETS.map((p) => (
              <button
                key={p.label}
                style={{ ...chipBase, ...(pitchAngle === p.angle ? chipActive : {}) }}
                onClick={() => applyPitch(p.angle)}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Heading */}
        <div style={{ borderTop: '1px solid rgba(0,212,255,0.12)', paddingTop: 7 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 2 }}>
            <span style={sectionLabelStyle}>HDG</span>
            <span style={valueStyle}>{headingDeg}°</span>
          </div>
          <input
            type="range"
            min={0}
            max={359}
            step={1}
            value={headingDeg}
            aria-label="heading angle"
            style={sliderStyle}
            onChange={(e) => applyHeading(Number(e.target.value))}
          />
          <div style={{ display: 'flex', gap: 3 }}>
            {HEADING_PRESETS.map((p) => (
              <button
                key={p.label}
                style={{ ...chipBase, flex: 1, textAlign: 'center', ...(headingDeg === p.deg ? chipActive : {}) }}
                onClick={() => applyHeading(p.deg)}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

      </div>
    </DraggablePanel>
  );
}
