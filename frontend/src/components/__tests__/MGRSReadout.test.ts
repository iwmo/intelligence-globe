import { describe, it, expect } from 'vitest';
import { getCameraGridRef } from '../CinematicHUD';

describe('getCameraGridRef — MGRS conversion', () => {
  it('returns valid MGRS string for Doha coordinates [51.53, 25.28]', () => {
    const result = getCameraGridRef([51.53, 25.28]);
    // Doha is in grid zone 38R; result should match MGRS pattern
    expect(result).toMatch(/^[0-9]{1,2}[A-Z]{3}[0-9]+$/);
  });

  it('returns UPS for polar lat > 84', () => {
    const result = getCameraGridRef([0, 85]);
    expect(result).toBe('UPS');
  });

  it('returns UPS for polar lat < -80', () => {
    const result = getCameraGridRef([0, -81]);
    expect(result).toBe('UPS');
  });

  it('returns a non-empty string for equatorial zone [0, 0]', () => {
    const result = getCameraGridRef([0, 0]);
    expect(result.length).toBeGreaterThan(0);
  });
});
