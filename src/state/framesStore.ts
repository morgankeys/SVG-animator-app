import { create } from 'zustand';
import type { Frame } from '../model/frames';

/**
 * Imported SVG frames for the interpolation epic (Phase 9). Kept separate from
 * the document buffers and their undo history — frames are import-workspace
 * state, not the source-of-truth markup/styles. The array order is the frame
 * order (later the timeline order); Phase 12 will persist it into Document meta.
 */
interface FramesState {
  frames: Frame[];
  /** Append imported frames in pick/drop order. */
  addFrames: (frames: Frame[]) => void;
  removeFrame: (id: string) => void;
  clearFrames: () => void;
}

export const useFramesStore = create<FramesState>((set) => ({
  frames: [],
  addFrames: (frames) => set((s) => ({ frames: [...s.frames, ...frames] })),
  removeFrame: (id) => set((s) => ({ frames: s.frames.filter((f) => f.id !== id) })),
  clearFrames: () => set({ frames: [] }),
}));
