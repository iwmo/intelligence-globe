import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';

vi.mock('../../lib/viewerRegistry', () => ({
  flyToLandmark: vi.fn(),
}));

vi.mock('../../store/useAppStore', () => {
  const setVisualPreset = vi.fn();
  const setHudVisible = vi.fn();
  const setDetectOverlayEnabled = vi.fn();
  const clearSelection = vi.fn();
  const state = {
    hudVisible: true,
    setHudVisible,
    detectOverlayEnabled: false,
    setDetectOverlayEnabled,
    setVisualPreset,
    clearSelection,
  };
  const useAppStore = Object.assign(
    (selector?: (s: typeof state) => unknown) => (selector ? selector(state) : state),
    { getState: () => state },
  );
  return { useAppStore };
});

import { flyToLandmark } from '../../lib/viewerRegistry';
import { useAppStore } from '../../store/useAppStore';
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts';

const mockFlyToLandmark = flyToLandmark as ReturnType<typeof vi.fn>;

beforeEach(() => {
  mockFlyToLandmark.mockClear();
});

describe('useKeyboardShortcuts — keyboard shortcut dispatch', () => {
  it('keydown q (lowercase) triggers flyToLandmark with Q landmark', () => {
    renderHook(() => useKeyboardShortcuts());
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'q' }));
    expect(mockFlyToLandmark).toHaveBeenCalledTimes(1);
    expect(mockFlyToLandmark.mock.calls[0][0]).toMatchObject({ shortcut: 'Q' });
  });

  it('keydown Q (uppercase) also triggers flyToLandmark (case-insensitive)', () => {
    renderHook(() => useKeyboardShortcuts());
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Q' }));
    expect(mockFlyToLandmark).toHaveBeenCalledTimes(1);
    expect(mockFlyToLandmark.mock.calls[0][0]).toMatchObject({ shortcut: 'Q' });
  });

  it('keydown a does NOT call flyToLandmark', () => {
    renderHook(() => useKeyboardShortcuts());
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));
    expect(mockFlyToLandmark).not.toHaveBeenCalled();
  });

  it('cleans up event listener on unmount (no listener leak)', () => {
    const { unmount } = renderHook(() => useKeyboardShortcuts());
    unmount();
    // After unmount, firing a keydown should NOT call flyToLandmark
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'q' }));
    expect(mockFlyToLandmark).not.toHaveBeenCalled();
  });

  it('Escape clears selection and track', () => {
    renderHook(() => useKeyboardShortcuts());
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(useAppStore.getState().clearSelection).toHaveBeenCalledTimes(1);
  });

  it('digit 2 sets the NVG preset', () => {
    renderHook(() => useKeyboardShortcuts());
    window.dispatchEvent(new KeyboardEvent('keydown', { key: '2' }));
    expect(useAppStore.getState().setVisualPreset).toHaveBeenCalledWith('nvg');
  });

  it('keydown d toggles the detection overlay', () => {
    renderHook(() => useKeyboardShortcuts());
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'd' }));
    expect(useAppStore.getState().setDetectOverlayEnabled).toHaveBeenCalledWith(true);
  });
});
