import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';

vi.mock('cesium', () => ({}));

const toggleCategory = vi.fn();

const mockState = {
  replayMode: 'playback' as 'live' | 'playback',
  setReplayMode: vi.fn(),
  replayTs: Date.now(),
  setReplayTs: vi.fn(),
  replayWindowStart: null as number | null,
  replayWindowEnd: null as number | null,
  replaySpeedMultiplier: 60,
  setReplaySpeedMultiplier: vi.fn(),
  setReplayWindow: vi.fn(),
  activeCategories: [] as string[],
  toggleCategory,
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

// Static import after vi.mock
import { PlaybackBar } from '../PlaybackBar';

const EXPECTED_CATEGORIES = ['KINETIC', 'AIRSPACE', 'MARITIME', 'SEISMIC', 'JAMMING'];

describe('PlaybackBar — category chips (Phase 12 RED)', () => {
  it('renders category chips when replayMode is playback', () => {
    mockState.replayMode = 'playback';
    const { getByText } = render(<PlaybackBar />);
    for (const cat of EXPECTED_CATEGORIES) {
      expect(getByText(cat)).toBeTruthy();
    }
  });

  it('SEISMIC chip is present (new category not yet in store)', () => {
    mockState.replayMode = 'playback';
    const { getByText } = render(<PlaybackBar />);
    expect(getByText('SEISMIC')).toBeTruthy();
  });

  it('clicking KINETIC chip calls toggleCategory("KINETIC")', () => {
    mockState.replayMode = 'playback';
    toggleCategory.mockClear();
    const { getByText } = render(<PlaybackBar />);
    const chip = getByText('KINETIC');
    fireEvent.click(chip);
    expect(toggleCategory).toHaveBeenCalledWith('KINETIC');
  });

  it('clicking AIRSPACE chip calls toggleCategory("AIRSPACE")', () => {
    mockState.replayMode = 'playback';
    toggleCategory.mockClear();
    const { getByText } = render(<PlaybackBar />);
    const chip = getByText('AIRSPACE');
    fireEvent.click(chip);
    expect(toggleCategory).toHaveBeenCalledWith('AIRSPACE');
  });

  it('category chips are NOT rendered in live mode', () => {
    mockState.replayMode = 'live';
    const { queryByText } = render(<PlaybackBar />);
    expect(queryByText('KINETIC')).toBeNull();
  });
});
