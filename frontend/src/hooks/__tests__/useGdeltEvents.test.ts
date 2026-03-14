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

describe('useGdeltEvents — GDELT-10 replay window', () => {
  it('Test A: queryFn URL includes since and until ISO strings when replayMode=playback with valid window', async () => {
    const T1 = new Date('2024-01-01T00:00:00Z').getTime();
    const T2 = new Date('2024-01-01T06:00:00Z').getTime();
    mockUseAppStore.mockImplementation((selector: (s: Record<string, unknown>) => unknown) =>
      selector({
        replayMode: 'playback',
        viewportBbox: null,
        replayWindowStart: T1,
        replayWindowEnd: T2,
      })
    );

    let capturedQueryFn: (() => Promise<unknown>) | undefined;
    mockUseQuery.mockImplementation((opts: { queryFn?: () => Promise<unknown> }) => {
      capturedQueryFn = opts.queryFn;
      return { data: [], isLoading: false };
    });

    useGdeltEvents();

    expect(capturedQueryFn).toBeDefined();

    // Mock fetch to capture the URL
    const originalFetch = globalThis.fetch;
    let capturedUrl = '';
    globalThis.fetch = vi.fn(async (url: string) => {
      capturedUrl = url;
      return { ok: true, json: async () => [] } as unknown as Response;
    });

    await capturedQueryFn!();

    globalThis.fetch = originalFetch;

    expect(capturedUrl).toContain('since=2024-01-01T00%3A00%3A00.000Z');
    expect(capturedUrl).toContain('until=2024-01-01T06%3A00%3A00.000Z');
  });

  it('Test B: queryKey includes window bounds and NOT replayTs when replayMode=playback', () => {
    const T1 = new Date('2024-01-01T00:00:00Z').getTime();
    const T2 = new Date('2024-01-01T06:00:00Z').getTime();
    mockUseAppStore.mockImplementation((selector: (s: Record<string, unknown>) => unknown) =>
      selector({
        replayMode: 'playback',
        viewportBbox: null,
        replayWindowStart: T1,
        replayWindowEnd: T2,
        replayTs: T1 + 1000, // deliberately different — must NOT appear in queryKey
      })
    );

    useGdeltEvents();

    const opts = mockUseQuery.mock.calls[0][0] as { queryKey: unknown[] };
    expect(opts.queryKey[0]).toBe('gdelt-events');
    expect(opts.queryKey[1]).toBeNull(); // effectiveBbox
    expect(opts.queryKey[2]).toBe(new Date(T1).toISOString());
    expect(opts.queryKey[3]).toBe(new Date(T2).toISOString());
    // replayTs must NOT be in queryKey
    expect(opts.queryKey).not.toContain(T1 + 1000);
  });

  it('Test C: queryKey is [gdelt-events, null, null, null] when replayMode=playback and replayWindowStart=null', () => {
    mockUseAppStore.mockImplementation((selector: (s: Record<string, unknown>) => unknown) =>
      selector({
        replayMode: 'playback',
        viewportBbox: null,
        replayWindowStart: null,
        replayWindowEnd: null,
      })
    );

    useGdeltEvents();

    const opts = mockUseQuery.mock.calls[0][0] as { queryKey: unknown[] };
    expect(opts.queryKey).toEqual(['gdelt-events', null, null, null]);
  });

  it('Test D: queryKey is [gdelt-events, viewportBbox, null, null] when replayMode=live', () => {
    const bbox = { minLat: 10, maxLat: 20, minLon: 30, maxLon: 40 };
    mockUseAppStore.mockImplementation((selector: (s: Record<string, unknown>) => unknown) =>
      selector({
        replayMode: 'live',
        viewportBbox: bbox,
        replayWindowStart: null,
        replayWindowEnd: null,
      })
    );

    useGdeltEvents();

    const opts = mockUseQuery.mock.calls[0][0] as { queryKey: unknown[] };
    expect(opts.queryKey).toEqual(['gdelt-events', bbox, null, null]);
  });
});
