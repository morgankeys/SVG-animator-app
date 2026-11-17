import { useState } from 'react';
import type { ElementNode } from '../../model/markup';
import type { CorrespondenceStatus } from '../../model/match';
import { correspondenceColor } from './correspondenceColor';

/**
 * Per-node mapping decoration (Phase 10.2). Absent ⇒ the tree is read-only
 * (Phase 9.2 behavior). Present ⇒ the row shows its correspondence color/id,
 * flags unmatched nodes, and participates in pick-to-link.
 */
export interface NodeDecoration {
  corrId: string;
  status: CorrespondenceStatus;
  picked: boolean;
  /** True when the correspondence spans more than one frame (so it's unlinkable). */
  linked: boolean;
}

interface FrameTreeProps {
  tree: ElementNode[];
  /** Mapping hooks; omit all three for the read-only Phase 9.2 viewer. */
  decorate?: (ref: string) => NodeDecoration | undefined;
  onPick?: (ref: string) => void;
  onUnlink?: (corrId: string) => void;
}

/**
 * Element tree for one imported frame. Read-only by default (Phase 9.2); with
 * mapping hooks it becomes the correspondence-mapping surface (Phase 10.2):
 * rows carry a correspondence chip, flag unmatched nodes, and click to pick.
 */
export function FrameTree({ tree, decorate, onPick, onUnlink }: FrameTreeProps) {
  return (
    <div className="tree frame-tree" role="tree" aria-label="Frame elements">
      {tree.map((node) => (
        <FrameTreeNode
          key={node.ref}
          node={node}
          depth={0}
          decorate={decorate}
          onPick={onPick}
          onUnlink={onUnlink}
        />
      ))}
    </div>
  );
}

function FrameTreeNode({
  node,
  depth,
  decorate,
  onPick,
  onUnlink,
}: {
  node: ElementNode;
  depth: number;
} & Pick<FrameTreeProps, 'decorate' | 'onPick' | 'onUnlink'>) {
  const [collapsed, setCollapsed] = useState(false);
  const hasChildren = node.children.length > 0;
  const deco = decorate?.(node.ref);
  const interactive = Boolean(onPick && deco);

  const rowClass = [
    'tree-row',
    deco?.picked ? 'picked' : '',
    deco?.status === 'unmatched' ? 'unmatched' : '',
    interactive ? 'interactive' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div role="treeitem" aria-expanded={hasChildren ? !collapsed : undefined}>
      <div
        className={rowClass}
        style={{ paddingLeft: depth * 14 + 6 }}
        onClick={interactive ? () => onPick!(node.ref) : undefined}
        aria-pressed={interactive ? deco!.picked : undefined}
      >
        {hasChildren ? (
          <button
            type="button"
            className={`disclosure${collapsed ? '' : ' open'}`}
            aria-label={collapsed ? 'Expand' : 'Collapse'}
            onClick={(e) => {
              e.stopPropagation();
              setCollapsed((c) => !c);
            }}
          >
            ▸
          </button>
        ) : (
          <span className="disclosure-spacer" />
        )}
        <span className="tree-label">
          <span className="tree-tag">{node.tag}</span>
          {labelHint(node) && <span className="tree-hint"> {labelHint(node)}</span>}
        </span>
        {deco && (
          <span className="corr-badge-wrap">
            <span
              className="corr-chip"
              style={{ background: correspondenceColor(deco.corrId) }}
              title={`Correspondence: ${deco.corrId} (${deco.status})`}
            >
              {deco.corrId}
            </span>
            {deco.linked && onUnlink && (
              <button
                type="button"
                className="tree-action"
                aria-label={`Unlink ${node.tag} from ${deco.corrId}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onUnlink(deco.corrId);
                }}
              >
                ⊘
              </button>
            )}
          </span>
        )}
      </div>
      {hasChildren && !collapsed && (
        <div role="group">
          {node.children.map((child) => (
            <FrameTreeNode
              key={child.ref}
              node={child}
              depth={depth + 1}
              decorate={decorate}
              onPick={onPick}
              onUnlink={onUnlink}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function labelHint(node: ElementNode): string {
  if (node.id) return `#${node.id}`;
  if (node.classes.length > 0) return `.${node.classes[0]}`;
  return '';
}
