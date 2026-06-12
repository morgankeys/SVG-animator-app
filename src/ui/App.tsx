import { ElementsPanel } from './panels/ElementsPanel';
import { RightPanel } from './panels/RightPanel';
import { CenterView } from './center/CenterView';
import { Timeline } from './center/Timeline';

/**
 * Static layout shell (Phase 0.2). Three panels + timeline per docs/ui-spec.md.
 * No logic yet — panels fill with real projections starting in Phase 1.
 */
export function App() {
  return (
    <div className="app-shell">
      <aside className="left-panel">
        <ElementsPanel />
      </aside>
      <main className="center-area">
        <CenterView />
        <Timeline />
      </main>
      <aside className="right-panel">
        <RightPanel />
      </aside>
    </div>
  );
}
