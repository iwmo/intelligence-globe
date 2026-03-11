import { useQuery } from '@tanstack/react-query';

export function useHealthCheck() {
  return useQuery({
    queryKey: ['health'],
    queryFn: async () => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5_000);
      try {
        const res = await fetch('/api/health', { signal: controller.signal });
        if (!res.ok) throw new Error('Backend unreachable');
        return res.json() as Promise<{ status: string; version: string }>;
      } finally {
        clearTimeout(timeoutId);
      }
    },
    staleTime: 30_000,
    retry: 3,
    retryDelay: 2_000,
    refetchInterval: 10_000,
  });
}
