import { useMemo } from 'react';
import { useDocumentStore } from '../../state/documentStore';
import { useSelectionStore } from '../../state/selectionStore';
import { resolveRef } from '../../model/markup';
import { parseStyles } from '../../model/styles';
import { resolveEffectiveProperties } from '../../model/cascade';
import type { EffectiveProperty } from '../../model/cascade';
import { getSandboxBody } from '../../sandbox/registry';

/**
 * Read-only style controls (Phase 3.2; editing arrives in Phase 4).
 * Grouping per docs/css-engine.md. Geometry attributes are markup-owned;
 * CSS properties are styles-owned — each row says which.
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
  const selectedRef = useSelectionStore((s) => s.element);

  const projection = useMemo(() => {
    if (!selectedRef) return null;
    const doc = new DOMParser().parseFromString(markup, 'text/html');
    const element = resolveRef(doc.body, selectedRef);
    if (!element) return null;

    let effective: Map<string, EffectiveProperty>;
    let styleParseError = false;
    try {
      const liveBody = getSandboxBody();
      const liveElement = liveBody ? (resolveRef(liveBody, selectedRef) ?? undefined) : undefined;
      effective = resolveEffectiveProperties(parseStyles(styles), element, liveElement);
    } catch {
      effective = new Map();
      styleParseError = true;
    }
    return { element, effective, styleParseError };
  }, [markup, styles, selectedRef]);

  if (!projection) {
    return <div className="panel-body placeholder">Select an element to inspect its styles</div>;
  }

  const { element, effective, styleParseError } = projection;
  const grouped = new Set(CSS_GROUPS.flatMap((g) => g.props));
  const other = [...effective.keys()].filter((p) => !grouped.has(p)).sort();

  return (
    <div className="panel-body rules">
      {styleParseError && (
        <div className="rules-warning" role="alert">
          Styles buffer could not be parsed — rules unavailable.
        </div>
      )}
      <GeometryGroup element={element} />
      {CSS_GROUPS.map(({ title, props }) => (
        <PropertyGroup key={title} title={title} props={props} effective={effective} />
      ))}
      {other.length > 0 && <PropertyGroup title="Other" props={other} effective={effective} />}
    </div>
  );
}

/** SVG geometry lives in markup attributes, not CSS (docs/css-engine.md). */
function GeometryGroup({ element }: { element: Element }) {
  const present = GEOMETRY_ATTRS.filter((a) => element.hasAttribute(a));
  if (present.length === 0) return null;
  return (
    <section className="rules-group">
      <h3 className="rules-group-title">
        Layout <span className="rules-owner" title="These values live in the markup buffer">markup</span>
      </h3>
      {present.map((attr) => (
        <div key={attr} className="rules-row">
          <span className="rules-prop">{attr}</span>
          <span className="rules-value">{element.getAttribute(attr)}</span>
        </div>
      ))}
    </section>
  );
}

function PropertyGroup({
  title,
  props,
  effective,
}: {
  title: string;
  props: string[];
  effective: Map<string, EffectiveProperty>;
}) {
  const rows = props
    .map((p) => ({ prop: p, entry: effective.get(p) }))
    .filter((r) => r.entry !== undefined);
  if (rows.length === 0) return null;

  return (
    <section className="rules-group">
      <h3 className="rules-group-title">{title}</h3>
      {rows.map(({ prop, entry }) => (
        <PropertyRow key={prop} entry={entry!} />
      ))}
    </section>
  );
}

function PropertyRow({ entry }: { entry: EffectiveProperty }) {
  const competingHint =
    entry.competing.length > 0
      ? `Also set by: ${entry.competing.map((c) => `${c.selector} (${c.value})`).join(', ')}`
      : null;

  return (
    <div className="rules-row">
      <span className="rules-prop" title={entry.source ? `From ${entry.source.selector}` : undefined}>
        {entry.property}
      </span>
      <span className="rules-value">{entry.value}</span>
      {entry.source === null && (
        <span className="rules-owner" title="Set by the element's style attribute (markup-owned)">
          inline
        </span>
      )}
      {competingHint && (
        <span className="rules-conflict" role="img" aria-label="Competing rules" title={competingHint}>
          ⚠
        </span>
      )}
    </div>
  );
}
