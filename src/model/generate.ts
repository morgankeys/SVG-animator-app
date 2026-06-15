/**
 * `@keyframes` generation from frames + correspondences (Phase 10.4,
 * docs/svg-interpolation.md). The final step of the interpolation epic: turn the
 * settled correspondences into a single animated document — unified markup
 * (canonical ids applied) plus generated `@keyframes` and `animation`
 * declarations that drive each element across the frame states.
 *
 * Pure: frames + correspondences in, the two document buffers (+ warnings) out.
 * The result is fed to the document store, after which the *existing* animation
 * pipeline (model/animation.ts) projects the generated `animation`s as Timeline
 * rows like any other — no special-casing downstream.
 *
 * Scope (honest degradation; 10.5 refines edge cases): structure comes from the
 * base frame (frames[0]). Elements present in the base animate their differing
 * properties across frames; an element that disappears in later frames animates
 * its `opacity` to 0. An element that *appears* only in a non-base frame can't
 * be placed yet — surfaced as a warning rather than silently dropped.
 */
import { refactorFrameIds } from './refactor';
import { validateReferences } from './validate';
import type { Frame } from './frames';
import type { ElementNode, ElementRef } from './markup';
import type { Correspondence } from './match';

export interface GenerateOptions {
  /** Total animation duration in seconds (default: one second per frame gap). */
  durationS?: number;
  /** Timing function for the generated `animation` (default `linear`). */
  timingFunction?: string;
}

export interface GenerateResult {
  markup: string;
  styles: string;
  warnings: string[];
}

/** SVG presentation/geometry attributes that animate as CSS properties. */
const ANIMATABLE_ATTRS = new Set([
  'fill',
  'stroke',
  'stroke-width',
  'stroke-opacity',
  'fill-opacity',
  'opacity',
  'transform',
  'cx',
  'cy',
  'r',
  'rx',
  'ry',
  'x',
  'y',
  'width',
  'height',
  'x1',
  'y1',
  'x2',
  'y2',
  'stop-color',
  'stop-opacity',
]);

interface Track {
  canonicalId: string;
  /** property → (frameIndex → value), only for frames where a value exists. */
  props: Map<string, Map<number, string>>;
}

/**
 * Generate the unified, animated document from ordered frames + correspondences.
 * Returns the markup/styles buffers to write and any warnings to surface.
 */
export function generateInterpolation(
  frames: Frame[],
  rawCorrespondences: Correspondence[],
  options: GenerateOptions = {},
): GenerateResult {
  const warnings: string[] = [];
  if (frames.length === 0) {
    return { markup: '', styles: '', warnings: ['No frames to generate from.'] };
  }

  const base = frames[0];
  const frameTrees = frames.map((f) => indexByRef(f.tree));

  // Conflicting canonical ids would produce duplicate selectors/@keyframes
  // names; disambiguate so the output stays valid, and say we did (10.5).
  const correspondences = dedupeCanonicalIds(rawCorrespondences, warnings);

  // Unified markup: the base frame with canonical ids applied + references fixed.
  const refactored = refactorFrameIds(base, correspondences);
  warnings.push(...refactored.warnings);

  const durationS = options.durationS ?? Math.max(1, frames.length - 1);
  const timing = options.timingFunction ?? 'linear';

  const tracks: Track[] = [];
  for (const corr of correspondences) {
    if (corr.members[base.id] === undefined) {
      if (Object.keys(corr.members).length > 0) {
        warnings.push(
          `"${corr.id}" appears only in non-base frames; merging appearing elements isn't supported yet (it won't animate).`,
        );
      }
      continue;
    }
    const track = buildTrack(corr, frames, frameTrees);
    if (track) tracks.push(track);
  }

  const styles = tracks.length
    ? renderStyles(tracks, frames.length, durationS, timing)
    : '';
  if (tracks.length === 0) {
    warnings.push('No animatable differences found across the frames.');
  }

  // Reference integrity: the id rewrite shouldn't have left any dangling
  // url(#…)/href references in the unified markup (10.5).
  for (const issue of validateReferences(refactored.markup)) warnings.push(issue.message);

  return { markup: refactored.markup, styles, warnings };
}

/**
 * Ensure canonical ids are unique so selectors and `@keyframes` names don't
 * collide. Duplicates (only possible after a manual rename) are suffixed -2, -3…
 * and a warning is recorded.
 */
function dedupeCanonicalIds(
  correspondences: Correspondence[],
  warnings: string[],
): Correspondence[] {
  const used = new Set<string>();
  return correspondences.map((c) => {
    if (!used.has(c.id)) {
      used.add(c.id);
      return c;
    }
    let id = c.id;
    for (let n = 2; used.has(id); n++) id = `${c.id}-${n}`;
    used.add(id);
    warnings.push(`Canonical id "${c.id}" was duplicated; renamed one to "${id}" to keep output valid.`);
    return { ...c, id };
  });
}

