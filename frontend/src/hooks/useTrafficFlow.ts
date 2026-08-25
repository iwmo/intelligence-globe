import { useQuery } from '@tanstack/react-query';
import type { Viewer } from 'cesium';
import { useAppStore } from '../store/useAppStore';
import type { FlowSample } from '../lib/trafficFlow';

const TOMTOM_ALT_M = 8_000;

export interface TrafficFlowResponse {
  mode: 'live' | 'sim';
  samples: FlowSample[];
  provider: string;
}

export function useTrafficStatus() {
  return useQuery<{ mode: string; provider: string }>({
    queryKey: ['traffic-status'],
    queryFn: async () => {
      const res = await fetch('/api/traffic/status');
      if (!res.ok) throw new Error('traffic status');
      return res.json();
    },
    staleTime: 60_000,
  });
}

export function useTrafficFlow(viewer: Viewer | null, enabled: boolean) {
  const bbox = useAppStore(s => s.viewportBbox);
  const replayMode = useAppStore(s => s.replayMode);
  const alt = viewer && !viewer.isDestroyed()
    ? viewer.camera.positionCartographic.height
    : Infinity;
  const streetLevel = alt <= TOMTOM_ALT_M;

  return useQuery<TrafficFlowResponse>({
    queryKey: ['traffic-flow', bbox?.minLat, bbox?.maxLat, bbox?.minLon, bbox?.maxLon],
    queryFn: async () => {
      if (!bbox) return { mode: 'sim', samples: [], provider: 'osm-sim' };
      const params = new URLSearchParams({
        min_lat: String(bbox.minLat),
        max_lat: String(bbox.maxLat),
        min_lon: String(bbox.minLon),
        max_lon: String(bbox.maxLon),
      });
      const res = await fetch(`/api/traffic/flow?${params}`);
      if (!res.ok) throw new Error('traffic flow');
      return res.json() as Promise<TrafficFlowResponse>;
    },
    enabled: enabled && replayMode === 'live' && streetLevel && bbox != null,
    staleTime: 120_000,
  });
}
