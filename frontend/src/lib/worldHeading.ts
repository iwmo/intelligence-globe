import { Cartesian3, Ellipsoid } from 'cesium';

/** Local geodetic up at a position — billboard alignedAxis for world-stable heading. */
export function worldAlignedAxis(position: Cartesian3): Cartesian3 {
  return Ellipsoid.WGS84.geodeticSurfaceNormal(position, new Cartesian3());
}
