import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useQuery } from '@tanstack/react-query';

vi.mock('@tanstack/react-query', () => ({
  useQuery: vi.fn(() => ({ data: { cells: [] } })),
}));

vi.mock('../../store/useAppStore', () => ({
  useAppStore: vi.fn(),
}));

import { useAppStore } from '../../store/useAppStore';
import { useFires } from '../useFires';

const mockUseAppStore = vi.mocked(useAppStore);
const mockUseQuery = vi.mocked(useQuery);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('useFires viewport cull', () => {
  it('does not pass a globe-scale bbox into the query key', () => {
    mockUseAppStore.mockImplementation((selector: (s: Record<string, unknown>) => unknown) =>
      selector({
        replayMode: 'live',
        viewportBbox: { minLat: -80, maxLat: 80, minLon: -170, maxLon: 170 },
      })
    );
    useFires();
    const opts = mockUseQuery.mock.calls[0][0] as { queryKey: unknown[] };
    expect(opts.queryKey[1]).toBeNull();
  });

  it('keeps a clipped bbox in the query key', () => {
    const bbox = { minLat: 24, maxLat: 26, minLon: 50, maxLon: 52 };
    mockUseAppStore.mockImplementation((selector: (s: Record<string, unknown>) => unknown) =>
      selector({ replayMode: 'live', viewportBbox: bbox })
    );
    useFires();
    const opts = mockUseQuery.mock.calls[0][0] as { queryKey: unknown[] };
    expect(opts.queryKey[1]).toEqual(bbox);
  });
});
