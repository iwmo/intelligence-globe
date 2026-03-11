import { Cartesian3 } from 'cesium';
import type { Viewer } from 'cesium';

let _viewer: Viewer | null = null;

export function registerViewer(v: Viewer): void {
  _viewer = v;
}

/** Fly to a geographic position (lon/lat degrees, altitude meters above ellipsoid). */
export function flyToPosition(lon: number, lat: number, altMeters: number): void {
  if (!_viewer || _viewer.isDestroyed()) return;
  _viewer.camera.flyTo({
    destination: Cartesian3.fromDegrees(lon, lat, altMeters + 2_000_000),
    duration: 2.0,
  });
}

/** Fly to an ECEF Cartesian3 position (e.g. from satellite propagation). */
export function flyToCartesian(position: Cartesian3): void {
  if (!_viewer || _viewer.isDestroyed()) return;
  _viewer.camera.flyTo({
    destination: position,
    duration: 2.0,
  });
}
