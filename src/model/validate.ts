/**
 * Mapping & reference-integrity validation (Phase 10.5, docs/svg-interpolation.md).
 *
 * Surfaces the epic's edge cases honestly instead of letting them corrupt the
 * output: conflicting canonical ids, tag changes across a correspondence
 * (non-animatable / structural splits), unresolved nodes, and — after id rewrite
 * — dangling `url(#…)`/`href` references. Pure: data in, issues out. The UI lists
 * mapping issues live; generation runs the reference check on its output.
 */
import type { ElementNode, ElementRef } from './markup';
import type { Correspondence } from './match';

export interface ValidationIssue {
  severity: 'error' | 'warning';
  message: string;
  /** The correspondence this issue concerns, when applicable. */
  corrId?: string;
}

interface MappingFrame {
  id: string;
  tree: ElementNode[];
}

/**
 * Check the correspondence set for structural problems the user should resolve
 * before generating: duplicate canonical ids, tag changes across a
 * correspondence, and nodes still unresolved.
 */
export function validateMapping(
  frames: MappingFrame[],
  correspondences: Correspondence[],
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const byFrame = new Map(frames.map((f) => [f.id, indexByRef(f.tree)]));

  // 1. Conflicting canonical ids — two correspondences want the same name.
  const idCounts = new Map<string, number>();
  for (const c of correspondences) idCounts.set(c.id, (idCounts.get(c.id) ?? 0) + 1);
  for (const [id, count] of idCounts) {
    if (count > 1) {
      issues.push({
        severity: 'error',
        message: `Canonical id "${id}" is used by ${count} correspondences — rename one (generation will auto-disambiguate, but the names will be confusing).`,
        corrId: id,
      });
    }
  }

  for (const corr of correspondences) {
    // 2. Tag change across a correspondence — a manual link between unlike
    //    elements (a structural change), which interpolation can't animate.
    const tags = new Set<string>();
    for (const [frameId, ref] of Object.entries(corr.members)) {
      const node = byFrame.get(frameId)?.get(ref);
      if (node) tags.add(node.tag);
    }
    if (tags.size > 1) {
      issues.push({
        severity: 'warning',
        message: `"${corr.id}" links different element types (${[...tags].join(', ')}); a tag change can't be interpolated.`,
        corrId: corr.id,
      });
    }

    // 3. Still-unresolved nodes — the user hasn't linked them or marked them
    //    frame-specific.
    const memberCount = Object.keys(corr.members).length;
    if (corr.status === 'unmatched' && memberCount < frames.length) {
      issues.push({
        severity: 'warning',
        message: `"${corr.id}" isn't in every frame and is still unmatched — link it across frames or mark it frame-specific.`,
        corrId: corr.id,
      });
    }
  }

  return issues;
}

/**
 * Validate reference integrity of a finished markup buffer: every `url(#…)`,
 * `href`/`xlink:href="#…"`, and aria id-list token must resolve to an element
 * with that id. Dangling references become errors.
 */
export function validateReferences(markup: string): ValidationIssue[] {
  const doc = new DOMParser().parseFromString(markup, 'text/html');
  const ids = new Set<string>();
  doc.querySelectorAll('[id]').forEach((el) => ids.add(el.id));

  const issues: ValidationIssue[] = [];
  const seen = new Set<string>();
  const flag = (id: string, context: string) => {
    if (ids.has(id) || seen.has(id)) return;
    seen.add(id);
    issues.push({ severity: 'error', message: `Broken reference: ${context} points at #${id}, which doesn't exist.` });
  };

  for (const el of Array.from(doc.querySelectorAll('*'))) {
    for (const attr of Array.from(el.attributes)) {
      const { name, value } = attr;
      for (const m of value.matchAll(/url\(\s*['"]?#([^'")\s]+)['"]?\s*\)/g)) {
        flag(m[1], `${name}="${value}"`);
      }
      if ((name === 'href' || name === 'xlink:href') && value.startsWith('#')) {
        flag(value.slice(1), `${name}`);
      }
      if (name === 'aria-labelledby' || name === 'aria-describedby') {
        for (const tok of value.split(/\s+/)) if (tok) flag(tok, name);
      }
    }
  }

  return issues;
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
