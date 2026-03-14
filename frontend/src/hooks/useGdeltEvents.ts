import { useQuery } from '@tanstack/react-query';
import { useAppStore } from '../store/useAppStore';

export interface GdeltEvent {
  global_event_id: string;
  occurred_at: string;           // ISO string
  discovered_at: string | null;
  latitude: number;
  longitude: number;
  quad_class: number;            // 1=Verbal Coop, 2=Material Coop, 3=Verbal Conflict, 4=Material Conflict
  goldstein_scale: number | null;
  event_code: string;            // CAMEO code e.g. "040" — VARCHAR(4), not integer
  actor1_name: string | null;
  actor2_name: string | null;
  source_url: string | null;
  avg_tone: number | null;
  num_mentions: number | null;
  source_is_stale: boolean;
}

export function useGdeltEvents() {
  const replayMode = useAppStore(s => s.replayMode);
  const viewportBbox = useAppStore(s => s.viewportBbox);

  // VPC-08: suppress bbox during playback — replay covers arbitrary space/time
  const effectiveBbox = replayMode === 'live' ? viewportBbox : null;

  return useQuery<GdeltEvent[]>({
    queryKey: ['gdelt-events', effectiveBbox],
    queryFn: async () => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30_000);
      try {
        let url = '/api/gdelt-events';
        if (effectiveBbox) {
          const params = new URLSearchParams({
            min_lat: String(effectiveBbox.minLat),
            max_lat: String(effectiveBbox.maxLat),
            min_lon: String(effectiveBbox.minLon),
            max_lon: String(effectiveBbox.maxLon),
          });
          url = `/api/gdelt-events?${params}`;
        }
        const res = await fetch(url, { signal: controller.signal });
        if (!res.ok) throw new Error(`GDELT events fetch failed: ${res.status}`);
        return res.json() as Promise<GdeltEvent[]>;
      } finally {
        clearTimeout(timeoutId);
      }
    },
    staleTime: 900_000,
    refetchInterval: replayMode === 'live' ? 900_000 : false,
    retry: 3,
    retryDelay: 5_000,
  });
}
