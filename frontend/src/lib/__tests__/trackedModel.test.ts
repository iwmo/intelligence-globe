import { describe, it, expect } from 'vitest';
import { shouldShowTrackedModel, TRACKED_MODEL_MAX_ALT_M } from '../trackedModel';

describe('shouldShowTrackedModel', () => {
  it('shows only air contacts below 150 km', () => {
    expect(shouldShowTrackedModel(80_000, 'aircraft')).toBe(true);
    expect(shouldShowTrackedModel(TRACKED_MODEL_MAX_ALT_M, 'military')).toBe(true);
    expect(shouldShowTrackedModel(200_000, 'aircraft')).toBe(false);
    expect(shouldShowTrackedModel(10_000, 'ship')).toBe(false);
    expect(shouldShowTrackedModel(10_000, undefined)).toBe(false);
  });
});
