import { useMemo, useState } from 'react';
import { useDocumentStore } from '../../state/documentStore';
import { useSelectionStore } from '../../state/selectionStore';
import { parseMarkup } from '../../model/markup';
import type { ElementNode, ElementRef } from '../../model/markup';

/**
 * Left panel: the element tree, projected from the markup buffer (docs/ui-spec.md).
 * Collapse state is transient UI; selection lives in the shared selection store.
 */
export function ElementsPanel() {
  const markup = useDocumentStore((s) => s.markup);
  const roots = useMemo(() => parseMarkup(markup), [markup]);
  const [collapsed, setCollapsed] = useState<ReadonlySet<ElementRef>>(new Set());

  const toggle = (ref: ElementRef) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(ref)) next.delete(ref);
      else next.add(ref);
      return next;
    });

  return (
    <section className="panel">
      <header className="panel-header">Elements</header>
      <div className="panel-body tree" role="tree" aria-label="Elements">
        {roots.map((node) => (
          <TreeNode key={node.ref} node={node} depth={0} collapsed={collapsed} toggle={toggle} />
        ))}
      </div>
    </section>
  );
}

function TreeNode({
  node,
  depth,
  collapsed,
  toggle,
}: {
  node: ElementNode;
  depth: number;
  collapsed: ReadonlySet<ElementRef>;
  toggle: (ref: ElementRef) => void;
}) {
  const selected = useSelectionStore((s) => s.element === node.ref);
  const selectElement = useSelectionStore((s) => s.selectElement);
  const hasChildren = node.children.length > 0;
  const isCollapsed = collapsed.has(node.ref);

  return (
    <div role="treeitem" aria-selected={selected} aria-expanded={hasChildren ? !isCollapsed : undefined}>
      <div
        className={`tree-row${selected ? ' selected' : ''}`}
        style={{ paddingLeft: depth * 14 + 6 }}
        onClick={() => selectElement(node.ref)}
      >
        {hasChildren ? (
          <button
            type="button"
            className={`disclosure${isCollapsed ? '' : ' open'}`}
            aria-label={isCollapsed ? 'Expand' : 'Collapse'}
            onClick={(e) => {
              e.stopPropagation();
              toggle(node.ref);
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
      </div>
      {hasChildren && !isCollapsed && (
        <div role="group">
          {node.children.map((child) => (
            <TreeNode
              key={child.ref}
              node={child}
              depth={depth + 1}
              collapsed={collapsed}
              toggle={toggle}
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
