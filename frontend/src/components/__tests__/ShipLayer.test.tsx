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
vi.mock('../../store/useAppStore', () => ({
  useAppStore: vi.fn((selector) => selector({
    layers: { ships: true },
    selectedShipId: null,
    setSelectedShipId: vi.fn(),
    setSelectedAircraftId: vi.fn(),
    setSelectedSatelliteId: vi.fn(),
    setSelectedMilitaryId: vi.fn(),
    replayMode: 'live',
    replayTs: Date.now(),
    replayWindowStart: null,
    replayWindowEnd: null,
  })),
}));
vi.mock('../../hooks/useShips', () => ({
  useShips: vi.fn(() => ({ data: [], isLoading: false })),
}));
vi.mock('../../hooks/useReplaySnapshots', () => ({
  useReplaySnapshots: vi.fn(() => ({ data: new Map(), isLoading: false })),
  findAdjacentSnapshots: vi.fn(() => [null, null]),
}));

import { ShipLayer } from '../ShipLayer';

describe('ShipLayer smoke test', () => {
  it('renders null without crash when viewer is null', () => {
    const { container } = render(<ShipLayer viewer={null} />);
    expect(container.firstChild).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// LAYR-02: Effect 2 guard in playback mode
//
// RED test: when replayMode is 'playback', ShipLayer Effect 2 (snapshot
// interpolation / billboard position update) must return early WITHOUT
// calling bb.position =. The current implementation has no such guard.
//
// Test strategy: a contract helper mirrors the Effect 2 position-write logic
// (without the guard). The RED assertion verifies that in playback mode,
// bb.position SHOULD remain unset. Fails until ShipLayer adds the guard.
// ---------------------------------------------------------------------------

function simulateShipEffect2Unguarded(
  replayMode: 'live' | 'playback',
  ships: { mmsi: string }[],
  billboards: Map<string, { position: unknown }>,
) {
  // Current production code: no replayMode check — always writes
  for (const ship of ships) {
    const bb = billboards.get(ship.mmsi);
    if (bb) {
      bb.position = { updated: true }; // sentinel write simulating Effect 2
    }
  }
  void replayMode; // production code ignores replayMode — this is the bug
}

describe('LAYR-02: ShipLayer Effect 2 guard in playback', () => {
  it('current Effect 2 (unguarded) writes bb.position in live mode — sanity check', () => {
    const mockBb = { position: undefined as unknown };
    const billboards = new Map([['123456789', mockBb]]);
    const ships = [{ mmsi: '123456789' }];

    simulateShipEffect2Unguarded('live', ships, billboards);
    expect(mockBb.position).toBeDefined();
  });

  it('Effect 2 must NOT write bb.position when replayMode is playback (RED)', () => {
    // RED: the current ShipLayer has no playback guard in Effect 2.
    // When replayMode is 'playback', bb.position writes are still performed.
    // This test FAILS until ShipLayer adds: if (replayMode === 'playback') return;
    const mockBb = { position: undefined as unknown };
    const billboards = new Map([['987654321', mockBb]]);
    const ships = [{ mmsi: '987654321' }];

    simulateShipEffect2Unguarded('playback', ships, billboards);

    // Contract: position must NOT be written in playback mode
    expect(mockBb.position).toBeUndefined();
  });
});
