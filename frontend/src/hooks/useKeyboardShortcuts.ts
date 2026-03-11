import { useEffect } from 'react';
import landmarksData from '../data/landmarks.json';
import { flyToLandmark } from '../lib/viewerRegistry';

/**
 * Registers Q/W/E/R/T global keyboard shortcuts that fly the camera to landmark presets.
 * Shortcuts are case-insensitive and ignored when the user is typing in an input or textarea.
 * Cleans up the event listener on unmount.
 */
export function useKeyboardShortcuts(): void {
  useEffect(() => {
    const shortcuts = new Map(
      landmarksData.landmarks.map(lm => [lm.shortcut.toUpperCase(), lm]),
    );

    const handler = (e: KeyboardEvent) => {
      // Don't fire if user is typing in an input or textarea
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }
      const lm = shortcuts.get(e.key.toUpperCase());
      if (lm) flyToLandmark(lm);
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []); // no deps — landmarks are static
}
