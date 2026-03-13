import { useEffect } from 'react';
import type { Viewer } from 'cesium';
import { JulianDate } from 'cesium';
import { useAppStore } from '../store/useAppStore';

/**
 * useViewerClock — syncs viewer.clock.currentTime with replayTs every render frame.
 *
 * Uses viewer.scene.postUpdate (not useEffect on replayTs) to guarantee zero frame lag:
 * postUpdate fires synchronously inside the CesiumJS render frame before draw commands.
 *
 * Design decision (STATE.md, v5.0): postUpdate pattern, not useEffect on replayTs.
 * Do NOT set viewer.clock.shouldAnimate — clock is controlled by the store, not CesiumJS.
 */
export function useViewerClock(viewer: Viewer | null): void {
  useEffect(() => {
    if (!viewer) return;
    const handler = () => {
      const { replayMode, replayTs } = useAppStore.getState();
      if (replayMode !== 'playback') return;
      viewer.clock.currentTime = JulianDate.fromDate(new Date(replayTs));
    };
    viewer.scene.postUpdate.addEventListener(handler);
    return () => {
      if (!viewer.isDestroyed()) {
        viewer.scene.postUpdate.removeEventListener(handler);
      }
    };
  }, [viewer]);
}
