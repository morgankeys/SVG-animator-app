import { create } from 'zustand';
import type { ElementRef } from '../model/markup';

/**
 * Shared selection (docs/ui-spec.md): one store consumed by every panel —
 * Elements tree, canvas, Rules panel. Timeline selection joins in Phase 6.
 */
interface SelectionState {
  element: ElementRef | null;
  selectElement: (ref: ElementRef | null) => void;
}

export const useSelectionStore = create<SelectionState>((set) => ({
  element: null,
  selectElement: (element) => set({ element }),
}));
