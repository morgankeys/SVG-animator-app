/**
 * Animation parsing (docs/css-engine.md): project the styles AST into the
 * Timeline's model — one row per applied `animation`, with stops at the
 * referenced `@keyframes` percentages. Pure and jsdom-testable; the Timeline UI
 * (6.2) renders these rows and the Web Animations API (6.3) drives playback.
 *
 * Which animations apply to which element is a cascade question, so we lean on
 * the same resolver the Rules panel uses (model/cascade.ts) rather than
 * re-deriving it. Transitions (Phase 7) share the row shape: one row per
 * transitioned property, drawn as a bar (delay → delay+duration) with no stops,
 * linking to its `transition` declaration instead of a `@keyframes` block.
 */
import type { Root, AtRule, Rule, Declaration } from '../lib/postcss';
import { resolveEffectiveProperties } from './cascade';
import type { EffectiveProperty, RuleSource } from './cascade';
import { elementToRef } from './markup';
import type { ElementRef } from './markup';

/** A character span in the styles buffer (for linking to the Code tab, 6.4). */
export interface TextRange {
  from: number;
  to: number;
}

export interface KeyframeStop {
  /** 0–100; `from`→0, `to`→100. */
  percent: number;
  /** The stop block (`50% { … }`) in the styles buffer. */
  range: TextRange;
}

export interface Keyframes {
  name: string;
  /** The whole `@keyframes name { … }` block. */
  range: TextRange;
  /** Stops sorted by ascending percent (a `0%, 100%` selector yields two). */
  stops: KeyframeStop[];
}

/** A single resolved `animation` definition (one comma-segment of the value). */
export interface AnimationSpec {
  name: string;
  durationMs: number;
  delayMs: number;
  /** Iteration count; `Infinity` for `infinite`. */
  iterations: number;
  timingFunction: string;
  direction: string;
  fillMode: string;
}

export interface TimelineStop {
  atPercent: number;
  range: TextRange;
}

/** A single resolved `transition` definition (one comma-segment of the value). */
export interface TransitionSpec {
  /** The transitioned property (`opacity`, `all`, …) — also the row label. */
  property: string;
  durationMs: number;
  delayMs: number;
  timingFunction: string;
}

/**
 * One Timeline track: a single `animation` or `transition` applied to a single
 * element. Animations carry `@keyframes` stops; transitions have none and link
 * to their `transition` declaration via `declarationRange` instead.
 */
export interface TimelineRow {
  kind: 'animation' | 'transition';
  /**
   * Stable within one projection. Animations: `${elementRef}::${index}`;
   * transitions: `${elementRef}::t${index}` (so the two kinds never collide).
   */
  rowId: string;
  elementRef: ElementRef;
  /** The animation name or transitioned property (also the row label). */
  label: string;
  durationMs: number;
  delayMs: number;
  /** Iteration count; `Infinity` for `infinite`. Always 1 for transitions. */
  iterations: number;
  /** The referenced `@keyframes` block (animations), null for transitions/missing. */
  keyframesRange: TextRange | null;
  /** The defining declaration to spotlight (transitions); null for animations. */
  declarationRange: TextRange | null;
  stops: TimelineStop[];
}

// Shorthand keyword vocabularies (CSS animation shorthand grammar).
const DIRECTION_KEYWORDS = new Set(['normal', 'reverse', 'alternate', 'alternate-reverse']);
const FILL_KEYWORDS = new Set(['none', 'forwards', 'backwards', 'both']);
const PLAY_STATE_KEYWORDS = new Set(['running', 'paused']);
const TIMING_KEYWORDS = new Set([
  'linear',
  'ease',
  'ease-in',
  'ease-out',
  'ease-in-out',
  'step-start',
  'step-end',
]);

const ANIMATION_DEFAULTS = {
  durationMs: 0,
  delayMs: 0,
  iterations: 1,
  timingFunction: 'ease',
  direction: 'normal',
  fillMode: 'none',
};

/**
 * Build all animation rows for the document: walk every animatable element
 * (`<defs>` subtrees excluded, matching the Elements tree), resolve its applied
 * animations through the cascade, and pair each with its `@keyframes` stops.
 */
