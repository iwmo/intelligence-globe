import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../viewerRegistry', () => ({
  flyToLandmark: vi.fn(),
  flyToPosition: vi.fn(),
  resetGlobe: vi.fn(),
}));

import { runVoiceTool } from '../voiceTools';
import { useAppStore } from '../../store/useAppStore';
import { resetGlobe } from '../viewerRegistry';

describe('runVoiceTool', () => {
  beforeEach(() => {
    useAppStore.getState().clearSelection();
    useAppStore.getState().setVisualPreset('normal');
  });

  it('sets NVG from set_visual_preset', async () => {
    expect(await runVoiceTool('set_visual_preset', { preset: 'nvg' })).toContain('nvg');
    expect(useAppStore.getState().visualPreset).toBe('nvg');
  });

  it('resets the globe', async () => {
    await runVoiceTool('zoom_to_globe', {});
    expect(resetGlobe).toHaveBeenCalled();
  });

  it('refuses cockpit without a tracked air contact', async () => {
    expect(await runVoiceTool('enter_cockpit', {})).toMatch(/track an aircraft/i);
  });

  it('enters cockpit when an aircraft is tracked', async () => {
    useAppStore.getState().selectContact('aircraft', 'abc123');
    expect(await runVoiceTool('enter_cockpit', {})).toMatch(/cockpit chase on/i);
    expect(useAppStore.getState().cockpitMode).toBe(true);
    expect(await runVoiceTool('exit_cockpit', {})).toMatch(/off/i);
    expect(useAppStore.getState().cockpitMode).toBe(false);
  });

  it('geocodes a place through the backend proxy', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ results: [{ label: 'Lisbon, Portugal', lat: 38.72, lon: -9.14 }] }),
    });
    vi.stubGlobal('fetch', fetchMock);
    const { flyToLandmark } = await import('../viewerRegistry');
    expect(await runVoiceTool('geocode_place', { query: 'LIS' })).toMatch(/Lisbon/i);
    expect(fetchMock).toHaveBeenCalled();
    expect(flyToLandmark).toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
