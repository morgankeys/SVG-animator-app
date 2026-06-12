import { EditorView, basicSetup } from 'codemirror';
import { EditorState, type Extension } from '@codemirror/state';
import { html } from '@codemirror/lang-html';
import { css } from '@codemirror/lang-css';
import { oneDark } from '@codemirror/theme-one-dark';

export type CodeLanguage = 'html' | 'css';

const languages: Record<CodeLanguage, () => Extension> = {
  html, // handles embedded <style> CSS highlighting too
  css,
};

/**
 * Read-only CodeMirror 6 view: syntax highlighting + fold gutter (via
 * basicSetup) on a dark theme. Editable surfaces arrive in later phases.
 */
export function createReadOnlyEditor(
  parent: HTMLElement,
  doc: string,
  language: CodeLanguage,
): EditorView {
  return new EditorView({
    parent,
    state: EditorState.create({
      doc,
      extensions: [
        basicSetup,
        languages[language](),
        oneDark,
        EditorState.readOnly.of(true),
        EditorView.editable.of(false),
      ],
    }),
  });
}

/** Replace the entire document of an existing view (e.g. buffers changed). */
export function replaceEditorDoc(view: EditorView, doc: string): void {
  view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: doc } });
}
