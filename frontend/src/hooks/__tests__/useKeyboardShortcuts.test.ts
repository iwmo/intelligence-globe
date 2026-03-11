import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';

vi.mock('../../lib/viewerRegistry', () => ({
  flyToLandmark: vi.fn(),
}));

import { flyToLandmark } from '../../lib/viewerRegistry';
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
});