export function buildTimelineRows(ast: Root, body: ParentNode): TimelineRow[] {
  const keyframes = collectKeyframes(ast);
  const rows: TimelineRow[] = [];
  for (const element of animatableElements(body)) {
    const ref = elementToRef(body, element);
    if (ref === null) continue;
    const effective = resolveEffectiveProperties(ast, element);
    resolveElementAnimations(effective).forEach((spec, index) => {
      const kf = keyframes.get(spec.name) ?? null;
      rows.push({
        kind: 'animation',
        rowId: `${ref}::${index}`,
        elementRef: ref,
        label: spec.name,
        durationMs: spec.durationMs,
        delayMs: spec.delayMs,
        iterations: spec.iterations,
        keyframesRange: kf?.range ?? null,
        declarationRange: null,
        stops: kf ? kf.stops.map((s) => ({ atPercent: s.percent, range: s.range })) : [],
      });
    });
    // Each transitioned property is its own row, linking to where it's declared.
    const transitionSource = transitionDeclarationSource(effective);
    resolveElementTransitions(effective).forEach((spec, index) => {
      rows.push({
        kind: 'transition',
        rowId: `${ref}::t${index}`,
        elementRef: ref,
        label: spec.property,
        durationMs: spec.durationMs,
        delayMs: spec.delayMs,
        iterations: 1,
        keyframesRange: null,
        declarationRange: declarationRange(ast, transitionSource),
        stops: [],
      });
    });
  }
  return rows;
}

/**
 * The declaration we link a transition row to: prefer the `transition`
 * shorthand, else the first present longhand. Inline winners have no AST node.
 */
function transitionDeclarationSource(
  effective: Map<string, EffectiveProperty>,
): RuleSource | null {
  for (const property of [
    'transition',
    'transition-property',
    'transition-duration',
    'transition-delay',
    'transition-timing-function',
  ]) {
    const prop = effective.get(property);
    if (prop) return prop.source;
  }
  return null;
}

/**
 * Resolve a declaration's styles-buffer span from its cascade `source`. Walks
 * rules in the same order cascade.ts indexes them (every rule, `@keyframes`
 * stop blocks included), then counts declarations to `declIndex`.
 */
function declarationRange(ast: Root, source: RuleSource | null): TextRange | null {
  if (!source) return null;
  let ruleIndex = -1;
  let found: TextRange | null = null;
  ast.walkRules((rule) => {
    ruleIndex += 1;
    if (ruleIndex !== source.ruleIndex) return;
    let declIndex = -1;
    rule.each((node) => {
      if (node.type !== 'decl') return;
      declIndex += 1;
      if (declIndex === source.declIndex) found = rangeOf(node as Declaration);
    });
  });
  return found;
}

/** Collect every `@keyframes` block by name (last definition wins, as in CSS). */
export function collectKeyframes(ast: Root): Map<string, Keyframes> {
  const map = new Map<string, Keyframes>();
  ast.walkAtRules((at) => {
    if (!/keyframes$/i.test(at.name)) return; // also matches @-webkit-keyframes
    const name = at.params.trim();
    if (!name) return;
    map.set(name, { name, range: rangeOf(at), stops: collectStops(at) });
  });
  return map;
}

function collectStops(at: AtRule): KeyframeStop[] {
  const stops: KeyframeStop[] = [];
  at.each((node) => {
    if (node.type !== 'rule') return;
    const range = rangeOf(node as Rule);
    for (const selector of (node as Rule).selectors) {
      const percent = parsePercent(selector);
      if (percent !== null) stops.push({ percent, range });
    }
  });
  return stops.sort((a, b) => a.percent - b.percent);
}

function parsePercent(selector: string): number | null {
  const token = selector.trim().toLowerCase();
  if (token === 'from') return 0;
  if (token === 'to') return 100;
  const match = /^([\d.]+)%$/.exec(token);
  return match ? parseFloat(match[1]) : null;
}

function rangeOf(node: AtRule | Rule | Declaration): TextRange {
  return { from: node.source?.start?.offset ?? 0, to: node.source?.end?.offset ?? 0 };
}

/**
 * Resolve the animations applied to one element from its effective declarations:
 * parse the `animation` shorthand into per-segment specs, then let any present
 * longhand (`animation-duration`, …) override the matching segment. (Full
 * cross-shorthand source-order resolution and value cycling are deferred; this
 * covers shorthand-only, longhand-only, and longhand-overrides-shorthand.)
 */
