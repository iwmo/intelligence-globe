import { describe, expect, it } from 'vitest';
import { nearestFlowBucket } from '../trafficFlow';

describe('nearestFlowBucket', () => {
  it('returns unknown with no samples', () => {
    expect(nearestFlowBucket(0, 0, [])).toBe('unknown');
  });

  it('picks the closest sample', () => {
    const bucket = nearestFlowBucket(-120.61, 34.63, [
      { lat: 40, lon: -74, bucket: 'heavy' },
      { lat: 34.632, lon: -120.611, bucket: 'slow' },
    ]);
    expect(bucket).toBe('slow');
  });
});
