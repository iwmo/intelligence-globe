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
  const replayWindowStart = useAppStore(s => s.replayWindowStart);
  const replayWindowEnd = useAppStore(s => s.replayWindowEnd);

  // VPC-08: suppress bbox during playback — replay covers arbitrary space/time
  const effectiveBbox = replayMode === 'live' ? viewportBbox : null;

  // Live mode: only fetch events from the last 24 hours.
  // Floor to the nearest 15-min boundary to keep the queryKey stable within
  // each refetch cycle and avoid redundant re-fetches between renders.
  const liveSince = replayMode === 'live'
    ? new Date(Math.floor((Date.now() - 86_400_000) / 900_000) * 900_000).toISOString()
    : null;

  // GDELT-10: window bounds for single-load replay session.
  // Only populated when in playback AND both window values are non-null.
  // replayTs is intentionally NOT in the queryKey — window bounds are constant
  // per session; per-tick temporal filtering is handled by GdeltLayer Effect 3.
  const replayWindowSince =
    replayMode === 'playback' && replayWindowStart != null
      ? new Date(replayWindowStart).toISOString()
      : null;
  const replayWindowUntil =
    replayMode === 'playback' && replayWindowEnd != null
      ? new Date(replayWindowEnd).toISOString()
      : null;

  return useQuery<GdeltEvent[]>({
    queryKey: ['gdelt-events', effectiveBbox, liveSince, replayWindowSince, replayWindowUntil],
    queryFn: async () => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30_000);
      try {
        const params = new URLSearchParams();

        if (effectiveBbox) {
          params.set('min_lat', String(effectiveBbox.minLat));
          params.set('max_lat', String(effectiveBbox.maxLat));
          params.set('min_lon', String(effectiveBbox.minLon));
          params.set('max_lon', String(effectiveBbox.maxLon));
        }

        if (liveSince != null) {
          params.set('since', liveSince);
        }
        if (replayWindowSince != null) {
          params.set('since', replayWindowSince);
        }
        if (replayWindowUntil != null) {
          params.set('until', replayWindowUntil);
        }

        const qs = params.toString();
        const url = qs ? `/api/gdelt-events?${qs}` : '/api/gdelt-events';

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
