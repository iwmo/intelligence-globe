import * as satellite from 'satellite.js';

interface SatrecEntry {
  satrec: satellite.SatRec;
  norad: number;
}

export interface OverheadSat {
  norad: number;
  ecf: { x: number; y: number; z: number };  // meters (km * 1000)
}

// Test-compatible signature (propagation.worker.test.ts RED tests call this form):
//   computeOverpassElevation(satrec, timestamp, lat, lon)
// Returns Array<{norad, elevationDeg}> filtered to elevation >= 0.
export function computeOverpassElevation(
  satrecOrList: satellite.SatRec | SatrecEntry[],
  timestamp: number,
  lat: number,
  lon: number,
  elevationThresholdDeg = 0,
): Array<{ norad: number; elevationDeg: number }> {
  const now = new Date(timestamp);
  const gmst = satellite.gstime(now);
  const observerGd = {
    longitude: lon * Math.PI / 180,
    latitude:  lat * Math.PI / 180,
    height: 0,
  };

  // Normalise to array of {satrec, norad}
  let entries: SatrecEntry[];
  if (Array.isArray(satrecOrList)) {
    entries = satrecOrList;
  } else {
    const satrec = satrecOrList as satellite.SatRec;
    const norad = typeof satrec.satnum === 'string'
      ? parseInt(satrec.satnum, 10)
      : Number(satrec.satnum);
    entries = [{ satrec, norad }];
  }

  const result: Array<{ norad: number; elevationDeg: number }> = [];

  for (const { satrec, norad } of entries) {
    const pv = satellite.propagate(satrec, now);
    if (pv === null || typeof pv.position === 'boolean' || pv.position === undefined) continue;
    const ecf = satellite.eciToEcf(pv.position, gmst);
    const look = satellite.ecfToLookAngles(observerGd, ecf);
    const elevationDeg = look.elevation * 180 / Math.PI;
    if (elevationDeg >= elevationThresholdDeg) {
      result.push({ norad, elevationDeg });
    }
  }
  return result;
}

// Array-form used by the worker: returns ECF coordinates (meters) for Cesium rendering.
export function computeOverpassElevationBatch(
  satrecs: SatrecEntry[],
  timestamp: number,
  lat: number,
  lon: number,
  elevationThresholdDeg = 10,
): OverheadSat[] {
  const now = new Date(timestamp);
  const gmst = satellite.gstime(now);
  const observerGd = {
    longitude: lon * Math.PI / 180,
    latitude:  lat * Math.PI / 180,
    height: 0,
  };
  const overhead: OverheadSat[] = [];

  for (const { satrec, norad } of satrecs) {
    const pv = satellite.propagate(satrec, now);
    if (pv === null || typeof pv.position === 'boolean' || pv.position === undefined) continue;
    const ecf = satellite.eciToEcf(pv.position, gmst);
    const look = satellite.ecfToLookAngles(observerGd, ecf);
    const elevationDeg = look.elevation * 180 / Math.PI;
    if (elevationDeg >= elevationThresholdDeg) {
      overhead.push({
        norad,
        ecf: { x: ecf.x * 1000, y: ecf.y * 1000, z: ecf.z * 1000 },
      });
    }
  }
  return overhead;
}
