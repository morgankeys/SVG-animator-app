/**
 * SVG correspondence auto-matcher (Phase 10.1, docs/svg-interpolation.md).
 *
 * Given several frames that depict the same artwork in different states, propose
 * which element in each frame is "the same element" — even when ids/structure
 * differ across frames. The output is a set of `Correspondence`s the manual
 * mapping UI (10.2) can review/override and the code generator (10.3–10.4)
 * turns into a unified markup + `@keyframes`.
 *
 * Pure and fixture-testable: parsed trees in, proposed correspondences out. No
 * React, no stores, no DOM mutation — keep it that way (the hard logic lives
 * here, and that's where the bugs hide).
 *
 * Strategy: anchor on the first frame, then fold each subsequent frame in. Each
 * working correspondence keeps a *representative* node (its first member); a new
 * frame's nodes are greedily assigned to the best-scoring representative of the
 * same tag, and anything left over seeds a fresh correspondence (so an element
 * that first appears in frame 2 can still be matched by frame 3). Scoring blends
 * structural position, normalized id/class, and attribute/geometry similarity;
 * tag name is a hard filter.
 */
import type { ElementNode, ElementRef } from './markup';

/** Minimal frame shape the matcher needs (a `Frame` satisfies it). */
export interface MatchFrame {
  id: string;
  tree: ElementNode[];
}

/** Which node within a frame a correspondence points at (an `ElementRef`). */
export type NodePath = ElementRef;

export type CorrespondenceStatus = 'auto' | 'manual' | 'unmatched';

/**
 * One set of nodes — at most one per frame — judged to be the same element
 * across states. `members` is keyed by frame id; a correspondence missing some
 * frames is a frame-specific element (appears/disappears).
 */
export interface Correspondence {
  /** Canonical id proposed for the unified element (unique within the set). */
  id: string;
  members: Record<string, NodePath>;
  /** 0–1 aggregate match confidence (0 for a lone, unmatched node). */
  confidence: number;
  status: CorrespondenceStatus;
}

/** Minimum pair score for a node to join an existing correspondence. */
const MATCH_THRESHOLD = 0.45;
/** A fully-populated correspondence at/above this average is accepted as `auto`. */
const AUTO_THRESHOLD = 0.6;

interface FlatNode {
  node: ElementNode;
  ref: ElementRef;
  tag: string;
  depth: number;
  /** Index among its siblings (last path segment; counts `<defs>` like refs do). */
  siblingIndex: number;
  /** Tag names from the root down to (not including) this node. */
  ancestorTags: string[];
}

interface WorkingCorrespondence {
  id: string;
  members: Record<string, NodePath>;
  rep: FlatNode;
  /** Pair scores accumulated as members joined (the rep contributes none). */
  scores: number[];
}

/**
 * Propose correspondences across `frames` (in the given order — frame order is
 * later the timeline order). Deterministic: same frames in, same result out.
 */
export function autoMatch(frames: MatchFrame[]): Correspondence[] {
  const working: WorkingCorrespondence[] = [];
  const usedIds = new Set<string>();

  frames.forEach((frame, frameIndex) => {
    const flat = flatten(frame.tree);
    if (frameIndex === 0) {
      for (const fn of flat) working.push(seed(frame.id, fn, usedIds));
      return;
    }
    foldFrame(working, frame.id, flat, usedIds);
  });

  return working.map((wc) => finalize(wc, frames.length));
}

/** Flatten a frame's tree to a pre-order list carrying structural context. */
function flatten(tree: ElementNode[]): FlatNode[] {
  const out: FlatNode[] = [];
  const walk = (node: ElementNode, depth: number, ancestorTags: string[]) => {
    const path = node.ref.split('/');
    out.push({
      node,
      ref: node.ref,
      tag: node.tag,
      depth,
      siblingIndex: Number(path[path.length - 1]),
      ancestorTags,
    });
    for (const child of node.children) walk(child, depth + 1, [...ancestorTags, node.tag]);
  };
  for (const root of tree) walk(root, 0, []);
  return out;
}

/** Start a correspondence anchored on one node, assigning a unique canonical id. */
function seed(frameId: string, fn: FlatNode, usedIds: Set<string>): WorkingCorrespondence {
  const id = uniqueId(canonicalStem(fn), usedIds);
  return { id, members: { [frameId]: fn.ref }, rep: fn, scores: [] };
}

