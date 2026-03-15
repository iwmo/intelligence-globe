import { describe, it, expect } from 'vitest';
import { Math as CesiumMath } from 'cesium';
import { computeIconRotation } from '../AircraftLayer';

describe('computeIconRotation — UI-04 roll banking', () => {
  it('returns 0 when both heading and roll are null', () => {
    expect(computeIconRotation(null, null)).toBeCloseTo(0);
  });
  it('applies heading only when roll is null', () => {
    expect(computeIconRotation(90, null)).toBeCloseTo(CesiumMath.toRadians(-90));
  });
  it('combines heading and roll', () => {
    expect(computeIconRotation(90, 15)).toBeCloseTo(CesiumMath.toRadians(-90 + 15));
  });
  it('handles negative roll (left bank)', () => {
    expect(computeIconRotation(180, -20)).toBeCloseTo(CesiumMath.toRadians(-180 + (-20)));
  });
  it('returns 0 when heading and roll are both 0', () => {
    expect(computeIconRotation(0, 0)).toBeCloseTo(0);
  });
  it('applies roll only when heading is null', () => {
    expect(computeIconRotation(null, 30)).toBeCloseTo(CesiumMath.toRadians(30));
  });
});
