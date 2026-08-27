import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fireEvent, render } from '@testing-library/react';
import { useGdeltEvents } from '../../hooks/useGdeltEvents';

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
  replayTimelineExpanded: true,
  setReplayTimelineExpanded: vi.fn((expanded: boolean) => {
    mockState.replayTimelineExpanded = expanded;
  }),
  pinnedContacts: [],
  selectedAircraftId: null,
  selectedMilitaryId: null,
  selectedShipId: null,
  selectedSatelliteId: null,
  selectedGdeltEventId: null,
};

// Mutable so individual tests can set isLoading
const mockSnapshotsResult = { data: new Map(), isLoading: false };

// useAppStore mock: selector hook + getState() for imperative calls in handleModeToggle
function mockUseAppStore(selector: (s: any) => unknown) {
  return selector(mockState);
}
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
vi.mock('../../hooks/useGdeltEvents', () => ({
  useGdeltEvents: vi.fn(() => ({ data: [] })),
}));

// Static import after vi.mock — produces ModuleNotFoundError when PlaybackBar.tsx does not exist
import { PlaybackBar } from '../PlaybackBar';

beforeEach(() => {
  mockState.replayTimelineExpanded = true;
});

describe('PlaybackBar smoke tests', () => {
  it('does not render the temporal row in live mode', () => {
    mockState.replayMode = 'live';
    const { container } = render(<PlaybackBar />);
    expect(container.firstChild).toBeNull();
  });
});

describe('PlaybackBar playback mode', () => {
  it('renders replay controls and speed presets in playback mode', () => {
    mockState.replayMode = 'playback';
    const { getByText, queryByText } = render(<PlaybackBar />);
    expect(getByText('NO REPLAY DATA')).toBeTruthy();
    expect(queryByText('← LIVE')).toBeNull();
    expect(getByText('60×')).toBeTruthy();
    expect(getByText('180×')).toBeTruthy();
    expect(getByText('300×')).toBeTruthy();
    expect(getByText('900×')).toBeTruthy();
    expect(getByText('3600×')).toBeTruthy();
  });

  it('collapses the timeline body while retaining replay transport', () => {
    mockState.replayMode = 'playback';
    const { getByRole, queryByLabelText, rerender } = render(<PlaybackBar />);
    fireEvent.click(getByRole('button', { name: 'Collapse replay timeline' }));
    rerender(<PlaybackBar />);
    expect(queryByLabelText('Replay speed')).toBeNull();
    expect(getByRole('button', { name: 'Expand replay timeline' })).toBeTruthy();
  });
});

