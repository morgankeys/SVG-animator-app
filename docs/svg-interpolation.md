# SVGs as Keyframes: Import, Mapping & Interpolation

This is the most algorithmically complex feature. It is a **distinct epic** (project-plan Phases 9–10) and should not be attempted until the core editor + timeline are solid.

## Goal

Let a user supply several SVGs that represent the **same artwork in different states** (different opacity, scale, position, color…) and turn them into a single animated SVG: **one unified markup** whose elements are driven across states by generated `@keyframes`.

## The core problem: corresponding markup across frames

Different SVGs that depict the same thing rarely share IDs or exact structure. Example:

```
SVG 1: <g id="frame-1"> <circle id="circle-1" .../> </g>
SVG 2: <g id="frame-2"> <circle id="circle-2" .../> </g>
```

A naïve diff treats `#circle-1` and `#circle-2` as unrelated. We want to recognize they're **the same element** and unify them:

```
Output: <g id="frame"> <circle id="circle" .../> </g>
   + @keyframes that animate #circle's style from SVG 1's state → SVG 2's state.
```

## Data model

```ts
Frame {
  id: string
  label: string          // e.g. "01-start.svg"
  markup: string         // original SVG source
  tree: ElementNode[]    // parsed
}

// A correspondence links one node from each frame that represent the same element.
Correspondence {
  id: string                              // canonical id, e.g. "circle"
  members: Record<FrameId, NodePath>      // which node in each frame
  confidence: number                      // from the matcher
  status: "auto" | "manual" | "unmatched"
}

InterpolationProject {
  frames: Frame[]
  order: FrameId[]                        // timeline order of frames
  correspondences: Correspondence[]
  unifiedMarkup?: string                  // generated
  generatedKeyframes?: string            // generated CSS
}
```

## Auto-matching algorithm (best-effort)

Run pairwise/across-frames to propose correspondences. Score candidate pairs on a weighted combination of signals:

1. **Tag name** must match (hard filter): a `circle` only maps to a `circle`.
2. **Structural position** — similar depth and sibling index; similar ancestor chain.
3. **Normalized id/class** — strip trailing frame indices/suffixes (`circle-1`, `circle_2`, `circle.frame2` → `circle`); compare the normalized stems.
4. **Attribute/geometry similarity** — compare geometry attrs (`r`, `width`, `points` length, path command structure) and presentation attrs; close values ⇒ likely the same element.
5. **Count/uniqueness** — if each frame has exactly one `circle` under a corresponding parent, match them with high confidence.

Produce correspondences with a confidence score. High-confidence ⇒ `auto`. Low/ambiguous ⇒ left `unmatched` for the user.

> Keep the matcher **pure and testable** in `model/`. It takes parsed trees in, returns proposed correspondences out. Build a fixture suite of SVG pairs with known-correct mappings.

## Manual mapping UI

The auto-matcher will not always be right. The UI must let the user:

- See frames side by side with their element trees.
- **Link** two (or more) nodes across frames to form/redefine a correspondence (the `#frame-1` ↔ `#frame-2` case).
- **Unlink / split** an incorrect correspondence.
- See **unmatched** nodes flagged, and decide: link them, or mark a node as **frame-specific** (appears/disappears — animate opacity).
- Review/override the canonical id assigned to each correspondence.

## ID refactor & code generation

Once correspondences are settled:

1. **Assign canonical IDs.** Each correspondence gets one canonical id (`circle`); rewrite member nodes to use it. **Refactor all references** accordingly (e.g. `url(#...)`, `href`, `aria-labelledby`) so nothing dangles.
2. **Emit unified markup.** Use the structure of a chosen base frame (or a merged superset that includes frame-specific elements, hidden by default).
3. **Generate `@keyframes`.** For each correspondence and each animatable property that differs across frames, emit a stop per frame at its timeline percentage. Frame order → percentage (`0%`, `…`, `100%`). Frame-specific elements animate `opacity`/`visibility`.
4. **Wire `animation`** declarations onto elements, exposed as Timeline rows like any other animation.

## Edge cases to handle (and surface to the user)

- An element exists in some frames but not others (appearance/disappearance).
- One→many or many→one structural changes (a shape splits/merges) — likely require manual mapping, possibly unsupported initially.
- Conflicting canonical ids (two correspondences want the same name) — disambiguate.
- Non-animatable differences (e.g. tag changes) — warn; out of scope for interpolation.
- Reference integrity after id rewrite — validate no broken `url(#…)`.

## Phasing within the epic

- **9.x** Import pipeline + Frame model + side-by-side viewer (no matching yet).
- **10.1** Pure auto-matcher + fixture tests.
- **10.2** Manual mapping UI (link/unlink/flag).
- **10.3** ID refactor + reference rewrite.
- **10.4** `@keyframes` generation + wire into Timeline.
- **10.5** Edge-case handling + validation/warnings.

Treat each as independently reviewable. Do not let an agent attempt the whole epic in one pass.