export function resolveElementAnimations(
  effective: Map<string, EffectiveProperty>,
): AnimationSpec[] {
  const shorthand = effective.get('animation')?.value;
  const base = shorthand ? splitSegments(shorthand).map(parseAnimationSegment) : [];

  const names = longhandList(effective, 'animation-name');
  const durations = longhandList(effective, 'animation-duration');
  const delays = longhandList(effective, 'animation-delay');
  const iterations = longhandList(effective, 'animation-iteration-count');
  const timings = longhandList(effective, 'animation-timing-function');
  const directions = longhandList(effective, 'animation-direction');
  const fills = longhandList(effective, 'animation-fill-mode');

  const count = Math.max(
    base.length,
    names?.length ?? 0,
    durations?.length ?? 0,
    delays?.length ?? 0,
    iterations?.length ?? 0,
    timings?.length ?? 0,
    directions?.length ?? 0,
    fills?.length ?? 0,
  );

  const specs: AnimationSpec[] = [];
  for (let i = 0; i < count; i++) {
    const b = base[i] ?? {};
    const name = at(names, i) ?? b.name;
    if (!name || name.toLowerCase() === 'none') continue;
    specs.push({
      name,
      durationMs: parseTime(at(durations, i)) ?? b.duration ?? ANIMATION_DEFAULTS.durationMs,
      delayMs: parseTime(at(delays, i)) ?? b.delay ?? ANIMATION_DEFAULTS.delayMs,
      iterations:
        parseIterations(at(iterations, i)) ?? b.iterations ?? ANIMATION_DEFAULTS.iterations,
      timingFunction: at(timings, i) ?? b.timingFunction ?? ANIMATION_DEFAULTS.timingFunction,
      direction: at(directions, i)?.toLowerCase() ?? b.direction ?? ANIMATION_DEFAULTS.direction,
      fillMode: at(fills, i)?.toLowerCase() ?? b.fillMode ?? ANIMATION_DEFAULTS.fillMode,
    });
  }
  return specs;
}

interface ParsedSegment {
  name?: string;
  duration?: number;
  delay?: number;
  iterations?: number;
  timingFunction?: string;
  direction?: string;
  fillMode?: string;
}

/** Parse one comma-segment of an `animation` shorthand into its longhand parts. */
function parseAnimationSegment(segment: string): ParsedSegment {
  const parsed: ParsedSegment = {};
  for (const token of splitTokens(segment)) {
    const lower = token.toLowerCase();
    const time = parseTime(token);
    if (time !== null) {
      if (parsed.duration === undefined) parsed.duration = time;
      else if (parsed.delay === undefined) parsed.delay = time;
      continue;
    }
    if (lower === 'infinite') {
      parsed.iterations = Infinity;
    } else if (/^[\d.]+$/.test(token)) {
      parsed.iterations = parseFloat(token);
    } else if (isTimingFunction(lower)) {
      parsed.timingFunction = token;
    } else if (DIRECTION_KEYWORDS.has(lower)) {
      parsed.direction = lower;
    } else if (PLAY_STATE_KEYWORDS.has(lower)) {
      // play-state isn't modeled in the timeline; skip it.
    } else if (FILL_KEYWORDS.has(lower) && lower !== 'none') {
      parsed.fillMode = lower;
    } else if (parsed.name === undefined) {
      // The first unrecognized token (incl. `none`) is the animation name.
      parsed.name = token;
    } else if (lower === 'none' && parsed.fillMode === undefined) {
      parsed.fillMode = lower;
    }
  }
  return parsed;
}

function isTimingFunction(lower: string): boolean {
  return TIMING_KEYWORDS.has(lower) || lower.startsWith('cubic-bezier(') || lower.startsWith('steps(');
}

/**
 * Resolve the transitions applied to one element, mirroring
 * `resolveElementAnimations`: parse the `transition` shorthand per comma-segment,
 * then let any present longhand (`transition-duration`, …) override the matching
 * segment. Returns one spec per transitioned property; `transition: none` (or a
 * `transition-property: none` entry) is skipped. Returns `[]` when the element
 * declares no transition at all (so we don't invent rows for every element).
 */
