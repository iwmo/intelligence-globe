import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';

vi.mock('cesium', () => ({}));

// Mock react-query to avoid network calls
vi.mock('@tanstack/react-query', () => ({
  useQuery: vi.fn(() => ({ data: undefined, isLoading: false, isError: false })),
}));

// Stub file exists (allows import) but exports nothing.
// Tests RED-fail because useOsintEvents is undefined.
import * as osintHookModule from '../useOsintEvents';

type HookFn = (opts: { enabled: boolean }) => { events: Array<Record<string, unknown>>; isLoading: boolean };

describe('useOsintEvents hook (Phase 12 RED)', () => {
  it('useOsintEvents is exported from the module', () => {
    // RED: stub exports nothing — useOsintEvents will be undefined
    const mod = osintHookModule as Record<string, unknown>;
    expect(mod['useOsintEvents']).toBeDefined();
  });

  it('returns an object with events array and isLoading boolean', () => {
    const mod = osintHookModule as Record<string, unknown>;
    const useOsintEvents = mod['useOsintEvents'] as HookFn | undefined;
    expect(useOsintEvents).toBeDefined();
    if (!useOsintEvents) return;
    const { result } = renderHook(() => useOsintEvents({ enabled: true }));
    expect(Array.isArray(result.current.events)).toBe(true);
    expect(typeof result.current.isLoading).toBe('boolean');
  });

  it('in disabled state, events is an empty array', () => {
    const mod = osintHookModule as Record<string, unknown>;
    const useOsintEvents = mod['useOsintEvents'] as HookFn | undefined;
    if (!useOsintEvents) return;
    const { result } = renderHook(() => useOsintEvents({ enabled: false }));
    expect(result.current.events).toEqual([]);
  });

  it('in disabled state, isLoading is false (no fetch triggered)', () => {
    const mod = osintHookModule as Record<string, unknown>;
    const useOsintEvents = mod['useOsintEvents'] as HookFn | undefined;
    if (!useOsintEvents) return;
    const { result } = renderHook(() => useOsintEvents({ enabled: false }));
    expect(result.current.isLoading).toBe(false);
  });

  it('each event in the events array has id, ts, category, label fields', () => {
    const mod = osintHookModule as Record<string, unknown>;
    const useOsintEvents = mod['useOsintEvents'] as HookFn | undefined;
    if (!useOsintEvents) return;
    const { result } = renderHook(() => useOsintEvents({ enabled: true }));
    for (const evt of result.current.events) {
      expect(typeof evt['id']).toBe('string');
      expect(typeof evt['ts']).toBe('number');
      expect(typeof evt['category']).toBe('string');
      expect(typeof evt['label']).toBe('string');
    }
  });
});
