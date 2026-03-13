import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';

vi.mock('cesium', () => ({
  PointPrimitiveCollection: class { add = vi.fn(); isDestroyed = vi.fn(() => false); },
  Cartesian3: { fromDegrees: vi.fn(() => ({})) },
  Math: { toDegrees: vi.fn((r: number) => r * (180 / Math.PI)) },
  Rectangle: {},
}));

const mockAppState = {
  layers: { streetTraffic: true },
  replayMode: 'live' as 'live' | 'playback',
};

vi.mock('../../store/useAppStore', () => ({
  useAppStore: vi.fn((selector: (s: typeof mockAppState) => unknown) => selector(mockAppState)),
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

// ---------------------------------------------------------------------------
// LAYR-04: hide particles when replayMode transitions to playback
//
// RED test: when replayMode switches to 'playback', all particles in
// particlesRef must have show = false. When it returns to 'live' with
// layerVisible=true, show must be restored to true.
//
// Test strategy: contract helper mirrors the StreetTrafficLayer Effect 4
// visibility logic (layerVisible toggle) PLUS the new replayMode guard.
// The FAILING assertion asserts behavior that Effect 4 doesn't support yet:
// Effect 4 only checks layerVisible, not replayMode.
// ---------------------------------------------------------------------------

function simulateStreetTrafficVisibilityEffect(
  replayMode: 'live' | 'playback',
  layerVisible: boolean,
  particles: { primitive: { show: boolean } }[],
) {
  // Current Effect 4: only sets show = layerVisible — no replayMode check
  // Contract: show must be false when replayMode='playback', regardless of layerVisible
  for (const p of particles) {
    p.primitive.show = layerVisible; // existing logic — no replayMode guard
  }
  void replayMode; // production code ignores replayMode — this is the bug
}

describe('LAYR-04: hide particles in playback', () => {
  it('current Effect 4 (unguarded) sets show=true when layerVisible=true — sanity check', () => {
    const particles = [
      { primitive: { show: false } },
      { primitive: { show: false } },
    ];

    simulateStreetTrafficVisibilityEffect('live', true, particles);
    expect(particles[0].primitive.show).toBe(true);
    expect(particles[1].primitive.show).toBe(true);
  });

  it('particles must have show=false when replayMode transitions to playback (RED)', () => {
    // RED: current StreetTrafficLayer Effect 4 does not check replayMode.
    // When replayMode='playback' and layerVisible=true, Effect 4 sets show=true
    // — but the contract requires show=false (no particle animation in playback).
    // FAILS until a replayMode guard is added: if (replayMode==='playback') show=false.
    const particles = [
      { primitive: { show: true } },
      { primitive: { show: true } },
    ];

    simulateStreetTrafficVisibilityEffect('playback', true, particles);

    // Contract: show must be false in playback regardless of layerVisible
    expect(particles[0].primitive.show).toBe(false);
    expect(particles[1].primitive.show).toBe(false);
  });

  it('particles restore show=true when returning to live with layerVisible=true', () => {
    const particles = [
      { primitive: { show: false } },
      { primitive: { show: false } },
    ];

    simulateStreetTrafficVisibilityEffect('live', true, particles);
    expect(particles[0].primitive.show).toBe(true);
    expect(particles[1].primitive.show).toBe(true);
  });
});
