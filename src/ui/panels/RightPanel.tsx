import { useMemo } from 'react';
import { useUiStore } from '../../state/uiStore';
import type { RightTab } from '../../state/uiStore';
import { useDocumentStore } from '../../state/documentStore';
import { useSelectionStore } from '../../state/selectionStore';
import { useTimelineRows } from '../center/useTimelineRows';
import { RulesTab } from './RulesTab';
import { CodeView } from '../shared/CodeView';

const tabs: Array<{ id: RightTab; label: string }> = [
  { id: 'rules', label: 'Rules' },
  { id: 'code', label: 'Code' },
];

/**
 * Right panel: Rules (controls) / Code (the styles buffer — source of truth).
 * Selecting a Timeline row/stop switches to Code and spotlights the linked
 * `@keyframes` block (or its specific stop) in the buffer (docs/ui-spec.md, 6.4).
 */
export function RightPanel() {
  const rightTab = useUiStore((s) => s.rightTab);
  const setRightTab = useUiStore((s) => s.setRightTab);
  const styles = useDocumentStore((s) => s.styles);
  const timeline = useSelectionStore((s) => s.timeline);
  const rows = useTimelineRows();

  const highlight = useMemo(() => {
    if (!timeline) return null;
    const row = rows.find((r) => r.rowId === timeline.rowId);
    if (!row) return null;
    // Row select spotlights the @keyframes (animations) or the `transition`
    // declaration; stop select (animations only) narrows to that stop's block.
    return timeline.stopIndex !== null
      ? (row.stops[timeline.stopIndex]?.range ?? null)
      : (row.keyframesRange ?? row.declarationRange);
  }, [timeline, rows]);

  return (
    <section className="panel">
      <header className="panel-header tab-row">
        {tabs.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            className={`tab${rightTab === id ? ' active' : ''}`}
            aria-pressed={rightTab === id}
            onClick={() => setRightTab(id)}
          >
            {label}
          </button>
        ))}
      </header>
      {rightTab === 'rules' ? (
        <RulesTab />
      ) : (
        <CodeView value={styles} language="css" highlight={highlight} />
      )}
    </section>
  );
}
