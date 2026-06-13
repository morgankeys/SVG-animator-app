import { create } from 'zustand';
import type { ElementRef } from '../model/markup';

/** A selected Timeline row, optionally narrowed to one keyframe stop. */
export interface TimelineSelection {
  rowId: string;
  /** Index into the row's stops, or null when the whole row is selected. */
  stopIndex: number | null;
}

/**
 * Shared selection (docs/ui-spec.md): one store consumed by every panel —
 * Elements tree, canvas, Rules panel, and (Phase 6) the Timeline. `element`
 * and `timeline` are independent axes; selecting a Timeline row also points
 * `element` at that row's element so the Rules panel follows along.
 */
interface SelectionState {
  element: ElementRef | null;
  selectElement: (ref: ElementRef | null) => void;
  timeline: TimelineSelection | null;
  selectTimeline: (selection: TimelineSelection | null) => void;
}

export const useSelectionStore = create<SelectionState>((set) => ({
  element: null,
  selectElement: (element) => set({ element }),
  timeline: null,
  selectTimeline: (timeline) => set({ timeline }),
}));
