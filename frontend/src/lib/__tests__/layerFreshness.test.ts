import { describe, it, expect } from 'vitest';
import { layerHonesty } from '../layerFreshness';

describe('layerHonesty', () => {
  it('is OFF when the layer is hidden', () => {
    expect(layerHonesty({ visible: false })).toBe('OFF');
  });

  it('is UNAVAILABLE when on but empty', () => {
    expect(layerHonesty({ visible: true, hasData: false })).toBe('UNAVAILABLE');
  });

  it('is LIVE when visible and fresh', () => {
    expect(layerHonesty({ visible: true, lastUpdated: new Date().toISOString() })).toBe('LIVE');
  });

  it('is CONNECTING when visible without confirmed data', () => {
    expect(layerHonesty({ visible: true })).toBe('CONNECTING');
  });

  it('uses explicit source health ahead of inferred freshness', () => {
    expect(layerHonesty({
      visible: true,
      status: 'error',
      lastUpdated: new Date().toISOString(),
    })).toBe('ERROR');
  });
});
