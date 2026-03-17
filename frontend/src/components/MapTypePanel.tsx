import { useAppStore } from '../store/useAppStore';
import type { MapType } from '../store/useAppStore';

interface MapOption {
  id: MapType;
  label: string;
  sublabel: string;
  icon: React.ReactNode;
}

const MAP_OPTIONS: MapOption[] = [
  {
    id: 'satellite',
    label: 'SATELLITE',
    sublabel: 'Google Maps 2D Satellite',
    icon: (
      <svg width="32" height="22" viewBox="0 0 32 22" fill="none">
        <rect width="32" height="22" rx="2" fill="#0d2b0d" />
        <path d="M0 14 Q8 8 16 12 Q24 16 32 10" stroke="#1a5c1a" strokeWidth="1.5" fill="none" />
        <path d="M0 18 Q8 12 16 16 Q24 20 32 14" stroke="#1a5c1a" strokeWidth="1" fill="none" opacity="0.6" />
        <circle cx="10" cy="9" r="3" fill="#0d3d0d" stroke="#1a5c1a" strokeWidth="0.5" />
        <circle cx="22" cy="13" r="2" fill="#0d3d0d" stroke="#1a5c1a" strokeWidth="0.5" />
      </svg>
    ),
  },
  {
    id: 'hybrid',
    label: 'HYBRID',
    sublabel: 'Google Maps Satellite + Labels',
    icon: (
      <svg width="32" height="22" viewBox="0 0 32 22" fill="none">
        <rect width="32" height="22" rx="2" fill="#0d2b0d" />
        <path d="M0 14 Q8 8 16 12 Q24 16 32 10" stroke="#1a5c1a" strokeWidth="1.5" fill="none" />
        <rect x="4" y="4" width="10" height="4" rx="1" fill="rgba(255,255,255,0.15)" stroke="rgba(255,255,255,0.4)" strokeWidth="0.5" />
        <rect x="18" y="14" width="10" height="4" rx="1" fill="rgba(255,255,255,0.15)" stroke="rgba(255,255,255,0.4)" strokeWidth="0.5" />
      </svg>
    ),
  },
  {
    id: 'roadmap',
    label: 'ROADMAP',
    sublabel: 'Google Maps 2D Roadmap',
    icon: (
      <svg width="32" height="22" viewBox="0 0 32 22" fill="none">
        <rect width="32" height="22" rx="2" fill="#1a1a0a" />
        <line x1="0" y1="11" x2="32" y2="11" stroke="#888" strokeWidth="1.5" />
        <line x1="16" y1="0" x2="16" y2="22" stroke="#888" strokeWidth="1" />
        <line x1="0" y1="6" x2="32" y2="6" stroke="#555" strokeWidth="0.5" />
        <line x1="0" y1="16" x2="32" y2="16" stroke="#555" strokeWidth="0.5" />
        <line x1="8" y1="0" x2="8" y2="22" stroke="#555" strokeWidth="0.5" />
        <line x1="24" y1="0" x2="24" y2="22" stroke="#555" strokeWidth="0.5" />
      </svg>
    ),
  },
  {
    id: 'contour',
    label: 'CONTOUR',
    sublabel: 'Google Maps 2D Contour',
    icon: (
      <svg width="32" height="22" viewBox="0 0 32 22" fill="none">
        <rect width="32" height="22" rx="2" fill="#0d1a0d" />
        <ellipse cx="16" cy="11" rx="10" ry="6" stroke="#2d6a2d" strokeWidth="0.8" fill="none" />
        <ellipse cx="16" cy="11" rx="6" ry="3.5" stroke="#2d6a2d" strokeWidth="0.8" fill="none" />
        <ellipse cx="16" cy="11" rx="3" ry="1.5" stroke="#3a7a3a" strokeWidth="1" fill="none" />
      </svg>
    ),
  },
  {
    id: 'bing_aerial',
    label: 'BING AERIAL',
    sublabel: 'Bing Maps Aerial',
    icon: (
      <svg width="32" height="22" viewBox="0 0 32 22" fill="none">
        <rect width="32" height="22" rx="2" fill="#0a1a2a" />
        <path d="M0 12 Q10 6 20 10 Q26 12 32 9" stroke="#1a4a6a" strokeWidth="1.5" fill="none" />
        <rect x="12" y="6" width="8" height="6" rx="1" fill="#0a2a3a" stroke="#1a4a6a" strokeWidth="0.5" />
        <rect x="5" y="13" width="6" height="4" rx="1" fill="#0a2a3a" stroke="#1a4a6a" strokeWidth="0.5" />
        <rect x="22" y="12" width="5" height="5" rx="1" fill="#0a2a3a" stroke="#1a4a6a" strokeWidth="0.5" />
      </svg>
    ),
  },
  {
    id: 'bing_road',
    label: 'BING ROAD',
    sublabel: 'Bing Maps Road',
    icon: (
      <svg width="32" height="22" viewBox="0 0 32 22" fill="none">
        <rect width="32" height="22" rx="2" fill="#111820" />
        <path d="M6 22 Q16 11 26 0" stroke="#4a7aaa" strokeWidth="2" fill="none" />
        <path d="M0 16 Q16 11 32 6" stroke="#3a5a8a" strokeWidth="1.5" fill="none" />
        <circle cx="8" cy="5" r="1.5" fill="#4a7aaa" opacity="0.7" />
        <circle cx="24" cy="17" r="1.5" fill="#4a7aaa" opacity="0.7" />
      </svg>
    ),
  },
  {
    id: 'google_3d',
    label: 'GOOGLE 3D',
    sublabel: 'Google Photorealistic 3D Tiles',
    icon: (
      <svg width="32" height="22" viewBox="0 0 32 22" fill="none">
        <rect width="32" height="22" rx="2" fill="#0a1a0f" />
        {/* Ground plane */}
        <ellipse cx="16" cy="16" rx="12" ry="4" fill="#0d2a14" stroke="#1a5a2a" strokeWidth="0.5" />
        {/* Buildings */}
        <rect x="7" y="8" width="5" height="8" fill="#143d1f" stroke="#1a6a2a" strokeWidth="0.5" />
        <polygon points="7,8 9.5,4 12,8" fill="#1a5a28" stroke="#1a6a2a" strokeWidth="0.3" />
        <rect x="14" y="5" width="6" height="11" fill="#143d1f" stroke="#1a6a2a" strokeWidth="0.5" />
        <polygon points="14,5 17,1 20,5" fill="#1a5a28" stroke="#1a6a2a" strokeWidth="0.3" />
        <rect x="22" y="10" width="4" height="6" fill="#143d1f" stroke="#1a6a2a" strokeWidth="0.5" />
        <polygon points="22,10 24,7 26,10" fill="#1a5a28" stroke="#1a6a2a" strokeWidth="0.3" />
      </svg>
    ),
  },
];

