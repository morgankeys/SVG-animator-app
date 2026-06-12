import { useEffect, useMemo, useState } from 'react';
import { useDocumentStore } from '../../state/documentStore';
import { useSelectionStore } from '../../state/selectionStore';
import { resolveRef } from '../../model/markup';
import { parseStyles } from '../../model/styles';
import { resolveEffectiveProperties } from '../../model/cascade';
import type { EffectiveProperty } from '../../model/cascade';
import type { EditResult } from '../../model/edit';
import { getSandboxBody } from '../../sandbox/registry';

/**
 * Style controls (Phase 4.2: editable, writing through the document store).
 * Grouping per docs/css-engine.md. Geometry attributes are markup-owned;
 * CSS properties are styles-owned — each row says which. Unset CSS properties
 * render an empty input (computed value as placeholder); committing one
 * triggers the write-target logic in model/edit.ts.
 */

const GEOMETRY_ATTRS = ['x', 'y', 'width', 'height', 'cx', 'cy', 'r', 'rx', 'ry', 'points', 'd'];

const CSS_GROUPS: Array<{ title: string; props: string[] }> = [
  { title: 'Transform', props: ['transform', 'transform-origin'] },
  { title: 'Appearance', props: ['fill', 'stroke', 'stroke-width', 'opacity'] },
  { title: 'Effects', props: ['filter', 'mix-blend-mode'] },
  { title: 'Animation', props: ['animation', 'transition'] },
];

export function RulesTab() {
  const markup = useDocumentStore((s) => s.markup);
  const styles = useDocumentStore((s) => s.styles);
  const applyStyleEdit = useDocumentStore((s) => s.applyStyleEdit);
  const applyAttributeEdit = useDocumentStore((s) => s.applyAttributeEdit);
  const selectedRef = useSelectionStore((s) => s.element);

  const projection = useMemo(() => {
    if (!selectedRef) return null;
    const doc = new DOMParser().parseFromString(markup, 'text/html');
    const element = resolveRef(doc.body, selectedRef);
    if (!element) return null;

    let effective: Map<string, EffectiveProperty>;
    let computed: CSSStyleDeclaration | null = null;
    let styleParseError = false;
    try {
      const liveBody = getSandboxBody();
      const liveElement = liveBody ? (resolveRef(liveBody, selectedRef) ?? undefined) : undefined;
      const view = liveElement?.ownerDocument.defaultView;
      computed = view && liveElement ? view.getComputedStyle(liveElement) : null;
      effective = resolveEffectiveProperties(parseStyles(styles), element, liveElement);
    } catch {
      effective = new Map();
      styleParseError = true;
    }
    return { element, effective, computed, styleParseError };
  }, [markup, styles, selectedRef]);

  if (!projection || !selectedRef) {
    return <div className="panel-body placeholder">Select an element to inspect its styles</div>;
  }

  const { element, effective, computed, styleParseError } = projection;
  const grouped = new Set(CSS_GROUPS.flatMap((g) => g.props));
  const other = [...effective.keys()].filter((p) => !grouped.has(p)).sort();

  const commitStyle = (property: string, value: string) =>
    describeFailure(applyStyleEdit(selectedRef, property, value));
  const commitAttribute = (attribute: string, value: string) =>
    describeFailure(applyAttributeEdit(selectedRef, attribute, value));

  return (
    <div className="panel-body rules">
      {styleParseError && (
        <div className="rules-warning" role="alert">
          Styles buffer could not be parsed — rules unavailable.
        </div>
      )}
      <GeometryGroup element={element} onCommit={commitAttribute} />
      {CSS_GROUPS.map(({ title, props }) => (
        <section key={title} className="rules-group">
          <h3 className="rules-group-title">{title}</h3>
          {props.map((prop) => (
            <CssPropertyRow
              key={prop}
              prop={prop}
              entry={effective.get(prop)}
              placeholder={computed?.getPropertyValue(prop) || 'unset'}
              onCommit={commitStyle}
            />
          ))}
        </section>
      ))}
      {other.length > 0 && (
        <section className="rules-group">
          <h3 className="rules-group-title">Other</h3>
          {other.map((prop) => (
            <CssPropertyRow
              key={prop}
              prop={prop}
              entry={effective.get(prop)}
              placeholder="unset"
              onCommit={commitStyle}
            />
          ))}
        </section>
      )}
    </div>
  );
}

