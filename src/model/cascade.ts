/**
 * Cascade resolution (docs/css-engine.md): given the CSS AST and an element,
 * compute each property's winning declaration plus provenance and competitors.
 *
 * Matching is delegated to element.matches() — the element can come from a
 * detached DOMParser document (pure, testable). Computed values need a live
 * element in a rendered document (the sandbox); pass it when available.
 */
import type { Root, Rule, Declaration } from '../lib/postcss';
import { specificity, compareSpecificity } from './specificity';
import type { Specificity } from './specificity';

export interface RuleSource {
  selector: string; // the rule's full selector as written
  ruleIndex: number; // walk order in the AST (stable within one projection)
  declIndex: number;
  important: boolean;
}

export interface EffectiveProperty {
  property: string;
  /** The winning declared value. */
  value: string;
  /** Resolved value from getComputedStyle, '' when no live element was given. */
  computed: string;
  /** null when the winner is the element's inline style attribute. */
  source: RuleSource | null;
  /** Other matching declarations of this property (→ inline warning). */
  competing: Array<{ selector: string; value: string }>;
  /** Safe to write back via the AST? Inline styles are markup-owned. */
  editable: boolean;
}

interface Candidate {
  value: string;
  important: boolean;
  inline: boolean;
  spec: Specificity;
  order: number;
  source: RuleSource | null;
}

const INLINE_SELECTOR = 'style attribute';

/**
 * Resolve all properties declared anywhere relevant to `element`.
 * `liveElement` (sandbox DOM) supplies computed values when provided.
 */
export function resolveEffectiveProperties(
  ast: Root,
  element: Element,
  liveElement?: Element,
): Map<string, EffectiveProperty> {
  const candidates = collectCandidates(ast, element);
  const computedSource = liveElement ?? element;
  const view = computedSource.ownerDocument?.defaultView;
  const computedStyle = view ? view.getComputedStyle(computedSource) : null;

  const result = new Map<string, EffectiveProperty>();
  for (const [property, list] of candidates) {
    list.sort(byCascade); // strongest first
    const winner = list[0];
    result.set(property, {
      property,
      value: winner.value,
      computed: computedStyle?.getPropertyValue(property) ?? '',
      source: winner.source,
      competing: list.slice(1).map((c) => ({
        selector: c.source?.selector ?? INLINE_SELECTOR,
        value: c.value,
      })),
      editable: !winner.inline,
    });
  }
  return result;
}

function collectCandidates(ast: Root, element: Element): Map<string, Candidate[]> {
  const candidates = new Map<string, Candidate[]>();
  let order = 0;
  let ruleIndex = -1;

  const add = (property: string, candidate: Candidate) => {
    const list = candidates.get(property) ?? [];
    list.push(candidate);
    candidates.set(property, list);
  };

  ast.walkRules((rule) => {
    ruleIndex += 1;
    if (isKeyframeBlock(rule)) return;
    const spec = matchedSpecificity(element, rule);
    if (!spec) return;

    let declIndex = -1;
    rule.each((node) => {
      if (node.type !== 'decl') return;
      declIndex += 1;
      const decl = node as Declaration;
      add(decl.prop, {
        value: decl.value,
        important: Boolean(decl.important),
        inline: false,
        spec,
        order: order++,
        source: {
          selector: rule.selector,
          ruleIndex,
          declIndex,
          important: Boolean(decl.important),
        },
      });
    });
  });

  // Inline style attribute: beats author rules of the same importance.
  const inlineStyle = (element as HTMLElement | SVGElement).style;
  if (inlineStyle) {
    for (let i = 0; i < inlineStyle.length; i++) {
      const property = inlineStyle.item(i);
      add(property, {
        value: inlineStyle.getPropertyValue(property),
        important: inlineStyle.getPropertyPriority(property) === 'important',
        inline: true,
        spec: [0, 0, 0],
        order: order++,
        source: null,
      });
    }
  }

  return candidates;
}

/** Rules inside @keyframes ("0% { … }") are stops, not cascade participants. */
function isKeyframeBlock(rule: Rule): boolean {
  const parent = rule.parent;
  return (
    parent?.type === 'atrule' &&
    /-?keyframes$/i.test((parent as { name?: string }).name ?? '')
  );
}

/**
 * The specificity this rule matches `element` with: the most specific matching
 * selector in the rule's selector list, or null if none match. Invalid
 * selectors are skipped (surfaced later via build warnings, not crashes).
 */
function matchedSpecificity(element: Element, rule: Rule): Specificity | null {
  let best: Specificity | null = null;
  for (const sel of rule.selectors) {
    if (!safeMatches(element, sel)) continue;
    const spec = specificity(sel);
    if (!best || compareSpecificity(spec, best) > 0) best = spec;
  }
  return best;
}

function safeMatches(element: Element, selector: string): boolean {
  try {
    return element.matches(selector);
  } catch {
    return false;
  }
}

/** Cascade order, strongest first: importance bands, then specificity, then source order. */
function byCascade(a: Candidate, b: Candidate): number {
  // Bands: important-inline (3) > important-rule (2) > inline (1) > rule (0).
  const band = (c: Candidate) => (c.important ? 2 : 0) + (c.inline ? 1 : 0);
  if (band(a) !== band(b)) return band(b) - band(a);
  const spec = compareSpecificity(b.spec, a.spec);
  if (spec !== 0) return spec;
  return b.order - a.order; // later declaration wins
}
