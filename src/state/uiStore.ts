import { create } from 'zustand';

export type CenterTab = 'preview' | 'code' | 'split';

/** Transient UI state (active tabs, later: playhead, zoom). Never document data. */
interface UiState {
  centerTab: CenterTab;
  setCenterTab: (tab: CenterTab) => void;
}

export const useUiStore = create<UiState>((set) => ({
  centerTab: 'preview',
  setCenterTab: (centerTab) => set({ centerTab }),
}));
