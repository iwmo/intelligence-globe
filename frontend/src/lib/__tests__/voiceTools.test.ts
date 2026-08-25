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

  it('sets NVG from set_visual_preset', () => {
    expect(runVoiceTool('set_visual_preset', { preset: 'nvg' })).toContain('nvg');
    expect(useAppStore.getState().visualPreset).toBe('nvg');
  });

  it('resets the globe', () => {
    runVoiceTool('zoom_to_globe', {});
    expect(resetGlobe).toHaveBeenCalled();
  });

  it('stubs cockpit', () => {
    expect(runVoiceTool('enter_cockpit', {})).toMatch(/not available/i);
  });
});
