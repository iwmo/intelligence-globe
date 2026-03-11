import { create } from 'zustand';

export type VisualPreset = 'normal' | 'nvg' | 'crt' | 'flir' | 'noir';

export interface PostProcessUniforms {
  bloomIntensity: number;
  sharpenAmount: number;
  gainAmount: number;
  scanlineSpacing: number;
  pixelationLevel: number;
}

interface AppState {
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  layers: { satellites: boolean; aircraft: boolean };
  setLayerVisible: (layer: keyof AppState['layers'], visible: boolean) => void;
  selectedSatelliteId: number | null;
  setSelectedSatelliteId: (id: number | null) => void;
  tleLastUpdated: string | null;       // ISO8601 string from /api/satellites/freshness
  setTleLastUpdated: (ts: string | null) => void;
  selectedAircraftId: string | null;
  setSelectedAircraftId: (id: string | null) => void;

  satelliteFilter: {
    constellation: string | null;
    altitudeBand: [number, number] | null; // [min_km, max_km]
  };
  setSatelliteFilter: (f: Partial<AppState['satelliteFilter']>) => void;

  aircraftFilter: {
    altitudeRange: [number, number] | null; // [min_m, max_m]
    boundingBox: { minLat: number; maxLat: number; minLon: number; maxLon: number } | null;
  };
  setAircraftFilter: (f: Partial<AppState['aircraftFilter']>) => void;

  aircraftLastUpdated: string | null;
  setAircraftLastUpdated: (ts: string | null) => void;

  // Visual engine slices (Phase 7)
  visualPreset: VisualPreset;
  setVisualPreset: (preset: VisualPreset) => void;

  postProcessUniforms: PostProcessUniforms;
  setPostProcessUniforms: (u: Partial<PostProcessUniforms>) => void;

  cleanUI: boolean;
  setCleanUI: (v: boolean) => void;
}

export const useAppStore = create<AppState>((set) => ({
  sidebarOpen: false,
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  layers: { satellites: true, aircraft: true },
  setLayerVisible: (layer, visible) =>
    set((s) => ({ layers: { ...s.layers, [layer]: visible } })),
  selectedSatelliteId: null,
  setSelectedSatelliteId: (id) => set({ selectedSatelliteId: id }),
  tleLastUpdated: null,
  setTleLastUpdated: (ts) => set({ tleLastUpdated: ts }),
  selectedAircraftId: null,
  setSelectedAircraftId: (id) => set({ selectedAircraftId: id }),

  satelliteFilter: { constellation: null, altitudeBand: null },
  setSatelliteFilter: (f) =>
    set((s) => ({ satelliteFilter: { ...s.satelliteFilter, ...f } })),

  aircraftFilter: { altitudeRange: null, boundingBox: null },
  setAircraftFilter: (f) =>
    set((s) => ({ aircraftFilter: { ...s.aircraftFilter, ...f } })),

  aircraftLastUpdated: null,
  setAircraftLastUpdated: (ts) => set({ aircraftLastUpdated: ts }),

  // Visual engine slices
  visualPreset: 'normal',
  setVisualPreset: (preset) => set({ visualPreset: preset }),

  postProcessUniforms: {
    bloomIntensity: 0.5,
    sharpenAmount: 0.5,
    gainAmount: 1.0,
    scanlineSpacing: 3,
    pixelationLevel: 1,
  },
  setPostProcessUniforms: (u) =>
    set((s) => ({ postProcessUniforms: { ...s.postProcessUniforms, ...u } })),

  cleanUI: false,
  setCleanUI: (v) => set({ cleanUI: v }),
}));
