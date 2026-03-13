import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useViewerClock } from '../useViewerClock';

// Mock cesium — JulianDate.fromDate must be a spy
const mockFromDate = vi.fn((d: Date) => ({ julianDate: d.getTime() }));
vi.mock('cesium', () => ({
  JulianDate: {
    fromDate: mockFromDate,
  },
}));

// Mock useAppStore
const mockGetState = vi.fn(() => ({
  replayMode: 'playback' as 'live' | 'playback',
  replayTs: new Date('2026-01-01T00:00:00Z').getTime(),
}));
vi.mock('../../store/useAppStore', () => ({
  useAppStore: Object.assign(vi.fn(), { getState: mockGetState }),
}));

function makeViewer(overrides: Partial<{
  postUpdateListeners: ((handler: () => void) => void)[];
  isDestroyed: () => boolean;
}> = {}) {
  const listeners: (() => void)[] = [];
  const addEventListener = vi.fn((h: () => void) => listeners.push(h));
  const removeEventListener = vi.fn();
  const clock = { currentTime: null as unknown };
  const isDestroyed = overrides.isDestroyed ?? vi.fn(() => false);
  return {
    scene: { postUpdate: { addEventListener, removeEventListener } },
    clock,
    isDestroyed,
    _triggerPostUpdate: () => listeners.forEach(h => h()),
  };
}

describe('useViewerClock', () => {
  beforeEach(() => {
    mockFromDate.mockClear();
    mockGetState.mockClear();
  });

  it('attaches postUpdate listener when viewer is provided', () => {
    const viewer = makeViewer();
    renderHook(() => useViewerClock(viewer as never));
    expect(viewer.scene.postUpdate.addEventListener).toHaveBeenCalledTimes(1);
  });

  it('does NOT attach listener when viewer is null', () => {
    const { result } = renderHook(() => useViewerClock(null));
    // no error, no call
    expect(result.current).toBeUndefined();
  });

  it('sets viewer.clock.currentTime via JulianDate.fromDate when replayMode is playback', () => {
    const viewer = makeViewer();
    renderHook(() => useViewerClock(viewer as never));
    viewer._triggerPostUpdate();
    expect(mockFromDate).toHaveBeenCalled();
    expect(viewer.clock.currentTime).toBeTruthy();
  });

  it('does NOT set viewer.clock.currentTime when replayMode is live', () => {
    mockGetState.mockReturnValueOnce({ replayMode: 'live', replayTs: Date.now() });
    const viewer = makeViewer();
    renderHook(() => useViewerClock(viewer as never));
    viewer._triggerPostUpdate();
    expect(mockFromDate).not.toHaveBeenCalled();
  });

  it('calls removeEventListener on unmount when viewer is not destroyed', () => {
    const viewer = makeViewer();
    const { unmount } = renderHook(() => useViewerClock(viewer as never));
    unmount();
    expect(viewer.scene.postUpdate.removeEventListener).toHaveBeenCalledTimes(1);
  });

  it('does NOT call removeEventListener on unmount when viewer.isDestroyed() is true', () => {
    const viewer = makeViewer({ isDestroyed: vi.fn(() => true) });
    const { unmount } = renderHook(() => useViewerClock(viewer as never));
    unmount();
    expect(viewer.scene.postUpdate.removeEventListener).not.toHaveBeenCalled();
  });
});
