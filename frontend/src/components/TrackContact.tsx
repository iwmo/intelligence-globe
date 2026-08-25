import { useEffect } from 'react';
import type { Viewer } from 'cesium';
import { useAppStore } from '../store/useAppStore';
import { chaseTrackedEntity } from '../lib/trackContact';

export function TrackContact({ viewer }: { viewer: Viewer | null }) {
  const trackedEntity = useAppStore(s => s.trackedEntity);

  useEffect(() => {
    if (!viewer || viewer.isDestroyed() || !trackedEntity) return undefined;

    const onTick = () => {
      if (viewer.isDestroyed()) return;
      const current = useAppStore.getState().trackedEntity;
      if (!current) return;
      chaseTrackedEntity(viewer, current);
    };

    viewer.scene.preRender.addEventListener(onTick);
    return () => {
      if (!viewer.isDestroyed()) {
        viewer.scene.preRender.removeEventListener(onTick);
      }
    };
  }, [viewer, trackedEntity]);

  return null;
}
