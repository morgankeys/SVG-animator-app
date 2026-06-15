/**
 * Canonical-id refactor + reference rewrite (Phase 10.3, docs/svg-interpolation.md).
 *
 * Once correspondences are settled, each correspondence owns one canonical id.
 * For each frame we rewrite its member nodes to use that id and refactor every
 * reference to a renamed id (`url(#…)`, `href`/`xlink:href="#…"`, aria id-lists)
 * so nothing dangles. Pure: frame + correspondences in, rewritten markup + an
 * id map + warnings out.
 *
 * Markup writes go through the same start-tag splice helpers the editor uses
 * (`setMarkupAttribute`) so formatting/comments round-trip — never re-serialize
 * the DOM (docs/architecture.md invariant 3). Edits are non-structural, so
 * positional refs stay valid across the batch; we compute every new value from
 * the original markup, then apply.
 */
import { setMarkupAttribute } from './markup';
import type { ElementNode, ElementRef } from './markup';
import type { Correspondence } from './match';
import type { Frame } from './frames';

export interface IdRefactorResult {
  markup: string;
  /** Old id → canonical id, for the ids actually renamed in this frame. */
  idMap: Record<string, string>;
  /** Refs that had no id and were assigned the canonical one. */
  assigned: Record<ElementRef, string>;
  warnings: string[];
}

interface PlannedRename {
  ref: ElementRef;
  oldId: string | undefined;
  newId: string;
}

/**
 * Apply canonical ids and rewrite references for one frame. Correspondences
 * without a member in this frame are skipped (frame-specific elements).
 */
export function refactorFrameIds(
  frame: Frame,
  correspondences: Correspondence[],
): IdRefactorResult {
  const byRef = indexByRef(frame.tree);
  const warnings: string[] = [];
  const idMap: Record<string, string> = {};
  const assigned: Record<ElementRef, string> = {};

  // 1. Plan the renames (member nodes whose id differs from the canonical id).
  const renames: PlannedRename[] = [];
  for (const corr of correspondences) {
    const ref = corr.members[frame.id];
    if (ref === undefined) continue;
    const node = byRef.get(ref);
    if (!node) {
      warnings.push(`Correspondence "${corr.id}" points at a missing node (${ref}) in this frame.`);
      continue;
    }
    if (node.id === corr.id) continue; // already canonical
    renames.push({ ref, oldId: node.id, newId: corr.id });
  }

  // Collisions: two correspondences want the same canonical id, or a canonical
  // id clashes with an existing id we're NOT renaming away. Surface, don't hide.
  detectCollisions(renames, frame.tree, warnings);

  for (const r of renames) {
    if (r.oldId !== undefined) idMap[r.oldId] = r.newId;
    else assigned[r.ref] = r.newId;
  }

  // 2. Compute every edit from the original markup, then apply in one batch.
  const edits: Array<{ ref: ElementRef; name: string; value: string }> = [];
  for (const r of renames) edits.push({ ref: r.ref, name: 'id', value: r.newId });

  for (const node of byRef.values()) {
    for (const [name, value] of Object.entries(node.attributes)) {
      if (name === 'id') continue; // handled by the rename pass
      const next = rewriteReferences(name, value, idMap);
      if (next !== value) edits.push({ ref: node.ref, name, value: next });
    }
  }

  let markup = frame.markup;
  for (const edit of edits) {
    const next = setMarkupAttribute(markup, edit.ref, edit.name, edit.value);
    if (next === null) {
      warnings.push(
        `Couldn't rewrite ${edit.name} on ${edit.ref} (ambiguous source mapping); left unchanged.`,
      );
      continue;
    }
    markup = next;
  }

  return { markup, idMap, assigned, warnings };
}

/** Rewrite all references in one attribute value, given an old→new id map. */
export function rewriteReferences(
  attrName: string,
  value: string,
  idMap: Record<string, string>,
): string {
  if (Object.keys(idMap).length === 0) return value;
  let out = value;

  // url(#id) — appears in fill/stroke/clip-path/mask/filter/marker-*/style.
  out = out.replace(/url\(\s*(['"]?)#([^'")\s]+)\1\s*\)/g, (m, q, id) =>
    idMap[id] ? `url(${q}#${idMap[id]}${q})` : m,
  );

  // href / xlink:href = "#id" (whole-value fragment references).
  if (attrName === 'href' || attrName === 'xlink:href') {
    const frag = /^#(.+)$/.exec(out);
    if (frag && idMap[frag[1]]) out = `#${idMap[frag[1]]}`;
  }

  // Space-separated id lists (ARIA relationships).
  if (attrName === 'aria-labelledby' || attrName === 'aria-describedby') {
    out = out
      .split(/\s+/)
      .map((tok) => idMap[tok] ?? tok)
      .join(' ');
  }

  return out;
}

function detectCollisions(
  renames: PlannedRename[],
  tree: ElementNode[],
  warnings: string[],
): void {
  // Two renames targeting the same canonical id.
  const seen = new Map<string, ElementRef>();
  for (const r of renames) {
    const prev = seen.get(r.newId);
    if (prev !== undefined) {
      warnings.push(
        `Canonical id "${r.newId}" is assigned to two nodes (${prev} and ${r.ref}); references may be ambiguous.`,
      );
    } else {
      seen.set(r.newId, r.ref);
    }
  }

  // A canonical id colliding with an existing id that stays put (e.g. a <defs>
  // gradient), which would shadow it after the rename.
  const renamedRefs = new Set(renames.map((r) => r.ref));
  const existing = new Map<string, ElementRef>();
  walk(tree, (n) => {
    if (n.id && !renamedRefs.has(n.ref)) existing.set(n.id, n.ref);
  });
  for (const r of renames) {
    if (existing.has(r.newId)) {
      warnings.push(
        `Canonical id "${r.newId}" already exists in this frame (${existing.get(r.newId)}); rename would collide.`,
      );
    }
  }
}

function indexByRef(tree: ElementNode[]): Map<ElementRef, ElementNode> {
  const map = new Map<ElementRef, ElementNode>();
  walk(tree, (n) => map.set(n.ref, n));
  return map;
}

function walk(tree: ElementNode[], visit: (n: ElementNode) => void): void {
  for (const node of tree) {
    visit(node);
    walk(node.children, visit);
  }
}
