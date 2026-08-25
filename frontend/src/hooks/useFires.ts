import { useQuery } from '@tanstack/react-query';
import { useAppStore } from '../store/useAppStore';

export interface FireEnvelope {
  available: boolean;
  fetched_at: string | null;
  source_is_stale: boolean;
  cells: { id: number; lat: number; lon: number; frp: number | null; confidence: string | null }[];
}

function spanDeg(bbox: { minLat: number; maxLat: number; minLon: number; maxLon: number } | null): number {
  if (!bbox) return Infinity;
  return Math.max(bbox.maxLat - bbox.minLat, bbox.maxLon - bbox.minLon);
}

export function useFires() {
  const replayMode = useAppStore(s => s.replayMode);
  const bbox = useAppStore(s => s.viewportBbox);
  const clipped = spanDeg(bbox) <= 10;
  const effective = replayMode === 'live' && clipped ? bbox : null;

  return useQuery<FireEnvelope>({
    queryKey: ['fires', effective],
    queryFn: async () => {
      if (!effective) {
        const statusRes = await fetch('/api/fires/status');
        if (!statusRes.ok) throw new Error(`Fires status failed: ${statusRes.status}`);
        const status = await statusRes.json() as { available: boolean };
        return { available: status.available, fetched_at: null, source_is_stale: false, cells: [] };
      }
      const params = new URLSearchParams({
        min_lat: String(effective.minLat),
        max_lat: String(effective.maxLat),
        min_lon: String(effective.minLon),
        max_lon: String(effective.maxLon),
      });
      const res = await fetch(`/api/fires/?${params}`);
      if (!res.ok) throw new Error(`Fires fetch failed: ${res.status}`);
      return res.json() as Promise<FireEnvelope>;
    },
    staleTime: 600_000,
    refetchInterval: replayMode === 'live' ? 600_000 : false,
  });
}
