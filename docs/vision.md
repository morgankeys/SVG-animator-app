# Vision, Philosophy & Scope

## Motivation

This tool exists out of frustration with traditional animation tools (e.g. After Effects):

- **Asset/frame management is painful.** Importing and managing frames and assets from Figma is awkward.
- **Image quality vs. portability is a bad trade-off.** Videos and GIFs force you to choose between file size and fidelity, and neither scales cleanly.

## Philosophy

**Ground everything in CSS.** We deliberately trade away advanced graphics features in exchange for assets that are:

- **Hyper-scalable** — vector SVG + CSS, sharp at any size.
- **Hyper-portable** — plain text (HTML/SVG/CSS), embeddable anywhere a browser runs, diffable in git, no binary blobs.

This trade-off is the north star. When a feature request conflicts with "it must be expressible as CSS," the CSS constraint wins.

### The source-of-truth principle

The **code is the source of truth.** The GUI is a faithful projection of the underlying markup and styles — never a parallel state that can drift. See [`architecture.md`](architecture.md) for how this is enforced.

When the projection is *lossy or ambiguous* (e.g. two rules set the same property, or an SCSS construct can't be safely round-tripped), the UI must **surface a warning inline** next to the affected control rather than silently guessing — and it resolves what to *display* using real CSS cascade/precedence rules.

## Scope

### In scope

- Anything expressible in **CSS/SCSS** animations and transitions.
- Basic SVG shapes and containers: `rect`, `circle`, `ellipse`, `line`, `polyline`, `polygon`, `path`, `text`, and grouping (`g`, `svg`).
- Styling: fill, stroke, opacity, transforms, position/size, and other CSS properties.
- `@keyframes`-based animations and CSS `transition`s.
- Importing SVGs and mapping/interpolating them as keyframes.

### Out of scope (for now)

- **Anything not possible in CSS.** If it can't be expressed as a CSS rule, it's out of scope until proven otherwise.
- **`<defs>` elements** — excluded from the Elements tree for now.
- **Direct canvas manipulation** (drag-to-move/resize shapes on the canvas) — a future release. Early versions edit via the Elements tree + Rules panel.
- Raster image effects, video, audio, 3D engines, physics.

## Guiding questions when adding a feature

1. Can this be expressed purely as CSS/SCSS or SVG markup? If not, it's likely out of scope.
2. Does the GUI remain a projection of the code, with the code authoritative?
3. If the mapping from code → UI is ambiguous, is there a clear inline warning?
4. Does it keep the output portable and scalable (text, vector)?
