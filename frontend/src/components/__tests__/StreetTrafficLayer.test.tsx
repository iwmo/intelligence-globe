import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';

vi.mock('cesium', () => ({
  PointPrimitiveCollection: class { add = vi.fn(); isDestroyed = vi.fn(() => false); },
  Cartesian3: { fromDegrees: vi.fn(() => ({})) },
  Math: { toDegrees: vi.fn((r: number) => r * (180 / Math.PI)) },
  Rectangle: {},
}));
vi.mock('../../store/useAppStore', () => ({
  useAppStore: vi.fn((selector) => selector({
    layers: { streetTraffic: true },
  })),
}));
vi.mock('../../hooks/useStreetTraffic', () => ({
  useStreetTraffic: vi.fn(() => ({ roads: null, isLoading: false })),
}));

import { StreetTrafficLayer } from '../StreetTrafficLayer';

describe('StreetTrafficLayer smoke test', () => {
  it('renders null without crash when viewer is null', () => {
    const { container } = render(<StreetTrafficLayer viewer={null} />);
    expect(container.firstChild).toBeNull();
  });
});
