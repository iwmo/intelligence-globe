import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface GdeltPrefsState {
  gdeltVisible: boolean;
  gdeltQuadClassFilter: number[];
  setGdeltVisible: (v: boolean) => void;
  setGdeltQuadClassFilter: (classes: number[]) => void;
}

export const useGdeltPrefsStore = create<GdeltPrefsState>()(
  persist(
    (set) => ({
      gdeltVisible: false,
      gdeltQuadClassFilter: [1, 2, 3, 4],
      setGdeltVisible: (v) => set({ gdeltVisible: v }),
      setGdeltQuadClassFilter: (classes) => set({ gdeltQuadClassFilter: classes }),
    }),
    { name: 'globe-gdelt-prefs' }
  )
);
