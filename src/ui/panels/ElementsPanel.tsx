import { useMemo, useState } from 'react';
import { useDocumentStore } from '../../state/documentStore';
import { useSelectionStore } from '../../state/selectionStore';
import { parseMarkup } from '../../model/markup';
import type { ElementNode, ElementRef } from '../../model/markup';
import { SHAPE_KINDS, SHAPE_LABELS } from '../../model/shapes';
import type { ShapeKind } from '../../model/shapes';

/**
 * Left panel: the element tree, projected from the markup buffer (docs/ui-spec.md).
 * Collapse state is transient UI; selection lives in the shared selection store.
 * The "Add" menu inserts shapes into the markup buffer (Phase 5.1).
 */
export function ElementsPanel() {
  const markup = useDocumentStore((s) => s.markup);
  const addShape = useDocumentStore((s) => s.addShape);
  const selectedRef = useSelectionStore((s) => s.element);
  const selectElement = useSelectionStore((s) => s.selectElement);
  const roots = useMemo(() => parseMarkup(markup), [markup]);
  const [collapsed, setCollapsed] = useState<ReadonlySet<ElementRef>>(new Set());
  const [menuOpen, setMenuOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggle = (ref: ElementRef) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(ref)) next.delete(ref);
      else next.add(ref);
      return next;
    });

  const handleAdd = (kind: ShapeKind) => {
    setMenuOpen(false);
    const result = addShape(kind, selectedRef);
    if (result.ok) {
      setError(null);
      selectElement(result.ref);
    } else {
      setError("Couldn't insert a shape here — the markup buffer couldn't be edited safely.");
    }
  };

  return (
    <section className="panel">
      <header className="panel-header panel-header-row">
        <span>Elements</span>
        <div className="add-menu">
          <button
            type="button"
            className="add-button"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            aria-label="Add shape"
            onClick={() => setMenuOpen((open) => !open)}
          >
            +
          </button>
          {menuOpen && (
            <ul className="add-menu-list" role="menu">
              {SHAPE_KINDS.map((kind) => (
                <li key={kind} role="none">
                  <button
                    type="button"
                    role="menuitem"
                    className="add-menu-item"
                    onClick={() => handleAdd(kind)}
                  >
                    {SHAPE_LABELS[kind]}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </header>
      {error && (
        <div className="rules-warning" role="alert">
          {error}
        </div>
      )}
      <div className="panel-body tree" role="tree" aria-label="Elements">
        {roots.map((node, index) => (
          <TreeNode
            key={node.ref}
            node={node}
            depth={0}
            index={index}
            siblingCount={roots.length}
            collapsed={collapsed}
            toggle={toggle}
          />
        ))}
      </div>
    </section>
  );
}

function TreeNode({
  node,
  depth,
  index,
  siblingCount,
  collapsed,
  toggle,
}: {
  node: ElementNode;
  depth: number;
  index: number;
  siblingCount: number;
  collapsed: ReadonlySet<ElementRef>;
  toggle: (ref: ElementRef) => void;
}) {
  const selectedRef = useSelectionStore((s) => s.element);
  const selectElement = useSelectionStore((s) => s.selectElement);
  const deleteElement = useDocumentStore((s) => s.deleteElement);
  const moveElement = useDocumentStore((s) => s.moveElement);
  const selected = selectedRef === node.ref;
  const hasChildren = node.children.length > 0;
  const isCollapsed = collapsed.has(node.ref);

  const handleDelete = () => {
    // Sibling indices shift on delete, so any held selection may go stale.
    if (deleteElement(node.ref).ok && selectedRef !== null) selectElement(null);
  };
  const handleMove = (direction: 'up' | 'down') => {
    const result = moveElement(node.ref, direction);
    if (result.ok && selected) selectElement(result.ref);
  };

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
        <span className="tree-actions">
          <button
            type="button"
            className="tree-action"
            aria-label={`Move ${node.tag} up`}
            disabled={index === 0}
            onClick={(e) => {
              e.stopPropagation();
              handleMove('up');
            }}
          >
            ↑
          </button>
          <button
            type="button"
            className="tree-action"
            aria-label={`Move ${node.tag} down`}
            disabled={index === siblingCount - 1}
            onClick={(e) => {
              e.stopPropagation();
              handleMove('down');
            }}
          >
            ↓
          </button>
          <button
            type="button"
            className="tree-action"
            aria-label={`Delete ${node.tag}`}
            onClick={(e) => {
              e.stopPropagation();
              handleDelete();
            }}
          >
            ✕
          </button>
        </span>
      </div>
      {hasChildren && !isCollapsed && (
        <div role="group">
          {node.children.map((child, childIndex) => (
            <TreeNode
              key={child.ref}
              node={child}
              depth={depth + 1}
              index={childIndex}
              siblingCount={node.children.length}
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
