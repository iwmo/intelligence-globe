import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

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

const mockAppState = {
  layers: { gpsJamming: true },
  replayMode: 'live' as 'live' | 'playback',
};

vi.mock('../../store/useAppStore', () => ({
  useAppStore: vi.fn((selector: (s: typeof mockAppState) => unknown) => selector(mockAppState)),
}));
vi.mock('../../hooks/useGpsJamming', () => ({
  useGpsJamming: vi.fn(() => ({ data: { cells: [] }, isLoading: false })),
}));

import { GpsJammingLayer } from '../GpsJammingLayer';

describe('GpsJammingLayer smoke test', () => {
  it('renders null without crash when viewer is null', () => {
    mockAppState.replayMode = 'live';
    const { container } = render(<GpsJammingLayer viewer={null} />);
    expect(container.firstChild).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// LAYR-03: amber "GPS LIVE DATA" badge in playback mode
//
// RED test: when replayMode is 'playback' and the GPS jamming layer is visible,
// GpsJammingLayer must render a DOM badge with text 'GPS LIVE DATA' to warn
// operators that the heatmap is based on live (non-historical) data.
//
// The current GpsJammingLayer always returns null — no badge exists.
// This test FAILS until GpsJammingLayer renders the badge conditionally.
// ---------------------------------------------------------------------------

describe('LAYR-03: GPS LIVE DATA amber badge', () => {
  it('renders GPS LIVE DATA badge when replayMode is playback and layer is visible (RED)', () => {
    mockAppState.replayMode = 'playback';
    mockAppState.layers.gpsJamming = true;

    // GpsJammingLayer currently returns null — no badge element exists.
    // Test FAILS until badge is added: replayMode==='playback' && layerVisible => render badge.
    render(<GpsJammingLayer viewer={null} />);
    expect(screen.getByText('GPS LIVE DATA')).toBeTruthy();

    // reset
    mockAppState.replayMode = 'live';
  });

  it('does NOT render GPS LIVE DATA badge when replayMode is live', () => {
    mockAppState.replayMode = 'live';
    mockAppState.layers.gpsJamming = true;

    render(<GpsJammingLayer viewer={null} />);
    expect(screen.queryByText('GPS LIVE DATA')).toBeNull();
  });
});
