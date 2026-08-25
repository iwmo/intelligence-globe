import { Cartesian3, Ellipsoid, Math as CesiumMath } from 'cesium';
import type { Viewer } from 'cesium';
import { getEntityPosition } from './entityPositions';
import type { TrackedEntity } from '../store/useAppStore';

/**
 * Keep the camera centered on a tracked contact while preserving
 * the user's current altitude, heading, and pitch.
 */
export function chaseTrackedEntity(viewer: Viewer, tracked: TrackedEntity): void {
  const pos = getEntityPosition(tracked.kind, tracked.id);
  if (!pos || Cartesian3.equals(pos, Cartesian3.ZERO)) return;

  const carto = Ellipsoid.WGS84.cartesianToCartographic(pos);
  viewer.camera.setView({
    destination: Cartesian3.fromDegrees(
      CesiumMath.toDegrees(carto.longitude),
      CesiumMath.toDegrees(carto.latitude),
      viewer.camera.positionCartographic.height,
    ),
    orientation: {
      heading: viewer.camera.heading,
      pitch: viewer.camera.pitch,
      roll: 0,
    },
  });
}
