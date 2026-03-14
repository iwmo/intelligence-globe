import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useQuery } from '@tanstack/react-query';

vi.mock('@tanstack/react-query', () => ({
  useQuery: vi.fn(() => ({ data: [], isLoading: false })),
}));

vi.mock('../../store/useAppStore', () => ({
  useAppStore: vi.fn(),
}));

import { useAppStore } from '../../store/useAppStore';
import { useGdeltEvents } from '../useGdeltEvents';

const mockUseAppStore = vi.mocked(useAppStore);
const mockUseQuery = vi.mocked(useQuery);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('useGdeltEvents — GDELT-06 VPC-08', () => {
  it('effectiveBbox is null when replayMode is playback', () => {
    mockUseAppStore.mockImplementation((selector: (s: Record<string, unknown>) => unknown) =>
      selector({ replayMode: 'playback', viewportBbox: { minLat: 10, maxLat: 20, minLon: 30, maxLon: 40 } })
    );

    useGdeltEvents();

    const opts = mockUseQuery.mock.calls[0][0] as { queryKey: unknown[] };
    expect(opts.queryKey[1]).toBeNull();
  });

  it('effectiveBbox equals viewportBbox when replayMode is live', () => {
    const bbox = { minLat: 10, maxLat: 20, minLon: 30, maxLon: 40 };
    mockUseAppStore.mockImplementation((selector: (s: Record<string, unknown>) => unknown) =>
      selector({ replayMode: 'live', viewportBbox: bbox })
    );

    useGdeltEvents();

    const opts = mockUseQuery.mock.calls[0][0] as { queryKey: unknown[] };
    expect(opts.queryKey[1]).toEqual(bbox);
  });

  it('refetchInterval is false when replayMode is playback', () => {
    mockUseAppStore.mockImplementation((selector: (s: Record<string, unknown>) => unknown) =>
      selector({ replayMode: 'playback', viewportBbox: null })
    );

    useGdeltEvents();

    const opts = mockUseQuery.mock.calls[0][0] as { refetchInterval: unknown };
    expect(opts.refetchInterval).toBe(false);
  });

  it('refetchInterval is 900_000 when replayMode is live', () => {
    mockUseAppStore.mockImplementation((selector: (s: Record<string, unknown>) => unknown) =>
      selector({ replayMode: 'live', viewportBbox: null })
    );

    useGdeltEvents();

    const opts = mockUseQuery.mock.calls[0][0] as { refetchInterval: unknown };
    expect(opts.refetchInterval).toBe(900_000);
  });
});
