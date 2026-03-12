import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';

vi.mock('cesium', () => ({
  PointPrimitiveCollection: class { add = vi.fn(); isDestroyed = vi.fn(() => false); },
  Cartesian3: { fromDegrees: vi.fn(() => ({})) },
  Color: { fromCssColorString: vi.fn(() => ({})) },
  BlendOption: { OPAQUE: 'OPAQUE' },
  ScreenSpaceEventHandler: class { setInputAction = vi.fn(); destroy = vi.fn(); },
  ScreenSpaceEventType: { LEFT_CLICK: 'LEFT_CLICK' },
}));
vi.mock('../../../store/useAppStore', () => ({
  useAppStore: vi.fn((selector) => selector({
    layers: { militaryAircraft: true },
    selectedMilitaryId: null,
    setSelectedMilitaryId: vi.fn(),
    setSelectedAircraftId: vi.fn(),
    setSelectedSatelliteId: vi.fn(),
    setSelectedShipId: vi.fn(),
  })),
}));
vi.mock('../../../hooks/useMilitaryAircraft', () => ({
  useMilitaryAircraft: vi.fn(() => ({ data: [], isLoading: false })),
}));

import { MilitaryAircraftLayer } from '../MilitaryAircraftLayer';

describe('MilitaryAircraftLayer smoke test', () => {
  it('renders null without crash when viewer is null', () => {
    const { container } = render(<MilitaryAircraftLayer viewer={null} />);
    expect(container.firstChild).toBeNull();
  });
});
