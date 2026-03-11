import { create } from 'zustand';

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
}

export const useAppStore = create<AppState>((set) => ({
  sidebarOpen: false,
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  layers: { satellites: false, aircraft: false },
  setLayerVisible: (layer, visible) =>
    set((s) => ({ layers: { ...s.layers, [layer]: visible } })),
  selectedSatelliteId: null,
  setSelectedSatelliteId: (id) => set({ selectedSatelliteId: id }),
  tleLastUpdated: null,
  setTleLastUpdated: (ts) => set({ tleLastUpdated: ts }),
  selectedAircraftId: null,
  setSelectedAircraftId: (id) => set({ selectedAircraftId: id }),
}));
