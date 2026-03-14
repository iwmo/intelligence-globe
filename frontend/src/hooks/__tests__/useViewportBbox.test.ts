import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';

// Mock cesium — provide Math.toDegrees and a mock Viewer shape
// vi.mock is hoisted; factories must use inline vi.fn() only
vi.mock('cesium', () => ({
  Math: {
    toDegrees: (rad: number) => rad * (180 / Math.PI),
  },
}));

// Mock useAppStore to capture setViewportBbox calls
const mockSetViewportBbox = vi.fn();
vi.mock('../../store/useAppStore', () => ({
  useAppStore: vi.fn((selector: (s: Record<string, unknown>) => unknown) =>
    selector({ setViewportBbox: mockSetViewportBbox }),
  ),
}));

// Import after mocks are registered
import { useViewportBbox } from '../useViewportBbox';

// ---------------------------------------------------------------------------
// Helper: build a minimal Cesium Viewer mock
// ---------------------------------------------------------------------------
function makeMockViewer(getRectResult: { west: number; south: number; east: number; north: number } | undefined) {
  const listeners: Array<() => void> = [];
  const camera = {
    moveEnd: {
      addEventListener: vi.fn((h: () => void) => listeners.push(h)),
      removeEventListener: vi.fn(),
    },
    computeViewRectangle: vi.fn(() => getRectResult),
  };
  return {
    camera,
    isDestroyed: vi.fn(() => false),
    _fireMoveEnd: () => listeners.forEach(h => h()),
  };
}

describe('useViewportBbox (Phase 33 RED)', () => {
  beforeEach(() => {
    mockSetViewportBbox.mockClear();
  });

  it('VPC-01: fires setViewportBbox with degree values when rectangle is valid', () => {
    // west=-0.5, south=0.1, east=0.5, north=0.9 (radians)
    const viewer = makeMockViewer({ west: -0.5, south: 0.1, east: 0.5, north: 0.9 });
    renderHook(() => useViewportBbox(viewer as never));

    viewer._fireMoveEnd();

    expect(mockSetViewportBbox).toHaveBeenCalledTimes(1);
    const arg = mockSetViewportBbox.mock.calls[0][0];
    // Expected degree values (1 d.p.):
    //   west  = -0.5 * 180/π ≈ -28.6
    //   south =  0.1 * 180/π ≈   5.7
    //   east  =  0.5 * 180/π ≈  28.6
    //   north =  0.9 * 180/π ≈  51.6
    expect(arg).not.toBeNull();
    expect(typeof arg.minLon).toBe('number');
    expect(typeof arg.minLat).toBe('number');
    expect(typeof arg.maxLon).toBe('number');
    expect(typeof arg.maxLat).toBe('number');
    expect(arg.minLon).toBeCloseTo(-28.6, 1);
    expect(arg.minLat).toBeCloseTo(5.7, 1);
    expect(arg.maxLon).toBeCloseTo(28.6, 1);
    expect(arg.maxLat).toBeCloseTo(51.6, 1);
  });

  it('VPC-02: does NOT call setViewportBbox with a bbox object when computeViewRectangle returns undefined', () => {
    const viewer = makeMockViewer(undefined);
    renderHook(() => useViewportBbox(viewer as never));

    viewer._fireMoveEnd();

    // Either not called, or called with null — must NOT be called with a bbox object
    const objCalls = mockSetViewportBbox.mock.calls.filter(
      ([arg]) => arg !== null && typeof arg === 'object',
    );
    expect(objCalls).toHaveLength(0);
  });

  it('VPC-07: calls setViewportBbox(null) when west > east (IDL crossing)', () => {
    // west=2.8, east=-2.8 means west > east → IDL crossing
    const viewer = makeMockViewer({ west: 2.8, south: 0.1, east: -2.8, north: 0.9 });
    renderHook(() => useViewportBbox(viewer as never));

    viewer._fireMoveEnd();

    expect(mockSetViewportBbox).toHaveBeenCalledWith(null);
  });
});
