import { RotateCcw, Share2 } from 'lucide-react';
import { resetGlobe } from '../lib/viewerRegistry';
import { writeShareHash } from '../lib/shareView';

export function GlobeToolbar() {
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
    </div>
  );
}
