import { describe, it, expect } from 'vitest';
import { buildAircraftHud, metersToFeet, msToKnots, resolveHudContact } from '../hudContact';
import type { AircraftRecord } from '../../hooks/useAircraft';

const sample: AircraftRecord = {
  icao24: 'abc123',
  callsign: 'QTR123 ',
  origin_country: 'Qatar',
  latitude: 25.2,
  longitude: 51.5,
  baro_altitude: 10000,
  velocity: 250,
  true_track: 90,
  trail: [],
  is_stale: false,
  roll: null,
};

describe('hudContact', () => {
  it('converts meters and m/s to ft and kts', () => {
    expect(Math.round(metersToFeet(10000))).toBe(32808);
    expect(Math.round(msToKnots(250))).toBe(486);
  });

  it('builds an aircraft HUD with live ADS-B readout', () => {
    const hud = buildAircraftHud(sample);
    expect(hud.title).toBe('QTR123');
    expect(hud.altitude).toBe('32808 ft');
    expect(hud.speed).toBe('486 kts');
    expect(hud.source).toBe('ADS-B');
    expect(hud.freshness).toBe('LIVE');
  });

  it('resolves the selected aircraft when nothing is tracked yet', () => {
    const hud = resolveHudContact(
      null,
      { aircraftId: 'abc123', militaryId: null, shipId: null, satelliteId: null },
      { aircraft: [sample] },
    );
    expect(hud?.title).toBe('QTR123');
  });
});
