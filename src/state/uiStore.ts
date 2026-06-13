import { create } from 'zustand';

export type CenterTab = 'preview' | 'code' | 'split';
export type RightTab = 'rules' | 'code';

/** Transient UI state (active tabs, timeline playhead, later: zoom). Never document data. */
interface UiState {
  centerTab: CenterTab;
  setCenterTab: (tab: CenterTab) => void;
  rightTab: RightTab;
  setRightTab: (tab: RightTab) => void;
  /** Timeline transport (Phase 6.3): playhead position + play/pause. */
  playing: boolean;
  setPlaying: (playing: boolean) => void;
  playheadMs: number;
  setPlayheadMs: (playheadMs: number) => void;
}

export const useUiStore = create<UiState>((set) => ({
  centerTab: 'preview',
  setCenterTab: (centerTab) => set({ centerTab }),
  rightTab: 'rules',
  setRightTab: (rightTab) => set({ rightTab }),
  playing: false,
  setPlaying: (playing) => set({ playing }),
  playheadMs: 0,
  setPlayheadMs: (playheadMs) => set({ playheadMs }),
}));