/**
 * Collect a correspondence's animated properties across frames. A property is
 * animated when it's present in every frame the element exists in and its
 * values aren't all equal. A frame-specific element (absent in some frames)
 * additionally animates `opacity` (1 where present, 0 where absent).
 */
function buildTrack(
  corr: Correspondence,
  frames: Frame[],
  frameTrees: Array<Map<ElementRef, ElementNode>>,
): Track | null {
  const present: Array<{ index: number; props: Record<string, string> }> = [];
  frames.forEach((frame, index) => {
    const ref = corr.members[frame.id];
    if (ref === undefined) return;
    const node = frameTrees[index].get(ref);
    if (node) present.push({ index, props: readProperties(node) });
  });
  if (present.length === 0) return null;

  const props = new Map<string, Map<number, string>>();

  // Properties common to every present frame, that actually differ.
  const candidateKeys = new Set<string>();
  for (const key of Object.keys(present[0].props)) candidateKeys.add(key);
  for (const key of candidateKeys) {
    const values = present.map((p) => p.props[key]);
    if (values.some((v) => v === undefined)) continue; // not in every present frame
    if (values.every((v) => v === values[0])) continue; // unchanged
    const perFrame = new Map<number, string>();
    present.forEach((p) => perFrame.set(p.index, p.props[key]));
    props.set(key, perFrame);
  }

  // Appear/disappear → opacity track across ALL frames.
  const isFrameSpecific = present.length < frames.length;
  if (isFrameSpecific) {
    const perFrame = props.get('opacity') ?? new Map<number, string>();
    const presentIndices = new Set(present.map((p) => p.index));
    frames.forEach((_, index) => {
      if (presentIndices.has(index)) {
        if (!perFrame.has(index)) {
          const here = present.find((p) => p.index === index)!;
          perFrame.set(index, here.props.opacity ?? '1');
        }
      } else {
        perFrame.set(index, '0');
      }
    });
    props.set('opacity', perFrame);
  }

  if (props.size === 0) return null;
  return { canonicalId: corr.id, props };
}

/** Read a node's animatable properties from its attributes + inline style. */
function readProperties(node: ElementNode): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [name, value] of Object.entries(node.attributes)) {
    if (ANIMATABLE_ATTRS.has(name)) out[name] = value.trim();
  }
  // Inline style overrides presentation attributes (and may add CSS-only props).
  const style = node.attributes.style;
  if (style) {
    for (const decl of style.split(';')) {
      const i = decl.indexOf(':');
      if (i < 0) continue;
      const prop = decl.slice(0, i).trim();
      const val = decl.slice(i + 1).trim();
      if (prop) out[prop] = val;
    }
  }
  return out;
}

function renderStyles(
  tracks: Track[],
  frameCount: number,
  durationS: number,
  timing: string,
): string {
  const rules = tracks.map(
    (t) =>
      `#${t.canonicalId} {\n  animation: ${t.canonicalId}-frames ${durationS}s ${timing} infinite;\n}`,
  );
  const keyframes = tracks.map((t) => renderKeyframes(t, frameCount));
  return (
    `/* Generated from ${frameCount} frames — interpolation (Phase 10.4) */\n\n` +
    `${rules.join('\n\n')}\n\n${keyframes.join('\n\n')}\n`
  );
}

function renderKeyframes(track: Track, frameCount: number): string {
  // For each frame, gather the props that have a value there.
  const stops: string[] = [];
  for (let i = 0; i < frameCount; i++) {
    const decls: string[] = [];
    for (const [prop, perFrame] of track.props) {
      const value = perFrame.get(i);
      if (value !== undefined) decls.push(`    ${prop}: ${value};`);
    }
    if (decls.length === 0) continue;
    stops.push(`  ${percent(i, frameCount)} {\n${decls.join('\n')}\n  }`);
  }
  return `@keyframes ${track.canonicalId}-frames {\n${stops.join('\n')}\n}`;
}

/** Frame index → keyframe percentage label (`0%`, `50%`, `100%`). */
function percent(index: number, count: number): string {
  if (count <= 1) return '0%';
  const pct = (index / (count - 1)) * 100;
  return `${Number(pct.toFixed(3))}%`;
}

function indexByRef(tree: ElementNode[]): Map<ElementRef, ElementNode> {
  const map = new Map<ElementRef, ElementNode>();
  const walk = (nodes: ElementNode[]) => {
    for (const n of nodes) {
      map.set(n.ref, n);
      walk(n.children);
    }
  };
  walk(tree);
  return map;
}
