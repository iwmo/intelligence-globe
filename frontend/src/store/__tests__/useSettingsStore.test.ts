import { describe, it, expect, beforeEach } from 'vitest';
import { useSettingsStore } from '../useSettingsStore';

// Helper: reset store to initial state before each test
function resetStore() {
  useSettingsStore.setState({
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
  });
  // Also clear localStorage so persist hydration does not bleed across tests
  localStorage.removeItem('globe-settings');
}

describe('useSettingsStore — CONFIG-02: defaultLayers', () => {
  beforeEach(resetStore);

  it('initial defaultLayers match useAppStore defaults', () => {
    const { defaultLayers } = useSettingsStore.getState();
    expect(defaultLayers.satellites).toBe(true);
    expect(defaultLayers.aircraft).toBe(true);
    expect(defaultLayers.militaryAircraft).toBe(false);
    expect(defaultLayers.ships).toBe(false);
    expect(defaultLayers.gpsJamming).toBe(false);
    expect(defaultLayers.streetTraffic).toBe(false);
  });

  it('setDefaultLayers replaces all layer booleans', () => {
    useSettingsStore.getState().setDefaultLayers({
      satellites: false,
      aircraft: false,
      militaryAircraft: false,
      ships: false,
      gpsJamming: false,
      streetTraffic: false,
    });
    const { defaultLayers } = useSettingsStore.getState();
    expect(defaultLayers.satellites).toBe(false);
    expect(defaultLayers.aircraft).toBe(false);
  });

  it('setDefaultLayers can set all layers to true', () => {
    useSettingsStore.getState().setDefaultLayers({
      satellites: true,
      aircraft: true,
      militaryAircraft: true,
      ships: true,
      gpsJamming: true,
      streetTraffic: true,
    });
    const { defaultLayers } = useSettingsStore.getState();
    expect(Object.values(defaultLayers).every(Boolean)).toBe(true);
  });
});

describe('useSettingsStore — CONFIG-03: defaultPreset', () => {
  beforeEach(resetStore);

  it('initial defaultPreset is "normal"', () => {
    expect(useSettingsStore.getState().defaultPreset).toBe('normal');
  });

  it('setDefaultPreset("nvg") sets defaultPreset to "nvg"', () => {
    useSettingsStore.getState().setDefaultPreset('nvg');
    expect(useSettingsStore.getState().defaultPreset).toBe('nvg');
  });

  it('all five VisualPreset values round-trip correctly', () => {
    const presets = ['normal', 'nvg', 'crt', 'flir', 'noir'] as const;
    for (const preset of presets) {
      useSettingsStore.getState().setDefaultPreset(preset);
      expect(useSettingsStore.getState().defaultPreset).toBe(preset);
    }
  });
});

describe('useSettingsStore — CONFIG-04: defaultCamera', () => {
  beforeEach(resetStore);

  it('initial defaultCamera is null', () => {
    expect(useSettingsStore.getState().defaultCamera).toBeNull();
  });

  it('setDefaultCamera sets camera position', () => {
    const camera = { lon: 10, lat: 48, altMeters: 5_000_000, pitch: -45 };
    useSettingsStore.getState().setDefaultCamera(camera);
    expect(useSettingsStore.getState().defaultCamera).toEqual(camera);
  });

  it('setDefaultCamera(null) resets to null sentinel', () => {
    useSettingsStore.getState().setDefaultCamera({ lon: 10, lat: 48, altMeters: 5_000_000, pitch: -45 });
    useSettingsStore.getState().setDefaultCamera(null);
    expect(useSettingsStore.getState().defaultCamera).toBeNull();
  });
});

describe('useSettingsStore — CONFIG-05: defaultMode', () => {
  beforeEach(resetStore);

  it('initial defaultMode is "live"', () => {
    expect(useSettingsStore.getState().defaultMode).toBe('live');
  });

  it('setDefaultMode("playback") sets defaultMode', () => {
    useSettingsStore.getState().setDefaultMode('playback');
    expect(useSettingsStore.getState().defaultMode).toBe('playback');
  });

  it('setDefaultMode("live") returns to live', () => {
    useSettingsStore.getState().setDefaultMode('playback');
    useSettingsStore.getState().setDefaultMode('live');
    expect(useSettingsStore.getState().defaultMode).toBe('live');
  });
});

describe('useSettingsStore — CONFIG-06: localStorage persistence', () => {
  beforeEach(resetStore);

  it('setDefaultPreset("crt") is reflected in localStorage', () => {
    useSettingsStore.getState().setDefaultPreset('crt');
    const stored = JSON.parse(localStorage.getItem('globe-settings')!);
    expect(stored.state.defaultPreset).toBe('crt');
  });

  it('setDefaultLayers is reflected in localStorage', () => {
    useSettingsStore.getState().setDefaultLayers({
      satellites: false,
      aircraft: false,
      militaryAircraft: true,
      ships: true,
      gpsJamming: false,
      streetTraffic: false,
    });
    const stored = JSON.parse(localStorage.getItem('globe-settings')!);
    expect(stored.state.defaultLayers.militaryAircraft).toBe(true);
    expect(stored.state.defaultLayers.satellites).toBe(false);
  });

  it('setDefaultCamera is reflected in localStorage', () => {
    const camera = { lon: -73.9, lat: 40.7, altMeters: 1_000_000, pitch: -60 };
    useSettingsStore.getState().setDefaultCamera(camera);
    const stored = JSON.parse(localStorage.getItem('globe-settings')!);
    expect(stored.state.defaultCamera).toEqual(camera);
  });

  it('setDefaultMode is reflected in localStorage', () => {
    useSettingsStore.getState().setDefaultMode('playback');
    const stored = JSON.parse(localStorage.getItem('globe-settings')!);
    expect(stored.state.defaultMode).toBe('playback');
  });
});
