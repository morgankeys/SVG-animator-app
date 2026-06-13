/**
 * The write path (docs/architecture.md, docs/css-engine.md): a UI control
 * requests one change; we mutate the owning buffer's AST in place and hand
 * back the new buffer strings. Pure — the document store applies the result.
 */
import type { Document } from './document';
import { resolveRef, setMarkupAttribute, ensureElementId, insertAfter, insertChild } from './markup';
import type { ElementRef } from './markup';
import { createShapeMarkup } from './shapes';
import type { ShapeKind } from './shapes';
import { parseStyles, serializeStyles, setDeclarationValue, createDeclaration } from './styles';
import { resolveEffectiveProperties } from './cascade';

export type EditFailure =
  /** The ref no longer resolves against the markup buffer. */
  | 'element-not-found'
  /** The styles buffer has a syntax error; there is no AST to mutate. */
  | 'styles-unparsable'
  /** The winner is markup-owned (inline style attribute) — see css-engine.md. */
  | 'not-editable'
  /** The element's start tag couldn't be located unambiguously in the buffer. */
  | 'markup-write-failed';

export type EditResult = { ok: true; document: Document } | { ok: false; reason: EditFailure };

export type InsertEditResult =
  | { ok: true; document: Document; ref: ElementRef }
  | { ok: false; reason: EditFailure };

/** Tags a new shape lands *inside* rather than beside (docs/ui-spec.md). */
const CONTAINER_TAGS = new Set(['svg', 'g', 'a', 'switch']);

/**
 * Add a shape to the markup buffer near the current selection: inside it when a
 * container is selected, as its next sibling when a leaf is selected, and inside
 * the first root container (or at the top level) when nothing is selected. The
 * new element's serialized text is spliced into the buffer; we hand back its ref
 * so the caller can select it.
 */
export function insertShape(
  document: Document,
  kind: ShapeKind,
  selectedRef: ElementRef | null,
): InsertEditResult {
  const elementText = createShapeMarkup(kind);
  const body = parseDom(document.markup);
  const selected = selectedRef ? resolveRef(body, selectedRef) : null;

  const inserted =
    selected && selectedRef
      ? isContainer(selected)
        ? insertChild(document.markup, selectedRef, elementText)
        : insertAfter(document.markup, selectedRef, elementText)
      : insertChild(document.markup, defaultParentRef(body), elementText);

  if (!inserted) return { ok: false, reason: 'markup-write-failed' };
  return {
    ok: true,
    document: { markup: inserted.markup, styles: document.styles },
    ref: inserted.ref,
  };
}

function isContainer(element: Element): boolean {
  return CONTAINER_TAGS.has(element.tagName.toLowerCase());
}

/** Where shapes go with no selection: the first root container, else top level (''). */
function defaultParentRef(body: Element): ElementRef {
  const roots = Array.from(body.children);
  for (let i = 0; i < roots.length; i++) {
    if (isContainer(roots[i])) return String(i);
  }
  return '';
}

/**
 * Write a CSS property for the referenced element into the styles buffer:
 * mutate the cascade winner when it's editable, otherwise create the
 * declaration in the write-target rule — assigning the element an id in the
 * markup buffer first when it needs one (the only case where this touches
 * markup).
 */
export function writeStyleDeclaration(
  document: Document,
  ref: ElementRef,
  property: string,
  value: string,
): EditResult {
  let element = resolveRef(parseDom(document.markup), ref);
  if (!element) return { ok: false, reason: 'element-not-found' };

  let ast;
  try {
    ast = parseStyles(document.styles);
  } catch {
    return { ok: false, reason: 'styles-unparsable' };
  }

  const entry = resolveEffectiveProperties(ast, element).get(property);
  if (entry && !entry.editable) return { ok: false, reason: 'not-editable' };
  if (entry?.source) {
    setDeclarationValue(ast, entry.source, value);
    return { ok: true, document: { markup: document.markup, styles: serializeStyles(ast) } };
  }

  let markup = document.markup;
  if (!element.id) {
    const ensured = ensureElementId(markup, ref);
    if (!ensured) return { ok: false, reason: 'markup-write-failed' };
    markup = ensured.markup;
    element = resolveRef(parseDom(markup), ref)!; // re-resolve so the id is visible
  }
  const created = createDeclaration(ast, element, property, value);
  if (!created.ok) return { ok: false, reason: 'markup-write-failed' };
  return { ok: true, document: { markup, styles: serializeStyles(ast) } };
}

/** Write an element attribute (SVG geometry, ids) into the markup buffer. */
export function writeMarkupAttribute(
  document: Document,
  ref: ElementRef,
  attribute: string,
  value: string,
): EditResult {
  if (!resolveRef(parseDom(document.markup), ref)) {
    return { ok: false, reason: 'element-not-found' };
  }
  const markup = setMarkupAttribute(document.markup, ref, attribute, value);
  if (markup === null) return { ok: false, reason: 'markup-write-failed' };
  return { ok: true, document: { markup, styles: document.styles } };
}

function parseDom(markup: string): Element {
  return new DOMParser().parseFromString(markup, 'text/html').body;
}
