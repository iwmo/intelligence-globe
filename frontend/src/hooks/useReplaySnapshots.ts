import { useQuery } from '@tanstack/react-query';

export interface SnapshotRecord {
  ts: number;           // ms since epoch (converted from ISO string in queryFn)
  entity_id: string;
  latitude: number;
  longitude: number;
  altitude: number | null;
  heading: number | null;
  speed: number | null;
}

/**
 * Binary search for adjacent snapshots bracketing ts.
 * Returns [before, after] where before.ts <= ts < after.ts.
 * Pure function — no React deps. Exported for use in layer components.
 */
export function findAdjacentSnapshots(
  snapshots: SnapshotRecord[],
  ts: number,
): [SnapshotRecord | null, SnapshotRecord | null] {
  if (snapshots.length === 0) return [null, null];

  // Edge: ts is before first snapshot
  if (ts < snapshots[0].ts) return [null, snapshots[0]];

  // Binary search for last snapshot at or before ts
  let lo = 0;
  let hi = snapshots.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (snapshots[mid].ts <= ts) lo = mid;
    else hi = mid - 1;
  }

  const before = snapshots[lo].ts <= ts ? snapshots[lo] : null;
  const after = snapshots[lo + 1] ?? null;
  return [before, after];
}

/**
 * Fetch and cache snapshot data for a given layer and time window.
 * Builds Map<entityId, SnapshotRecord[]> sorted by ts ascending.
 * enabled=false: returns { data: new Map(), isLoading: false } immediately.
 *
 * IMPORTANT: Do NOT call this with a window larger than ~2 hours.
 * A 2-hour window at full entity density = ~264MB in the browser.
 */
export function useReplaySnapshots(
  layer: 'aircraft' | 'military' | 'ship' | 'all',
  windowStart: number | null,
  windowEnd: number | null,
  enabled: boolean,
) {
  return useQuery({
    queryKey: ['replaySnapshots', layer, windowStart, windowEnd],
    queryFn: async (): Promise<Map<string, SnapshotRecord[]>> => {
      if (!windowStart || !windowEnd) return new Map();
      const params = new URLSearchParams({
        layer,
        start: new Date(windowStart).toISOString(),
        end: new Date(windowEnd).toISOString(),
        limit: '100000',
      });
      const res = await fetch(`/api/replay/snapshots?${params}`);
      if (!res.ok) throw new Error(`Snapshot fetch failed: ${res.status}`);
      const body = await res.json() as {
        snapshots: Array<{
          ts: string;
          entity_id: string;
          latitude: number;
          longitude: number;
          altitude: number | null;
          heading: number | null;
          speed: number | null;
        }>;
      };

      // Build Map<entityId, sorted SnapshotRecord[]>
      const byEntity = new Map<string, SnapshotRecord[]>();
      for (const s of body.snapshots) {
        const rec: SnapshotRecord = {
          ts: new Date(s.ts).getTime(),
          entity_id: s.entity_id,
          latitude: s.latitude,
          longitude: s.longitude,
          altitude: s.altitude,
          heading: s.heading,
          speed: s.speed,
        };
        const arr = byEntity.get(s.entity_id) ?? [];
        arr.push(rec);
        byEntity.set(s.entity_id, arr);
      }
      // Sort each entity's snapshots ascending by ts (they should be, but guarantee it)
      for (const arr of byEntity.values()) {
        arr.sort((a, b) => a.ts - b.ts);
      }
      return byEntity;
    },
    enabled,
    staleTime: Infinity,    // snapshot history is immutable — never re-fetch during playback
    refetchInterval: false,
    placeholderData: new Map(),
  });
}
