# CSS Engine: Parsing, Cascade Resolution & Round-Trip Editing

This document specifies how the Rules panel maps to CSS and how UI edits round-trip back to the buffers. It implements invariants 4–5 from [`architecture.md`](architecture.md).

## Pipeline

```
styles (SCSS string)
   │  sass.compileString()        // dart-sass compiled to JS/WASM
   ▼
CSS string  ──────────────────────► injected into sandbox iframe (rendering)
   │  postcss.parse()
   ▼
CSS AST (Root → Rule/AtRule → Declaration)   // canonical model for editing
```

- **SCSS is the authoring source of truth.** CSS is its compiled output.
- For **MVP (Phases 1–7) we author plain CSS** (SCSS compiles CSS to itself, so the pipeline is identical). The SCSS-specific authoring layer and its round-trip limits land in **Phase 8**.

## Resolving what the Rules panel shows (read path)

Given the selected element, we show its **effective declarations** — the value that actually wins per the cascade — plus provenance.

Algorithm (lean on the browser, don't reimplement the cascade):

1. Find the live DOM node for the selected element inside the sandbox iframe.
2. For each `Rule` in the CSS AST, test `liveNode.matches(rule.selector)` to collect **matching rules**.
3. For each CSS **property** of interest, gather all declarations of that property across matching rules. Sort by **(specificity, source order)**; the last/highest wins. (Use a small specificity util, or cross-check against `getComputedStyle` for the resolved value.)
4. Build a per-property view model:

```ts
EffectiveProperty {
  property: string            // "opacity"
  value: string               // "0.5"  (the winning declared value)
  computed: string            // from getComputedStyle (resolved/animated)
  source: { selector, ruleIndex, declIndex }   // where the winner lives
  competing: Array<{ selector, value }>          // other matching decls (→ warning)
  editable: boolean           // false if origin can't be safely written back
}
```

5. If `competing.length > 0`, the control renders an **inline warning** ("also set by `.foo`") and still shows/edits the winner.

`getComputedStyle` gives resolved values (great for display and for properties not explicitly declared); the AST gives the *declared* value and its location (needed to edit the right place).

## Editing (write path)

When a control changes a value:

1. If the property has a winning declaration with `editable: true`, **mutate that Declaration node's value** in the PostCSS AST.
2. If no declaration exists yet, **create one** in the *write-target rule* (see below).
3. Serialize the AST → styles buffer → re-render.

### Write-target rule strategy

When the UI must create a new declaration, where does it go? Documented default (revisit in Phase 4):

- Prefer the **most-specific matching rule whose selector targets this element uniquely** (e.g. an id selector for the element).
- If none exists, **create/reuse a per-element rule** keyed by a stable selector (assign the element a stable `id` in markup if needed, then write `#that-id { ... }`).
- Never silently write into a broad, shared selector (e.g. `circle {}`) — that would surprise the user by restyling siblings. If only a shared rule matches, create a more specific rule instead.

### Non-round-trippable cases (mark `editable: false`)

- The winning value comes from an SCSS construct that doesn't map to a single CSS declaration we can rewrite (variable interpolation, mixin output, computed expression) — Phase 8.
- The value uses `!important` in a way that complicates precedence — show warning, allow but flag.
- The selector matches via complex combinators we can't safely target for a *new* per-element rule.

In all these, the control becomes read-only with an inline warning explaining why, and points the user to the Code tab.

## Rules-panel grouping (UI model)

The Rules tab presents a compact, Figma-like set of control groups. Suggested grouping (iterate over time):

- **Layout / Position** — `x`/`y` (via `transform: translate` or `x`/`y`/`cx`/`cy` SVG attrs), `width`/`height`.
- **Transform** — translate, scale, rotate, skew, transform-origin.
- **Appearance** — `fill`, `stroke`, `stroke-width`, `opacity`.
- **Effects** — `filter`, `mix-blend-mode`, `box-shadow`/`drop-shadow`.
- **Animation** — applied `animation`/`transition` shorthand (links to Timeline).

Each control: label, value input, provenance/warning affordance. Unset properties show placeholder/computed value, and setting them triggers the write-target logic.

> Note: SVG geometry (e.g. `cx`, `r`, `points`) lives in **markup attributes**, not CSS. Those controls mutate the markup buffer, not the styles buffer. Be explicit about which buffer each control owns.

## Animations & transitions (for the Timeline)

Parsed in `model/animation.ts`:

- **`@keyframes <name>`** → ordered list of stops `{ percent, declarations }`.
- **`animation` / `animation-*`** on an element → `{ name, duration, delay, iteration, timing, direction, fill }`.
- **`transition` / `transition-*`** → `{ property, duration, delay, timing }`.

Timeline row model:

```ts
TimelineRow {
  kind: "animation" | "transition"
  elementRef: ElementRef
  label: string                 // animation name or property
  durationMs: number
  stops: Array<{ atPercent: number, keyframeRef }>   // animations only
}
```

### Playback & scrubbing

Use the **Web Animations API**: `iframeNode.getAnimations()` returns `Animation` objects. Drive playback by setting `animation.currentTime` (scrub), `.play()`/`.pause()`. This is far more robust than the negative-`animation-delay` hack and stays perfectly in sync with the real rendered animation.

- Playhead position ↔ `currentTime` for all rows, normalized to a common timeline.
- Selecting a row highlights its `@keyframes`/`transition` in the right panel.
- Selecting a stop highlights the specific `50% { ... }` block.
