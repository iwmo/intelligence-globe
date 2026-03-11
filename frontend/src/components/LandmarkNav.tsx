import { useState, useRef, useEffect } from 'react';
import type { Viewer } from 'cesium';
import landmarksData from '../data/landmarks.json';
import { flyToLandmark } from '../lib/viewerRegistry';

interface NominatimResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  boundingbox: [string, string, string, string]; // [south, north, west, east]
}

function computeAltFromBbox(bbox: [string, string, string, string]): number {
  const [south, north, west, east] = bbox.map(Number);
  const latSpan = north - south;
  const lonSpan = east - west;
  return Math.max(100_000, Math.min(3_000_000, Math.max(latSpan, lonSpan) * 111_000));
}

const LANDMARK_BUTTON_STYLE: React.CSSProperties = {
  background: 'rgba(0, 212, 255, 0.08)',
  border: '1px solid rgba(0, 212, 255, 0.25)',
  borderRadius: '4px',
  color: '#00D4FF',
  cursor: 'pointer',
  fontFamily: 'monospace',
  fontSize: '11px',
  letterSpacing: '0.05em',
  padding: '4px 8px',
  whiteSpace: 'nowrap',
  transition: 'background 0.15s, border-color 0.15s',
};

const LANDMARK_BUTTON_HOVER_STYLE: React.CSSProperties = {
  ...LANDMARK_BUTTON_STYLE,
  background: 'rgba(0, 212, 255, 0.2)',
  borderColor: 'rgba(0, 212, 255, 0.6)',
};

function LandmarkButton({ landmark }: { landmark: (typeof landmarksData.landmarks)[number] }) {
  const [hovered, setHovered] = useState(false);

  return (
    <button
      style={hovered ? LANDMARK_BUTTON_HOVER_STYLE : LANDMARK_BUTTON_STYLE}
      onClick={() => flyToLandmark(landmark)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      title={`Press ${landmark.shortcut} to fly here`}
    >
      [{landmark.shortcut}] {landmark.name}
    </button>
  );
}

/**
 * Bottom navigation bar with city quick-jump search (Nominatim) and five landmark preset buttons.
 * Positioned above the BottomStatusBar.
 * The viewer prop is accepted for future use (e.g. displaying current landmark) but unused for navigation —
 * all navigation goes through viewerRegistry which already holds the viewer reference.
 */
export function LandmarkNav({ viewer: _viewer }: { viewer: Viewer | null }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<NominatimResult[]>([]);
  const [searchStatus, setSearchStatus] = useState<'idle' | 'loading' | 'no-results' | 'error'>('idle');
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current !== null) clearTimeout(debounceRef.current);
    };
  }, []);

  function handleQueryChange(e: React.ChangeEvent<HTMLInputElement>) {
    const value = e.target.value;
    setQuery(value);

    if (debounceRef.current !== null) clearTimeout(debounceRef.current);

    if (!value.trim()) {
      setDropdownOpen(false);
      setResults([]);
      setSearchStatus('idle');
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setSearchStatus('loading');
      try {
        const url = new URL('https://nominatim.openstreetmap.org/search');
        url.searchParams.set('q', value.trim());
        url.searchParams.set('format', 'json');
        url.searchParams.set('limit', '5');
        const res = await fetch(url.toString(), {
          headers: {
            'User-Agent': 'IntelligenceGlobe/2.0 (homelab OSINT viewer)',
            'Accept-Language': 'en',
          },
        });
        const data = (await res.json()) as NominatimResult[];
        setResults(data);
        setSearchStatus(data.length === 0 ? 'no-results' : 'idle');
        setDropdownOpen(true);
      } catch {
        setSearchStatus('error');
        setResults([]);
        setDropdownOpen(true);
      }
    }, 400);
  }

  function handleResultClick(result: NominatimResult) {
    const altMeters = computeAltFromBbox(result.boundingbox);
    flyToLandmark({
      lon: parseFloat(result.lon),
      lat: parseFloat(result.lat),
      altMeters,
    });
    setQuery(result.display_name.split(',')[0]);
    setDropdownOpen(false);
  }

  return (
    <div
      ref={containerRef}
      style={{
        position: 'fixed',
        bottom: '32px', // sit above the 32px BottomStatusBar
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 90,
        background: 'rgba(0, 10, 20, 0.85)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        border: '1px solid rgba(0, 212, 255, 0.2)',
        borderRadius: '6px',
        padding: '6px 10px',
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
        minWidth: '320px',
        maxWidth: '90vw',
      }}
    >
      {/* City quick-jump search */}
      <div style={{ position: 'relative' }}>
        <input
          type="text"
          value={query}
          onChange={handleQueryChange}
          placeholder="Jump to city..."
          style={{
            width: '100%',
            background: 'rgba(0, 0, 0, 0.6)',
            border: '1px solid rgba(0, 212, 255, 0.3)',
            borderRadius: '4px',
            color: '#e0e0e0',
            fontFamily: 'monospace',
            fontSize: '12px',
            outline: 'none',
            padding: '4px 8px',
            boxSizing: 'border-box',
          }}
        />

        {/* Dropdown */}
        {dropdownOpen && (
          <div
            style={{
              position: 'absolute',
              bottom: '100%',
              left: 0,
              right: 0,
              background: 'rgba(0, 10, 20, 0.95)',
              border: '1px solid rgba(0, 212, 255, 0.3)',
              borderRadius: '4px',
              marginBottom: '2px',
              maxHeight: '200px',
              overflowY: 'auto',
              zIndex: 10,
            }}
          >
            {searchStatus === 'loading' && (
              <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '11px', padding: '6px 8px' }}>
                Searching...
              </div>
            )}
            {searchStatus === 'error' && (
              <div style={{ color: '#ff6666', fontSize: '11px', padding: '6px 8px' }}>
                Search unavailable
              </div>
            )}
            {searchStatus === 'no-results' && (
              <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px', padding: '6px 8px' }}>
                No results
              </div>
            )}
            {results.map(r => (
              <div
                key={r.place_id}
                onClick={() => handleResultClick(r)}
                style={{
                  color: '#e0e0e0',
                  cursor: 'pointer',
                  fontSize: '11px',
                  fontFamily: 'monospace',
                  padding: '5px 8px',
                  borderBottom: '1px solid rgba(0, 212, 255, 0.1)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLDivElement).style.background = 'rgba(0, 212, 255, 0.1)';
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLDivElement).style.background = 'transparent';
                }}
              >
                {r.display_name}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Landmark preset buttons */}
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
        {landmarksData.landmarks.map(lm => (
          <LandmarkButton key={lm.id} landmark={lm} />
        ))}
      </div>
    </div>
  );
}
