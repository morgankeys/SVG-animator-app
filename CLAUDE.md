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

## Commands

```
npm run dev     # Vite dev server
npm test        # Vitest
npm run lint    # ESLint
npm run build   # production build
```

(These exist after Phase 0.2 scaffolding.)
