# CLAUDE.md — Agent Operating Guide

You are building **CSS Animator**, a desktop web app for authoring CSS/SCSS animations through a Figma-style GUI where **the code is the source of truth**. Read this before doing anything.

## Read first

1. [`docs/vision.md`](docs/vision.md) — what we're building and why; scope boundaries.
2. [`docs/architecture.md`](docs/architecture.md) — the source-of-truth model. **Non-negotiable invariants live here.**
3. [`docs/project-plan.md`](docs/project-plan.md) — pick up the lowest unchecked step.
4. [`docs/css-engine.md`](docs/css-engine.md), [`docs/ui-spec.md`](docs/ui-spec.md), [`docs/svg-interpolation.md`](docs/svg-interpolation.md), [`docs/glossary.md`](docs/glossary.md) — as relevant to your step.

## The one rule that matters most

**The `markup` and `styles` text buffers are the only source of truth. Every UI panel is a pure projection of them. UI edits mutate the buffers (via AST), never a parallel UI state.** If your change stores the authoritative value of a style/structure anywhere else, it's wrong. See [`docs/architecture.md`](docs/architecture.md) invariants 1–6.

## Tech stack

- **React 18 + TypeScript**, built with **Vite**. Pure browser web app (no Electron/Tauri).
- **CodeMirror 6** for all code surfaces.
- **PostCSS** = canonical CSS AST; **`sass`** compiles SCSS→CSS.
- **Sandboxed `<iframe>`** renders the output; we lean on the browser for cascade resolution (`matches`, `getComputedStyle`) and playback (Web Animations API).
- **Zustand** for state. **Vitest + React Testing Library** for tests.

## Directory layout

```
src/
  model/    # framework-agnostic core. NO React imports. The hard, testable logic.
  sandbox/  # iframe renderer + typed bridge
  state/    # zustand stores (document, selection, ui)
  ui/       # center/, panels/, shared/
  lib/      # thin wrappers around postcss, sass, codemirror
docs/       # the specs above
```

`model/` must stay pure TypeScript (DOM parsing via `DOMParser`/jsdom is fine). Keep React and app wiring out of it so the cascade engine, animation parser, and SVG matcher stay unit-testable.

## How to work a task

1. Open [`docs/project-plan.md`](docs/project-plan.md), take the **lowest unchecked step**. Do **that step only** unless it's trivially small.
2. Match the surrounding code's style, naming, and comment density.
3. **Write tests for `model/` logic.** That's where correctness bugs live.
4. Verify: `npm run lint`, `npm test`, and `npm run dev` for anything visual. Confirm the behavior, don't assume.
5. Check the box in the project plan and leave a one-line note.

## Guardrails

- **Don't pull future phases forward.** Stubs are fine; speculative architecture isn't.
- **Surface ambiguity, don't hide it.** Competing rules / non-round-trippable SCSS → inline warning + degrade the control. Build warnings as you go.
- **Be explicit about which buffer a control owns.** CSS declarations → `styles`; SVG geometry attributes → `markup`.
- **Don't reimplement the cascade.** Ask the browser.
- **Mutate ASTs in place** to preserve user formatting/comments; don't regenerate buffers wholesale.
- **`<defs>` is excluded** from the Elements tree.
- Commit/push only when asked. If on `main`, branch first. End commit messages with the `Co-Authored-By` trailer.

## Hard-won notes (learned in Phases 1–6; don't relearn)

