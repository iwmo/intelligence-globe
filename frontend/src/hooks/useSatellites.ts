import { useQuery } from '@tanstack/react-query';

interface SatelliteRecord {
  norad_cat_id: number;
  omm: Record<string, unknown>;
}

export function useSatellites() {
  return useQuery<SatelliteRecord[]>({
    queryKey: ['satellites'],
    queryFn: async () => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30_000); // 30s — large payload
      try {
        const res = await fetch('/api/satellites/', { signal: controller.signal });
        if (!res.ok) throw new Error(`Satellites fetch failed: ${res.status}`);
        return res.json() as Promise<SatelliteRecord[]>;
      } finally {
        clearTimeout(timeoutId);
      }
    },
    staleTime: 7_200_000,      // 2 hours — matches backend TLE refresh interval
    refetchInterval: 7_200_000,
    retry: 3,
    retryDelay: 5_000,
  });
}
