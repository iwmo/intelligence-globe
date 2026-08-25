import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { useAppStore } from '../../store/useAppStore';
import { useSourceHealthStore } from '../../store/useSourceHealthStore';

const swapMapType = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
vi.mock('../../lib/viewerRegistry', () => ({ swapMapType }));

import { MapFallbackNotice } from '../shell/MapFallbackNotice';

describe('MapFallbackNotice', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAppStore.setState({ mapType: 'satellite', replayMode: 'live' });
    useSourceHealthStore.getState().resetSourceHealth();
  });

  it('surfaces map fallback reasons and provides a retry', () => {
    useSourceHealthStore.getState().setSourceHealth('map', {
      status: 'stale',
      reason: 'Photoreal 3D unavailable; using satellite fallback',
    });
    render(<MapFallbackNotice />);

    expect(screen.getByRole('status').textContent).toContain('Photoreal 3D unavailable');
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

    expect(swapMapType).toHaveBeenCalledWith('satellite');
    expect(useSourceHealthStore.getState().sources.map.status).toBe('connecting');
  });
});
