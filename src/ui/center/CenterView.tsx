import { SandboxFrame } from '../../sandbox/SandboxFrame';
import { CodeTab } from './CodeTab';
import { useUiStore } from '../../state/uiStore';
import type { CenterTab } from '../../state/uiStore';

const tabs: Array<{ id: CenterTab; label: string }> = [
  { id: 'preview', label: 'Preview' },
  { id: 'code', label: 'Code' },
  { id: 'split', label: 'Split' },
];

/** Center view: Preview / Code / Split. */
export function CenterView() {
  const centerTab = useUiStore((s) => s.centerTab);
  const setCenterTab = useUiStore((s) => s.setCenterTab);

  return (
    <section className="center-view panel">
      <header className="panel-header tab-row">
        {tabs.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            className={`tab${centerTab === id ? ' active' : ''}`}
            aria-pressed={centerTab === id}
            onClick={() => setCenterTab(id)}
          >
            {label}
          </button>
        ))}
      </header>
      <div className={`panel-body canvas${centerTab === 'split' ? ' split' : ''}`}>
        {centerTab !== 'code' && <SandboxFrame />}
        {centerTab !== 'preview' && <CodeTab />}
      </div>
    </section>
  );
}
