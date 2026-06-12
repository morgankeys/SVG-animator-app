# Architecture: The Source-of-Truth Model

This is the most important document in the repo. The entire app is organized around one invariant:

> **The text buffers (markup + styles) are the only source of truth. Every view is a pure projection derived from them. UI edits mutate the buffers, never a parallel UI state.**

If you ever find UI state holding the "real" value of a CSS property, that's a bug against this architecture.

## The document

A project's canonical state is two text buffers (plus light metadata):

```
Document {
  markup:  string   // HTML + inline SVG. Source of truth for structure.
  styles:  string   // SCSS (a superset of CSS). Source of truth for style/animation.
  meta:    { frames?: Frame[], correspondences?: ... } // for SVG-keyframe feature
}
```

Everything else — the element tree, the resolved styles for the Rules panel, the timeline rows — is **derived** from these strings on each change.

## Data flow

```
            ┌──────────────────────────────────────────────┐
            │  Document (markup: string, styles: string)   │  ← SOURCE OF TRUTH
            └──────────────────────────────────────────────┘
                 │ parse                          │ compile + parse
                 ▼                                ▼
        Markup AST (DOM tree)        SCSS ──sass──► CSS ──postcss──► CSS AST
                 │                                │
                 └───────────────┬────────────────┘
                                 ▼
              Sandbox <iframe>:  render markup + compiled CSS
                                 │  (the browser IS our CSS engine)
        ┌────────────┬───────────┼───────────────┬──────────────────┐
        ▼            ▼           ▼               ▼                  ▼
  Elements panel   Canvas    Rules panel      Timeline          Code views
  (tree from       (rendered (cascade-        (@keyframes +     (pretty-printed
   markup AST)      SVG +     resolved         animation/        markup + CSS,
                    selection)effective decls) transition rows)  read-only early)
```

### Read path (code → UI)

1. A buffer changes.
2. **Markup** is parsed with the browser's `DOMParser` into a DOM tree — accurate, free, and exactly matches what renders.
3. **Styles**: SCSS is compiled to CSS with `sass`; the CSS is parsed into a PostCSS AST.
4. The compiled CSS + markup are injected into a **sandboxed iframe** and rendered.
5. Panels derive their view models from the ASTs and the live iframe DOM (see [`css-engine.md`](css-engine.md) for cascade resolution).

### Write path (UI → code)

1. A UI control (e.g. opacity slider) requests a change to a specific declaration.
2. The change is applied as a **mutation on the AST node** (PostCSS for styles, DOM for markup) — *in place*, preserving surrounding formatting/comments.
3. The mutated AST is serialized back to the buffer string.
4. The buffer change re-triggers the read path. UI re-projects.

There is no separate "apply" step and no optimistic UI state. The round trip is the update.

## Why a sandboxed iframe is the renderer

- **Style isolation.** The user's CSS must not leak into the app's own UI, and vice versa. An iframe is a clean style boundary.
- **The browser is the CSS engine.** Rather than re-implementing the cascade, specificity, `@keyframes`, and `transition` timing, we render real CSS and *ask the browser*: `element.matches(selector)`, `getComputedStyle(element)`, and `element.getAnimations()`. This is dramatically more correct than a hand-rolled engine.
- **Selection & hit-testing.** Canvas selection maps to real DOM elements inside the iframe.

The iframe communicates with the app via a thin, typed bridge (postMessage or direct `contentWindow` access since same-origin). Keep that bridge small and documented.

## Core invariants (do not violate)

1. **Buffers are truth.** Never store the authoritative value of a style/structure anywhere but the buffers.
2. **Projections are pure & rebuildable.** Any derived view model must be reconstructable from the buffers alone.
3. **Mutate ASTs in place** to preserve user formatting/comments; don't regenerate buffers from scratch on every keystroke.
4. **Ambiguity is surfaced, never hidden.** If a value's origin is ambiguous (competing rules, non-round-trippable SCSS), show an inline warning and degrade the control gracefully (read-only / "detached").
5. **The browser resolves the cascade.** Display the *winning* value per CSS precedence; don't invent precedence logic.
6. **Selection is shared state**, keyed by a stable element reference, consumed by every panel.

## Module boundaries

```
src/
  model/        # framework-agnostic core. NO React imports here.
    document.ts     # the Document type, buffer get/set, serialization
    markup.ts       # DOMParser-based parse, tree extraction, mutation helpers
    styles.ts       # sass compile + postcss parse + serialize + mutation helpers
    cascade.ts      # given an element + CSS AST, resolve effective declarations
    animation.ts    # parse @keyframes/animation/transition into timeline models
  sandbox/      # iframe renderer + typed bridge (selection, computed styles, WAAPI)
  state/        # Zustand stores: document, selection, ui (active tabs, etc.)
  ui/
    center/         # PreviewTab, CodeTab, SplitView, Timeline
    panels/         # ElementsPanel, RulesPanel (each with Rules + Code tabs)
    shared/         # reusable controls, CodeMirror wrappers
  lib/          # thin wrappers around postcss, sass, codemirror
```

**Rule:** `model/` is pure TypeScript with no React and no DOM-app dependencies (it may use `DOMParser`/`document` for parsing, which is fine and testable in jsdom). This keeps the hard logic unit-testable in isolation, which is where most bugs will live.

## State management

- **Zustand** stores. The document store holds the buffers + derived caches (recomputed via selectors/memoization). Selection and transient UI (active tabs, timeline playhead) live in separate stores.
- **Undo/redo** is implemented as a history of buffer snapshots (or AST commands) at the document-store level — see project plan Phase 4.

## Open questions (track in project plan, don't pre-decide here)

- Exact write-target strategy: when the UI creates a *new* declaration, which rule does it land in? (Selected element's most-specific matching rule? A dedicated per-element rule? See [`css-engine.md`](css-engine.md).)
- SCSS round-trip depth: how much SCSS (variables, nesting, mixins) is editable from the UI vs. read-only-with-warning. Phased in Phase 8.
