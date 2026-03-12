import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';

vi.mock('cesium', () => ({}));

// Mock the propagation worker — SatelliteLayer creates a Worker instance
vi.mock('../../workers/propagation.worker?worker', () => {
  return {
    default: class MockWorker {
      onmessage: ((e: MessageEvent) => void) | null = null;
      postMessage() {}
      terminate() {}
    },
  };
});

// TLE last updated 8 days ago (stale — beyond 7-day threshold)
const EIGHT_DAYS_AGO = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString();

const mockState = {
  tleLastUpdated: EIGHT_DAYS_AGO,
  replayMode: 'playback' as 'live' | 'playback',
  replayTs: Date.now(),
  layers: { satellites: true, aircraft: true, militaryAircraft: false, ships: false, gpsJamming: false, streetTraffic: false },
  selectedSatelliteId: null,
  setSelectedSatelliteId: vi.fn(),
  satelliteFilter: { constellation: null, altitudeBand: null },
};

vi.mock('../../store/useAppStore', () => ({
  useAppStore: vi.fn((selector: (s: typeof mockState) => unknown) => selector(mockState)),
}));

vi.mock('../../hooks/useSatellites', () => ({
  useSatellites: vi.fn(() => ({ data: [], isLoading: false })),
}));

// Static import after vi.mock
import { SatelliteLayer } from '../SatelliteLayer';

describe('SatelliteLayer — TLE staleness warning (Phase 12 RED)', () => {
  it('renders a TLE staleness warning when tleLastUpdated is 8 days ago in playback mode', () => {
    const { container } = render(<SatelliteLayer />);
    // RED: warning element does not exist in current SatelliteLayer
    // The test asserts a data attribute or role that the GREEN implementation will add
    const warning = container.querySelector('[data-testid="tle-stale-warning"], [role="alert"]');
    expect(warning).toBeTruthy();
  });

  it('warning text mentions TLE staleness or age', () => {
    const { container } = render(<SatelliteLayer />);
    const warning = container.querySelector('[data-testid="tle-stale-warning"], [role="alert"]');
    expect(warning).toBeTruthy();
    // The warning should mention TLE or staleness
    const text = warning?.textContent?.toLowerCase() ?? '';
    const mentionsTleOrAge = text.includes('tle') || text.includes('stale') || text.includes('days') || text.includes('old');
    expect(mentionsTleOrAge).toBe(true);
  });
});
