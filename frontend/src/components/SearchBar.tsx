import { useRef, useState, useCallback } from 'react';
import type { RefObject } from 'react';
import { Search, X } from 'lucide-react';
import { useSatellites } from '../hooks/useSatellites';
import { useAircraft } from '../hooks/useAircraft';
import { useAppStore } from '../store/useAppStore';
import { flyToPosition } from '../lib/viewerRegistry';

interface SearchBarProps {
  workerRef: RefObject<Worker | null>;
}

export function SearchBar({ workerRef }: SearchBarProps) {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const satellites = useSatellites();
  const aircraft = useAircraft();

  const setSelectedSatelliteId = useAppStore(s => s.setSelectedSatelliteId);
  const setSelectedAircraftId = useAppStore(s => s.setSelectedAircraftId);

  const handleSearch = useCallback((rawQuery: string) => {
    const q = rawQuery.trim().toLowerCase();
    if (!q) { setStatus(null); return; }

    // Try aircraft first (callsign or icao24)
    const acMatch = aircraft.data?.find(ac =>
      ac.icao24 === q ||
      (ac.callsign?.trim().toLowerCase() ?? '') === q ||
      (ac.callsign?.trim().toLowerCase() ?? '').includes(q)
    );
    if (acMatch && acMatch.latitude != null && acMatch.longitude != null) {
      setSelectedAircraftId(acMatch.icao24);
      setSelectedSatelliteId(null);
      flyToPosition(acMatch.longitude, acMatch.latitude, acMatch.baro_altitude ?? 10_000);
      setStatus(`Aircraft: ${acMatch.callsign?.trim() || acMatch.icao24}`);
      return;
    }

    // Try satellite (NORAD ID exact or name includes)
    const satMatch = satellites.data?.find(s =>
      String(s.norad_cat_id) === q ||
      ((s.omm as Record<string, string>).OBJECT_NAME?.toLowerCase().includes(q) ?? false)
    );
    if (satMatch) {
      setSelectedSatelliteId(satMatch.norad_cat_id);
      setSelectedAircraftId(null);
      // Request live ECEF position from worker; fly-to handled by POSITION_RESULT
      if (workerRef.current) {
        setStatus(`Satellite: ${(satMatch.omm as Record<string, string>).OBJECT_NAME ?? satMatch.norad_cat_id}`);
        workerRef.current.postMessage({
          type: 'GET_POSITION',
          payload: { norad: satMatch.norad_cat_id },
        });
      } else {
        // Worker not yet ready — TLE data still loading. Status remains visible.
        const name = (satMatch.omm as Record<string, string>).OBJECT_NAME ?? String(satMatch.norad_cat_id);
        setStatus(`Satellite: ${name} (loading position...)`);
      }
      return;
    }

    setStatus('No match');
  }, [aircraft.data, satellites.data, setSelectedAircraftId, setSelectedSatelliteId, workerRef]);

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => handleSearch(val), 300);
  };

  const onClear = () => {
    setQuery('');
    setStatus(null);
    if (debounceRef.current) clearTimeout(debounceRef.current);
  };

  return (
    <div style={{ padding: '12px 12px 0' }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: '6px',
        background: 'rgba(0,212,255,0.06)',
        border: '1px solid rgba(0,212,255,0.25)',
        borderRadius: '6px', padding: '6px 10px',
      }}>
        <Search size={14} color="rgba(0,212,255,0.6)" />
        <input
          type="text"
          value={query}
          onChange={onChange}
          placeholder="Search satellite or aircraft..."
          style={{
            flex: 1, background: 'transparent', border: 'none', outline: 'none',
            color: '#e0e0e0', fontSize: '12px',
          }}
        />
        {query && (
          <button onClick={onClear} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
            <X size={12} color="rgba(255,255,255,0.4)" />
          </button>
        )}
      </div>
      {status && (
        <div style={{ fontSize: '11px', color: status === 'No match' ? '#ff6b6b' : '#00D4FF', marginTop: '6px', paddingLeft: '2px' }}>
          {status}
        </div>
      )}
    </div>
  );
}
