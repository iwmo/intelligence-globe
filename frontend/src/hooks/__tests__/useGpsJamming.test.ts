/**
 * useGpsJamming hook — LAYR-03 (refetchInterval guard in playback mode)
 *
 * RED tests: assert refetchInterval behaviour that does not yet exist in source.
 * When replayMode is 'playback' the hook must pass refetchInterval: false to
 * useQuery so that React Query never auto-refreshes stale GPS jamming data
 * while the user is scrubbing historical time.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks (must be hoisted before the static import of the hook)
// ---------------------------------------------------------------------------

const mockReplayMode: { value: 'live' | 'playback' } = { value: 'live' };

vi.mock('../../store/useAppStore', () => ({
  useAppStore: vi.fn((selector: (s: { replayMode: 'live' | 'playback' }) => unknown) =>
    selector({ replayMode: mockReplayMode.value })
  ),
  // static getState also needed by some paths
}));

// Capture the options passed to useQuery
let capturedQueryOptions: Record<string, unknown> | null = null;

vi.mock('@tanstack/react-query', () => ({
  useQuery: vi.fn((options: Record<string, unknown>) => {
    capturedQueryOptions = options;
    return { data: undefined, isLoading: false };
  }),
}));

import { useGpsJamming } from '../useGpsJamming';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('LAYR-03: useGpsJamming refetchInterval guard', () => {
  beforeEach(() => {
    capturedQueryOptions = null;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('sets refetchInterval to false when replayMode is playback', () => {
    mockReplayMode.value = 'playback';
    useGpsJamming();
    // Implementation not yet written — this will FAIL until the hook reads replayMode
    expect(capturedQueryOptions?.refetchInterval).toBe(false);
  });

  it('sets refetchInterval to 86_400_000 when replayMode is live', () => {
    mockReplayMode.value = 'live';
    useGpsJamming();
    expect(capturedQueryOptions?.refetchInterval).toBe(86_400_000);
  });
});
