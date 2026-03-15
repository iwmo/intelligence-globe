import React from 'react';
import { useSettingsStore } from '../store/useSettingsStore';
import { getViewer } from '../lib/viewerRegistry';

function radToDeg(rad: number): number { return (rad * 180) / Math.PI; }

const LAYER_LABELS: Record<string, string> = {
  satellites: 'Satellites', aircraft: 'Aircraft',
  militaryAircraft: 'Military Aircraft', ships: 'Ships',
  gpsJamming: 'GPS Jamming', streetTraffic: 'Street Traffic',
};

const PRESET_OPTIONS = ['normal', 'nvg', 'crt', 'flir', 'noir'] as const;

const sectionStyle: React.CSSProperties = {
  padding: '8px 10px', borderBottom: '1px solid rgba(0,212,255,0.10)',
};
const headingStyle: React.CSSProperties = {
  fontFamily: 'monospace', fontSize: '9px', fontWeight: 700,
  letterSpacing: '0.12em', color: 'rgba(0,212,255,0.55)',
  marginBottom: '6px', textTransform: 'uppercase' as const,
};
const labelStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: '6px',
  fontFamily: 'monospace', fontSize: '10px',
  color: 'rgba(255,255,255,0.8)', marginBottom: '4px', cursor: 'pointer',
};
const checkboxStyle: React.CSSProperties = { accentColor: 'rgba(0,212,255,0.8)', cursor: 'pointer' };

export function SettingsPanel() {
  const {
    defaultLayers, defaultPreset, defaultCamera, defaultMode,
    showSatelliteLabels, showAircraftLabels, showMilitaryLabels, showShipLabels,
    setDefaultLayers, setDefaultPreset, setDefaultCamera, setDefaultMode,
    setShowSatelliteLabels, setShowAircraftLabels, setShowMilitaryLabels, setShowShipLabels,
  } = useSettingsStore();

  function handleLayerToggle(key: keyof typeof defaultLayers) {
    setDefaultLayers({ ...defaultLayers, [key]: !defaultLayers[key] });
  }

  function handleSaveCamera() {
    const viewer = getViewer();
    if (!viewer || viewer.isDestroyed()) return;
    const carto = viewer.camera.positionCartographic;
    setDefaultCamera({
      lon: radToDeg(carto.longitude), lat: radToDeg(carto.latitude),
      altMeters: carto.height, pitch: radToDeg(viewer.camera.pitch),
    });
  }

  return (
    <>
      {/* Entity Labels */}
      <div style={sectionStyle}>
        <div style={headingStyle}>Entity Labels</div>
        {([
          { key: 'satellite', label: 'Satellites', color: '#00D4FF', checked: showSatelliteLabels, toggle: () => setShowSatelliteLabels(!showSatelliteLabels) },
          { key: 'aircraft',  label: 'Aircraft',   color: '#FF8C00', checked: showAircraftLabels,  toggle: () => setShowAircraftLabels(!showAircraftLabels) },
          { key: 'military',  label: 'Military',   color: '#EF4444', checked: showMilitaryLabels,  toggle: () => setShowMilitaryLabels(!showMilitaryLabels) },
          { key: 'ship',      label: 'Ships',      color: '#22C55E', checked: showShipLabels,      toggle: () => setShowShipLabels(!showShipLabels) },
        ] as const).map(({ key, label, color, checked, toggle }) => (
          <label key={key} style={labelStyle}>
            <input type="checkbox" style={{ ...checkboxStyle, accentColor: color }}
              checked={checked} onChange={toggle} aria-label={`${label} labels`} />
            <span style={{ color: checked ? color : 'rgba(255,255,255,0.8)' }}>{label}</span>
          </label>
        ))}
      </div>

      {/* Default Layers */}
      <div style={sectionStyle}>
        <div style={headingStyle}>Default Layers</div>
        {(Object.keys(defaultLayers) as Array<keyof typeof defaultLayers>).map((key) => (
          <label key={key} style={labelStyle}>
            <input type="checkbox" style={checkboxStyle}
              checked={defaultLayers[key]} onChange={() => handleLayerToggle(key)}
              aria-label={LAYER_LABELS[key] ?? key} />
            {LAYER_LABELS[key] ?? key}
          </label>
        ))}
      </div>

      {/* Default Preset */}
      <div style={sectionStyle}>
        <div style={headingStyle}>Default Preset</div>
        <select value={defaultPreset} onChange={(e) => setDefaultPreset(e.target.value as typeof defaultPreset)}
          style={{
            background: 'rgba(0,0,0,0.7)', border: '1px solid rgba(0,212,255,0.3)',
            borderRadius: '3px', color: 'rgba(255,255,255,0.85)',
            fontFamily: 'monospace', fontSize: '10px', padding: '3px 6px',
            width: '100%', cursor: 'pointer',
          }}>
          {PRESET_OPTIONS.map((p) => <option key={p} value={p}>{p.toUpperCase()}</option>)}
        </select>
      </div>

      {/* Default Camera */}
      <div style={sectionStyle}>
        <div style={headingStyle}>Default Camera</div>
        <button onClick={handleSaveCamera} aria-label="Save current view" style={{
          background: 'rgba(0,212,255,0.1)', border: '1px solid rgba(0,212,255,0.35)',
          borderRadius: '3px', color: 'rgba(0,212,255,0.9)',
          fontFamily: 'monospace', fontSize: '10px', padding: '4px 8px',
          cursor: 'pointer', width: '100%', marginBottom: '4px',
        }}>Save current view</button>
        {defaultCamera && (
          <div style={{ fontFamily: 'monospace', fontSize: '9px', color: 'rgba(255,255,255,0.55)', marginBottom: '4px' }}>
            {defaultCamera.lon.toFixed(1)}° {defaultCamera.lat.toFixed(1)}° {(defaultCamera.altMeters / 1000).toFixed(0)} km
          </div>
        )}
        {defaultCamera && (
          <button onClick={() => setDefaultCamera(null)} style={{
            background: 'none', border: '1px solid rgba(255,255,255,0.15)',
            borderRadius: '3px', color: 'rgba(255,255,255,0.45)',
            fontFamily: 'monospace', fontSize: '9px', padding: '2px 6px', cursor: 'pointer',
          }}>Clear</button>
        )}
      </div>

      {/* Start Mode */}
      <div style={{ ...sectionStyle, borderBottom: 'none' }}>
        <div style={headingStyle}>Start Mode</div>
        <div style={{ display: 'flex', gap: '6px' }}>
          {(['live', 'playback'] as const).map((mode) => (
            <button key={mode} onClick={() => setDefaultMode(mode)} aria-label={mode} style={{
              flex: 1,
              background: defaultMode === mode ? 'rgba(0,212,255,0.18)' : 'rgba(0,0,0,0.4)',
              border: `1px solid ${defaultMode === mode ? 'rgba(0,212,255,0.5)' : 'rgba(255,255,255,0.15)'}`,
              borderRadius: '3px',
              color: defaultMode === mode ? 'rgba(0,212,255,0.95)' : 'rgba(255,255,255,0.5)',
              fontFamily: 'monospace', fontSize: '10px',
              fontWeight: defaultMode === mode ? 700 : 400,
              letterSpacing: '0.08em', padding: '4px 0',
              cursor: 'pointer', textTransform: 'uppercase',
            }}>{mode}</button>
          ))}
        </div>
      </div>
    </>
  );
}
