import { useEffect } from 'react';
import type { Viewer } from 'cesium';
import { useAppStore } from '../store/useAppStore';
import { chaseCockpit, chaseTrackedEntity } from '../lib/trackContact';

export function TrackContact({ viewer }: { viewer: Viewer | null }) {
  const trackedEntity = useAppStore(s => s.trackedEntity);
  const cockpitMode = useAppStore(s => s.cockpitMode);

  useEffect(() => {
    if (!viewer || viewer.isDestroyed() || !trackedEntity) return undefined;

    const onTick = () => {
      if (viewer.isDestroyed()) return;
      const current = useAppStore.getState().trackedEntity;
      if (!current) return;
      if (useAppStore.getState().cockpitMode) {
        const ok = chaseCockpit(viewer, current);
        if (!ok) useAppStore.getState().setCockpitMode(false);
        return;
      }
      chaseTrackedEntity(viewer, current);
    };

    viewer.scene.preRender.addEventListener(onTick);
    return () => {
      if (!viewer.isDestroyed()) {
        viewer.scene.preRender.removeEventListener(onTick);
      }
    };
  }, [viewer, trackedEntity, cockpitMode]);

  return null;
}
