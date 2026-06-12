/**
 * The write path (docs/architecture.md, docs/css-engine.md): a UI control
 * requests one change; we mutate the owning buffer's AST in place and hand
 * back the new buffer strings. Pure — the document store applies the result.
 */
import type { Document } from './document';
import { resolveRef, setMarkupAttribute, ensureElementId } from './markup';
import type { ElementRef } from './markup';
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
