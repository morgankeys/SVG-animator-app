import { useEffect, useRef } from 'react';
import type { EditorView } from 'codemirror';
import { createReadOnlyEditor, replaceEditorDoc } from '../../lib/codemirror';
import type { CodeLanguage } from '../../lib/codemirror';

/** Read-only, syntax-highlighted, foldable code surface. */
export function CodeView({ value, language }: { value: string; language: CodeLanguage }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);

  useEffect(() => {
    const view = createReadOnlyEditor(containerRef.current!, '', language);
    viewRef.current = view;
    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, [language]);

  useEffect(() => {
    if (viewRef.current && viewRef.current.state.doc.toString() !== value) {
      replaceEditorDoc(viewRef.current, value);
    }
  }, [value, language]);

  return <div ref={containerRef} className="code-view" data-testid="code-view" />;
}
