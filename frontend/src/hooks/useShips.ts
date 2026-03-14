import { useQuery } from '@tanstack/react-query';
import { useAppStore } from '../store/useAppStore';

export interface ShipRecord {
  mmsi: string;
  vessel_name: string | null;
  vessel_type: string | null;
  lat: number;
  lon: number;
  sog: number | null;           // knots
  cog: number | null;           // degrees
  heading: number | null;       // 511 = not available
  nav_status: number | null;
  last_update: string | null;
  updated_at: string | null;
  // v4.0 freshness — serialised by backend routes_ships.py
  is_stale: boolean;
}

export function useShips() {
  const replayMode = useAppStore(s => s.replayMode);
  const viewportBbox = useAppStore(s => s.viewportBbox);

  // VPC-08: suppress bbox during playback — replay covers arbitrary space/time
  const effectiveBbox = replayMode === 'live' ? viewportBbox : null;

  return useQuery<ShipRecord[]>({
    queryKey: ['ships', effectiveBbox],  // bbox in key triggers refetch on camera pan
    queryFn: async () => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30_000);
      try {
        let url = '/api/ships/';
        if (effectiveBbox) {
          const params = new URLSearchParams({
            min_lat: String(effectiveBbox.minLat),
            max_lat: String(effectiveBbox.maxLat),
            min_lon: String(effectiveBbox.minLon),
            max_lon: String(effectiveBbox.maxLon),
          });
          url = `/api/ships/?${params}`;
        }
        const res = await fetch(url, { signal: controller.signal });
        if (!res.ok) throw new Error(`Ships fetch failed: ${res.status}`);
        return res.json() as Promise<ShipRecord[]>;
      } finally {
        clearTimeout(timeoutId);
      }
    },
    staleTime: 30_000,         // 30 seconds — matches batch flush interval
    refetchInterval: replayMode === 'live' ? 30_000 : false,
    retry: 3,
    retryDelay: 5_000,
  });
}
