import { useEffect, useRef } from 'react';
import {
  Color,
  ConstantPositionProperty,
  ConstantProperty,
  CustomDataSource,
  HeadingPitchRoll,
  Math as CesiumMath,
  ModelGraphics,
  Transforms,
  type Viewer,
} from 'cesium';
import { useAppStore } from '../store/useAppStore';
import { getEntityPose } from '../lib/entityPositions';
import { shouldShowTrackedModel } from '../lib/trackedModel';

const MODEL_URI = '/models/airliner.gltf';
const ENTITY_ID = 'tracked-airliner';

export function TrackedModelLayer({ viewer }: { viewer: Viewer | null }) {
  const setHideTrackedBillboard = useAppStore(s => s.setHideTrackedBillboard);
  const sourceRef = useRef<CustomDataSource | null>(null);

  useEffect(() => {
    if (!viewer || viewer.isDestroyed()) return undefined;
    const ds = new CustomDataSource('tracked-model');
    viewer.dataSources.add(ds);
    sourceRef.current = ds;
    return () => {
      ds.entities.removeAll();
      if (!viewer.isDestroyed()) viewer.dataSources.remove(ds);
      sourceRef.current = null;
      useAppStore.getState().setHideTrackedBillboard(false);
    };
  }, [viewer]);

  useEffect(() => {
    if (!viewer || viewer.isDestroyed()) return undefined;
    const ds = sourceRef.current;
    if (!ds) return undefined;

    const onTick = () => {
      const current = useAppStore.getState().trackedEntity;
      const alt = viewer.camera.positionCartographic.height;
      const pose = current && shouldShowTrackedModel(alt, current.kind)
        ? getEntityPose(current.kind, current.id)
        : null;
      const show = pose != null;
      setHideTrackedBillboard(show);

      let entity = ds.entities.getById(ENTITY_ID);
      if (!entity) {
        entity = ds.entities.add({
          id: ENTITY_ID,
          show: false,
          model: new ModelGraphics({
            uri: new ConstantProperty(MODEL_URI),
            minimumPixelSize: new ConstantProperty(72),
            maximumScale: new ConstantProperty(20_000),
            color: new ConstantProperty(Color.WHITE),
          }),
        });
      }
      entity.show = show;
      if (!pose) return;
      const heading = CesiumMath.toRadians(pose.headingDeg ?? 0);
      entity.position = new ConstantPositionProperty(pose.position);
      entity.orientation = new ConstantProperty(
        Transforms.headingPitchRollQuaternion(
          pose.position,
          new HeadingPitchRoll(heading, 0, 0),
        ),
      );
    };

    viewer.scene.preRender.addEventListener(onTick);
    return () => {
      if (!viewer.isDestroyed()) viewer.scene.preRender.removeEventListener(onTick);
      setHideTrackedBillboard(false);
    };
  }, [viewer, setHideTrackedBillboard]);

  return null;
}
