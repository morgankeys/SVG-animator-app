import { useState } from 'react';
import type { ElementNode } from '../../model/markup';

/**
 * Read-only element tree for an imported frame (Phase 9.2). A static projection
 * of the frame's parsed markup — no selection or editing (frames aren't the
 * document buffers). Mirrors the Elements panel's tag + #id/.class hints and
 * `<defs>` exclusion, but stays presentational.
 */
export function FrameTree({ tree }: { tree: ElementNode[] }) {
  return (
    <div className="tree frame-tree" role="tree" aria-label="Frame elements">
      {tree.map((node) => (
        <FrameTreeNode key={node.ref} node={node} depth={0} />
      ))}
    </div>
  );
}

function FrameTreeNode({ node, depth }: { node: ElementNode; depth: number }) {
  const [collapsed, setCollapsed] = useState(false);
  const hasChildren = node.children.length > 0;

  return (
    <div role="treeitem" aria-expanded={hasChildren ? !collapsed : undefined}>
      <div className="tree-row" style={{ paddingLeft: depth * 14 + 6 }}>
        {hasChildren ? (
          <button
            type="button"
            className={`disclosure${collapsed ? '' : ' open'}`}
            aria-label={collapsed ? 'Expand' : 'Collapse'}
            onClick={() => setCollapsed((c) => !c)}
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
      </div>
      {hasChildren && !collapsed && (
        <div role="group">
          {node.children.map((child) => (
            <FrameTreeNode key={child.ref} node={child} depth={depth + 1} />
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