export function resolveElementTransitions(
  effective: Map<string, EffectiveProperty>,
): TransitionSpec[] {
  const shorthand = effective.get('transition')?.value;
  const base = shorthand ? splitSegments(shorthand).map(parseTransitionSegment) : [];

  const properties = longhandList(effective, 'transition-property');
  const durations = longhandList(effective, 'transition-duration');
  const delays = longhandList(effective, 'transition-delay');
  const timings = longhandList(effective, 'transition-timing-function');

  // Nothing references a transition on this element → no rows.
  if (!shorthand && !properties && !durations && !delays && !timings) return [];

  const count = Math.max(
    base.length,
    properties?.length ?? 0,
    durations?.length ?? 0,
    delays?.length ?? 0,
    timings?.length ?? 0,
  );

  const specs: TransitionSpec[] = [];
  for (let i = 0; i < count; i++) {
    const b = base[i] ?? {};
    // `transition-property` defaults to `all` when only timing longhands are set.
    const property = at(properties, i) ?? b.property ?? 'all';
    if (property.toLowerCase() === 'none') continue;
    specs.push({
      property,
      durationMs: parseTime(at(durations, i)) ?? b.duration ?? 0,
      delayMs: parseTime(at(delays, i)) ?? b.delay ?? 0,
      timingFunction: at(timings, i) ?? b.timingFunction ?? ANIMATION_DEFAULTS.timingFunction,
    });
  }
  return specs;
}

interface ParsedTransition {
  property?: string;
  duration?: number;
  delay?: number;
  timingFunction?: string;
}

/** Parse one comma-segment of a `transition` shorthand into its longhand parts. */
function parseTransitionSegment(segment: string): ParsedTransition {
  const parsed: ParsedTransition = {};
  for (const token of splitTokens(segment)) {
    const time = parseTime(token);
    if (time !== null) {
      if (parsed.duration === undefined) parsed.duration = time;
      else if (parsed.delay === undefined) parsed.delay = time;
      continue;
    }
    if (isTimingFunction(token.toLowerCase())) {
      parsed.timingFunction = token;
    } else if (parsed.property === undefined) {
      // The first non-time, non-timing token is the property (incl. `all`/`none`).
      parsed.property = token;
    }
  }
  return parsed;
}

function longhandList(
  effective: Map<string, EffectiveProperty>,
  property: string,
): string[] | null {
  const value = effective.get(property)?.value;
  return value ? splitSegments(value).map((s) => s.trim()) : null;
}

function at(list: string[] | null, index: number): string | undefined {
  return list ? list[index] : undefined;
}

function parseTime(token: string | undefined): number | null {
  if (!token) return null;
  const match = /^([\d.]+)(ms|s)$/i.exec(token.trim());
  if (!match) return null;
  const value = parseFloat(match[1]);
  return match[2].toLowerCase() === 's' ? value * 1000 : value;
}

function parseIterations(token: string | undefined): number | null {
  if (!token) return null;
  const trimmed = token.trim().toLowerCase();
  if (trimmed === 'infinite') return Infinity;
  return /^[\d.]+$/.test(trimmed) ? parseFloat(trimmed) : null;
}

/** Split a comma-list, respecting parentheses (cubic-bezier/steps contain commas). */
function splitSegments(value: string): string[] {
  return splitTopLevel(value, ',').map((s) => s.trim()).filter(Boolean);
}

/** Split on whitespace, respecting parentheses. */
function splitTokens(segment: string): string[] {
  const tokens: string[] = [];
  let depth = 0;
  let current = '';
  for (const ch of segment.trim()) {
    if (ch === '(') depth++;
    else if (ch === ')') depth = Math.max(0, depth - 1);
    if (/\s/.test(ch) && depth === 0) {
      if (current) {
        tokens.push(current);
        current = '';
      }
    } else {
      current += ch;
    }
  }
  if (current) tokens.push(current);
  return tokens;
}

function splitTopLevel(value: string, separator: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = '';
  for (const ch of value) {
    if (ch === '(') depth++;
    else if (ch === ')') depth = Math.max(0, depth - 1);
    if (ch === separator && depth === 0) {
      parts.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  parts.push(current);
  return parts;
}

/** Pre-order elements eligible for animation rows; `<defs>` subtrees excluded. */
function animatableElements(body: ParentNode): Element[] {
  return Array.from(body.querySelectorAll('*')).filter((el) => !el.closest('defs'));
}
