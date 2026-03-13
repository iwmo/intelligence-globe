import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';

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
  isPlaying: false as boolean,
  setIsPlaying: vi.fn(),
};

// Mutable so individual tests can set isLoading
const mockSnapshotsResult = { data: new Map(), isLoading: false };

vi.mock('../../store/useAppStore', () => ({
  useAppStore: vi.fn((selector: (s: typeof mockState) => unknown) => selector(mockState)),
}));
vi.mock('../../hooks/useReplaySnapshots', () => ({
  useReplaySnapshots: vi.fn(() => mockSnapshotsResult),
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

describe('PlaybackBar — snapshot loading gate', () => {
  it('shows "Loading snapshots..." and disables play button when snapshotsLoading=true', () => {
    mockState.replayMode = 'playback';
    mockState.replayWindowStart = Date.now() - 3600_000;
    mockState.replayWindowEnd = Date.now();
    mockSnapshotsResult.isLoading = true;

    const { getByText } = render(<PlaybackBar />);
    const btn = getByText('Loading snapshots...');
    expect(btn).toBeTruthy();
    expect((btn as HTMLButtonElement).disabled).toBe(true);

    // reset
    mockSnapshotsResult.isLoading = false;
    mockState.replayWindowStart = null;
    mockState.replayWindowEnd = null;
  });

  it('shows PLAY and is enabled when snapshotsLoading=false and hasWindow=true', () => {
    mockState.replayMode = 'playback';
    mockState.isPlaying = false;
    mockState.replayWindowStart = Date.now() - 3600_000;
    mockState.replayWindowEnd = Date.now();
    mockSnapshotsResult.isLoading = false;

    const { getByText } = render(<PlaybackBar />);
    const btn = getByText('PLAY');
    expect(btn).toBeTruthy();
    expect((btn as HTMLButtonElement).disabled).toBe(false);

    // reset
    mockState.replayWindowStart = null;
    mockState.replayWindowEnd = null;
  });
});

// ---------------------------------------------------------------------------
// PLAY-04: queryClient.invalidateQueries called on return to LIVE
//
// RED test: when handleModeToggle switches from playback → live, PlaybackBar
// must call queryClient.invalidateQueries() exactly once to refresh all
// React Query caches. The current implementation does NOT call invalidateQueries.
//
// This test FAILS until PlaybackBar imports queryClient from '../lib/queryClient'
// and calls queryClient.invalidateQueries() inside the else branch of handleModeToggle.
// ---------------------------------------------------------------------------

const mockInvalidateQueries = vi.fn();

vi.mock('../../lib/queryClient', () => ({
  queryClient: {
    invalidateQueries: mockInvalidateQueries,
  },
}));

describe('PLAY-04: invalidateQueries on return to LIVE', () => {
  it('calls queryClient.invalidateQueries exactly once when switching from playback to live (RED)', () => {
    mockState.replayMode = 'playback';
    mockInvalidateQueries.mockClear();

    const { getByText } = render(<PlaybackBar />);
    // Click the LIVE toggle button to switch back to live mode
    const liveBtn = getByText('LIVE');
    fireEvent.click(liveBtn);

    // Contract: invalidateQueries must be called exactly once on mode switch to live.
    // FAILS until PlaybackBar.handleModeToggle() adds: queryClient.invalidateQueries()
    expect(mockInvalidateQueries).toHaveBeenCalledTimes(1);

    // reset
    mockState.replayMode = 'live';
  });
});
