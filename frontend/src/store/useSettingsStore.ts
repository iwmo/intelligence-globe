import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { VisualPreset } from './useAppStore';

export interface SettingsState {
  defaultLayers: {
    satellites: boolean;
    aircraft: boolean;
    militaryAircraft: boolean;
    ships: boolean;
    gpsJamming: boolean;
    streetTraffic: boolean;
  };
  defaultPreset: VisualPreset;
  defaultCamera: { lon: number; lat: number; altMeters: number; pitch: number } | null;
  defaultMode: 'live' | 'playback';

  showEntityLabels: boolean;

  setDefaultLayers: (layers: SettingsState['defaultLayers']) => void;
  setDefaultPreset: (preset: VisualPreset) => void;
  setDefaultCamera: (camera: SettingsState['defaultCamera']) => void;
  setDefaultMode: (mode: 'live' | 'playback') => void;
  setShowEntityLabels: (v: boolean) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      // Initial state matches useAppStore layer defaults exactly
      defaultLayers: {
        satellites: true,
        aircraft: true,
        militaryAircraft: false,
        ships: false,
        gpsJamming: false,
        streetTraffic: false,
      },
      defaultPreset: 'normal',
      defaultCamera: null,
      defaultMode: 'live',
      showEntityLabels: false,

      setDefaultLayers: (layers) => set({ defaultLayers: layers }),
      setDefaultPreset: (preset) => set({ defaultPreset: preset }),
      setDefaultCamera: (camera) => set({ defaultCamera: camera }),
      setDefaultMode: (mode) => set({ defaultMode: mode }),
      setShowEntityLabels: (v) => set({ showEntityLabels: v }),
    }),
    { name: 'globe-settings' }
  )
);
