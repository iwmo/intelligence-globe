export type FlowBucket = 'free' | 'slow' | 'heavy' | 'standstill' | 'closed' | 'unknown';

export interface FlowSample {
  lat: number;
  lon: number;
  bucket: FlowBucket;
  closed?: boolean;
}

export const FLOW_HEX: Record<FlowBucket, string> = {
  free: '#4ade80',
  slow: '#facc15',
  heavy: '#fb923c',
  standstill: '#f87171',
  closed: '#64748b',
  unknown: '#38BDF8',
};

export function nearestFlowBucket(lon: number, lat: number, samples: FlowSample[]): FlowBucket {
  if (samples.length === 0) return 'unknown';
  let best = samples[0];
  let bestD = Infinity;
  for (const s of samples) {
    const d = Math.hypot(s.lat - lat, s.lon - lon);
    if (d < bestD) {
      best = s;
      bestD = d;
    }
  }
  return best.bucket;
}
