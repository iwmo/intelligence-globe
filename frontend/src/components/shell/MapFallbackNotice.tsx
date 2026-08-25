import { AlertTriangle, RefreshCw } from 'lucide-react';
import { swapMapType } from '../../lib/viewerRegistry';
import { useAppStore } from '../../store/useAppStore';
import { useSourceHealthStore } from '../../store/useSourceHealthStore';

export function MapFallbackNotice() {
  const mapHealth = useSourceHealthStore(s => s.sources.map);
  const replayMode = useAppStore(s => s.replayMode);

  if ((mapHealth.status !== 'stale' && mapHealth.status !== 'error') || !mapHealth.reason) {
    return null;
  }

  return (
    <div
      className="map-fallback-notice"
      data-replay={replayMode === 'playback'}
      role="status"
      aria-live="polite"
    >
      <AlertTriangle aria-hidden="true" />
      <span>{mapHealth.reason}</span>
      <button
        type="button"
        onClick={() => {
          useSourceHealthStore.getState().setSourceHealth('map', {
            status: 'connecting',
            reason: null,
          });
          void swapMapType(useAppStore.getState().mapType);
        }}
      >
        <RefreshCw aria-hidden="true" />
        Retry
      </button>
    </div>
  );
}
