import { useQuery } from '@tanstack/react-query';

export function useHealthCheck() {
  return useQuery({
    queryKey: ['health'],
    queryFn: async () => {
      const res = await fetch('/api/health');
      if (!res.ok) throw new Error('Backend unreachable');
      return res.json() as Promise<{ status: string; version: string }>;
    },
    staleTime: 30_000,
    retry: 3,
  });
}
