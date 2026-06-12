import { create } from 'zustand';
import { sampleDocument } from '../model/document';
import type { Document } from '../model/document';

/**
 * Holds the source-of-truth buffers. Getters/setters only (Phase 1.1) —
 * derived projections (ASTs, trees) arrive with Phases 1.2–1.3.
 */
interface DocumentState extends Document {
  setMarkup: (markup: string) => void;
  setStyles: (styles: string) => void;
  setDocument: (document: Document) => void;
}

export const useDocumentStore = create<DocumentState>((set) => ({
  ...sampleDocument(),
  setMarkup: (markup) => set({ markup }),
  setStyles: (styles) => set({ styles }),
  setDocument: ({ markup, styles }) => set({ markup, styles }),
}));
