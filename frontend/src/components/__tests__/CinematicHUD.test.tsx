import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';

vi.mock('cesium', () => ({
  Math: { toDegrees: (v: number) => v },
}));
vi.mock('mgrs', () => ({ forward: () => '37U CQ 12345 67890' }));

const mockState = {
  cleanUI: false,
  setCleanUI: vi.fn(),
  selectedSatelliteId: null as number | null,
  replayMode: 'live' as 'live' | 'playback',
  replayTs: new Date('2026-01-01T00:00:00Z').getTime(),
};

vi.mock('../../store/useAppStore', () => ({
  useAppStore: vi.fn((selector?: (s: typeof mockState) => unknown) =>
    selector ? selector(mockState) : mockState
  ),
}));

import { CinematicHUD } from '../CinematicHUD';

describe('CinematicHUD — live mode', () => {
  it('renders REC text in live mode', () => {
    mockState.replayMode = 'live';
    const { getByText } = render(<CinematicHUD viewer={null} />);
    expect(getByText('REC')).toBeTruthy();
  });
});

describe('CinematicHUD — playback mode', () => {
  it('renders REPLAY text in playback mode', () => {
    mockState.replayMode = 'playback';
    const { getByText } = render(<CinematicHUD viewer={null} />);
    expect(getByText('REPLAY')).toBeTruthy();
  });

  it('does NOT render REC in playback mode', () => {
    mockState.replayMode = 'playback';
    const { queryByText } = render(<CinematicHUD viewer={null} />);
    expect(queryByText('REC')).toBeNull();
  });

  it('renders the replayTs as ISO string in playback mode', () => {
    mockState.replayMode = 'playback';
    mockState.replayTs = new Date('2026-01-01T00:00:00Z').getTime();
    const { getByText } = render(<CinematicHUD viewer={null} />);
    expect(getByText('2026-01-01T00:00:00Z')).toBeTruthy();
  });
});
