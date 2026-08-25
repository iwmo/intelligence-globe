export type LayerHonesty = 'LIVE' | 'STALE' | 'OFF' | 'UNAVAILABLE';

const STALE_AFTER_MS = 90_000;

export function layerHonesty(opts: {
  visible: boolean;
  lastUpdated?: string | null;
  hasData?: boolean;
  anyStale?: boolean;
}): LayerHonesty {
  if (!opts.visible) return 'OFF';
  if (opts.hasData === false) return 'UNAVAILABLE';
  if (opts.anyStale) return 'STALE';
  if (opts.lastUpdated) {
    const age = Date.now() - new Date(opts.lastUpdated).getTime();
    if (!Number.isNaN(age) && age > STALE_AFTER_MS) return 'STALE';
  }
  return 'LIVE';
}
