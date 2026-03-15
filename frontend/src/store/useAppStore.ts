import { create } from 'zustand';

export type VisualPreset = 'normal' | 'nvg' | 'crt' | 'flir' | 'noir';

export interface ViewportBbox {
  minLat: number;
  maxLat: number;
  minLon: number;
  maxLon: number;
}

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
  layers: { satellites: boolean; aircraft: boolean; militaryAircraft: boolean; ships: boolean; gpsJamming: boolean; streetTraffic: boolean; gdelt: boolean };
  setLayerVisible: (layer: keyof AppState['layers'], visible: boolean) => void;
  selectedSatelliteId: number | null;
  setSelectedSatelliteId: (id: number | null) => void;
  tleLastUpdated: string | null;       // ISO8601 string from /api/satellites/freshness
  setTleLastUpdated: (ts: string | null) => void;
  selectedAircraftId: string | null;
  setSelectedAircraftId: (id: string | null) => void;
  selectedMilitaryId: string | null;
  setSelectedMilitaryId: (id: string | null) => void;
  selectedShipId: string | null;
  setSelectedShipId: (id: string | null) => void;

  satelliteFilter: {
    constellation: string[] | null;
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

  // Replay engine slice (Phase 11)
  replayMode: 'live' | 'playback';
  setReplayMode: (mode: 'live' | 'playback') => void;
  replayTs: number;
  setReplayTs: (ts: number) => void;
  replaySpeedMultiplier: number;
  setReplaySpeedMultiplier: (s: number) => void;
  replayWindowStart: number | null;
  replayWindowEnd: number | null;
  setReplayWindow: (start: number, end: number) => void;

  // Phase 23: isPlaying promoted from PlaybackBar local state
  isPlaying: boolean;
  setIsPlaying: (v: boolean | ((prev: boolean) => boolean)) => void;

  // Phase 12 slices
  areaOfInterest: { lat: number; lon: number } | null;
  setAreaOfInterest: (aoi: { lat: number; lon: number } | null) => void;
  activeCategories: string[];
  setActiveCategories: (cats: string[]) => void;
  toggleCategory: (cat: string) => void;

  // Phase 13 slices
  sidebarSections: {
    layers: boolean;
    filters: boolean;
    search: boolean;
    visualEngine: boolean;
  };
  toggleSidebarSection: (section: keyof AppState['sidebarSections']) => void;

  // Phase 33: viewport bbox for culled data loading
  viewportBbox: ViewportBbox | null;
  setViewportBbox: (bbox: ViewportBbox | null) => void;

  // Phase 35: GDELT slices
  gdeltQuadClassFilter: number[];
  setGdeltQuadClassFilter: (classes: number[]) => void;
  toggleGdeltQuadClass: (qc: number) => void;
  selectedGdeltEventId: string | null;
  setSelectedGdeltEventId: (id: string | null) => void;
  gdeltOsintPrefill: { lat: number; lon: number; ts: string; sourceUrl: string | null } | null;
  setGdeltOsintPrefill: (v: { lat: number; lon: number; ts: string; sourceUrl: string | null } | null) => void;
}

export const useAppStore = create<AppState>((set) => ({
  sidebarOpen: false,
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  layers: { satellites: true, aircraft: true, militaryAircraft: false, ships: false, gpsJamming: false, streetTraffic: false, gdelt: false },
  setLayerVisible: (layer, visible) =>
    set((s) => ({ layers: { ...s.layers, [layer]: visible } })),
  selectedSatelliteId: null,
  setSelectedSatelliteId: (id) => set({ selectedSatelliteId: id }),
  tleLastUpdated: null,
  setTleLastUpdated: (ts) => set({ tleLastUpdated: ts }),
  selectedAircraftId: null,
  setSelectedAircraftId: (id) => set({ selectedAircraftId: id }),
  selectedMilitaryId: null,
  setSelectedMilitaryId: (id) => set({ selectedMilitaryId: id }),
  selectedShipId: null,
  setSelectedShipId: (id) => set({ selectedShipId: id }),

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

  // Replay engine slice
  replayMode: 'live',
  setReplayMode: (mode) => set({ replayMode: mode }),
  replayTs: Date.now(),
  setReplayTs: (ts) => set({ replayTs: ts }),
  replaySpeedMultiplier: 60,
  setReplaySpeedMultiplier: (s) => set({ replaySpeedMultiplier: s }),
  replayWindowStart: null,
  replayWindowEnd: null,
  setReplayWindow: (start, end) => set({ replayWindowStart: start, replayWindowEnd: end }),

  // Phase 23
  isPlaying: false,
  setIsPlaying: (v) =>
    set((s) => ({ isPlaying: typeof v === 'function' ? v(s.isPlaying) : v })),

  // Phase 12 slices
  areaOfInterest: null,
  setAreaOfInterest: (aoi) => set({ areaOfInterest: aoi }),
  activeCategories: [],
  setActiveCategories: (cats) => set({ activeCategories: cats }),
  toggleCategory: (cat) => set((s) => ({
    activeCategories: s.activeCategories.includes(cat)
      ? s.activeCategories.filter(c => c !== cat)
      : [...s.activeCategories, cat],
  })),

  // Phase 13 slices
  sidebarSections: { layers: true, filters: true, search: true, visualEngine: true },
  toggleSidebarSection: (section) =>
    set((s) => ({
      sidebarSections: {
        ...s.sidebarSections,
        [section]: !s.sidebarSections[section],
      },
    })),

  // Phase 33: viewport bbox
  viewportBbox: null,
  setViewportBbox: (bbox) => set({ viewportBbox: bbox }),

  // Phase 35: GDELT slices
  gdeltQuadClassFilter: [1, 2, 3, 4],
  setGdeltQuadClassFilter: (classes) => set({ gdeltQuadClassFilter: classes }),
  toggleGdeltQuadClass: (qc) => set((s) => ({
    gdeltQuadClassFilter: s.gdeltQuadClassFilter.includes(qc)
      ? s.gdeltQuadClassFilter.filter(c => c !== qc)
      : [...s.gdeltQuadClassFilter, qc],
  })),
  selectedGdeltEventId: null,
  setSelectedGdeltEventId: (id) => set({ selectedGdeltEventId: id }),
  gdeltOsintPrefill: null,
  setGdeltOsintPrefill: (v) => set({ gdeltOsintPrefill: v }),
}));
