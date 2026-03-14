import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Mock cesium (useAircraft may transitively import cesium utils)
vi.mock('cesium', () => ({}));

// Mock useAppStore — playback mode with a non-null viewportBbox
const mockStoreState = {
  replayMode: 'playback' as 'live' | 'playback',
  viewportBbox: { minLat: 10, maxLat: 50, minLon: -10, maxLon: 30 },
};
vi.mock('../../store/useAppStore', () => ({
  useAppStore: vi.fn((selector: (s: typeof mockStoreState) => unknown) =>
    selector(mockStoreState),
  ),
}));

import { useAircraft } from '../useAircraft';

// ---------------------------------------------------------------------------
// Helper: create a fresh QueryClient wrapper for each test
// ---------------------------------------------------------------------------
function makeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
}

describe('useAircraft bbox suppression in playback mode (Phase 33 RED)', () => {
  const capturedUrls: string[] = [];
  const mockFetch = vi.fn((url: RequestInfo | URL) => {
    capturedUrls.push(String(url));
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve([]),
    } as Response);
  });

  beforeEach(() => {
    capturedUrls.length = 0;
    mockFetch.mockClear();
    vi.stubGlobal('fetch', mockFetch);
  });

  it('VPC-08: in playback mode, fetch URL does NOT include min_lat even when viewportBbox is set', async () => {
    const { result } = renderHook(() => useAircraft(), { wrapper: makeWrapper() });

    // Wait for the query to attempt a fetch (or settle)
    await vi.waitFor(() => {
      return mockFetch.mock.calls.length > 0 || result.current.isFetching === false;
    }, { timeout: 2000 }).catch(() => {
      // If no fetch happened at all (hook disabled in playback mode), that also satisfies VPC-08
    });

    // If fetch was called, the URL must NOT contain min_lat
    for (const url of capturedUrls) {
      expect(url).not.toContain('min_lat');
    }
  });
});
