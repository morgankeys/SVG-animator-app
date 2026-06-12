/**
 * Typed bridge to the sandbox iframe. Same-origin, so we reach into
 * contentDocument directly. Grows with the phases: matches/getComputedStyle
 * (3.1), getAnimations (6.3).
 *
 * Selection highlighting annotates the LIVE render DOM only (a data attribute
 * + one app-owned style tag) — the buffers stay untouched; this is
 * projection-side state, not document state.
 */
import { resolveRef, elementToRef } from '../model/markup';
import type { ElementRef } from '../model/markup';

const SELECTED_ATTR = 'data-app-selected';
const STYLE_ID = '__app-selection-style';
const SELECTION_CSS = `[${SELECTED_ATTR}] { outline: 2px solid #4f9cf9; outline-offset: 1px; }`;

export interface SandboxBridge {
  /** The rendered document's body, or null before the iframe first loads. */
  getBody(): HTMLElement | null;
  /** Outline the element for `ref`; null clears. Re-apply after each frame load. */
  highlight(ref: ElementRef | null): void;
  /** Subscribe to canvas clicks as ElementRefs (null = empty space). Returns unsubscribe. */
  onSelect(callback: (ref: ElementRef | null) => void): () => void;
}

export function createBridge(iframe: HTMLIFrameElement): SandboxBridge {
  const getDoc = () => iframe.contentDocument;

  return {
    getBody: () => getDoc()?.body ?? null,

    highlight(ref) {
      const doc = getDoc();
      if (!doc?.body) return;
      ensureSelectionStyle(doc);
      for (const el of Array.from(doc.querySelectorAll(`[${SELECTED_ATTR}]`))) {
        el.removeAttribute(SELECTED_ATTR);
      }
      if (ref) resolveRef(doc.body, ref)?.setAttribute(SELECTED_ATTR, '');
    },

    onSelect(callback) {
      const doc = getDoc();
      if (!doc) return () => {};
      const onClick = (event: MouseEvent) => {
        // nodeType, not instanceof: iframe nodes belong to another realm's classes.
        const target = event.target as Node | null;
        if (
          !target ||
          target.nodeType !== Node.ELEMENT_NODE ||
          target === doc.body ||
          target === doc.documentElement
        ) {
          callback(null);
          return;
        }
        callback(elementToRef(doc.body, target as Element));
      };
      doc.addEventListener('click', onClick);
      return () => doc.removeEventListener('click', onClick);
    },
  };
}

function ensureSelectionStyle(doc: Document): void {
  if (doc.getElementById(STYLE_ID)) return;
  const style = doc.createElement('style');
  style.id = STYLE_ID;
  style.textContent = SELECTION_CSS;
  doc.head.appendChild(style);
}
