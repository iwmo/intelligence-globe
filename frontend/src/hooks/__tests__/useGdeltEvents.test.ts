import { describe, it, vi } from 'vitest';

vi.mock('@tanstack/react-query', () => ({
  useQuery: vi.fn((opts: { queryKey: unknown[] }) => ({ data: [], isLoading: false, queryKey: opts.queryKey })),
}));

vi.mock('../../store/useAppStore', () => ({
  useAppStore: vi.fn((selector: (s: Record<string, unknown>) => unknown) => selector({
    replayMode: 'live',
    viewportBbox: null,
  })),
}));

describe('useGdeltEvents — GDELT-06 VPC-08', () => {
  it.todo('effectiveBbox is null when replayMode is playback');
  it.todo('effectiveBbox equals viewportBbox when replayMode is live');
  it.todo('refetchInterval is false when replayMode is playback');
  it.todo('refetchInterval is 900_000 when replayMode is live');
});
