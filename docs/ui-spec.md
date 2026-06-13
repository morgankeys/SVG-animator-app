# UI Specification

Layout inspired by Figma / Framer: left panel, center view (preview/code + timeline), right panel. Every panel is a **projection of the buffers** ([`architecture.md`](architecture.md)).

```
┌──────────────┬───────────────────────────────────────┬──────────────┐
│              │  [ Preview | Code | Split ]            │              │
│   Elements   │                                        │  [Rules|Code]│
│   (markup    │         Center View                    │  Right panel │
│    tree)     │   (canvas / code / both)               │  (controls)  │
│              │                                        │              │
│              ├────────────────────────────────────────┤              │
│              │   Timeline (animation/transition rows) │              │
└──────────────┴───────────────────────────────────────┴──────────────┘
```

## Left panel — Elements

- Titled **"Elements"** (not "Layers"). Reflects the **SVG/HTML markup** directly and exactly; markup is the source of truth.
- **Collapsible hierarchy** mirroring the DOM tree from the markup buffer.
- **Exclude `<defs>`** elements (for now).
- Non-graphical containers (`<svg>`, `<g>`, wrapper `<div>`) are treated like **frames**.
- **Selection sync (bidirectional):** selecting a node here highlights it on the canvas; selecting on the canvas highlights it here. Backed by shared selection state.
- Each row: disclosure triangle, element label (tag + id/class hint), visibility affordance (later).
- **Editing affordances (Phase 5, done):** an **Add** menu inserts shapes (placed inside a selected container, beside a selected leaf, else the first root container); each row has **↑ / ↓ / ✕** controls to reorder among siblings and delete. All mutate the markup buffer through the document store (one undoable step each). Drag-to-reorder, re-parenting, and canvas manipulation are deferred.

## Center view

Three tabs: **Preview · Code · Split**.

### Preview tab

- A Figma-like **canvas** rendering the SVG via the sandbox iframe.
- Elements are **selectable** on the canvas; selection syncs with the Elements panel and drives the Rules panel.
- Pan/zoom canvas controls.
- **Future:** direct manipulation (drag to move/resize) — out of scope for early releases.

### Code tab

- Full, **consolidated** view of everything that will be exported: HTML + SVG markup and **all CSS** (SCSS compiled to CSS).
- **Read-only** in this consolidated view, but elements are **collapsible**.
- Good formatting + **syntax highlighting** (CodeMirror 6).

> Note: per-panel Code tabs (right panel) *are* the editable code surfaces in later phases; this center Code tab is the read-only "what will ship" view.

### Split tab

- Preview and Code side by side, simultaneously.

## Timeline (below center view)

- **Play** and **scrub** controls (driven by the Web Animations API — see [`css-engine.md`](css-engine.md)).
- **Multiple rows.** Each row corresponds to **one CSS `animation` rule** (e.g. `animation: movement 6s infinite`). Do the same for **`transition`** rules.
- A row is built from the animation's **duration** plus **transformation points** placed at the `@keyframes` **percentages** (like After Effects, but **no per-property hierarchy** — one row per animation, period).
- **Row selection** → show the associated `@keyframes` rule in the **right panel**.
- **Stop selection** (a specific transformation point) → highlight the specific block, e.g. `50% { ... }`, within that `@keyframes` rule.

## Right panel — control panel

Two tabs: **Rules · Code**.

### Rules tab

- Figma-like **UI controls** reflecting all potential CSS for the selection (grouping in [`css-engine.md`](css-engine.md): Layout, Transform, Appearance, Effects, Animation).
- Controls reflect the **cascade-resolved winning value**; competing/duplicative rules show an **inline warning label** next to the control.
- Some controls own **markup attributes** (SVG geometry), others own **CSS declarations** — be explicit per control about which buffer it writes to.
- When a row/stop is selected in the Timeline, this tab focuses the relevant `@keyframes` (and the specific stop block).

### Code tab

- The **editable** code surface (later phases) and the source of truth for styles: syntax-highlighted SCSS/CSS for the current context.
- Proper formatting + syntax highlighting.

## Shared selection model

A single selection store, consumed by all panels:

```ts
Selection {
  element?: ElementRef                      // currently selected element (tree/canvas/rules)
  timeline?: { rowId, stopIndex: number | null } // selected animation row / keyframe stop
}
```

(Implemented in Phase 6: `element` and `timeline` are independent axes; selecting a Timeline row also points `element` at that row's element so the Rules panel follows along. `stopIndex` is null when the whole row — not a specific stop — is selected.)

`ElementRef` is a stable reference into the markup tree (e.g. a path of child indices, or an assigned stable id). It must survive re-parses of the buffer.

## Interaction principles

- **No hidden state:** if a control can't faithfully represent the code, it warns and degrades, it doesn't lie.
- **Round-trip everything:** a UI edit changes the buffer; the buffer change re-renders the UI. The user could achieve the identical result by typing in the Code tab.
- **Keyboard + accessibility** considered from the start for the tree and controls (defer polish, but don't design it out).
