import { useEffect } from 'react';
import { ElementsPanel } from './panels/ElementsPanel';
import { RightPanel } from './panels/RightPanel';
import { CenterView } from './center/CenterView';
import { Timeline } from './center/Timeline';
import { useDocumentStore } from '../state/documentStore';

/**
 * Layout shell: three panels + timeline per docs/ui-spec.md, plus app-wide
 * undo/redo shortcuts (Phase 4.3).
 */
export function App() {
  useUndoShortcuts();
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

/**
 * Cmd/Ctrl+Z undoes the last buffer change; with Shift it redoes. Text-editing
 * surfaces are left alone — inputs keep native undo and CodeMirror (Phase 8)
 * brings its own history.
 */
function useUndoShortcuts() {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== 'z' || !(e.metaKey || e.ctrlKey)) return;
      if (isTextEditingTarget(e.target)) return;
      e.preventDefault();
      const { undo, redo } = useDocumentStore.getState();
      if (e.shiftKey) redo();
      else undo();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);
}

function isTextEditingTarget(target: EventTarget | null): boolean {
  // nodeType + duck typing, not instanceof (cross-realm safety, see CLAUDE.md).
  const el = target as HTMLElement | null;
  if (!el || el.nodeType !== Node.ELEMENT_NODE) return false;
  const tag = el.tagName.toLowerCase();
  return tag === 'input' || tag === 'textarea' || Boolean(el.isContentEditable);
}
