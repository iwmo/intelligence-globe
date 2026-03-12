import { useQuery } from '@tanstack/react-query';

export interface GpsJammingCell {
  h3index: string;
  bad_ratio: number;
  severity: 'green' | 'yellow' | 'red';
  aircraft_count: number;
  updated_at: string | null;
}

export function useGpsJamming() {
  return useQuery<{ cells: GpsJammingCell[] }>({
    queryKey: ['gps-jamming'],
    queryFn: async () => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30_000);
      try {
        const res = await fetch('/api/gps-jamming', { signal: controller.signal });
        if (!res.ok) throw new Error(`GPS jamming fetch failed: ${res.status}`);
        return res.json();
      } finally {
        clearTimeout(timeoutId);
      }
    },
    staleTime: 86_400_000,    // 24 hours — matches daily aggregation cadence
    refetchInterval: 86_400_000,
    retry: 3,
    retryDelay: 5_000,
  });
}
