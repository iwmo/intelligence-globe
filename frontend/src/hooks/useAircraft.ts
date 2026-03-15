import { useQuery } from '@tanstack/react-query';
import { useAppStore } from '../store/useAppStore';

export interface AircraftRecord {
  icao24: string;
  callsign: string | null;
  origin_country: string | null;
  latitude: number;
  longitude: number;
  baro_altitude: number | null;
  velocity: number | null;
  true_track: number | null;
  trail: Array<{ lon: number; lat: number; alt: number | null; ts: number | null }>;
  // v4.0 freshness — serialised by backend routes_aircraft.py
  is_stale: boolean;
  // v10.0 ADSB.lol — roll angle in degrees; positive = right bank, negative = left bank; null when not reported
  roll: number | null;
}

export function useAircraft() {
  const replayMode = useAppStore(s => s.replayMode);
  const viewportBbox = useAppStore(s => s.viewportBbox);

  // VPC-08: suppress bbox during playback — replay covers arbitrary space/time
  const effectiveBbox = replayMode === 'live' ? viewportBbox : null;

  return useQuery<AircraftRecord[]>({
    queryKey: ['aircraft', effectiveBbox],  // bbox in key triggers refetch on camera pan
    queryFn: async () => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30_000); // 30s — aircraft payload can be large
      try {
        let url = '/api/aircraft/';
        if (effectiveBbox) {
          const params = new URLSearchParams({
            min_lat: String(effectiveBbox.minLat),
            max_lat: String(effectiveBbox.maxLat),
            min_lon: String(effectiveBbox.minLon),
            max_lon: String(effectiveBbox.maxLon),
          });
          url = `/api/aircraft/?${params}`;
        }
        const res = await fetch(url, { signal: controller.signal });
        if (!res.ok) throw new Error(`Aircraft fetch failed: ${res.status}`);
        return res.json() as Promise<AircraftRecord[]>;
      } finally {
        clearTimeout(timeoutId);
      }
    },
    staleTime: 90_000,         // 90 seconds — matches OpenSky poll interval
    refetchInterval: replayMode === 'live' ? 90_000 : false,
    retry: 3,
    retryDelay: 5_000,
  });
}
