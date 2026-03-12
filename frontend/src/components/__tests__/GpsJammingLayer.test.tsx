import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';

vi.mock('cesium', () => ({
  GroundPrimitive: class { isDestroyed = vi.fn(() => false); },
  GeometryInstance: class {},
  PolygonGeometry: { fromPositions: vi.fn(() => ({})) },
  PolygonHierarchy: class {},
  Cartesian3: { fromDegreesArray: vi.fn(() => []) },
  ColorGeometryInstanceAttribute: { fromColor: vi.fn(() => ({})) },
  PerInstanceColorAppearance: class {},
  Color: {
    RED: { withAlpha: vi.fn(() => ({})) },
    YELLOW: { withAlpha: vi.fn(() => ({})) },
    GREEN: { withAlpha: vi.fn(() => ({})) },
  },
}));
vi.mock('../../store/useAppStore', () => ({
  useAppStore: vi.fn((selector) => selector({
    layers: { gpsJamming: true },
  })),
}));
vi.mock('../../hooks/useGpsJamming', () => ({
  useGpsJamming: vi.fn(() => ({ data: { cells: [] }, isLoading: false })),
}));

import { GpsJammingLayer } from '../GpsJammingLayer';

describe('GpsJammingLayer smoke test', () => {
  it('renders null without crash when viewer is null', () => {
    const { container } = render(<GpsJammingLayer viewer={null} />);
    expect(container.firstChild).toBeNull();
  });
});
