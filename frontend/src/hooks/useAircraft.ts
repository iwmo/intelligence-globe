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
        const params = new URLSearchParams();
        params.set('include_stale', 'true'); // so map shows last-known positions when ingest is delayed; is_stale flags grey them
        if (effectiveBbox) {
          params.set('min_lat', String(effectiveBbox.minLat));
          params.set('max_lat', String(effectiveBbox.maxLat));
          params.set('min_lon', String(effectiveBbox.minLon));
          params.set('max_lon', String(effectiveBbox.maxLon));
        }
        const url = `/api/aircraft/?${params}`;
        const res = await fetch(url, { signal: controller.signal });
        if (!res.ok) throw new Error(`Aircraft fetch failed: ${res.status}`);
        return res.json() as Promise<AircraftRecord[]>;
      } finally {
        clearTimeout(timeoutId);
      }
    },
    staleTime: 15_000,         // 15 seconds — matches ADSB.lol backend cadence
    refetchInterval: replayMode === 'live' ? 15_000 : false,
    retry: 3,
    retryDelay: 5_000,
  });
}
