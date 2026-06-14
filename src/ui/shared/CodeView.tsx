import { useEffect, useRef } from 'react';
import type { EditorView } from 'codemirror';
import {
  createEditor,
  replaceEditorDoc,
  setEditorHighlight,
} from '../../lib/codemirror';
import type { CodeLanguage, HighlightRange } from '../../lib/codemirror';

/**
 * Syntax-highlighted, foldable code surface with optional spotlight. Read-only
 * by default; pass `onChange` to make it an editable authoring surface (Phase 8
 * SCSS Code tab). The buffer prop stays the source of truth: editing fires
 * `onChange`, and external buffer changes (other panels, undo) flow back in via
 * the value effect. Because the store updates synchronously on `onChange`, the
 * incoming `value` already matches the editor's content, so the guard below
 * skips the redundant replace and the caret is preserved while typing.
 */
export function CodeView({
  value,
  language,
  highlight,
  onChange,
}: {
  value: string;
  language: CodeLanguage;
  highlight?: HighlightRange | null;
  onChange?: (value: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const editable = Boolean(onChange);

  useEffect(() => {
    const view = createEditor(
      containerRef.current!,
      '',
      language,
      editable ? { onChange: (v) => onChangeRef.current?.(v) } : {},
    );
    viewRef.current = view;
    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, [language, editable]);

  useEffect(() => {
    if (viewRef.current && viewRef.current.state.doc.toString() !== value) {
      replaceEditorDoc(viewRef.current, value);
    }
  }, [value, language, editable]);

  // Re-apply after value changes too: a full doc replacement drops the mark.
  useEffect(() => {
    if (viewRef.current) setEditorHighlight(viewRef.current, highlight ?? null);
  }, [highlight, value, language, editable]);

  return <div ref={containerRef} className="code-view" data-testid="code-view" />;
}