- **Cross-realm `instanceof` fails for iframe nodes.** Elements inside the sandbox belong to the iframe window's classes. Use `node.nodeType === Node.ELEMENT_NODE`, never `instanceof Element`, when handling sandbox DOM.
- **Two parses, two purposes.** The renderable CSS comes from `compileStyles` (sass) — sass *reformats* its output, so never treat it as an editing surface. The editing AST (`parseStyles`) parses the buffer directly; PostCSS raws round-trip byte-for-byte and in-place `Declaration.value` mutations preserve all other formatting.
- **`element.matches()` works on detached `DOMParser` documents** — cascade resolution needs no iframe. The live sandbox element is only needed for `getComputedStyle`/`getAnimations` (fetch it via `sandbox/registry.ts`).
- **The sandbox reloads on every srcdoc change** and drops its DOM. Anything wired into the frame (listeners, selection highlight) must re-apply on the iframe `load` event. Selection highlight is a `data-app-selected` attribute + one app-owned style tag in the live DOM only — never in the buffers.
- **ElementRef indices count `<defs>`** (excluded from the projected tree, still occupying its child index) so the same ref resolves against both the parsed buffer and the live sandbox DOM.
- **Never re-serialize the DOM to write markup.** `innerHTML`/`XMLSerializer` normalize self-closing tags and quoting across the whole buffer. `setMarkupAttribute` (`model/markup.ts`) splices only the element's start-tag text, located by pre-order correspondence between source start tags and the parsed DOM — verified over the whole tag list, returning `null` (→ inline warning, no write) when the parser invents elements (e.g. `<tbody>`).
- **All buffer writes go through documentStore actions** (`applyStyleEdit`/`applyAttributeEdit`/`addShape`/`deleteElement`/`moveElement`/setters). They share one `commit` that records undo history and clears redo; writing buffers any other way silently bypasses undo. The actions delegate to pure `model/edit.ts` — keep orchestration there, not in components.
- **Structural edits splice whole subtrees; never re-serialize the DOM (Phase 5).** Add/delete/reorder (`insertChild`/`insertAfter`/`removeElement`/`moveElement` in `model/markup.ts`) locate an element's full *source span* via a stack walk over the same pre-order tag list `setMarkupAttribute` uses, then splice that text. They return `null` (→ inline warning, no write) when source tags don't correspond to the parsed DOM (parser-invented `<tbody>` etc.). Insertion is selection-aware in `insertShape` (inside a selected container, beside a selected leaf, else the first root container / top level). Because refs are **positional**, deletion shifts following siblings' indices — the Elements panel clears selection on delete and follows the element to its new ref on reorder. Reorder is sibling move-up/down only; drag-to-reorder and re-parenting stay deferred with canvas drag-manipulation.
- **`DeclarationAddress` indexing matches cascade walk order** — `ruleIndex` counts every rule `walkRules` visits, *including* `@keyframes` stop blocks, so `EffectiveProperty.source` feeds `setDeclarationValue` directly. Addresses go stale on any buffer change: re-parse and re-resolve, never cache them.
- **PostCSS infers raws for appended nodes from exemplars in the tree**, so new rules/declarations match the buffer's formatting automatically; only near-empty buffers fall back to postcss defaults (4-space indent, no semicolon).
- **Timeline rows are cascade-derived, per element (Phase 6).** `model/animation.ts` walks every animatable element (`<defs>` excluded, matching the Elements tree) and resolves its applied `animation`(s) through `resolveEffectiveProperties` — animations reach elements via the cascade, so never map a rule straight to an element. One `TimelineRow` per applied animation (`rowId = ${elementRef}::${index}`); stops come from the referenced `@keyframes` (missing `@keyframes` → row with no stops, surfaced honestly). The shorthand parser is paren-aware so commas inside `cubic-bezier()`/`steps()` don't split it.
- **PostCSS source offsets map to the styles buffer — but only while it's plain CSS.** `node.source.start.offset`/`end.offset` are present (postcss 8.5) and `end.offset` is *exclusive* (one past the closing `}`), so `buffer.slice(from, to)` lifts a block exactly. The Timeline stores these as `TextRange`s to spotlight `@keyframes`/stop blocks in the right-panel Code tab. This breaks in Phase 8: sass-compiled CSS offsets won't map back to SCSS source — recompute ranges against the authoring buffer then.
- **Playback owns the playhead; it does not read the browser's clock.** `usePlayback` pauses every live animation and sets `animation.currentTime` (play = a rAF loop, scrub = one apply — *same* path), so the rendered frame always matches the playhead. Re-fetch `getSandboxAnimations()` each frame (the iframe reload recreates the Animation objects); `animation.currentTime = …` can throw before the animation is ready (wrap in try/catch); `Document.getAnimations` is absent in jsdom, so `getSandboxAnimations` returns `[]` and playback is a no-op in tests. Until a control is engaged, animations run freely (browser-driven).
- **Testing:** CodeMirror 6 runs fine in jsdom (no polyfills; assert on real editor content — including mark decorations, e.g. `.cm-range-highlight`). A **full-document replace drops decorations**, so re-apply any highlight after the value changes (`CodeView`'s highlight effect also depends on `value`). Reset Zustand stores with `useStore.setState(...)` in `beforeEach` (documentStore needs `past: [], future: []`; uiStore now also holds `playing`/`playheadMs`; selectionStore has a `timeline` axis); wrap store mutations that should re-render in `act()`. Pure `model/` tests can build DOM via `new DOMParser()`.
- **Visual verification:** `.claude/launch.json` defines the `dev` server for the preview tools. `preview_click` can't reach inside the sandbox iframe — use `preview_eval` with `document.querySelector('iframe.sandbox-frame').contentDocument` to interact with rendered elements.

## Workflow

- One plan step per session-chunk; the user says "go" per step or phase. Commit each completed step (checkbox + one-line note in `docs/project-plan.md` goes in the same commit).
- Work each phase on a branch off `main` (e.g. `phase-4-editing`); merge --ff-only to `main` and delete the branch when the user says the phase batch is done. Remote: `origin` = github.com/morgankeys/SVG-animator-app.

## Commands

```
npm run dev     # Vite dev server
npm test        # Vitest
npm run lint    # ESLint
npm run build   # production build
```

(These exist after Phase 0.2 scaffolding.)
