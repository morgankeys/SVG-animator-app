import { create } from 'zustand';
import { autoMatch } from '../model/match';
import type { Correspondence, CorrespondenceStatus, MatchFrame, NodePath } from '../model/match';
import { linkNodes, unlinkMember, setCanonicalId, setStatus } from '../model/mapping';
import { generateInterpolation } from '../model/generate';
import type { Frame } from '../model/frames';
import { useDocumentStore } from './documentStore';
import { useUiStore } from './uiStore';

/**
 * Correspondence-mapping workspace for the interpolation epic (Phase 10.2).
 * Holds the proposed/edited `Correspondence[]` plus the user's cross-frame node
 * picks for linking. Like `framesStore`, this is import-workspace state — not the
 * undoable document buffers; Phase 12 will fold it into `Document.meta`.
 *
 * All correspondence edits delegate to the pure `model/mapping.ts` helpers;
 * the store only orchestrates and tracks transient selection.
 */
interface InterpolationState {
  correspondences: Correspondence[];
  /** Whether `runAutoMatch` has produced a set (vs. a fresh, empty workspace). */
  matched: boolean;
  /** One picked node per frame, staged for `linkPicks` (frameId → ref). */
  picks: Record<string, NodePath>;
  /** Warnings from the most recent `generate` (surfaced in the mapping UI). */
  warnings: string[];
  /** True once `generate` has written buffers (so the UI can offer "preview"). */
  generated: boolean;

  /** (Re)run the auto-matcher over the current frames, replacing all mappings. */
  runAutoMatch: (frames: MatchFrame[]) => void;
  /** Stage/unstage a node for linking (one pick per frame; re-click clears it). */
  togglePick: (frameId: string, ref: NodePath) => void;
  clearPicks: () => void;
  /** Link all currently picked nodes into one correspondence, then clear picks. */
  linkPicks: () => void;
  unlink: (corrId: string, frameId: string) => void;
  rename: (corrId: string, id: string) => void;
  setStatus: (corrId: string, status: CorrespondenceStatus) => void;
  /**
   * Generate the unified animated document from the current correspondences and
   * write it to the document buffers (one undoable step), then switch to the
   * Preview tab. Records any generation warnings.
   */
  generate: (frames: Frame[]) => void;
  reset: () => void;
}

export const useInterpolationStore = create<InterpolationState>((set) => ({
  correspondences: [],
  matched: false,
  picks: {},
  warnings: [],
  generated: false,

  runAutoMatch: (frames) =>
    set({ correspondences: autoMatch(frames), matched: true, picks: {} }),

  togglePick: (frameId, ref) =>
    set((s) => {
      const picks = { ...s.picks };
      if (picks[frameId] === ref) delete picks[frameId];
      else picks[frameId] = ref;
      return { picks };
    }),

  clearPicks: () => set({ picks: {} }),

  linkPicks: () =>
    set((s) => {
      const frames = Object.keys(s.picks);
      if (frames.length < 2) return s;
      const [anchorFrame, ...rest] = frames;
      const anchorRef = s.picks[anchorFrame];
      let corrs = s.correspondences;
      for (const frameId of rest) {
        corrs = linkNodes(corrs, anchorFrame, anchorRef, frameId, s.picks[frameId]);
      }
      return { correspondences: corrs, picks: {} };
    }),

  unlink: (corrId, frameId) =>
    set((s) => ({ correspondences: unlinkMember(s.correspondences, corrId, frameId) })),

  rename: (corrId, id) =>
    set((s) => ({ correspondences: setCanonicalId(s.correspondences, corrId, id) })),

  setStatus: (corrId, status) =>
    set((s) => ({ correspondences: setStatus(s.correspondences, corrId, status) })),

  generate: (frames) =>
    set((s) => {
      const result = generateInterpolation(frames, s.correspondences);
      // Apply both buffers as one undoable step; the existing animation
      // pipeline then projects the generated animations as Timeline rows.
      useDocumentStore.getState().setDocument({ markup: result.markup, styles: result.styles });
      useUiStore.getState().setCenterTab('preview');
      return { warnings: result.warnings, generated: true };
    }),

  reset: () =>
    set({ correspondences: [], matched: false, picks: {}, warnings: [], generated: false }),
}));
