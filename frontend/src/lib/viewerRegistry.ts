import { Cartesian3, Cartographic, Math as CesiumMath } from 'cesium';
import type { Viewer } from 'cesium';

let _viewer: Viewer | null = null;

export interface LandmarkTarget {
  lon: number;
  lat: number;
  altMeters: number;
  heading?: number;
  pitch?: number;
}

export function registerViewer(v: Viewer): void {
  _viewer = v;
}

export function getViewer(): Viewer | null {
  return _viewer;
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

/**
 * Fly to a landmark using exact altitude (not added to 2M offset).
 * Cancels any in-progress flight first to prevent CesiumJS errors on rapid keypresses.
 * Duration is proportional to angular distance (0.5s – 3.5s).
 */
export function flyToLandmark(landmark: LandmarkTarget): void {
  if (!_viewer || _viewer.isDestroyed()) return;

  // Cancel any in-progress camera flight to avoid CesiumJS conflict errors
  _viewer.camera.cancelFlight();

  // Compute distance-proportional duration
  let duration = 2.0;
  try {
    const carto = _viewer.camera.positionCartographic;
    if (carto) {
      const camLon = CesiumMath.toDegrees(carto.longitude);
      const camLat = CesiumMath.toDegrees(carto.latitude);
      const angularDeg = Math.hypot(landmark.lon - camLon, landmark.lat - camLat);
      duration = Math.max(0.5, Math.min(3.5, angularDeg / 30));
    }
  } catch {
    duration = 2.0;
  }

  const hasOrientation =
    landmark.heading !== undefined || landmark.pitch !== undefined;

  _viewer.camera.flyTo({
    destination: Cartesian3.fromDegrees(
      landmark.lon,
      landmark.lat,
      landmark.altMeters,
    ),
    duration,
    orientation: hasOrientation
      ? {
          heading: CesiumMath.toRadians(landmark.heading ?? 0),
          pitch: CesiumMath.toRadians(landmark.pitch ?? -45),
          roll: 0,
        }
      : undefined,
  });
}

// Re-export Cartographic for consumers that need it without importing cesium directly
export { Cartographic };
