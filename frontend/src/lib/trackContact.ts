import { Cartesian3, Ellipsoid, Math as CesiumMath } from 'cesium';
import type { Viewer } from 'cesium';
import { getEntityPose, getEntityPosition } from './entityPositions';
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

const COCKPIT_BACK_M = 28;
const COCKPIT_UP_M = 6;
const COCKPIT_PITCH_DEG = -14;

/** Heading-locked chase: sit just aft of the contact and look down the nose onto terrain. */
export function chaseCockpit(viewer: Viewer, tracked: TrackedEntity): boolean {
  const pose = getEntityPose(tracked.kind, tracked.id);
  if (!pose || Cartesian3.equals(pose.position, Cartesian3.ZERO)) return false;

  const carto = Ellipsoid.WGS84.cartesianToCartographic(pose.position);
  const headingDeg = pose.headingDeg ?? CesiumMath.toDegrees(viewer.camera.heading);
  const heading = CesiumMath.toRadians(headingDeg);
  const metersPerDegLat = 111_320;
  const metersPerDegLon = 111_320 * Math.max(0.2, Math.cos(carto.latitude));
  const lat = CesiumMath.toDegrees(carto.latitude) - (COCKPIT_BACK_M / metersPerDegLat) * Math.cos(heading);
  const lon = CesiumMath.toDegrees(carto.longitude) - (COCKPIT_BACK_M / metersPerDegLon) * Math.sin(heading);

  viewer.camera.setView({
    destination: Cartesian3.fromDegrees(lon, lat, carto.height + COCKPIT_UP_M),
    orientation: {
      heading,
      pitch: CesiumMath.toRadians(COCKPIT_PITCH_DEG),
      roll: 0,
    },
  });
  return true;
}

export function canEnterCockpit(kind: string | undefined): boolean {
  return kind === 'aircraft' || kind === 'military';
}
