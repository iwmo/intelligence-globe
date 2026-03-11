import { describe, it, expect } from 'vitest';
import * as satelliteLib from 'satellite.js';

// ---------------------------------------------------------------------------
// ISS OMM fixture — hardcoded for offline test capability.
// These values are illustrative; only INCLINATION matters for the latitude
// constraint assertion (latitude must stay within ± inclination degrees).
// ---------------------------------------------------------------------------
const ISS_OMM_FIXTURE = {
  OBJECT_NAME: 'ISS (ZARYA)',
  OBJECT_ID: '1998-067A',
  EPOCH: '2026-01-01T00:00:00.000000',
  MEAN_MOTION: 15.49,
  ECCENTRICITY: 0.0002,
  INCLINATION: 51.6,
  RA_OF_ASC_NODE: 0.0,
  ARG_OF_PERICENTER: 0.0,
  MEAN_ANOMALY: 0.0,
  EPHEMERIS_TYPE: 0,
  CLASSIFICATION_TYPE: 'U',
  NORAD_CAT_ID: 25544,
  ELEMENT_SET_NO: 999,
  REV_AT_EPOCH: 0,
  BSTAR: 0.0001,
  MEAN_MOTION_DOT: 0.00001,
  MEAN_MOTION_DDOT: 0.0,
};

// ISS orbital inclination is 51.6°. Allow 1.4° tolerance for propagation
// drift over the one-orbit test window.
const LATITUDE_TOLERANCE_DEG = 53;

// Earth radius in metres; ISS nominal altitude ~400 km (range 200–800 km allowed)
const EARTH_RADIUS_M = 6_371_000;
const MIN_LEO_M = EARTH_RADIUS_M + 200_000; // 6,571,000 m
const MAX_LEO_M = EARTH_RADIUS_M + 800_000; // 7,171,000 m

describe('ISS ground track ECI/ECEF validation', () => {
  it('parses ISS OMM with no error', () => {
    const satrec = satelliteLib.json2satrec(ISS_OMM_FIXTURE as unknown as satelliteLib.OMMJsonObject);
    expect(satrec.error).toBe(0);
  });

  it('ground track latitude stays within orbital inclination bounds', () => {
    const satrec = satelliteLib.json2satrec(ISS_OMM_FIXTURE as unknown as satelliteLib.OMMJsonObject);
    expect(satrec.error).toBe(0);

    const epoch = new Date('2026-01-01T00:00:00.000Z');
    const STEPS = 96; // ~1 full orbit (ISS period ~92 min) with margin

    const violations: number[] = [];

    for (let i = 0; i < STEPS; i++) {
      const t = new Date(epoch.getTime() + i * 60_000);
      const gmst = satelliteLib.gstime(t);
      const pv = satelliteLib.propagate(satrec, t);

      if (typeof pv.position === 'boolean' || pv.position === undefined) continue;

      const geo = satelliteLib.eciToGeodetic(pv.position, gmst);
      const latDeg = satelliteLib.degreesLat(geo.latitude);

      if (Math.abs(latDeg) > LATITUDE_TOLERANCE_DEG) {
        violations.push(latDeg);
      }
    }

    expect(violations).toHaveLength(0);
  });

  it('ECEF position magnitudes are within LEO range', () => {
    const satrec = satelliteLib.json2satrec(ISS_OMM_FIXTURE as unknown as satelliteLib.OMMJsonObject);
    expect(satrec.error).toBe(0);

    const epoch = new Date('2026-01-01T00:00:00.000Z');
    const STEPS = 96;

    const outOfRange: number[] = [];

    for (let i = 0; i < STEPS; i++) {
      const t = new Date(epoch.getTime() + i * 60_000);
      const gmst = satelliteLib.gstime(t);
      const pv = satelliteLib.propagate(satrec, t);

      if (typeof pv.position === 'boolean' || pv.position === undefined) continue;

      const ecf = satelliteLib.eciToEcf(pv.position, gmst);
      // Worker converts km → m by multiplying by 1000
      const xM = ecf.x * 1000;
      const yM = ecf.y * 1000;
      const zM = ecf.z * 1000;
      const magnitude = Math.sqrt(xM * xM + yM * yM + zM * zM);

      if (magnitude < MIN_LEO_M || magnitude > MAX_LEO_M) {
        outOfRange.push(magnitude);
      }
    }

    expect(outOfRange).toHaveLength(0);
  });

  it('returns at least 90 valid ground track points out of 96 steps', () => {
    const satrec = satelliteLib.json2satrec(ISS_OMM_FIXTURE as unknown as satelliteLib.OMMJsonObject);
    expect(satrec.error).toBe(0);

    const epoch = new Date('2026-01-01T00:00:00.000Z');
    const STEPS = 96;

    let validCount = 0;

    for (let i = 0; i < STEPS; i++) {
      const t = new Date(epoch.getTime() + i * 60_000);
      const gmst = satelliteLib.gstime(t);
      const pv = satelliteLib.propagate(satrec, t);

      if (typeof pv.position === 'boolean' || pv.position === undefined) continue;

      const geo = satelliteLib.eciToGeodetic(pv.position, gmst);
      const lonDeg = satelliteLib.degreesLong(geo.longitude);

      // Validate longitude within range while counting
      if (lonDeg >= -180 && lonDeg <= 180) {
        validCount++;
      }
    }

    expect(validCount).toBeGreaterThanOrEqual(90);
  });

  it('longitude values are always in range [-180, 180]', () => {
    const satrec = satelliteLib.json2satrec(ISS_OMM_FIXTURE as unknown as satelliteLib.OMMJsonObject);
    expect(satrec.error).toBe(0);

    const epoch = new Date('2026-01-01T00:00:00.000Z');
    const STEPS = 96;

    const violations: number[] = [];

    for (let i = 0; i < STEPS; i++) {
      const t = new Date(epoch.getTime() + i * 60_000);
      const gmst = satelliteLib.gstime(t);
      const pv = satelliteLib.propagate(satrec, t);

      if (typeof pv.position === 'boolean' || pv.position === undefined) continue;

      const geo = satelliteLib.eciToGeodetic(pv.position, gmst);
      const lonDeg = satelliteLib.degreesLong(geo.longitude);

      if (lonDeg < -180 || lonDeg > 180) {
        violations.push(lonDeg);
      }
    }

    expect(violations).toHaveLength(0);
  });
});
