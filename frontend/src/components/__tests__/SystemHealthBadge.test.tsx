import { beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { TooltipProvider } from '../ui/tooltip';
import { SystemHealthBadge } from '../shell/SystemHealthBadge';
import { useSourceHealthStore } from '../../store/useSourceHealthStore';

describe('SystemHealthBadge', () => {
  beforeEach(() => {
    useSourceHealthStore.getState().resetSourceHealth();
    useSourceHealthStore.getState().setSourceHealth('map', {
      status: 'live',
      lastSuccessAt: '2026-08-25T18:00:00.000Z',
      reason: null,
    });
  });

  it('shows source diagnostics, last success, and retries degraded feeds', async () => {
    useSourceHealthStore.getState().setSourceHealth('fires', {
      status: 'unavailable',
      lastSuccessAt: '2026-08-25T18:01:00.000Z',
      reason: 'FIRMS key is not configured',
    });

    render(
      <TooltipProvider>
        <SystemHealthBadge />
      </TooltipProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'System status: degraded' }));
    expect(await screen.findByText('FIRMS key is not configured')).toBeTruthy();
    expect(screen.getAllByText(/Last success/)).toHaveLength(2);

    fireEvent.click(screen.getByRole('button', { name: 'Retry Fires' }));
    expect(useSourceHealthStore.getState().sources.fires.status).toBe('connecting');
    expect(useSourceHealthStore.getState().sources.fires.reason).toBeNull();
  });
});
