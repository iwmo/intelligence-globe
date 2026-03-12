import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';

vi.mock('cesium', () => ({}));
vi.mock('../../store/useAppStore', () => ({
  useAppStore: vi.fn((selector) => selector({
    replayMode: 'live',
    setReplayMode: vi.fn(),
    replayTs: Date.now(),
    setReplayTs: vi.fn(),
    replayWindowStart: null,
    replayWindowEnd: null,
    replaySpeedMultiplier: 60,
    setReplaySpeedMultiplier: vi.fn(),
    setReplayWindow: vi.fn(),
  })),
}));
vi.mock('../../hooks/useReplaySnapshots', () => ({
  useReplaySnapshots: vi.fn(() => ({ data: new Map(), isLoading: false })),
}));

// Static import after vi.mock — produces ModuleNotFoundError when PlaybackBar.tsx does not exist
import { PlaybackBar } from '../PlaybackBar';

describe('PlaybackBar smoke tests', () => {
  it('renders PLAYBACK button in live mode', () => {
    const { getByText } = render(<PlaybackBar />);
    expect(getByText('PLAYBACK')).toBeTruthy();
  });
});

describe('PlaybackBar playback mode', () => {
  it('renders LIVE button and speed presets in playback mode', () => {
    const { getByText } = render(<PlaybackBar />);
    expect(getByText('LIVE')).toBeTruthy();
    expect(getByText('1m/s')).toBeTruthy();
    expect(getByText('3m/s')).toBeTruthy();
    expect(getByText('5m/s')).toBeTruthy();
    expect(getByText('15m/s')).toBeTruthy();
    expect(getByText('1h/s')).toBeTruthy();
  });
});
