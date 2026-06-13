import { create } from 'zustand';
import { sampleDocument } from '../model/document';
import type { Document } from '../model/document';
import {
  writeStyleDeclaration,
  writeMarkupAttribute,
  insertShape,
  deleteElement,
  moveElement,
} from '../model/edit';
import type { EditResult, InsertEditResult } from '../model/edit';
import type { ElementRef, MoveDirection } from '../model/markup';
import type { ShapeKind } from '../model/shapes';

/**
 * Holds the source-of-truth buffers, the write-path actions UI controls call
 * (Phase 4.2), and snapshot-based undo/redo (Phase 4.3, docs/architecture.md).
 * Every buffer change funnels through one commit, so history covers UI edits
 * and (later) code edits alike — an undo step restores both buffers at once.
 */
interface DocumentState extends Document {
  /** Buffer snapshots behind / ahead of the present (undo / redo stacks). */
  past: Document[];
  future: Document[];
  setMarkup: (markup: string) => void;
  setStyles: (styles: string) => void;
  setDocument: (document: Document) => void;
  /** Write a CSS property for an element (styles buffer; may assign an id in markup). */
  applyStyleEdit: (ref: ElementRef, property: string, value: string) => EditResult;
  /** Write an element attribute (markup buffer). */
  applyAttributeEdit: (ref: ElementRef, attribute: string, value: string) => EditResult;
  /** Add a shape near the selection (markup buffer); returns the new element's ref. */
  addShape: (kind: ShapeKind, selectedRef: ElementRef | null) => InsertEditResult;
  /** Delete an element and its subtree (markup buffer). */
  deleteElement: (ref: ElementRef) => EditResult;
  /** Reorder an element among its siblings (markup buffer); returns its new ref. */
  moveElement: (ref: ElementRef, direction: MoveDirection) => InsertEditResult;
  /** Restore the previous/next snapshot. False when the stack is empty. */
  undo: () => boolean;
  redo: () => boolean;
}

const HISTORY_LIMIT = 100;

const buffers = ({ markup, styles }: Document): Document => ({ markup, styles });

export const useDocumentStore = create<DocumentState>((set, get) => {
  /** Apply new buffers, recording the present in the undo stack. No-ops record nothing. */
  const commit = (next: Document) =>
    set((s) => {
      if (next.markup === s.markup && next.styles === s.styles) return s;
      return {
        ...next,
        past: [...s.past.slice(-(HISTORY_LIMIT - 1)), buffers(s)],
        future: [],
      };
    });

  return {
    ...sampleDocument(),
    past: [],
    future: [],
    setMarkup: (markup) => commit({ markup, styles: get().styles }),
    setStyles: (styles) => commit({ markup: get().markup, styles }),
    setDocument: (document) => commit(buffers(document)),
    applyStyleEdit: (ref, property, value) => {
      const result = writeStyleDeclaration(buffers(get()), ref, property, value);
      if (result.ok) commit(result.document);
      return result;
    },
    applyAttributeEdit: (ref, attribute, value) => {
      const result = writeMarkupAttribute(buffers(get()), ref, attribute, value);
      if (result.ok) commit(result.document);
      return result;
    },
    addShape: (kind, selectedRef) => {
      const result = insertShape(buffers(get()), kind, selectedRef);
      if (result.ok) commit(result.document);
      return result;
    },
    deleteElement: (ref) => {
      const result = deleteElement(buffers(get()), ref);
      if (result.ok) commit(result.document);
      return result;
    },
    moveElement: (ref, direction) => {
      const result = moveElement(buffers(get()), ref, direction);
      if (result.ok) commit(result.document);
      return result;
    },
    undo: () => {
      if (get().past.length === 0) return false;
      set((s) => ({
        ...s.past[s.past.length - 1],
        past: s.past.slice(0, -1),
        future: [...s.future, buffers(s)],
      }));
      return true;
    },
    redo: () => {
      if (get().future.length === 0) return false;
      set((s) => ({
        ...s.future[s.future.length - 1],
        future: s.future.slice(0, -1),
        past: [...s.past, buffers(s)],
      }));
      return true;
    },
  };
});
