import { useEffect, useRef } from 'react';
import type { EditorView } from 'codemirror';
import {
  createReadOnlyEditor,
  replaceEditorDoc,
  setEditorHighlight,
} from '../../lib/codemirror';
import type { CodeLanguage, HighlightRange } from '../../lib/codemirror';

/** Read-only, syntax-highlighted, foldable code surface with optional spotlight. */
export function CodeView({
  value,
  language,
  highlight,
}: {
  value: string;
  language: CodeLanguage;
  highlight?: HighlightRange | null;
}) {
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

  // Re-apply after value changes too: a full doc replacement drops the mark.
  useEffect(() => {
    if (viewRef.current) setEditorHighlight(viewRef.current, highlight ?? null);
  }, [highlight, value, language]);

  return <div ref={containerRef} className="code-view" data-testid="code-view" />;
}
