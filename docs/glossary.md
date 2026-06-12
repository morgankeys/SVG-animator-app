# Glossary

Shared vocabulary. Use these terms consistently in code and docs.

- **Document** — the canonical project state: the `markup` and `styles` text buffers (+ metadata). The single source of truth.
- **Buffer** — a raw text string that is part of the Document (`markup`, `styles`). Authoritative.
- **Projection** — any view (Elements tree, Rules panel, Timeline, canvas) derived purely from the buffers. Never authoritative.
- **Markup AST / Element tree** — the parsed DOM tree of the `markup` buffer (via `DOMParser`). `<defs>` excluded from the Elements panel.
- **CSS AST** — the PostCSS parse of the compiled CSS. The canonical model for editing style declarations.
- **Sandbox** — the same-origin `<iframe>` that renders compiled CSS + markup. Acts as our CSS engine (matches, computed styles, animations).
- **ElementRef** — a stable reference to a node in the markup tree that survives re-parses (used by shared selection). Implemented as a path of element-child indices (`"0/0/1"`); indices count **all** elements including `<defs>` (which the projected tree omits), so a ref resolves identically against the parsed buffer and the live sandbox DOM.
- **Effective declaration / EffectiveProperty** — the cascade-resolved winning value of a CSS property for a selected element, plus provenance and competing declarations.
- **Write-target rule** — the CSS rule a UI edit writes a *new* declaration into (see [`css-engine.md`](css-engine.md)).
- **Competing rules** — multiple matching rules declaring the same property; trigger an inline warning.
- **Round-trip** — the property that a UI edit and a hand-edit in the Code tab produce the identical buffer change.
- **Timeline row** — one CSS `animation` (or `transition`) rendered as a single track; stops sit at `@keyframes` percentages. No per-property hierarchy.
- **Stop** — a transformation point on a timeline row, corresponding to a keyframe percentage block (`50% { … }`).
- **Frame** — an imported SVG representing one state of the artwork, for the SVG-keyframes feature.
- **Correspondence** — a link between nodes across frames that represent the same element; gets one canonical id in the output.
- **Canonical id** — the unified id assigned to a correspondence in the generated output (e.g. `circle` from `circle-1`/`circle-2`).
