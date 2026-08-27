import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { TooltipProvider } from '../ui/tooltip';
import { useAppStore } from '../../store/useAppStore';
import { useSourceHealthStore } from '../../store/useSourceHealthStore';

const resetGlobe = vi.hoisted(() => vi.fn());
const swapMapType = vi.hoisted(() => vi.fn());
const writeShareHash = vi.hoisted(() => vi.fn());
const invalidateQueries = vi.hoisted(() => vi.fn());

vi.mock('../../lib/viewerRegistry', () => ({ resetGlobe, swapMapType }));
vi.mock('../../lib/shareView', () => ({ writeShareHash }));
vi.mock('../../lib/queryClient', () => ({
  queryClient: { invalidateQueries },
}));
vi.mock('../SearchBar', () => ({
  SearchBar: () => <input aria-label="Universal command and location search" />,
}));

import { CommandStrip } from '../shell/CommandStrip';

const workerRef = { current: null };

function renderStrip() {
  return render(
    <TooltipProvider>
      <CommandStrip workerRef={workerRef} />
    </TooltipProvider>,
  );
}

describe('CommandStrip', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useSourceHealthStore.getState().resetSourceHealth();
    useSourceHealthStore.getState().setSourceHealth('map', { status: 'live' });
    useAppStore.setState({
      replayMode: 'live',
      replayTs: Date.now(),
      cleanUI: false,
      visualPreset: 'normal',
      hudVisible: true,
      detectOverlayEnabled: false,
      activeRightPanel: null,
      isPlaying: false,
    });
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
  });

  it('owns live/replay switching and refreshes data when returning live', () => {
    const { rerender } = renderStrip();
    fireEvent.click(screen.getByRole('button', { name: 'Open playback' }));
    expect(useAppStore.getState().replayMode).toBe('playback');

    rerender(
      <TooltipProvider>
        <CommandStrip workerRef={workerRef} />
      </TooltipProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Return to live' }));
    expect(useAppStore.getState().replayMode).toBe('live');
    expect(invalidateQueries).toHaveBeenCalledTimes(1);
  });

  it('exposes one Focus Mode control and reduces the shell when active', () => {
    renderStrip();
    const focus = screen.getByRole('button', { name: 'Enter focus mode' });
    expect(screen.getAllByRole('button', { name: /focus mode/i })).toHaveLength(1);
    fireEvent.click(focus);
    expect(useAppStore.getState().cleanUI).toBe(true);
    expect(screen.getByRole('button', { name: 'Exit focus mode' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Open settings' })).toBeNull();
  });

  it('migrates reset, share, attribution, and settings actions', async () => {
    renderStrip();
    fireEvent.click(screen.getByRole('button', { name: 'Reset globe' }));
    expect(resetGlobe).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'Copy share link' }));
    expect(writeShareHash).toHaveBeenCalledTimes(1);
    expect(navigator.clipboard.writeText).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'Open settings' }));
    expect(useAppStore.getState().activeRightPanel).toBe('settings');

    fireEvent.click(screen.getByRole('button', { name: 'Data attribution' }));
    expect(await screen.findByText('USGS Earthquake Hazards Program')).toBeTruthy();
  });

  it('controls visual preset, HUD, and detection from one view popover', async () => {
    renderStrip();
    fireEvent.click(screen.getByRole('button', { name: 'View mode: normal' }));

    fireEvent.click(await screen.findByRole('button', { name: /Night vision/i }));
    expect(useAppStore.getState().visualPreset).toBe('nvg');

    fireEvent.click(screen.getByRole('button', { name: /Telemetry HUD/i }));
    expect(useAppStore.getState().hudVisible).toBe(false);

    fireEvent.click(screen.getByRole('button', { name: /Detection overlay/i }));
    expect(useAppStore.getState().detectOverlayEnabled).toBe(true);
  });

  it('keeps View Mode and attribution reachable from mobile overflow', async () => {
    renderStrip();
    fireEvent.click(screen.getByRole('button', { name: 'More global controls' }));

    const viewModeButtons = await screen.findAllByRole('button', { name: 'View mode: normal' });
    const overflowViewMode = viewModeButtons.find(button => button.classList.contains('command-overflow__action'));
    expect(overflowViewMode).toBeTruthy();
    fireEvent.click(overflowViewMode!);
    fireEvent.click(await screen.findByRole('button', { name: /Noir/i }));
    expect(useAppStore.getState().visualPreset).toBe('noir');

    fireEvent.click(screen.getByRole('button', { name: 'More global controls' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Data attribution' }));
    expect(await screen.findByText('NASA FIRMS / VIIRS')).toBeTruthy();
  });
});
