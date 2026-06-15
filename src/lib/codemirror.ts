import { EditorView, basicSetup } from 'codemirror';
import { EditorState, StateEffect, StateField, type Extension } from '@codemirror/state';
import { Decoration, type DecorationSet } from '@codemirror/view';
import { html } from '@codemirror/lang-html';
import { css } from '@codemirror/lang-css';
import { sass } from '@codemirror/lang-sass';
import { oneDark } from '@codemirror/theme-one-dark';

export type CodeLanguage = 'html' | 'css' | 'scss';

/** A character span to spotlight in a read-only view (Timeline linking, 6.4). */
export interface HighlightRange {
  from: number;
  to: number;
}

const languages: Record<CodeLanguage, () => Extension> = {
  html, // handles embedded <style> CSS highlighting too
  css,
  scss: () => sass({ indented: false }), // SCSS syntax (`//`, `$vars`, nesting, `&`)
};

// A single mark decoration spotlights the linked range; mapped through edits.
const setHighlight = StateEffect.define<HighlightRange | null>();
const highlightMark = Decoration.mark({ class: 'cm-range-highlight' });

const highlightField = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(deco, tr) {
    deco = deco.map(tr.changes);
    for (const effect of tr.effects) {
      if (!effect.is(setHighlight)) continue;
      const range = effect.value;
      deco =
        range && range.to > range.from
          ? Decoration.set([highlightMark.range(range.from, range.to)])
          : Decoration.none;
    }
    return deco;
  },
  provide: (field) => EditorView.decorations.from(field),
});

const highlightTheme = EditorView.baseTheme({
  '.cm-range-highlight': { backgroundColor: 'rgba(79, 156, 249, 0.25)' },
});

export interface EditorOptions {
  /** When set, the view is editable and fires this on every document change. */
  onChange?: (value: string) => void;
}

/**
 * CodeMirror 6 view: syntax highlighting + fold gutter (via basicSetup) on a
 * dark theme, plus a range-highlight field for Timeline linking. Read-only by
 * default; pass `onChange` to make it an editable authoring surface (Phase 8 —
 * the SCSS Code tab writes back through this callback). CodeMirror keeps its own
 * undo history for the editable case.
 */
export function createEditor(
  parent: HTMLElement,
  doc: string,
  language: CodeLanguage,
  options: EditorOptions = {},
): EditorView {
  const editable = Boolean(options.onChange);
  const extensions: Extension[] = [
    basicSetup,
    languages[language](),
    oneDark,
    highlightField,
    highlightTheme,
  ];
  if (editable) {
    extensions.push(
      EditorView.updateListener.of((update) => {
        if (update.docChanged) options.onChange!(update.state.doc.toString());
      }),
    );
  } else {
    extensions.push(EditorState.readOnly.of(true), EditorView.editable.of(false));
  }
  return new EditorView({ parent, state: EditorState.create({ doc, extensions }) });
}

/** Read-only convenience wrapper around {@link createEditor}. */
export function createReadOnlyEditor(
  parent: HTMLElement,
  doc: string,
  language: CodeLanguage,
): EditorView {
  return createEditor(parent, doc, language);
}

/** Replace the entire document of an existing view (e.g. buffers changed). */
export function replaceEditorDoc(view: EditorView, doc: string): void {
  view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: doc } });
}

/** Spotlight `range` (clamped to the doc) and scroll it into view; null clears. */
export function setEditorHighlight(view: EditorView, range: HighlightRange | null): void {
  const max = view.state.doc.length;
  const clamped =
    range && range.from < max ? { from: range.from, to: Math.min(range.to, max) } : null;
  const effects: StateEffect<unknown>[] = [setHighlight.of(clamped)];
  if (clamped) effects.push(EditorView.scrollIntoView(clamped.from, { y: 'center' }));
  view.dispatch({ effects });
}