export function MapTypePanel() {
  const mapType = useAppStore(s => s.mapType);
  const setMapType = useAppStore(s => s.setMapType);

  return (
    <div style={{ padding: '12px 10px', display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{
        fontFamily: 'monospace',
        fontSize: 9,
        letterSpacing: '0.12em',
        color: 'rgba(0,212,255,0.4)',
        marginBottom: 4,
        paddingLeft: 2,
      }}>
        BASE MAP — CESIUM ION
      </div>

      {MAP_OPTIONS.map(opt => {
        const active = mapType === opt.id;
        return (
          <button
            key={opt.id}
            onClick={() => setMapType(opt.id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              width: '100%',
              padding: '7px 10px',
              background: active ? 'rgba(0,212,255,0.08)' : 'rgba(255,255,255,0.02)',
              border: `1px solid ${active ? 'rgba(0,212,255,0.5)' : 'rgba(255,255,255,0.07)'}`,
              borderRadius: 3,
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'all 0.12s ease',
            }}
            onMouseEnter={e => {
              if (!active) (e.currentTarget as HTMLButtonElement).style.background = 'rgba(0,212,255,0.04)';
            }}
            onMouseLeave={e => {
              if (!active) (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.02)';
            }}
          >
            <div style={{
              flexShrink: 0,
              borderRadius: 2,
              overflow: 'hidden',
              border: `1px solid ${active ? 'rgba(0,212,255,0.3)' : 'rgba(255,255,255,0.1)'}`,
            }}>
              {opt.icon}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{
                  fontFamily: 'monospace',
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: '0.12em',
                  color: active ? '#00D4FF' : 'rgba(255,255,255,0.75)',
                  whiteSpace: 'nowrap',
                }}>
                  {opt.label}
                </span>
                {opt.id === 'google_3d' && (
                  <span style={{
                    fontFamily: 'monospace',
                    fontSize: 7,
                    letterSpacing: '0.08em',
                    color: '#00ff88',
                    background: 'rgba(0,255,136,0.1)',
                    border: '1px solid rgba(0,255,136,0.3)',
                    borderRadius: 2,
                    padding: '1px 3px',
                    flexShrink: 0,
                  }}>3D</span>
                )}
              </div>
              <div style={{
                fontFamily: 'monospace',
                fontSize: 9,
                color: 'rgba(255,255,255,0.3)',
                marginTop: 1,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}>
                {opt.sublabel}
              </div>
            </div>
            {active && (
              <div style={{
                marginLeft: 'auto',
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: '#00D4FF',
                flexShrink: 0,
                boxShadow: '0 0 6px #00D4FF',
              }} />
            )}
          </button>
        );
      })}
    </div>
  );
}
