import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  deriveAggregateHealth,
  useSourceHealthStore,
} from '../useSourceHealthStore';

describe('source health store', () => {
  beforeEach(() => {
    useSourceHealthStore.getState().resetSourceHealth();
  });

  it('starts CONNECTING instead of inferring LIVE', () => {
    const state = useSourceHealthStore.getState();
    expect(state.sources.map.status).toBe('connecting');
    expect(deriveAggregateHealth(state.sources)).toBe('connecting');
  });

  it('becomes LIVE after a confirmed map success', () => {
    useSourceHealthStore.getState().setSourceHealth('map', {
      status: 'live',
      lastSuccessAt: '2026-08-25T18:00:00.000Z',
      reason: null,
    });
    expect(deriveAggregateHealth(useSourceHealthStore.getState().sources)).toBe('live');
  });

  it('is DEGRADED when any active source errors', () => {
    const store = useSourceHealthStore.getState();
    store.setSourceHealth('map', { status: 'live' });
    store.setSourceHealth('aircraft', {
      status: 'error',
      reason: 'Aircraft fetch failed',
    });
    expect(deriveAggregateHealth(useSourceHealthStore.getState().sources)).toBe('degraded');
  });

  it('keeps disabled sources out of aggregate health', () => {
    const store = useSourceHealthStore.getState();
    store.setSourceHealth('map', { status: 'live' });
    store.setSourceHealth('aircraft', {
      status: 'off',
      reason: null,
    });
    expect(deriveAggregateHealth(useSourceHealthStore.getState().sources)).toBe('live');
  });

  it('does not notify subscribers for an unchanged source update', () => {
    const listener = vi.fn();
    const unsubscribe = useSourceHealthStore.subscribe(listener);

    useSourceHealthStore.getState().setSourceHealth('map', {
      status: 'connecting',
      lastSuccessAt: null,
      reason: null,
    });
    expect(listener).not.toHaveBeenCalled();

    useSourceHealthStore.getState().setSourceHealth('map', { status: 'live' });
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
  });
});
