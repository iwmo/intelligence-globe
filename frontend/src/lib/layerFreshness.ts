import type { SourceHealthStatus } from '../store/useSourceHealthStore';

export type LayerHonesty =
  | 'OFF'
  | 'CONNECTING'
  | 'LIVE'
  | 'STALE'
  | 'EMPTY'
  | 'ERROR'
  | 'UNAVAILABLE';

const STALE_AFTER_MS = 90_000;

export function layerHonesty(opts: {
  visible: boolean;
  status?: SourceHealthStatus;
  lastUpdated?: string | null;
  hasData?: boolean;
  anyStale?: boolean;
}): LayerHonesty {
  if (!opts.visible) return 'OFF';

  if (opts.status) {
    const labels: Record<SourceHealthStatus, LayerHonesty> = {
      off: 'OFF',
      connecting: 'CONNECTING',
      live: 'LIVE',
      stale: 'STALE',
      empty: 'EMPTY',
      error: 'ERROR',
      unavailable: 'UNAVAILABLE',
    };
    return labels[opts.status];
  }

  if (opts.hasData === false) return 'UNAVAILABLE';
  if (opts.anyStale) return 'STALE';
  if (opts.lastUpdated) {
    const age = Date.now() - new Date(opts.lastUpdated).getTime();
    if (!Number.isNaN(age) && age > STALE_AFTER_MS) return 'STALE';
    return 'LIVE';
  }
  if (opts.hasData === true) return 'LIVE';
  return 'CONNECTING';
}
