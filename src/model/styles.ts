/**
 * Style pipeline (docs/css-engine.md): SCSS buffer --sass--> CSS for rendering,
 * and CSS --postcss--> AST for inspection/editing.
 *
 * Two distinct parses, two purposes:
 * - compileStyles: the renderable CSS injected into the sandbox. Sass reformats
 *   its output, so this is NOT the editing surface.
 * - parseStyles/serializeStyles: the canonical editing AST, parsed straight from
 *   the buffer so untouched raws (whitespace, comments) round-trip exactly
 *   (architecture invariant 3). While the buffer is plain CSS (Phases 1-7) this
 *   AST also matches what renders; the SCSS authoring layer revisits that in
 *   Phase 8.
 */
import { compileScss, isSassException } from '../lib/sass';
import { parseCss, stringifyCss, createCssRule } from '../lib/postcss';
import type { Root, Rule, Declaration } from '../lib/postcss';

export interface StyleError {
  message: string;
  line?: number;
  column?: number;
}

export type CompileResult = { ok: true; css: string } | { ok: false; error: StyleError };

/** Compile the styles buffer (SCSS) to renderable CSS. Errors are surfaced, not thrown. */
export function compileStyles(scss: string): CompileResult {
  try {
    return { ok: true, css: compileScss(scss) };
  } catch (error) {
    if (isSassException(error)) {
      const start = error.span.start;
      return {
        ok: false,
        // sass spans are 0-based; report 1-based like editors do.
        error: { message: error.sassMessage, line: start.line + 1, column: start.column + 1 },
      };
    }
    return { ok: false, error: { message: String(error) } };
  }
}

/** Parse CSS into the canonical editing AST. */
export function parseStyles(css: string): Root {
  return parseCss(css);
}

/** Serialize the AST back to the buffer. Exact round-trip for untouched nodes. */
export function serializeStyles(ast: Root): string {
  return stringifyCss(ast);
}

/**
 * Location of a declaration in the AST, in the same walk order the cascade
 * reports (`RuleSource`): ruleIndex counts ALL rules in walkRules order
 * (keyframe stop blocks included), declIndex counts only the rule's
 * declaration children. Addresses are only valid against the AST projection
 * they came from — re-parse and re-resolve after every buffer change.
 */
export interface DeclarationAddress {
  ruleIndex: number;
  declIndex: number;
}

/** Locate the Declaration node an address points at, or null if stale. */
export function findDeclaration(ast: Root, address: DeclarationAddress): Declaration | null {
  let found: Declaration | null = null;
  let ruleIndex = -1;
  ast.walkRules((rule) => {
    ruleIndex += 1;
    if (ruleIndex !== address.ruleIndex) return undefined;
    let declIndex = -1;
    rule.each((node) => {
      if (node.type !== 'decl') return;
      declIndex += 1;
      if (declIndex === address.declIndex) found = node;
    });
    return false; // target rule visited; stop the walk
  });
  return found;
}

/**
 * Write path step 1 (docs/css-engine.md): mutate an existing declaration's
 * value in place; untouched raws are preserved. False if the address is stale.
 */
export function setDeclarationValue(
  ast: Root,
  address: DeclarationAddress,
  value: string,
): boolean {
  const decl = findDeclaration(ast, address);
  if (!decl) return false;
  decl.value = value;
  return true;
}

export type CreateDeclarationResult =
  | { ok: true; selector: string; createdRule: boolean }
  | { ok: false; reason: 'needs-id' };

/**
 * Write path step 2 (docs/css-engine.md): create `property` in the write-target
 * rule for `element` (updating it in place if the target already declares it).
 *
 * The target is the LAST top-level rule whose selector is exactly the element's
 * `#id` — the one rule that can't restyle siblings, and the position where a
 * new declaration wins source-order ties. Shared selectors (`circle`), selector
 * lists, and rules nested inside at-rules (conditional) never qualify; a fresh
 * `#id` rule is appended instead. Elements without an id have no stable write
 * target: the caller must assign one in the markup buffer first, then retry.
 */
export function createDeclaration(
  ast: Root,
  element: Element,
  property: string,
  value: string,
): CreateDeclarationResult {
  if (!element.id) return { ok: false, reason: 'needs-id' };
  const selector = `#${cssEscape(element.id)}`;

  let target: Rule | null = null;
  ast.each((node) => {
    if (node.type === 'rule' && node.selector.trim() === selector) target = node;
  });

  const createdRule = !target;
  if (!target) {
    target = createCssRule(selector);
    ast.append(target);
  }

  let existing: Declaration | null = null;
  target.each((node) => {
    if (node.type === 'decl' && node.prop === property) existing = node;
  });
  if (existing) (existing as Declaration).value = value;
  else target.append({ prop: property, value });

  return { ok: true, selector, createdRule };
}

function cssEscape(id: string): string {
  return typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(id) : id;
}