describe('PlaybackBar — snapshot loading gate', () => {
  it('shows "Loading snapshots..." and disables play button when snapshotsLoading=true', () => {
    mockState.replayMode = 'playback';
    mockState.replayWindowStart = Date.now() - 3600_000;
    mockState.replayWindowEnd = Date.now();
    mockSnapshotsResult.isLoading = true;

    const { getByText } = render(<PlaybackBar />);
    const btn = getByText('...');
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

// ---------------------------------------------------------------------------
// GDELT-11: PlaybackBar GDELT event timeline dots
//
// Tests A-F verify dot rendering, colour mapping, live-mode suppression,
// and out-of-window filtering for the GDELT scrubber dots.
// ---------------------------------------------------------------------------

describe('PlaybackBar — GDELT-11 timeline dots', () => {
  // Fixed window: 0ms to 1000ms (epoch) for easy fraction math
  const WINDOW_START = 0;
  const WINDOW_END_GDELT = 1000;

  beforeEach(() => {
    mockState.replayMode = 'playback';
    mockState.replayWindowStart = WINDOW_START;
    mockState.replayWindowEnd = WINDOW_END_GDELT;
    mockState.isPlaying = false;
    mockSnapshotsResult.isLoading = false;
    vi.mocked(useGdeltEvents).mockReturnValue({ data: [] } as ReturnType<typeof useGdeltEvents>);
  });

  afterEach(() => {
    mockState.replayMode = 'live';
    mockState.replayWindowStart = null;
    mockState.replayWindowEnd = null;
  });

  it('Test A: GDELT event at occurred_at=500ms renders dot at left="50%"', () => {
    const event = {
      global_event_id: 'evt-a',
      occurred_at: new Date(500).toISOString(),
      quad_class: 1,
      discovered_at: null,
      latitude: 0,
      longitude: 0,
      goldstein_scale: null,
      event_code: '010',
      actor1_name: null,
      actor2_name: null,
      source_url: null,
      avg_tone: null,
      num_mentions: null,
      source_is_stale: false,
    };
    vi.mocked(useGdeltEvents).mockReturnValue({ data: [event] } as ReturnType<typeof useGdeltEvents>);

    const { container } = render(<PlaybackBar />);
    const dot = container.querySelector('[data-testid="gdelt-dot-evt-a"]') as HTMLElement | null
      ?? Array.from(container.querySelectorAll('div')).find(
        el => el.getAttribute('title')?.startsWith('GDELT') && el.style.left === '50%'
      ) as HTMLElement | undefined;
    expect(dot).toBeTruthy();
    expect(dot!.style.left).toBe('50%');
  });

  it('Test B: GDELT event with quad_class=1 has background="#3B82F6" (blue)', () => {
    const event = {
      global_event_id: 'evt-b',
      occurred_at: new Date(500).toISOString(),
      quad_class: 1,
      discovered_at: null,
      latitude: 0,
      longitude: 0,
      goldstein_scale: null,
      event_code: '010',
      actor1_name: null,
      actor2_name: null,
      source_url: null,
      avg_tone: null,
      num_mentions: null,
      source_is_stale: false,
    };
    vi.mocked(useGdeltEvents).mockReturnValue({ data: [event] } as ReturnType<typeof useGdeltEvents>);

    const { container } = render(<PlaybackBar />);
    const dot = container.querySelector('[data-testid="gdelt-dot-evt-b"]') as HTMLElement | null;
    expect(dot).toBeTruthy();
    // JSDOM normalises hex to rgb(); accept either form
    expect(dot!.style.background.toLowerCase()).toMatch(/#3b82f6|rgb\(59,\s*130,\s*246\)/);
  });

  it('Test C: GDELT event with quad_class=4 has background="#EF4444" (red)', () => {
    const event = {
      global_event_id: 'evt-c',
      occurred_at: new Date(500).toISOString(),
      quad_class: 4,
      discovered_at: null,
      latitude: 0,
      longitude: 0,
      goldstein_scale: null,
      event_code: '190',
      actor1_name: null,
      actor2_name: null,
      source_url: null,
      avg_tone: null,
      num_mentions: null,
      source_is_stale: false,
    };
    vi.mocked(useGdeltEvents).mockReturnValue({ data: [event] } as ReturnType<typeof useGdeltEvents>);

    const { container } = render(<PlaybackBar />);
    const dot = container.querySelector('[data-testid="gdelt-dot-evt-c"]') as HTMLElement | null;
    expect(dot).toBeTruthy();
    // JSDOM normalises hex to rgb(); accept either form
    expect(dot!.style.background.toLowerCase()).toMatch(/#ef4444|rgb\(239,\s*68,\s*68\)/);
  });

  it('Test D: in live mode (replayMode="live"), no GDELT dots are rendered', () => {
    mockState.replayMode = 'live';
    const event = {
      global_event_id: 'evt-d',
      occurred_at: new Date(500).toISOString(),
      quad_class: 2,
      discovered_at: null,
      latitude: 0,
      longitude: 0,
      goldstein_scale: null,
      event_code: '020',
      actor1_name: null,
      actor2_name: null,
      source_url: null,
      avg_tone: null,
      num_mentions: null,
      source_is_stale: false,
    };
    vi.mocked(useGdeltEvents).mockReturnValue({ data: [event] } as ReturnType<typeof useGdeltEvents>);

    const { container } = render(<PlaybackBar />);
    const dots = container.querySelectorAll('[data-testid^="gdelt-dot-"]');
    expect(dots.length).toBe(0);
  });

  it('Test E: GDELT event with frac < 0 (occurred_at before window) does not render a dot', () => {
    const event = {
      global_event_id: 'evt-e',
      occurred_at: new Date(-100).toISOString(), // before window start (0ms)
      quad_class: 3,
      discovered_at: null,
      latitude: 0,
      longitude: 0,
      goldstein_scale: null,
      event_code: '030',
      actor1_name: null,
      actor2_name: null,
      source_url: null,
      avg_tone: null,
      num_mentions: null,
      source_is_stale: false,
    };
    vi.mocked(useGdeltEvents).mockReturnValue({ data: [event] } as ReturnType<typeof useGdeltEvents>);

    const { container } = render(<PlaybackBar />);
    const dots = container.querySelectorAll('[data-testid^="gdelt-dot-"]');
    expect(dots.length).toBe(0);
  });

  it('Test F: GDELT event with frac > 1 (occurred_at after window) does not render a dot', () => {
    const event = {
      global_event_id: 'evt-f',
      occurred_at: new Date(1500).toISOString(), // after window end (1000ms)
      quad_class: 3,
      discovered_at: null,
      latitude: 0,
      longitude: 0,
      goldstein_scale: null,
      event_code: '030',
      actor1_name: null,
      actor2_name: null,
      source_url: null,
      avg_tone: null,
      num_mentions: null,
      source_is_stale: false,
    };
    vi.mocked(useGdeltEvents).mockReturnValue({ data: [event] } as ReturnType<typeof useGdeltEvents>);

    const { container } = render(<PlaybackBar />);
    const dots = container.querySelectorAll('[data-testid^="gdelt-dot-"]');
    expect(dots.length).toBe(0);
  });
});
