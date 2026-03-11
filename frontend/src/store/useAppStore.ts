import { create } from 'zustand';

interface AppState {
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  layers: { satellites: boolean; aircraft: boolean };
  setLayerVisible: (layer: keyof AppState['layers'], visible: boolean) => void;
}

export const useAppStore = create<AppState>((set) => ({
  sidebarOpen: false,
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  layers: { satellites: false, aircraft: false },
  setLayerVisible: (layer, visible) =>
    set((s) => ({ layers: { ...s.layers, [layer]: visible } })),
}));
