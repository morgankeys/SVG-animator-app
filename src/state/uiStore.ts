import { create } from 'zustand';

export type CenterTab = 'preview' | 'code' | 'split';
export type RightTab = 'rules' | 'code';

/** Transient UI state (active tabs, later: playhead, zoom). Never document data. */
interface UiState {
  centerTab: CenterTab;
  setCenterTab: (tab: CenterTab) => void;
  rightTab: RightTab;
  setRightTab: (tab: RightTab) => void;
}

export const useUiStore = create<UiState>((set) => ({
  centerTab: 'preview',
  setCenterTab: (centerTab) => set({ centerTab }),
  rightTab: 'rules',
  setRightTab: (rightTab) => set({ rightTab }),
}));
