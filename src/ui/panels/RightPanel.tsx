import { useUiStore } from '../../state/uiStore';
import type { RightTab } from '../../state/uiStore';
import { useDocumentStore } from '../../state/documentStore';
import { RulesTab } from './RulesTab';
import { CodeView } from '../shared/CodeView';

const tabs: Array<{ id: RightTab; label: string }> = [
  { id: 'rules', label: 'Rules' },
  { id: 'code', label: 'Code' },
];

/** Right panel: Rules (controls) / Code (the styles buffer — source of truth). */
export function RightPanel() {
  const rightTab = useUiStore((s) => s.rightTab);
  const setRightTab = useUiStore((s) => s.setRightTab);
  const styles = useDocumentStore((s) => s.styles);

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
      {rightTab === 'rules' ? <RulesTab /> : <CodeView value={styles} language="css" />}
    </section>
  );
}