/** Greedily assign a frame's nodes to the best representative; seed the rest. */
function foldFrame(
  working: WorkingCorrespondence[],
  frameId: string,
  flat: FlatNode[],
  usedIds: Set<string>,
): void {
  const open = working.filter((wc) => !(frameId in wc.members));
  const pairs: Array<{ wc: WorkingCorrespondence; fn: FlatNode; score: number }> = [];
  for (const wc of open) {
    for (const fn of flat) {
      if (fn.tag !== wc.rep.tag) continue; // tag is a hard filter
      const score = scoreNodes(wc.rep, fn, flat);
      if (score >= MATCH_THRESHOLD) pairs.push({ wc, fn, score });
    }
  }
  // Highest-scoring pairs win; ties break deterministically by ref/id so the
  // result never depends on iteration accidents.
  pairs.sort(
    (a, b) => b.score - a.score || cmp(a.wc.id, b.wc.id) || cmp(a.fn.ref, b.fn.ref),
  );

  const takenNodes = new Set<ElementRef>();
  for (const { wc, fn, score } of pairs) {
    if (frameId in wc.members || takenNodes.has(fn.ref)) continue;
    wc.members[frameId] = fn.ref;
    wc.scores.push(score);
    takenNodes.add(fn.ref);
  }
  for (const fn of flat) {
    if (!takenNodes.has(fn.ref)) working.push(seed(frameId, fn, usedIds));
  }
}

function finalize(wc: WorkingCorrespondence, frameCount: number): Correspondence {
  const confidence = wc.scores.length
    ? wc.scores.reduce((a, b) => a + b, 0) / wc.scores.length
    : 0;
  const complete = Object.keys(wc.members).length === frameCount;
  const status: CorrespondenceStatus =
    complete && confidence >= AUTO_THRESHOLD ? 'auto' : 'unmatched';
  return { id: wc.id, members: wc.members, confidence: round(confidence), status };
}

/**
 * Score how likely `a` (an existing rep) and `b` (a candidate) are the same
 * element, in 0–1. Tag equality is assumed (filtered by the caller). Blends:
 * structural position, normalized id/class, attribute/geometry similarity, plus
 * a uniqueness bonus when `b` is the only node of its tag in its frame.
 */
export function scoreNodes(a: FlatNode, b: FlatNode, bFrame: FlatNode[]): number {
  const struct = structuralScore(a, b);
  const idClass = idClassScore(a.node, b.node);
  const attr = attributeScore(a.node, b.node);

  let score = 0.35 * struct + 0.3 * idClass + 0.25 * attr;

  // Uniqueness: if each frame has exactly one node of this tag, they almost
  // certainly correspond — nudge the score up (capped at 1).
  const sameTagCount = bFrame.filter((n) => n.tag === b.tag).length;
  if (sameTagCount === 1) score += 0.1;

  return Math.min(1, score);
}

/** Similar depth, sibling index, and ancestor chain ⇒ 1; divergence ⇒ lower. */
function structuralScore(a: FlatNode, b: FlatNode): number {
  const depth = 1 / (1 + Math.abs(a.depth - b.depth));
  const sibling = 1 / (1 + Math.abs(a.siblingIndex - b.siblingIndex));
  const ancestor = ancestorScore(a.ancestorTags, b.ancestorTags);
  return 0.35 * depth + 0.25 * sibling + 0.4 * ancestor;
}

/** Fraction of the shorter ancestor chain whose tags align from the root. */
function ancestorScore(a: string[], b: string[]): number {
  const n = Math.min(a.length, b.length);
  const max = Math.max(a.length, b.length);
  if (max === 0) return 1; // both at top level
  let matched = 0;
  for (let i = 0; i < n; i++) if (a[i] === b[i]) matched++;
  return matched / max;
}

/**
 * Compare the normalized id/class stems. Equal stems ⇒ 1; one side named and
 * the other anonymous ⇒ neutral 0.5 (absence isn't evidence either way);
 * different stems ⇒ low but non-zero (other signals can still carry the match).
 */
function idClassScore(a: ElementNode, b: ElementNode): number {
  const sa = identityStem(a);
  const sb = identityStem(b);
  if (sa === null && sb === null) return 0.5;
  if (sa === null || sb === null) return 0.5;
  if (sa === sb) return 1;
  return stringSimilarity(sa, sb) * 0.6;
}

/** The node's normalized id stem, else its first normalized class, else null. */
function identityStem(node: ElementNode): string | null {
  if (node.id) return normalizeStem(node.id);
  if (node.classes.length > 0) return normalizeStem(node.classes[0]);
  return null;
}

