import { create } from 'zustand';
import { autoMatch } from '../model/match';
import type { Correspondence, CorrespondenceStatus, MatchFrame, NodePath } from '../model/match';
import { linkNodes, unlinkMember, setCanonicalId, setStatus } from '../model/mapping';

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
  reset: () => void;
}

export const useInterpolationStore = create<InterpolationState>((set) => ({
  correspondences: [],
  matched: false,
  picks: {},

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

  reset: () => set({ correspondences: [], matched: false, picks: {} }),
}));
