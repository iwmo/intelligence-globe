import { useEffect } from 'react';
import landmarksData from '../data/landmarks.json';
import { flyToLandmark } from '../lib/viewerRegistry';
import { useAppStore, type VisualPreset } from '../store/useAppStore';

const PRESET_KEYS: Record<string, VisualPreset> = {
  '1': 'normal',
  '2': 'nvg',
  '3': 'crt',
  '4': 'flir',
  '5': 'noir',
};

/**
 * Global shortcuts: Q/W/E/R/T landmarks, 1–5 presets, H HUD, D detect, Esc stop track.
 * Ignored while typing in an input or textarea.
 */
export function useKeyboardShortcuts(): void {
  useEffect(() => {
    const shortcuts = new Map(
      landmarksData.landmarks.map(lm => [lm.shortcut.toUpperCase(), lm]),
    );

    const handler = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      if (e.key === 'Escape') {
        useAppStore.getState().clearSelection();
        return;
      }
      if (e.key === 'h' || e.key === 'H') {
        const { hudVisible, setHudVisible } = useAppStore.getState();
        setHudVisible(!hudVisible);
        return;
      }
      if (e.key === 'd' || e.key === 'D') {
        const { detectOverlayEnabled, setDetectOverlayEnabled } = useAppStore.getState();
        setDetectOverlayEnabled(!detectOverlayEnabled);
        return;
      }
      const preset = PRESET_KEYS[e.key];
      if (preset) {
        useAppStore.getState().setVisualPreset(preset);
        return;
      }

      const lm = shortcuts.get(e.key.toUpperCase());
      if (lm) flyToLandmark(lm);
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);
}
