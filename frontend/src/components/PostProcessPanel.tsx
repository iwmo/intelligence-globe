import { Eye, Radar, Tv, Thermometer, Circle } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import type { VisualPreset } from '../store/useAppStore';

const PRESETS: Array<{ id: VisualPreset; label: string; icon: React.ReactNode }> = [
  { id: 'normal', label: 'NORMAL', icon: <Eye size={12} /> },
  { id: 'nvg', label: 'NVG', icon: <Radar size={12} /> },
  { id: 'crt', label: 'CRT', icon: <Tv size={12} /> },
  { id: 'flir', label: 'FLIR', icon: <Thermometer size={12} /> },
  { id: 'noir', label: 'NOIR', icon: <Circle size={12} /> },
];

export function PostProcessPanel() {
  const { visualPreset, setVisualPreset, postProcessUniforms, setPostProcessUniforms } =
    useAppStore();

  return (
    <div
      style={{
        background: 'rgba(0,0,0,0.92)',
        border: '1px solid rgba(0,212,255,0.15)',
        borderRadius: '4px',
        padding: '12px',
        fontFamily: 'monospace',
        color: 'rgba(255,255,255,0.85)',
        minWidth: '220px',
      }}
    >
      {/* Section header */}
      <div
        style={{
          color: 'rgba(0,212,255,0.7)',
          fontSize: '10px',
          fontWeight: 700,
          letterSpacing: '0.15em',
          marginBottom: '10px',
          paddingBottom: '6px',
          borderBottom: '1px solid rgba(0,212,255,0.1)',
        }}
      >
        VISUAL PRESET
      </div>

      {/* Preset buttons row */}
      <div
        style={{
          display: 'flex',
          gap: '4px',
          marginBottom: '14px',
          flexWrap: 'wrap',
        }}
      >
        {PRESETS.map(({ id, label, icon }) => {
          const isActive = visualPreset === id;
          return (
            <button
              key={id}
              onClick={() => setVisualPreset(id)}
              title={`Switch to ${label} preset`}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '5px 8px',
                background: isActive ? 'rgba(0,212,255,0.2)' : 'rgba(255,255,255,0.05)',
                border: `1px solid ${isActive ? 'rgba(0,212,255,0.7)' : 'rgba(255,255,255,0.15)'}`,
                borderRadius: '3px',
                cursor: 'pointer',
                color: isActive ? '#00D4FF' : 'rgba(255,255,255,0.5)',
                fontSize: '10px',
                fontWeight: 700,
                letterSpacing: '0.08em',
                fontFamily: 'monospace',
                transition: 'all 0.15s ease',
              }}
            >
              {icon}
              {label}
            </button>
          );
        })}
      </div>

      {/* Section header */}
      <div
        style={{
          color: 'rgba(0,212,255,0.7)',
          fontSize: '10px',
          fontWeight: 700,
          letterSpacing: '0.15em',
          marginBottom: '10px',
          paddingBottom: '6px',
          borderBottom: '1px solid rgba(0,212,255,0.1)',
        }}
      >
        PARAMETERS
      </div>

      {/* Sliders */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <SliderRow
          label="BLOOM"
          min={0}
          max={2}
          step={0.1}
          value={postProcessUniforms.bloomIntensity}
          onChange={(v) => setPostProcessUniforms({ bloomIntensity: v })}
        />
        <SliderRow
          label="SHARPEN"
          min={0}
          max={1}
          step={0.05}
          value={postProcessUniforms.sharpenAmount}
          onChange={(v) => setPostProcessUniforms({ sharpenAmount: v })}
        />
        <SliderRow
          label="GAIN"
          min={0.5}
          max={2}
          step={0.1}
          value={postProcessUniforms.gainAmount}
          onChange={(v) => setPostProcessUniforms({ gainAmount: v })}
        />
        <SliderRow
          label="SCANLINES"
          min={1}
          max={10}
          step={1}
          value={postProcessUniforms.scanlineSpacing}
          onChange={(v) => setPostProcessUniforms({ scanlineSpacing: v })}
        />
        <SliderRow
          label="PIXELATE"
          min={1}
          max={10}
          step={1}
          value={postProcessUniforms.pixelationLevel}
          onChange={(v) => setPostProcessUniforms({ pixelationLevel: v })}
        />
      </div>
    </div>
  );
}

interface SliderRowProps {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (value: number) => void;
}

function SliderRow({ label, min, max, step, value, onChange }: SliderRowProps) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
      }}
    >
      <span
        style={{
          fontSize: '9px',
          fontWeight: 700,
          letterSpacing: '0.1em',
          color: 'rgba(0,212,255,0.6)',
          width: '60px',
          flexShrink: 0,
        }}
      >
        {label}
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        style={{
          flex: 1,
          accentColor: '#00D4FF',
          cursor: 'pointer',
          height: '3px',
        }}
      />
      <span
        style={{
          fontSize: '9px',
          color: 'rgba(255,255,255,0.4)',
          width: '28px',
          textAlign: 'right',
          flexShrink: 0,
        }}
      >
        {value.toFixed(step < 1 ? 1 : 0)}
      </span>
    </div>
  );
}

export default PostProcessPanel;
