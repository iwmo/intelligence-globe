import { useRef, useState, useCallback, useEffect } from 'react';
import type { RefObject } from 'react';
import { Search, X } from 'lucide-react';
import { useSatellites } from '../hooks/useSatellites';
import { useAircraft } from '../hooks/useAircraft';
import { useAppStore } from '../store/useAppStore';
import { flyToLandmark, flyToPosition } from '../lib/viewerRegistry';
import landmarksData from '../data/landmarks.json';
import './search-bar.css';

interface SearchBarProps {
  workerRef: RefObject<Worker | null>;
  compact?: boolean;
}

interface PlaceHit {
  label: string;
  lat: number;
  lon: number;
}

export function SearchBar({ workerRef, compact = false }: SearchBarProps) {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const satellites = useSatellites();
  const aircraft = useAircraft();

  const selectContact = useAppStore(s => s.selectContact);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
  }, []);

  const handleSearch = useCallback(async (rawQuery: string) => {
    const q = rawQuery.trim().toLowerCase();
    if (!q) { setStatus(null); return; }

    if (q === 'layers' || q === 'show layers') {
      useAppStore.getState().setActiveLeftPanel('layers');
      setStatus('Opened layer drawer');
      return;
    }
    if (q === 'settings' || q === 'open settings') {
      useAppStore.getState().setActiveRightPanel('settings');
      setStatus('Opened settings');
      return;
    }

    // Try aircraft first (callsign or icao24)
    const acMatch = aircraft.data?.find(ac =>
      ac.icao24 === q ||
      (ac.callsign?.trim().toLowerCase() ?? '') === q ||
      (ac.callsign?.trim().toLowerCase() ?? '').includes(q)
    );
    if (acMatch && acMatch.latitude != null && acMatch.longitude != null) {
      selectContact('aircraft', acMatch.icao24);
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
      selectContact('satellite', satMatch.norad_cat_id);
      // Request ECEF position from worker; fly-to handled by POSITION_RESULT
      if (workerRef.current) {
        setStatus(`Satellite: ${(satMatch.omm as Record<string, string>).OBJECT_NAME ?? satMatch.norad_cat_id}`);
        const { replayMode: srm, replayTs: srts } = useAppStore.getState();
        const satTimestamp = srm === 'playback' ? srts : Date.now();
        workerRef.current.postMessage({
          type: 'GET_POSITION',
          payload: { norad: satMatch.norad_cat_id, timestamp: satTimestamp },
        });
      } else {
        // Worker not yet ready — TLE data still loading. Status remains visible.
        const name = (satMatch.omm as Record<string, string>).OBJECT_NAME ?? String(satMatch.norad_cat_id);
        setStatus(`Satellite: ${name} (loading position...)`);
      }
      return;
    }

    const landmark = landmarksData.landmarks.find(item =>
      item.name.toLowerCase().includes(q) || item.id.toLowerCase() === q,
    );
    if (landmark) {
      flyToLandmark(landmark);
      setStatus(`Location: ${landmark.name}`);
      return;
    }

    setStatus('Searching locations…');
    try {
      const response = await fetch(`/api/places/geocode?q=${encodeURIComponent(rawQuery.trim())}`);
      if (!response.ok) throw new Error('geocode');
      const data = await response.json() as { results?: PlaceHit[] };
      const place = data.results?.[0];
      if (!place) {
        setStatus('No match');
        return;
      }
      flyToLandmark({ lon: place.lon, lat: place.lat, altMeters: 80_000 });
      setStatus(`Location: ${place.label}`);
    } catch {
      setStatus('Location search unavailable');
    }
  }, [aircraft.data, satellites.data, selectContact, workerRef]);

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => void handleSearch(val), 300);
  };

  const onClear = () => {
    setQuery('');
    setStatus(null);
    if (debounceRef.current) clearTimeout(debounceRef.current);
  };

  return (
    <div className={`universal-search${compact ? ' universal-search--compact' : ''}`}>
      <div className="universal-search__field">
        <Search aria-hidden="true" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={onChange}
          placeholder="Search locations, contacts, commands…"
          aria-label="Universal command and location search"
        />
        {compact && <kbd>⌘K</kbd>}
        {query && (
          <button type="button" onClick={onClear} aria-label="Clear search">
            <X aria-hidden="true" />
          </button>
        )}
      </div>
      {status && (
        <div
          className="universal-search__status"
          data-error={status === 'No match' || status.includes('unavailable')}
          role="status"
        >
          {status}
        </div>
      )}
    </div>
  );
}
