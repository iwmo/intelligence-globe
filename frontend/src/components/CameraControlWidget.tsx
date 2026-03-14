import React from 'react';
import { zoomStep, setPitchPreset } from '../lib/viewerRegistry';
import { DraggablePanel } from './DraggablePanel';

const TILT_PRESETS = [
  { label: 'TOP', pitchDeg: -90 },
  { label: '45°', pitchDeg: -45 },
  { label: 'HRZ', pitchDeg: -10 },
] as const;

const btnStyle: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  color: '#00d4ff',
  fontFamily: 'monospace',
  fontSize: 16,
  cursor: 'pointer',
  padding: '4px 10px',
  width: '100%',
  textAlign: 'center',
  lineHeight: 1.2,
};

const dividerStyle: React.CSSProperties = {
  width: '100%',
  height: 1,
  background: 'rgba(0,212,255,0.2)',
  margin: '4px 0',
};

const sectionLabelStyle: React.CSSProperties = {
  fontSize: 9,
  letterSpacing: '0.08em',
  color: 'rgba(0,212,255,0.5)',
  marginBottom: 2,
  textAlign: 'center',
};

export function CameraControlWidget(): React.ReactElement {
  const defaultX = typeof window !== 'undefined' ? window.innerWidth - 200 : 1720;

  return (
    <DraggablePanel id="camera-controls" title="CAMERA" defaultPos={{ x: defaultX, y: 150 }} defaultWidth={140} minWidth={100}>
      <div style={{ padding: '4px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        {/* Zoom section */}
        <button style={btnStyle} aria-label="zoom in" onClick={() => zoomStep('in')}>+</button>
        <button style={btnStyle} aria-label="zoom out" onClick={() => zoomStep('out')}>−</button>

        {/* Divider */}
        <div style={dividerStyle} />

        {/* Tilt section */}
        <div style={sectionLabelStyle}>TILT</div>
        {TILT_PRESETS.map((preset) => (
          <button
            key={preset.label}
            style={{ ...btnStyle, fontSize: 11 }}
            aria-label={`tilt ${preset.label}`}
            onClick={() => setPitchPreset(preset.pitchDeg)}
          >
            {preset.label}
          </button>
        ))}
      </div>
    </DraggablePanel>
  );
}
