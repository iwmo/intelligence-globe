import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';

vi.mock('cesium', () => ({}));

const mockState = {
  replayMode: 'live' as 'live' | 'playback',
  setReplayMode: vi.fn(),
  replayTs: Date.now(),
  setReplayTs: vi.fn(),
  replayWindowStart: null as number | null,
  replayWindowEnd: null as number | null,
  replaySpeedMultiplier: 60,
  setReplaySpeedMultiplier: vi.fn(),
  setReplayWindow: vi.fn(),
  activeCategories: [] as string[],
  toggleCategory: vi.fn(),
  setAreaOfInterest: vi.fn(),
  tleLastUpdated: null as string | null,
};

vi.mock('../../store/useAppStore', () => ({
  useAppStore: vi.fn((selector: (s: typeof mockState) => unknown) => selector(mockState)),
}));
vi.mock('../../hooks/useReplaySnapshots', () => ({
  useReplaySnapshots: vi.fn(() => ({ data: new Map(), isLoading: false })),
}));
vi.mock('../../hooks/useOsintEvents', () => ({
  useOsintEvents: vi.fn(() => ({ events: [], isLoading: false })),
}));

// Static import after vi.mock — produces ModuleNotFoundError when PlaybackBar.tsx does not exist
import { PlaybackBar } from '../PlaybackBar';

describe('PlaybackBar smoke tests', () => {
  it('renders PLAYBACK button in live mode', () => {
    mockState.replayMode = 'live';
    const { getByText } = render(<PlaybackBar />);
    expect(getByText('PLAYBACK')).toBeTruthy();
  });
});

describe('PlaybackBar playback mode', () => {
  it('renders LIVE button and speed presets in playback mode', () => {
    mockState.replayMode = 'playback';
    const { getByText } = render(<PlaybackBar />);
    expect(getByText('LIVE')).toBeTruthy();
    expect(getByText('1m/s')).toBeTruthy();
    expect(getByText('3m/s')).toBeTruthy();
    expect(getByText('5m/s')).toBeTruthy();
    expect(getByText('15m/s')).toBeTruthy();
    expect(getByText('1h/s')).toBeTruthy();
  });
});
