import { SandboxFrame } from '../../sandbox/SandboxFrame';
import { CodeTab } from './CodeTab';
import { FramesView } from '../frames/FramesView';
import { useUiStore } from '../../state/uiStore';
import type { CenterTab } from '../../state/uiStore';

const tabs: Array<{ id: CenterTab; label: string }> = [
  { id: 'preview', label: 'Preview' },
  { id: 'code', label: 'Code' },
  { id: 'split', label: 'Split' },
  { id: 'frames', label: 'Frames' },
];

/** Center view: Preview / Code / Split / Frames (imported SVG states). */
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
      {centerTab === 'frames' ? (
        <div className="panel-body frames-view-body">
          <FramesView />
        </div>
      ) : (
        <div className={`panel-body canvas${centerTab === 'split' ? ' split' : ''}`}>
          {centerTab !== 'code' && <SandboxFrame />}
          {centerTab !== 'preview' && <CodeTab />}
        </div>
      )}
    </section>
  );
}
