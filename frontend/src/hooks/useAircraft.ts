import { useQuery } from '@tanstack/react-query';

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
}

export function useAircraft() {
  return useQuery<AircraftRecord[]>({
    queryKey: ['aircraft'],
    queryFn: async () => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30_000); // 30s — aircraft payload can be large
      try {
        const res = await fetch('/api/aircraft/', { signal: controller.signal });
        if (!res.ok) throw new Error(`Aircraft fetch failed: ${res.status}`);
        return res.json() as Promise<AircraftRecord[]>;
      } finally {
        clearTimeout(timeoutId);
      }
    },
    staleTime: 90_000,         // 90 seconds — matches OpenSky poll interval
    refetchInterval: 90_000,
    retry: 3,
    retryDelay: 5_000,
  });
}
