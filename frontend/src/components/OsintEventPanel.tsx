import React, { useState, useEffect } from 'react';
import { useAppStore } from '../store/useAppStore';

interface Props {
  open?: boolean;
  onClose?: () => void;
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.15)',
  color: '#fff',
  padding: '4px',
  fontFamily: 'monospace',
  boxSizing: 'border-box',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  marginBottom: '2px',
  color: '#aaa',
};

const fieldStyle: React.CSSProperties = {
  marginBottom: '8px',
};

export function OsintEventPanel({ open = true, onClose }: Props) {
  const [label, setLabel] = useState('');
  const [ts, setTs] = useState(() => new Date().toISOString().slice(0, 16));
  const [category, setCategory] = useState<string>('KINETIC');
  const [sourceUrl, setSourceUrl] = useState('');
  const [lat, setLat] = useState('');
  const [lon, setLon] = useState('');

  const prefill = useAppStore(s => s.gdeltOsintPrefill);
  useEffect(() => {
    if (prefill) {
      setLat(String(prefill.lat));
      setLon(String(prefill.lon));
      setTs(prefill.ts.slice(0, 16));
      setSourceUrl(prefill.sourceUrl ?? '');
      useAppStore.getState().setGdeltOsintPrefill(null);
    }
  }, [prefill]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const body = {
      ts: new Date(ts).toISOString(),
      category,
      label,
      source_url: sourceUrl || null,
      latitude: lat ? parseFloat(lat) : null,
      longitude: lon ? parseFloat(lon) : null,
    };
    const r = await fetch('/api/osint-events', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': import.meta.env.VITE_API_KEY,
      },
      body: JSON.stringify(body),
    });
    if (r.ok) {
      onClose?.();
      setLabel('');
      setTs(new Date().toISOString().slice(0, 16));
      setCategory('KINETIC');
      setSourceUrl('');
      setLat('');
      setLon('');
    }
  };

  return (
    <>
      {/* Backdrop scrim */}
      <div onClick={onClose} style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.45)', zIndex: 299,
      }} />
    <div
      style={{
        position: 'fixed',
        top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 300,
        width: '340px',
        background: 'rgba(0,10,20,0.96)',
        border: '1px solid rgba(0,212,255,0.4)',
        borderRadius: '6px',
        padding: '16px',
        fontFamily: 'monospace',
        fontSize: '11px',
        color: '#ccc',
        boxShadow: '0 8px 32px rgba(0,0,0,0.8)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
        <span style={{ fontWeight: 700, color: '#00D4FF' }}>OSINT EVENT</span>
        <button
          onClick={onClose}
          style={{ background: 'none', border: 'none', color: '#ccc', cursor: 'pointer', fontSize: '14px' }}
        >
          X
        </button>
      </div>
      <form onSubmit={handleSubmit}>
        <div style={fieldStyle}>
          <span style={labelStyle}>LABEL</span>
          <input
            name="label"
            type="text"
            required
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            style={inputStyle}
          />
        </div>
        <div style={fieldStyle}>
          <span style={labelStyle}>DATE/TIME</span>
          <input
            name="ts"
            type="datetime-local"
            required
            value={ts}
            onChange={(e) => setTs(e.target.value)}
            style={inputStyle}
          />
        </div>
        <div style={fieldStyle}>
          <span style={labelStyle}>CATEGORY</span>
          <select
            name="category"
            required
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            style={{ ...inputStyle, color: '#fff' }}
          >
            <option value="KINETIC">KINETIC</option>
            <option value="AIRSPACE">AIRSPACE</option>
            <option value="MARITIME">MARITIME</option>
            <option value="SEISMIC">SEISMIC</option>
            <option value="JAMMING">JAMMING</option>
          </select>
        </div>
        <div style={fieldStyle}>
          <span style={labelStyle}>SOURCE URL</span>
          <input
            name="source_url"
            type="url"
            value={sourceUrl}
            onChange={(e) => setSourceUrl(e.target.value)}
            style={inputStyle}
          />
        </div>
        <div style={fieldStyle}>
          <span style={labelStyle}>LATITUDE (optional)</span>
          <input
            name="latitude"
            type="number"
            step="any"
            value={lat}
            onChange={(e) => setLat(e.target.value)}
            style={inputStyle}
          />
        </div>
        <div style={fieldStyle}>
          <span style={labelStyle}>LONGITUDE (optional)</span>
          <input
            name="longitude"
            type="number"
            step="any"
            value={lon}
            onChange={(e) => setLon(e.target.value)}
            style={inputStyle}
          />
        </div>
        <button
          type="submit"
          style={{
            width: '100%',
            background: '#00D4FF',
            color: '#000',
            fontWeight: 700,
            border: 'none',
            padding: '6px',
            cursor: 'pointer',
            fontFamily: 'monospace',
            fontSize: '11px',
          }}
        >
          LOG EVENT
        </button>
      </form>
    </div>
    </>
  );
}
