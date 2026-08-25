import { useQuery } from '@tanstack/react-query';
import { useAppStore } from '../store/useAppStore';

export interface EarthquakeEvent {
  id: string;
  occurred_at: string | null;
  lat: number;
  lon: number;
  depth_km: number | null;
  mag: number | null;
  place: string | null;
  url: string | null;
}

export interface EarthquakeEnvelope {
  fetched_at: string | null;
  source_is_stale: boolean;
  events: EarthquakeEvent[];
}

export function useEarthquakes() {
  const replayMode = useAppStore(s => s.replayMode);
  return useQuery<EarthquakeEnvelope>({
    queryKey: ['earthquakes'],
    queryFn: async () => {
      const res = await fetch('/api/earthquakes/');
      if (!res.ok) throw new Error(`Earthquakes fetch failed: ${res.status}`);
      return res.json() as Promise<EarthquakeEnvelope>;
    },
    staleTime: 300_000,
    refetchInterval: replayMode === 'live' ? 300_000 : false,
  });
}
