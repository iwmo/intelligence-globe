import { describe, it, expect, vi } from 'vitest';

vi.mock('cesium', () => ({
  Cartesian3: { equals: () => false, ZERO: {}, fromDegrees: () => ({}) },
  Ellipsoid: { WGS84: { cartesianToCartographic: () => ({}) } },
  Math: { toDegrees: (n: number) => n, toRadians: (n: number) => n },
}));

import { canEnterCockpit } from '../trackContact';

describe('canEnterCockpit', () => {
  it('allows only air contacts', () => {
    expect(canEnterCockpit('aircraft')).toBe(true);
    expect(canEnterCockpit('military')).toBe(true);
    expect(canEnterCockpit('ship')).toBe(false);
    expect(canEnterCockpit('satellite')).toBe(false);
  });
});
