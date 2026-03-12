import { useQuery } from '@tanstack/react-query';

export interface ShipRecord {
  mmsi: string;
  vessel_name: string | null;
  vessel_type: string | null;
  latitude: number;
  longitude: number;
  sog: number | null;           // knots
  cog: number | null;           // degrees
  true_heading: number | null;  // 511 = not available
  nav_status: number | null;
  last_update: string | null;
  updated_at: string | null;
}

export function useShips() {
  return useQuery<ShipRecord[]>({
    queryKey: ['ships'],
    queryFn: async () => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30_000);
      try {
        const res = await fetch('/api/ships/', { signal: controller.signal });
        if (!res.ok) throw new Error(`Ships fetch failed: ${res.status}`);
        return res.json() as Promise<ShipRecord[]>;
      } finally {
        clearTimeout(timeoutId);
      }
    },
    staleTime: 30_000,         // 30 seconds — matches batch flush interval
    refetchInterval: 30_000,
    retry: 3,
    retryDelay: 5_000,
  });
}
