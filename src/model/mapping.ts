/**
 * Manual correspondence editing (Phase 10.2, docs/svg-interpolation.md). Pure
 * operations over a `Correspondence[]`: the auto-matcher (10.1) proposes a set,
 * then the user links/unlinks/flags to correct it. Kept pure and testable; the
 * interpolation store wires these to the mapping UI.
 *
 * Every operation returns a *new* array (no in-place mutation), so the store can
 * snapshot/replace and React re-renders cleanly.
 */
import type { Correspondence, CorrespondenceStatus, NodePath } from './match';

/** The correspondence whose member in `frameId` is `ref`, if any. */
export function findCorrespondence(
  corrs: Correspondence[],
  frameId: string,
  ref: NodePath,
): Correspondence | undefined {
  return corrs.find((c) => c.members[frameId] === ref);
}

/**
 * Link two nodes (from two different frames) into one correspondence. The node
 * `(fb, rb)` joins `(fa, ra)`'s correspondence; if either side already had a
 * member in the other's frame, the displaced node is split off as its own
 * `unmatched` singleton so nothing is silently lost. No-op when the two are
 * already the same correspondence, or when it's the same frame.
 */
export function linkNodes(
  corrs: Correspondence[],
  fa: string,
  ra: NodePath,
  fb: string,
  rb: NodePath,
): Correspondence[] {
  if (fa === fb) return corrs;
  const ca = findCorrespondence(corrs, fa, ra);
  const cb = findCorrespondence(corrs, fb, rb);
  if (!ca || !cb) return corrs;
  if (ca.id === cb.id) return corrs;

  const used = new Set(corrs.map((c) => c.id));
  const result: Correspondence[] = [];
  const displaced: Array<{ frameId: string; ref: NodePath }> = [];

  // Any node in ca already occupying frame fb is displaced (rb takes its slot).
  if (ca.members[fb] !== undefined && ca.members[fb] !== rb) {
    displaced.push({ frameId: fb, ref: ca.members[fb] });
  }

  for (const c of corrs) {
    if (c.id === ca.id) {
      result.push({ ...ca, members: { ...ca.members, [fb]: rb }, status: 'manual' });
    } else if (c.id === cb.id) {
      // Drop rb (it moved into ca); keep cb's other members, if any.
      const members = { ...cb.members };
      delete members[fb];
      if (Object.keys(members).length > 0) {
        result.push({ ...cb, members, status: 'manual' });
      }
    } else {
      result.push(c);
    }
  }

  for (const d of displaced) {
    result.push(singleton(used, d.frameId, d.ref));
  }
  return result;
}

/**
 * Remove `frameId`'s member from a correspondence, splitting it off as its own
 * `unmatched` singleton (the node isn't deleted, just unlinked). Drops the
 * correspondence entirely if it becomes empty.
 */
export function unlinkMember(
  corrs: Correspondence[],
  corrId: string,
  frameId: string,
): Correspondence[] {
  const target = corrs.find((c) => c.id === corrId);
  if (!target || target.members[frameId] === undefined) return corrs;

  const used = new Set(corrs.map((c) => c.id));
  const ref = target.members[frameId];
  const remaining = { ...target.members };
  delete remaining[frameId];

  const result: Correspondence[] = [];
  for (const c of corrs) {
    if (c.id !== corrId) {
      result.push(c);
    } else if (Object.keys(remaining).length > 0) {
      result.push({ ...c, members: remaining, status: 'manual' });
    }
    // else: drop the now-empty correspondence
  }
  result.push(singleton(used, frameId, ref));
  return result;
}

/** Override the canonical id of a correspondence (uniqueness validated elsewhere). */
export function setCanonicalId(
  corrs: Correspondence[],
  corrId: string,
  id: string,
): Correspondence[] {
  return corrs.map((c) => (c.id === corrId ? { ...c, id, status: manualize(c.status) } : c));
}

/** Set a correspondence's status (e.g. acknowledging a frame-specific element). */
export function setStatus(
  corrs: Correspondence[],
  corrId: string,
  status: CorrespondenceStatus,
): Correspondence[] {
  return corrs.map((c) => (c.id === corrId ? { ...c, status } : c));
}

function singleton(used: Set<string>, frameId: string, ref: NodePath): Correspondence {
  // Split-off nodes get a synthetic unique id; the user can rename it.
  let id = 'unmatched';
  for (let n = 2; used.has(id); n++) id = `unmatched-${n}`;
  used.add(id);
  return { id, members: { [frameId]: ref }, confidence: 0, status: 'unmatched' };
}

/** Editing a correspondence promotes an `auto` match to `manual`; others keep. */
function manualize(status: CorrespondenceStatus): CorrespondenceStatus {
  return status === 'auto' ? 'manual' : status;
}
