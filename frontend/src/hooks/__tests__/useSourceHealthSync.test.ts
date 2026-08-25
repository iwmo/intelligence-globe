import { describe, expect, it } from 'vitest';
import type { Query } from '@tanstack/react-query';
import { healthFromQuery } from '../useSourceHealthSync';

function queryState(overrides: Record<string, unknown>): Query {
  return {
    state: {
      status: 'success',
      fetchStatus: 'idle',
      data: [{ id: 'confirmed' }],
      dataUpdatedAt: Date.parse('2026-08-25T18:00:00.000Z'),
      error: null,
      ...overrides,
    },
  } as unknown as Query;
}

describe('healthFromQuery', () => {
  it('stays connecting until the first response completes', () => {
    expect(healthFromQuery(queryState({
      status: 'pending',
      fetchStatus: 'fetching',
      data: undefined,
      dataUpdatedAt: 0,
    }))).toEqual({
      status: 'connecting',
      lastSuccessAt: null,
      reason: null,
    });
  });

  it('reports unavailable separately from a successful empty response', () => {
    expect(healthFromQuery(queryState({
      data: { available: false, reason: 'FIRMS key is not configured' },
    }))).toMatchObject({
      status: 'unavailable',
      reason: 'FIRMS key is not configured',
    });

    expect(healthFromQuery(queryState({ data: [] }))).toMatchObject({
      status: 'empty',
      reason: null,
    });
  });

  it('reports stale records and preserves the last successful timestamp', () => {
    expect(healthFromQuery(queryState({
      data: [{ id: 'old', is_stale: true }],
    }))).toEqual({
      status: 'stale',
      lastSuccessAt: '2026-08-25T18:00:00.000Z',
      reason: 'Source returned stale records',
    });
  });

  it('reports request errors without inventing a success time', () => {
    expect(healthFromQuery(queryState({
      status: 'error',
      dataUpdatedAt: 0,
      error: new Error('upstream unavailable'),
    }))).toEqual({
      status: 'error',
      lastSuccessAt: null,
      reason: 'upstream unavailable',
    });
  });
});
