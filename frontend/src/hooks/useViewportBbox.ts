import { useEffect } from 'react';
import { Viewer, Math as CesiumMath } from 'cesium';
import { useAppStore } from '../store/useAppStore';

export function useViewportBbox(viewer: Viewer | null): void {
  const setViewportBbox = useAppStore(s => s.setViewportBbox);

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
    };

    viewer.camera.moveEnd.addEventListener(handler);

    return () => {
      viewer.camera.moveEnd.removeEventListener(handler);
    };
  }, [viewer, setViewportBbox]);
}
