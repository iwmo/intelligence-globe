import { Cartesian3, Cartographic, Math as CesiumMath, IonImageryProvider, Cesium3DTileset } from 'cesium';
import type { Viewer } from 'cesium';
import type { MapType } from '../store/useAppStore';

// Cesium ion asset IDs for 2D imagery layers
const MAP_ION_ASSETS: Record<Exclude<MapType, 'google_3d'>, number> = {
  satellite:   3830182, // Google Maps 2D Satellite
  hybrid:      3830183, // Google Maps 2D Satellite with Labels
  roadmap:     3830184, // Google Maps 2D Roadmap
  contour:     3830186, // Google Maps 2D Contour
  bing_aerial: 2,       // Bing Maps Aerial
  bing_road:   4,       // Bing Maps Road
};

// Tracks the active Google Photorealistic 3D Tiles instance so we can remove it on swap
let _google3dTileset: Cesium3DTileset | null = null;

function clearGoogle3D(viewer: Viewer): void {
  if (_google3dTileset) {
    viewer.scene.primitives.remove(_google3dTileset);
    _google3dTileset = null;
  }
  // Restore the globe surface when leaving 3D mode
  viewer.scene.globe.show = true;
}

export async function swapMapType(mapType: MapType): Promise<void> {
  if (!_viewer || _viewer.isDestroyed()) return;

  if (mapType === 'google_3d') {
    try {
      const tileset = await Cesium3DTileset.fromIonAssetId(2275207);
      if (!_viewer || _viewer.isDestroyed()) return;
      clearGoogle3D(_viewer); // remove any previous 3D tileset first
      _viewer.imageryLayers.removeAll();
      _viewer.scene.primitives.add(tileset);
      _google3dTileset = tileset;
      // Hide the Cesium globe mesh — the 3D tiles provide the full surface
      _viewer.scene.globe.show = false;
    } catch (err) {
      console.error('[MapType] Failed to load Google 3D tiles:', err);
    }
  } else {
    // Leaving 3D mode: tear down tileset and restore globe
    clearGoogle3D(_viewer);
    try {
      const provider = await IonImageryProvider.fromAssetId(MAP_ION_ASSETS[mapType]);
      if (!_viewer || _viewer.isDestroyed()) return;
      _viewer.imageryLayers.removeAll();
      _viewer.imageryLayers.addImageryProvider(provider);
    } catch (err) {
      console.error('[MapType] Failed to load ion imagery:', err);
    }
  }
}

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

/** Zoom in or out by reducing/increasing altitude proportionally.
 *  factor=0.3 gives a deliberate button step (wheel uses 0.12).
 *  Consistent with existing altitude * factor pattern in GlobeView.tsx. */
export function zoomStep(direction: 'in' | 'out', factor = 0.3): void {
  if (!_viewer || _viewer.isDestroyed()) return;
  const alt = _viewer.camera.positionCartographic.height;
  const step = alt * factor;
  if (direction === 'in') _viewer.camera.zoomIn(step);
  else _viewer.camera.zoomOut(step);
}

/** Set camera pitch to a preset angle in degrees.
 *  Cancels any in-progress flight first (prevents setView stutter mid-flight). */
export function setPitchPreset(pitchDeg: number): void {
  if (!_viewer || _viewer.isDestroyed()) return;
  _viewer.camera.cancelFlight();
  _viewer.camera.setView({
    orientation: {
      heading: _viewer.camera.heading,
      pitch: CesiumMath.toRadians(pitchDeg),
      roll: 0,
    },
  });
}

/** Set camera heading in degrees (0 = north, 90 = east).
 *  Preserves current pitch. Cancels any in-progress flight first. */
export function setHeading(headingDeg: number): void {
  if (!_viewer || _viewer.isDestroyed()) return;
  _viewer.camera.cancelFlight();
  _viewer.camera.setView({
    orientation: {
      heading: CesiumMath.toRadians(headingDeg),
      pitch: _viewer.camera.pitch,
      roll: 0,
    },
  });
}

// Re-export Cartographic for consumers that need it without importing cesium directly
export { Cartographic };
