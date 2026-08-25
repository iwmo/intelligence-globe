import { useState } from 'react';
import { Info, RotateCcw, Share2 } from 'lucide-react';
import { resetGlobe } from '../lib/viewerRegistry';
import { writeShareHash } from '../lib/shareView';

const ATTRIBUTION = [
  'USGS Earthquake Hazards Program',
  'NASA FIRMS / VIIRS',
  'Open-Meteo (CC BY 4.0)',
  'Launch Library 2 / The Space Devs',
  'ADS-B (adsb.lol) · AIS · CelesTrak',
  'OpenStreetMap installations (ODbL)',
  'Tracked airliner model — Intelligence Globe (CC BY 4.0)',
  'Cesium ion / Google Photorealistic 3D Tiles',
];

export function GlobeToolbar() {
  const [creditsOpen, setCreditsOpen] = useState(false);
  return (
    <div
      style={{
        position: 'fixed',
        top: 8,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 210,
        display: 'flex',
        gap: 6,
      }}
    >
      <button
        type="button"
        title="Reset globe"
        aria-label="Reset globe"
        onClick={() => resetGlobe()}
        style={{
          width: 28,
          height: 28,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(0,0,0,0.55)',
          border: '1px solid rgba(255,255,255,0.14)',
          borderRadius: 3,
          color: 'rgba(255,255,255,0.75)',
          cursor: 'pointer',
        }}
      >
        <RotateCcw size={14} />
      </button>
      <button
        type="button"
        title="Copy share link"
        aria-label="Copy share link"
        onClick={() => {
          writeShareHash();
          void navigator.clipboard?.writeText(window.location.href);
        }}
        style={{
          width: 28,
          height: 28,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(0,0,0,0.55)',
          border: '1px solid rgba(255,255,255,0.14)',
          borderRadius: 3,
          color: 'rgba(255,255,255,0.75)',
          cursor: 'pointer',
        }}
      >
        <Share2 size={14} />
      </button>
      <button
        type="button"
        title="Data attribution"
        aria-label="Data attribution"
        aria-expanded={creditsOpen}
        onClick={() => setCreditsOpen(v => !v)}
        style={{
          width: 28,
          height: 28,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: creditsOpen ? 'rgba(0,212,255,0.18)' : 'rgba(0,0,0,0.55)',
          border: '1px solid rgba(255,255,255,0.14)',
          borderRadius: 3,
          color: 'rgba(255,255,255,0.75)',
          cursor: 'pointer',
        }}
      >
        <Info size={14} />
      </button>
      {creditsOpen && (
        <div
          role="dialog"
          aria-label="Data attribution"
          style={{
            position: 'absolute',
            top: 34,
            left: '50%',
            transform: 'translateX(-50%)',
            width: 280,
            padding: '8px 10px',
            background: 'rgba(0,0,0,0.88)',
            border: '1px solid rgba(255,255,255,0.14)',
            borderRadius: 4,
            color: 'rgba(255,255,255,0.78)',
            fontFamily: 'monospace',
            fontSize: 10,
            lineHeight: 1.6,
          }}
        >
          <div style={{ letterSpacing: '0.1em', opacity: 0.55, marginBottom: 4 }}>DATA ATTRIBUTION</div>
          {ATTRIBUTION.map(line => (
            <div key={line}>{line}</div>
          ))}
        </div>
      )}
    </div>
  );
}
