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
- Phases 1–7 authored within the plain-CSS subset (SCSS compiles CSS to itself, so the pipeline was identical). **Phase 8** turned the right-panel Code tab into an editable SCSS surface and added the round-trip limits below.
- **The editing AST is parsed from the buffer directly** (`parseStyles`), never from sass output — sass reformats, which would destroy the user's formatting on write-back. Since Phase 8 the buffer is parsed with the **postcss-scss** syntax, so real SCSS (`//` comments, `$variables`, nesting, `&`) round-trips byte-exact through in-place mutations; plain CSS is a subset, so nothing earlier regressed. The compiled CSS exists only to render and to inspect.

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

When the UI must create a new declaration, where does it go? Implemented in Phase 4 (`createDeclaration` in `model/styles.ts`, orchestrated by `model/edit.ts`):

- The target is the **last top-level rule whose selector is exactly the element's `#id`** — the one rule that can't restyle siblings, at the position where the new declaration wins source-order ties. (If that rule already declares the property, it's updated in place.)
- If none exists, a fresh `#id` rule is **appended** to the buffer (formatting inferred from the existing tree via PostCSS raws). Elements without an id are first assigned a generated, document-unique, tag-based id in the **markup buffer** (`ensureElementId`) — the one case where a style edit touches both buffers; it undoes as a single history step.
- Never written into: broad/shared selectors (`circle {}`), selector lists (`#ball, .other` — declarations would apply to both), and rules nested inside at-rules (conditional, e.g. `@media`).

### Non-round-trippable cases (mark `editable: false`)

Implemented in Phase 8.2 (`cascade.ts` sets `EffectiveProperty.uneditableReason`):

- **`scss-value`** — the winning value carries a SCSS variable reference (`$x`) or interpolation (`#{…}`), so its source text isn't its rendered value; rewriting it would clobber the expression. (Plain CSS functions — `calc`, `rgb`, `var`, `url` — are *not* flagged: they round-trip as ordinary values. Bare SCSS function calls like `darken(...)` are a known gap, deferred.)
- **`scss-nested`** — the declaration sits in a nested rule or one using the `&` parent selector, so its written selector is relative and can't be safely retargeted.
- **`inline`** — the winner is the element's `style` attribute (markup-owned, pre-Phase 8).

In all these the Rules control becomes read-only with a badge + tooltip explaining why and pointing to the Code tab (or markup, for inline). The winning value is still shown — honest about its origin rather than hidden. `!important` and complex-combinator targeting remain finer-grained follow-ups.

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

Timeline row model (animations in Phase 6, transitions in Phase 7 — both share the shape):

```ts
TextRange { from: number, to: number }   // char span in the styles buffer

TimelineRow {
  kind: "animation" | "transition"
  rowId: string                 // stable within one projection. animations: `${elementRef}::${index}`;
                                 // transitions: `${elementRef}::t${index}` (so the two kinds never collide)
  elementRef: ElementRef
  label: string                 // animation name, or the transitioned property (P7)
  durationMs: number
  delayMs: number
  iterations: number            // Infinity for `infinite`; always 1 for transitions
  keyframesRange: TextRange | null   // the @keyframes block (animations; null for transitions/missing)
  declarationRange: TextRange | null // the `transition` declaration to spotlight (transitions; null for animations)
  stops: Array<{ atPercent: number, range: TextRange }>   // animations only ([] for transitions)
}
```

Rows are a **pure projection** of the buffers (`model/animation.ts` → `buildTimelineRows`), surfaced to the UI by the `useTimelineRows` hook so both the Timeline strip and the right-panel linking share one derivation. Which animation/transition applies to which element is a **cascade** question — resolved via `resolveEffectiveProperties`, never by mapping a rule directly to an element. Stops carry a `TextRange` (rather than an opaque ref) so the Code tab can spotlight the exact block; those offsets come from PostCSS `source` positions and, since Phase 8 parses the buffer with postcss-scss, map directly onto the **authoring (SCSS) buffer** the Code tab shows — no recompilation needed.

**Transitions (Phase 7)** mirror the animation pipeline: `resolveElementTransitions` parses the `transition` shorthand per comma-segment (paren-aware) and lets longhands override, exactly like `resolveElementAnimations`; `transition-property` defaults to `all`, and `none` (shorthand or property entry) is skipped. A transition has no `@keyframes`, so it links to its defining `transition` declaration via `declarationRange` (resolved from the cascade winner's `source` by a rule/decl walk that matches `cascade.ts` indexing) instead of `keyframesRange`/stops. Note transitions only spawn a live `Animation` when a property actually changes, so they don't appear in `getSandboxAnimations()` at rest — the row is a static projection, not a playable track.

### Playback & scrubbing

Use the **Web Animations API**: `Document.getAnimations()` (via `getSandboxAnimations` in `sandbox/registry.ts`) returns `Animation` objects. Drive playback by setting `animation.currentTime` (scrub), `.play()`/`.pause()`. This is far more robust than the negative-`animation-delay` hack and stays perfectly in sync with the real rendered animation.

- The **playhead is the single source of truth; an animation plays iff the playhead is moving** (`usePlayback`). Every live animation is paused and pinned to `animation.currentTime`, so play (a `requestAnimationFrame` loop, looping at the common duration) and scrub share one path. Animations are re-fetched each frame so a mid-play iframe reload is picked up. **While not playing, a second rAF loop keeps pinning animations to the static playhead** so the canvas stays frozen at the current frame — by product decision nothing animates on load until the user presses play (this also defeats the browser autoplaying the sample on load / after an iframe reload). Playhead/playing live in `uiStore` (transient UI).
- Playhead position ↔ `currentTime` for all rows, normalized to a common timeline. The **playhead line itself is draggable** (`role="slider"`): pointer-drag maps cursor x onto the track region (same geometry constants the playhead is laid out with — keep them in sync) and routes through the same `scrub`; arrow keys / Home / End step it for keyboard scrubbing.
- Selecting a row reveals its `@keyframes` (animations) or `transition` declaration (transitions) in the right panel (switches it to the Code tab + spotlights the block).
- Selecting a stop highlights the specific `50% { ... }` block. Timeline selection (`{ rowId, stopIndex }`) lives in the shared `selectionStore` alongside `element`.
