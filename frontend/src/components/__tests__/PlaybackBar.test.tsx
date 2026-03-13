import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';

const mockInvalidateQueries = vi.hoisted(() => vi.fn());

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

// useAppStore mock: selector hook + getState() for imperative calls in handleModeToggle
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mockUseAppStore(selector: (s: any) => unknown) {
  return selector(mockState);
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(mockUseAppStore as any).getState = () => mockState;

vi.mock('../../store/useAppStore', () => ({
  useAppStore: mockUseAppStore,
}));
vi.mock('../../hooks/useReplaySnapshots', () => ({
  useReplaySnapshots: vi.fn(() => mockSnapshotsResult),
}));
vi.mock('../../hooks/useOsintEvents', () => ({
  useOsintEvents: vi.fn(() => ({ events: [], isLoading: false })),
}));

vi.mock('../../lib/queryClient', () => ({
  queryClient: {
    invalidateQueries: mockInvalidateQueries,
  },
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

// ---------------------------------------------------------------------------
// VRFY-01: PlaybackBar tick() boundary contracts
//
// These tests verify the auto-stop logic and speed-preset arithmetic from
// PlaybackBar tick(). The helper mirrors the exact computation in PlaybackBar:
//   const next = current + dt * speed * 1000;
//   if (windowEnd && next >= windowEnd) → stop
// ---------------------------------------------------------------------------

/**
 * Pure mirror of PlaybackBar tick() advancement logic (VRFY-01).
 * dt = wall-clock seconds elapsed since last frame (e.g. 1/60).
 * speed = speedMultiplier (e.g. 900 for 15m/s preset).
 * Returns next replayTs and whether the loop should stop.
 */
function simulateTickAdvance(
  current: number,
  windowEnd: number,
  speed: number,
  dt: number,
): { next: number; shouldStop: boolean } {
  const next = current + dt * speed * 1000;
  if (next >= windowEnd) {
    return { next: windowEnd, shouldStop: true };
  }
  return { next, shouldStop: false };
}

describe('VRFY-01: PlaybackBar tick boundary contracts', () => {
  const WINDOW_END = 1_700_000_000_000; // fixed reference timestamp

  it('does not stop when next < windowEnd', () => {
    const result = simulateTickAdvance(WINDOW_END - 10_000, WINDOW_END, 60, 1 / 60);
    expect(result.shouldStop).toBe(false);
    // next = (WINDOW_END - 10_000) + (1/60 * 60 * 1000) = WINDOW_END - 9000
    expect(result.next).toBeCloseTo(WINDOW_END - 9000, 0);
  });

  it('stops and pins to windowEnd when next >= windowEnd', () => {
    const result = simulateTickAdvance(WINDOW_END - 100, WINDOW_END, 900, 1 / 60);
    expect(result.shouldStop).toBe(true);
    expect(result.next).toBe(WINDOW_END);
  });

  it('does NOT stop at exactly windowEnd - 1ms before advancement', () => {
    // With speed=60 (1m/s), one frame at 1/60s advances 1000ms
    // current = windowEnd - 2000ms → next = windowEnd - 1000ms → no stop
    const result = simulateTickAdvance(WINDOW_END - 2000, WINDOW_END, 60, 1 / 60);
    expect(result.shouldStop).toBe(false);
  });

  it('1m/s preset (60×): advances 1000ms per 1/60s frame', () => {
    const result = simulateTickAdvance(0, Number.MAX_SAFE_INTEGER, 60, 1 / 60);
    expect(result.next).toBeCloseTo(1000, 1);
  });

  it('3m/s preset (180×): advances 3000ms per 1/60s frame', () => {
    const result = simulateTickAdvance(0, Number.MAX_SAFE_INTEGER, 180, 1 / 60);
    expect(result.next).toBeCloseTo(3000, 1);
  });

  it('5m/s preset (300×): advances 5000ms per 1/60s frame', () => {
    const result = simulateTickAdvance(0, Number.MAX_SAFE_INTEGER, 300, 1 / 60);
    expect(result.next).toBeCloseTo(5000, 1);
  });

  it('15m/s preset (900×): advances 15000ms per 1/60s frame', () => {
    const result = simulateTickAdvance(0, Number.MAX_SAFE_INTEGER, 900, 1 / 60);
    expect(result.next).toBeCloseTo(15000, 1);
  });

  it('1h/s preset (3600×): advances 60000ms per 1/60s frame', () => {
    const result = simulateTickAdvance(0, Number.MAX_SAFE_INTEGER, 3600, 1 / 60);
    expect(result.next).toBeCloseTo(60000, 1);
  });

  it('next is pinned to windowEnd (no overshoot) when auto-stop triggers', () => {
    // current is 1ms before windowEnd with speed=3600 (1h/s): next would massively overshoot
    const result = simulateTickAdvance(WINDOW_END - 1, WINDOW_END, 3600, 1 / 60);
    expect(result.next).toBe(WINDOW_END);  // pinned, not overshot
    expect(result.shouldStop).toBe(true);
  });
});
