import { create } from 'zustand';
import { sampleDocument } from '../model/document';
import type { Document } from '../model/document';
import { writeStyleDeclaration, writeMarkupAttribute } from '../model/edit';
import type { EditResult } from '../model/edit';
import type { ElementRef } from '../model/markup';

/**
 * Holds the source-of-truth buffers, plus the write-path actions UI controls
 * call (Phase 4.2). Edits are computed by pure model/edit.ts functions; the
 * store only applies the resulting buffers (and reports failures back so the
 * control can surface them).
 */
interface DocumentState extends Document {
  setMarkup: (markup: string) => void;
  setStyles: (styles: string) => void;
  setDocument: (document: Document) => void;
  /** Write a CSS property for an element (styles buffer; may assign an id in markup). */
  applyStyleEdit: (ref: ElementRef, property: string, value: string) => EditResult;
  /** Write an element attribute (markup buffer). */
  applyAttributeEdit: (ref: ElementRef, attribute: string, value: string) => EditResult;
}

export const useDocumentStore = create<DocumentState>((set, get) => ({
  ...sampleDocument(),
  setMarkup: (markup) => set({ markup }),
  setStyles: (styles) => set({ styles }),
  setDocument: ({ markup, styles }) => set({ markup, styles }),
  applyStyleEdit: (ref, property, value) => {
    const { markup, styles } = get();
    const result = writeStyleDeclaration({ markup, styles }, ref, property, value);
    if (result.ok) set(result.document);
    return result;
  },
  applyAttributeEdit: (ref, attribute, value) => {
    const { markup, styles } = get();
    const result = writeMarkupAttribute({ markup, styles }, ref, attribute, value);
    if (result.ok) set(result.document);
    return result;
  },
}));
