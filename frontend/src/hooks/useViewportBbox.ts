import { useEffect, useRef } from 'react';
import { Viewer, Math as CesiumMath } from 'cesium';
import { useAppStore } from '../store/useAppStore';

// Debounce delay for pushing bounds to the backend ingest worker (ms)
const BACKEND_PUSH_DEBOUNCE_MS = 2000;

async function pushViewportToBackend(
  minLat: number, maxLat: number, minLon: number, maxLon: number
): Promise<void> {
  try {
    await fetch('/api/viewport-bounds', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ min_lat: minLat, max_lat: maxLat, min_lon: minLon, max_lon: maxLon }),
    });
  } catch {
    // Non-critical — ingest falls back to global query if key is absent
  }
}

export function useViewportBbox(viewer: Viewer | null): void {
  const setViewportBbox = useAppStore(s => s.setViewportBbox);
  const pushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!viewer || viewer.isDestroyed()) return;

    const handler = () => {
      if (!viewer || viewer.isDestroyed()) return;

      const rect = viewer.camera.computeViewRectangle();
      if (!rect) {
        // Camera sees horizon — cannot compute bbox; fall back to global
        setViewportBbox(null);
        return;
      }

      const minLon = Math.round(CesiumMath.toDegrees(rect.west) * 10) / 10;
      const minLat = Math.round(CesiumMath.toDegrees(rect.south) * 10) / 10;
      const maxLon = Math.round(CesiumMath.toDegrees(rect.east) * 10) / 10;
      const maxLat = Math.round(CesiumMath.toDegrees(rect.north) * 10) / 10;

      // IDL guard: west > east means the viewport straddles the antimeridian
      if (minLon > maxLon) {
        // Safe fallback: send no bbox (full global dataset)
        setViewportBbox(null);
        return;
      }

      setViewportBbox({ minLat, maxLat, minLon, maxLon });

      // Debounced push to backend so the ingest worker uses the visible region
      if (pushTimerRef.current !== null) clearTimeout(pushTimerRef.current);
      pushTimerRef.current = setTimeout(() => {
        pushTimerRef.current = null;
        pushViewportToBackend(minLat, maxLat, minLon, maxLon);
      }, BACKEND_PUSH_DEBOUNCE_MS);
    };

    viewer.camera.moveEnd.addEventListener(handler);

    return () => {
      viewer.camera.moveEnd.removeEventListener(handler);
      if (pushTimerRef.current !== null) {
        clearTimeout(pushTimerRef.current);
        pushTimerRef.current = null;
      }
    };
  }, [viewer, setViewportBbox]);
}