/**
 * Strip trailing frame/state indices and suffixes so the "same" element reads
 * the same across frames: `circle-1`, `circle_2`, `circle.frame2`, `circleA` →
 * `circle`. Conservative — only trailing digit/index-like runs are removed.
 */
export function normalizeStem(raw: string): string {
  let s = raw.trim();
  // A trailing single-letter index, before we lose case: a camelCase capital
  // ("circleA") or a separator + letter ("circle-a"). A plain trailing letter
  // ("shadow") is part of the word and stays. Only when a real stem remains.
  const letterStripped = s.replace(/([a-z])[A-Z]$/, '$1').replace(/[-_.][a-zA-Z]$/, '');
  if (letterStripped.length >= 3 && letterStripped !== s) s = letterStripped;

  s = s.toLowerCase();
  let prev = '';
  while (s !== prev) {
    prev = s;
    // A separator-preceded qualifier word ("circle.frame2", "ball-state-4").
    // The separator requirement keeps a stem that simply *is* "frame" intact.
    s = s.replace(/[-_.\s]+(frame|state|step|f)[-_.\s]*\d*$/i, '');
    // A trailing numeric index ("circle-1", "circle_2", "frame2", "x 5").
    s = s.replace(/[-_.\s]*\d+$/i, '');
  }
  return s.length > 0 ? s : raw.toLowerCase();
}

/** A canonical id seed from a node's stem, falling back to its tag. */
function canonicalStem(fn: FlatNode): string {
  const stem = identityStem(fn.node);
  return stem && /[a-z]/i.test(stem) ? stem : fn.tag;
}

function uniqueId(base: string, used: Set<string>): string {
  let id = base;
  for (let n = 2; used.has(id); n++) id = `${base}-${n}`;
  used.add(id);
  return id;
}

/**
 * Geometry/presentation similarity. Numeric attrs (`r`, `cx`, `width`, …)
 * compare by relative closeness; path/points data compares by token-count
 * shape; other shared attrs compare for equality. No shared attrs ⇒ neutral.
 */
function attributeScore(a: ElementNode, b: ElementNode): number {
  const keys = new Set([...Object.keys(a.attributes), ...Object.keys(b.attributes)]);
  keys.delete('id');
  keys.delete('class');
  const scores: number[] = [];
  for (const key of keys) {
    const va = a.attributes[key];
    const vb = b.attributes[key];
    if (va === undefined || vb === undefined) {
      scores.push(0.3); // present on one side only: weak mismatch
      continue;
    }
    scores.push(attrValueScore(key, va, vb));
  }
  if (scores.length === 0) return 0.5;
  return scores.reduce((s, n) => s + n, 0) / scores.length;
}

function attrValueScore(key: string, a: string, b: string): number {
  if (a === b) return 1;
  if (key === 'd' || key === 'points') return tokenShapeScore(a, b);
  const na = Number(a);
  const nb = Number(b);
  if (Number.isFinite(na) && Number.isFinite(nb)) return numberSimilarity(na, nb);
  return stringSimilarity(a, b);
}

/** Compare path/points data by command/coordinate token count (cheap shape proxy). */
function tokenShapeScore(a: string, b: string): number {
  const ta = a.match(/[a-zA-Z]|[-+]?\d*\.?\d+/g)?.length ?? 0;
  const tb = b.match(/[a-zA-Z]|[-+]?\d*\.?\d+/g)?.length ?? 0;
  if (ta === 0 && tb === 0) return 1;
  return 1 - Math.abs(ta - tb) / Math.max(ta, tb);
}

/** 1 for equal numbers, decaying with relative difference. */
function numberSimilarity(a: number, b: number): number {
  if (a === b) return 1;
  const scale = Math.max(Math.abs(a), Math.abs(b), 1);
  return Math.max(0, 1 - Math.abs(a - b) / scale);
}

/** Normalized edit-distance similarity in 0–1 (cheap, good enough for stems). */
function stringSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  const max = Math.max(a.length, b.length);
  if (max === 0) return 1;
  return 1 - editDistance(a, b) / max;
}

function editDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp = Array.from({ length: m + 1 }, (_, i) => i);
  for (let j = 1; j <= n; j++) {
    let prev = dp[0];
    dp[0] = j;
    for (let i = 1; i <= m; i++) {
      const tmp = dp[i];
      dp[i] = Math.min(
        dp[i] + 1,
        dp[i - 1] + 1,
        prev + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
      prev = tmp;
    }
  }
  return dp[m];
}

function round(n: number): number {
  return Math.round(n * 1000) / 1000;
}

function cmp(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