/** SVG geometry lives in markup attributes, not CSS (docs/css-engine.md). */
function GeometryGroup({
  element,
  onCommit,
}: {
  element: Element;
  onCommit: (attribute: string, value: string) => string | null;
}) {
  const present = GEOMETRY_ATTRS.filter((a) => element.hasAttribute(a));
  if (present.length === 0) return null;
  return (
    <section className="rules-group">
      <h3 className="rules-group-title">
        Layout{' '}
        <span className="rules-owner" title="These values live in the markup buffer">
          markup
        </span>
      </h3>
      {present.map((attr) => (
        <EditableRow
          key={attr}
          name={attr}
          value={element.getAttribute(attr) ?? ''}
          onCommit={(v) => onCommit(attr, v)}
        />
      ))}
    </section>
  );
}

function CssPropertyRow({
  prop,
  entry,
  placeholder,
  onCommit,
}: {
  prop: string;
  entry: EffectiveProperty | undefined;
  placeholder: string;
  onCommit: (property: string, value: string) => string | null;
}) {
  const inline = entry !== undefined && entry.source === null;
  const competingHint =
    entry && entry.competing.length > 0
      ? `Also set by: ${entry.competing.map((c) => `${c.selector} (${c.value})`).join(', ')}`
      : null;

  return (
    <EditableRow
      name={prop}
      nameHint={entry?.source ? `From ${entry.source.selector}` : undefined}
      value={entry?.value ?? ''}
      placeholder={placeholder}
      disabled={entry !== undefined && !entry.editable}
      badge={inline ? 'inline' : undefined}
      badgeHint="Set by the element's style attribute (markup-owned)"
      competingHint={competingHint}
      onCommit={(v) => onCommit(prop, v)}
    />
  );
}

function EditableRow({
  name,
  nameHint,
  value,
  placeholder,
  disabled = false,
  badge,
  badgeHint,
  competingHint,
  onCommit,
}: {
  name: string;
  nameHint?: string;
  value: string;
  placeholder?: string;
  disabled?: boolean;
  badge?: string;
  badgeHint?: string;
  competingHint?: string | null;
  onCommit: (value: string) => string | null;
}) {
  const [draft, setDraft] = useState(value);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    setDraft(value);
    setError(null);
  }, [value]);

  // Empty commits revert (declaration removal is a later affordance).
  const commit = () => {
    const next = draft.trim();
    if (next === '' || next === value) {
      setDraft(value);
      return;
    }
    setError(onCommit(next));
  };

  return (
    <div className="rules-row">
      <span className="rules-prop" title={nameHint}>
        {name}
      </span>
      <input
        className="rules-input"
        aria-label={name}
        value={draft}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit();
          if (e.key === 'Escape') setDraft(value);
        }}
      />
      {badge && (
        <span className="rules-owner" title={badgeHint}>
          {badge}
        </span>
      )}
      {competingHint && (
        <span className="rules-conflict" role="img" aria-label="Competing rules" title={competingHint}>
          ⚠
        </span>
      )}
      {error && (
        <span className="rules-error" role="alert" title={error}>
          ⚠
        </span>
      )}
    </div>
  );
}

function describeFailure(result: EditResult): string | null {
  if (result.ok) return null;
  switch (result.reason) {
    case 'not-editable':
      return "Set by the element's style attribute — edit it in the markup.";
    case 'styles-unparsable':
      return 'Styles buffer could not be parsed.';
    case 'markup-write-failed':
      return "Could not locate this element's tag in the markup buffer.";
    case 'element-not-found':
      return 'Element no longer exists in the markup.';
  }
}
