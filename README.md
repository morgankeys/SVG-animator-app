# CSS Animator

A desktop web app for building **CSS/SCSS animations and transitions** through a Figma-style GUI — where the CSS is always the source of truth.

Instead of exporting heavyweight videos or GIFs from tools like After Effects, this editor produces **hyper-scalable, hyper-portable** assets: plain HTML/SVG markup + CSS. Everything you can do in the GUI maps directly to CSS rules, and you can drop into a code view at any time to read or write the CSS/SCSS yourself.

## Core idea

> The markup (HTML/SVG) and styles (CSS/SCSS) are the **single source of truth**. Every panel in the UI is a *projection* of that text. UI controls don't hold their own state — they read from and write back to the underlying code.

## What it does (target feature set)

- **Direct editing** — add, delete, style, and transform basic shapes on a canvas via a layer ("Elements") hierarchy that mirrors the SVG markup exactly.
- **Code view** — switch any panel to a syntax-highlighted code view; the code is authoritative.
- **Timeline** — play/scrub animations; each row is one CSS `animation` (or `transition`) rule, with stops derived from `@keyframes` percentages.
- **SVGs as keyframes** — import multiple SVGs, map corresponding markup across them (auto + manual), and interpolate between them as animation keyframes.
- **Export** — a single consolidated HTML/SVG + CSS bundle, ready to ship.

## Tech stack

| Concern | Choice |
| --- | --- |
| Framework | React 18 + TypeScript |
| Build | Vite |
| Packaging | Pure browser web app (localhost) |
| Code editor | CodeMirror 6 |
| Style engine | PostCSS (canonical AST) + `sass` (SCSS→CSS) |
| Rendering | Sandboxed `<iframe>` + Web Animations API |
| State | Zustand |
| Tests | Vitest + React Testing Library |

## Documentation map

Read these before contributing. They are the contract every agent works against.

- [`CLAUDE.md`](CLAUDE.md) — agent operating guide: invariants, conventions, how to pick up a task.
- [`docs/vision.md`](docs/vision.md) — motivation, philosophy, scope boundaries.
- [`docs/architecture.md`](docs/architecture.md) — the source-of-truth model and data flow.
- [`docs/css-engine.md`](docs/css-engine.md) — how CSS is parsed, the cascade is resolved, and edits round-trip.
- [`docs/ui-spec.md`](docs/ui-spec.md) — the three-panel + timeline layout, panel by panel.
- [`docs/svg-interpolation.md`](docs/svg-interpolation.md) — SVG-as-keyframes import and mapping.
- [`docs/project-plan.md`](docs/project-plan.md) — the phased, step-by-step build plan.
- [`docs/glossary.md`](docs/glossary.md) — shared vocabulary.

## Status

Greenfield. See [`docs/project-plan.md`](docs/project-plan.md) for the current phase.
