import { useQuery } from '@tanstack/react-query';
import { useAppStore } from '../store/useAppStore';

export interface LaunchRecord {
  id: string;
  name: string;
  net: string | null;
  status: string | null;
  pad: string | null;
  lat: number | null;
  lon: number | null;
}

export interface LaunchEnvelope {
  fetched_at: string | null;
  source_is_stale: boolean;
  launches: LaunchRecord[];
}

export function useLaunches() {
  const replayMode = useAppStore(s => s.replayMode);
  return useQuery<LaunchEnvelope>({
    queryKey: ['launches'],
    queryFn: async () => {
      const res = await fetch('/api/launches/');
      if (!res.ok) throw new Error(`Launches fetch failed: ${res.status}`);
      return res.json() as Promise<LaunchEnvelope>;
    },
    staleTime: 1_800_000,
    refetchInterval: replayMode === 'live' ? 1_800_000 : false,
  });
}
