import { describe, it, expect } from 'vitest';
import { estimateAscentPath } from '../ascentEstimate';

describe('estimateAscentPath', () => {
  it('starts on the pad and climbs', () => {
    const path = estimateAscentPath(-80.6, 28.6, 90, 60, 10);
    expect(path[0]).toMatchObject({ lon: -80.6, lat: 28.6, altM: 0, tSec: 0 });
    expect(path.at(-1)?.altM).toBeGreaterThan(1000);
    expect(path.at(-1)?.lon).toBeGreaterThan(-80.6);
  });
});
