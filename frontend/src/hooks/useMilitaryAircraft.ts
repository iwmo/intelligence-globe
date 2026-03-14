import { useQuery } from '@tanstack/react-query';
import { useAppStore } from '../store/useAppStore';

export interface MilitaryAircraftRecord {
  hex: string;
  flight: string | null;        // callsign
  aircraft_type: string | null;
  alt_baro: number | null;      // feet (airplanes.live uses feet, not meters)
  gs: number | null;            // knots
  track: number | null;         // degrees
  lat: number;
  lon: number;
  squawk: string | null;
  updated_at: string | null;
  // v4.0 freshness — serialised by backend routes_military.py
  is_stale: boolean;
}

export function useMilitaryAircraft() {
  const replayMode = useAppStore(s => s.replayMode);
  const viewportBbox = useAppStore(s => s.viewportBbox);

  // VPC-08: suppress bbox during playback — replay covers arbitrary space/time
  const effectiveBbox = replayMode === 'live' ? viewportBbox : null;

  return useQuery<MilitaryAircraftRecord[]>({
    queryKey: ['military-aircraft', effectiveBbox],  // bbox in key triggers refetch on camera pan
    queryFn: async () => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30_000);
      try {
        let url = '/api/military/';
        if (effectiveBbox) {
          const params = new URLSearchParams({
            min_lat: String(effectiveBbox.minLat),
            max_lat: String(effectiveBbox.maxLat),
            min_lon: String(effectiveBbox.minLon),
            max_lon: String(effectiveBbox.maxLon),
          });
          url = `/api/military/?${params}`;
        }
        const res = await fetch(url, { signal: controller.signal });
        if (!res.ok) throw new Error(`Military aircraft fetch failed: ${res.status}`);
        return res.json() as Promise<MilitaryAircraftRecord[]>;
      } finally {
        clearTimeout(timeoutId);
      }
    },
    staleTime: 300_000,        // 5 minutes — matches backend poll interval
    refetchInterval: replayMode === 'live' ? 300_000 : false,
    retry: 3,
    retryDelay: 5_000,
  });
}
