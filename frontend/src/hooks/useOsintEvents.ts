import { useQuery } from '@tanstack/react-query';
import type { OsintEvent } from '../data/osintEvents';

interface ApiOsintEvent {
  id: number;
  ts: string;  // ISO string from backend
  category: string;
  label: string;
  latitude: number | null;
  longitude: number | null;
  source_url: string | null;
}

export function useOsintEvents(enabled: boolean) {
  const { data, isLoading } = useQuery({
    queryKey: ['osint-events'],
    queryFn: async () => {
      const r = await fetch('/api/osint-events');
      if (!r.ok) throw new Error('Failed to fetch osint events');
      return r.json() as Promise<{ events: ApiOsintEvent[] }>;
    },
    refetchInterval: enabled ? 30_000 : false,
    enabled,
    staleTime: 25_000,
    select: (raw) => ({
      events: raw.events.map((e): OsintEvent => ({
        id: String(e.id),
        ts: new Date(e.ts).getTime(),
        category: e.category as OsintEvent['category'],
        label: e.label,
        latitude: e.latitude,
        longitude: e.longitude,
      })),
    }),
  });
  return { events: data?.events ?? [], isLoading };
}
