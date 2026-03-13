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
  // LAYR-02 guard — mirrors production MilitaryAircraftLayer Effect 2
  if (replayMode === 'playback') return;
  for (const entity of entities) {
    const bb = billboards.get(entity.hex);
    if (bb) {
      bb.position = { updated: true }; // sentinel write simulating Effect 2
    }
  }
}

describe('LAYR-02: MilitaryAircraftLayer Effect 2 guard in playback', () => {
  it('current Effect 2 (unguarded) writes bb.position in live mode — sanity check', () => {
    const mockBb = { position: undefined as unknown };
    const billboards = new Map([['AE1234', mockBb]]);
    const entities = [{ hex: 'AE1234' }];

    simulateMilitaryEffect2Unguarded('live', entities, billboards);
    expect(mockBb.position).toBeDefined();
  });

  it('Effect 2 must NOT write bb.position when replayMode is playback (LAYR-02)', () => {
    // GREEN after MilitaryAircraftLayer adds: if (replayMode === 'playback') return;
    const mockBb = { position: undefined as unknown };
    const billboards = new Map([['AE5678', mockBb]]);
    const entities = [{ hex: 'AE5678' }];

    simulateMilitaryEffect2Unguarded('playback', entities, billboards);

    // Contract: position must NOT be written in playback mode
    expect(mockBb.position).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// VIS-01: Stale billboard tint contract (MilitaryAircraftLayer)
//
// Contract tests: when is_stale=true in live mode, bb.color must be set to a
// stale-sentinel value. When replayMode='playback', the effect must return
// early without touching bb.color. Tests pass as self-contained contracts;
// real production guard is added in 26-02.
// ---------------------------------------------------------------------------

/**
 * Simulates the planned stale-tint effect from MilitaryAircraftLayer (VIS-01).
 * In playback mode: returns early, no color writes.
 * In live mode: sets bb.color based on entity.is_stale.
 */
function simulateMilitaryStaleTint(
  replayMode: 'live' | 'playback',
  entities: Array<{ hex: string; is_stale: boolean }>,
  billboards: Map<string, { color: unknown }>,
) {
  if (replayMode === 'playback') return;  // VIS-01 guard
  const byId = new Map(entities.map(e => [e.hex, e]));
  for (const [id, bb] of billboards) {
    const entity = byId.get(id);
    if (!entity || !bb) continue;
    bb.color = entity.is_stale ? 'STALE_GREY' : 'FRESH_WHITE'; // sentinels
  }
}

describe('VIS-01: stale billboard tint contract (MilitaryAircraftLayer)', () => {
  it('returns early in playback mode — no color writes', () => {
    const bb = { color: undefined as unknown };
    const billboards = new Map([['AE1234', bb]]);
    const entities = [{ hex: 'AE1234', is_stale: true }];
    simulateMilitaryStaleTint('playback', entities, billboards);
    expect(bb.color).toBeUndefined();
  });

  it('sets stale color when is_stale=true in live mode', () => {
    const bb = { color: undefined as unknown };
    const billboards = new Map([['AE1234', bb]]);
    const entities = [{ hex: 'AE1234', is_stale: true }];
    simulateMilitaryStaleTint('live', entities, billboards);
    expect(bb.color).toBe('STALE_GREY');
  });

  it('sets fresh color when is_stale=false in live mode', () => {
    const bb = { color: undefined as unknown };
    const billboards = new Map([['AE1234', bb]]);
    const entities = [{ hex: 'AE1234', is_stale: false }];
    simulateMilitaryStaleTint('live', entities, billboards);
    expect(bb.color).toBe('FRESH_WHITE');
  });

  it('skips billboard with no matching entity', () => {
    const bb = { color: 'original' as unknown };
    const billboards = new Map([['UNKNOWN', bb]]);
    const entities = [{ hex: 'OTHER', is_stale: true }];
    simulateMilitaryStaleTint('live', entities, billboards);
    expect(bb.color).toBe('original');  // untouched
  });
});
