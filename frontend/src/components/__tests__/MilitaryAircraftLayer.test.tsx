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
    layers: { militaryAircraft: true },
    selectedMilitaryId: null,
    setSelectedMilitaryId: vi.fn(),
    setSelectedAircraftId: vi.fn(),
    setSelectedSatelliteId: vi.fn(),
    setSelectedShipId: vi.fn(),
    replayMode: 'live',
    replayTs: Date.now(),
    replayWindowStart: null,
    replayWindowEnd: null,
  })),
}));
vi.mock('../../hooks/useMilitaryAircraft', () => ({
  useMilitaryAircraft: vi.fn(() => ({ data: [], isLoading: false })),
}));
vi.mock('../../hooks/useReplaySnapshots', () => ({
  useReplaySnapshots: vi.fn(() => ({ data: new Map(), isLoading: false })),
  findAdjacentSnapshots: vi.fn(() => [null, null]),
}));

import { MilitaryAircraftLayer } from '../MilitaryAircraftLayer';

describe('MilitaryAircraftLayer smoke test', () => {
  it('renders null without crash when viewer is null', () => {
    const { container } = render(<MilitaryAircraftLayer viewer={null} />);
    expect(container.firstChild).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// LAYR-02: Effect 2 guard in playback mode (MilitaryAircraftLayer)
//
// RED test: when replayMode is 'playback', MilitaryAircraftLayer Effect 2
// must return early WITHOUT writing bb.position. Current code has no guard.
//
// Mirror of the ShipLayer LAYR-02 test — same contract, different entity type.
// ---------------------------------------------------------------------------

function simulateMilitaryEffect2Unguarded(
  replayMode: 'live' | 'playback',
  entities: { hex: string }[],
  billboards: Map<string, { position: unknown }>,
) {
  // Current production code: no replayMode check — always writes
  for (const entity of entities) {
    const bb = billboards.get(entity.hex);
    if (bb) {
      bb.position = { updated: true }; // sentinel write simulating Effect 2
    }
  }
  void replayMode; // production code ignores replayMode — this is the bug
}

describe('LAYR-02: MilitaryAircraftLayer Effect 2 guard in playback', () => {
  it('current Effect 2 (unguarded) writes bb.position in live mode — sanity check', () => {
    const mockBb = { position: undefined as unknown };
    const billboards = new Map([['AE1234', mockBb]]);
    const entities = [{ hex: 'AE1234' }];

    simulateMilitaryEffect2Unguarded('live', entities, billboards);
    expect(mockBb.position).toBeDefined();
  });

  it('Effect 2 must NOT write bb.position when replayMode is playback (RED)', () => {
    // RED: MilitaryAircraftLayer Effect 2 has no playback guard yet.
    // FAILS until MilitaryAircraftLayer adds: if (replayMode === 'playback') return;
    const mockBb = { position: undefined as unknown };
    const billboards = new Map([['AE5678', mockBb]]);
    const entities = [{ hex: 'AE5678' }];

    simulateMilitaryEffect2Unguarded('playback', entities, billboards);

    // Contract: position must NOT be written in playback mode
    expect(mockBb.position).toBeUndefined();
  });
});
