# Project Plan

A phased build, ordered so each phase is **small, vertically sliced, and independently reviewable**. The guiding rule: **one phase (often one step) per agent session.** Don't let an agent swallow a whole phase if the steps are individually shippable.

Legend: each step lists a **Goal**, **Deliverable**, and **Done when** (acceptance criteria). Check boxes as you go.

---

## Phase 0 — Scaffold & docs ✅ (docs done)

- [x] **0.1 Documentation.** This `docs/` set + `README.md` + `CLAUDE.md`.
- [x] **0.2 Project scaffold.** — Vite + React 18 + TS, ESLint 9 + Prettier, Vitest + RTL, static 3-panel + timeline shell; lint/test/build green, dev server verified.
  - Goal: a runnable empty app.
  - Deliverable: Vite + React + TS project; ESLint + Prettier; Vitest configured; `npm run dev` serves a blank 3-panel + timeline layout shell (static, no logic); folder structure per [`architecture.md`](architecture.md).
  - Done when: `npm run dev` shows the empty Figma-like frame; `npm run lint` and `npm test` pass (with one trivial test).

---

## Phase 1 — Document model & rendering core (the spine)

The single most important phase. Establishes buffers-as-truth + the sandbox renderer.

- [x] **1.1 Document store.** — `model/document.ts` (Document type + animated bouncing-ball sample) + Zustand store with markup/styles setters; unit tests cover seed + get/set.
  - Deliverable: `model/document.ts` + Zustand document store holding `markup` and `styles` strings, seeded with a hardcoded sample (a simple animated SVG). Getters/setters only.
  - Done when: store holds + updates buffers; unit tests cover get/set.
- [ ] **1.2 Markup parsing.**
  - Deliverable: `model/markup.ts` — `DOMParser`-based parse of the markup buffer into an `ElementNode` tree (stable `ElementRef`s, `<defs>` excluded). Pure, jsdom-testable.
  - Done when: sample markup parses to expected tree; tests cover nesting + defs exclusion.
- [ ] **1.3 Style compile + parse.**
  - Deliverable: `model/styles.ts` — `sass.compileString(scss) → css`, then `postcss.parse(css) → AST`, plus serialize back. `lib/` wrappers for sass/postcss.
  - Done when: SCSS sample compiles; AST round-trips to equivalent CSS; tests pass.
- [ ] **1.4 Sandbox renderer.**
  - Deliverable: `sandbox/` iframe component that injects compiled CSS + markup and renders; typed bridge stub. Same-origin srcdoc iframe.
  - Done when: Preview tab shows the sample SVG rendered and animating.
- [ ] **1.5 Center tabs + read-only Code view.**
  - Deliverable: Preview / Code / Split tabs. Code tab shows consolidated markup + compiled CSS in CodeMirror 6, read-only, with collapsible regions + syntax highlighting.
  - Done when: all three tabs work; Code view is highlighted, read-only, collapsible.

---

## Phase 2 — Elements panel (markup projection)

- [ ] **2.1 Element tree UI.** Collapsible "Elements" tree from the markup AST (defs excluded), treating containers as frames.
  - Done when: tree matches the sample markup and expands/collapses.
- [ ] **2.2 Shared selection store.** `state/selection` with `ElementRef`.
- [ ] **2.3 Selection sync.** Click in tree → highlight on canvas (overlay in iframe); click on canvas → highlight in tree.
  - Done when: selection is bidirectional and stable across re-parses.

---

## Phase 3 — Cascade resolution & Rules panel (read-only)

- [ ] **3.1 Cascade engine.** `model/cascade.ts`: given an `ElementRef` + CSS AST + live iframe node, return `EffectiveProperty[]` (winner, computed, source, competing) per [`css-engine.md`](css-engine.md).
  - Done when: unit tests cover specificity ordering + competing-decl detection.
- [ ] **3.2 Rules panel (read-only).** Grouped controls (Layout/Transform/Appearance/Effects/Animation) displaying resolved values; inline warning when `competing.length > 0`.
  - Done when: selecting an element shows correct values + warnings; no editing yet.
- [ ] **3.3 Right-panel Code tab (read-only).** Highlighted SCSS/CSS for context.

---

## Phase 4 — Editing via Rules panel (write-back)

- [ ] **4.1 AST mutation helpers.** In-place edit of a Declaration value; create a declaration in a write-target rule (strategy in [`css-engine.md`](css-engine.md)); serialize.
- [ ] **4.2 Wire controls to writes.** Appearance group first (fill/stroke/opacity), then Transform, then Layout. Markup-attribute controls (SVG geometry) write the markup buffer.
  - Done when: changing a control updates the buffer and re-renders; the same edit is reproducible by hand in the Code tab.
- [ ] **4.3 Undo/redo.** History at the document-store level.
  - Done when: undo/redo restores prior buffer state across UI + (later) code edits.

---

## Phase 5 — Direct shape creation/deletion

- [ ] **5.1 Add shapes.** rect, circle, ellipse, line, polyline, polygon, path, text, group → insert into markup buffer at selection.
- [ ] **5.2 Delete + reorder** in Elements tree → markup mutation.
  - Done when: tree edits round-trip through the markup buffer and render. (Canvas drag-manipulation stays deferred.)

---

## Phase 6 — Timeline: animations

- [ ] **6.1 Animation parsing.** `model/animation.ts`: `@keyframes` + `animation` shorthand/longhand → `TimelineRow`s with stops.
- [ ] **6.2 Timeline UI.** One row per `animation`; stops at keyframe percentages (no per-property hierarchy).
- [ ] **6.3 Playback + scrub** via Web Animations API (`getAnimations()`, `currentTime`).
- [ ] **6.4 Timeline↔keyframes linking.** Row select → show `@keyframes` in right panel; stop select → highlight the `50% { … }` block.
  - Done when: scrubbing moves the rendered animation; selection links both ways.

---

## Phase 7 — Timeline: transitions

- [ ] **7.1 Transition parsing** → rows.
- [ ] **7.2 Transition rows + linking** in the timeline, mirroring Phase 6.

---

## Phase 8 — SCSS authoring layer

- [ ] **8.1 SCSS source-of-truth.** Right-panel Code tab edits SCSS; compile pipeline drives everything.
- [ ] **8.2 Round-trip limits.** Mark declarations originating from non-round-trippable SCSS constructs as `editable: false`; Rules controls degrade to read-only-with-warning per [`css-engine.md`](css-engine.md).
  - Done when: editing SCSS reflects everywhere; UI honestly flags what it can't safely write back.

---

## Phase 9 — SVG import & frame model

- [ ] **9.1 Import pipeline.** File picker / drag-drop SVGs → `Frame`s (parsed). (File System Access API + fallback.)
- [ ] **9.2 Frame viewer.** Side-by-side frames with element trees; set frame order.

---

## Phase 10 — SVG correspondence mapping & interpolation (epic)

Sub-phases from [`svg-interpolation.md`](svg-interpolation.md), each independently reviewable:

- [ ] **10.1 Auto-matcher** (pure) + fixture tests.
- [ ] **10.2 Manual mapping UI** (link/unlink/flag unmatched).
- [ ] **10.3 ID refactor** + reference rewrite.
- [ ] **10.4 `@keyframes` generation** + wire into Timeline.
- [ ] **10.5 Edge cases** + reference-integrity validation/warnings.

---

## Phase 11 — Export

- [ ] **11.1 Consolidated export.** Single HTML/SVG + compiled CSS bundle; copy-to-clipboard + download.
  - Done when: exported file renders identically standalone in a browser.

---

## Phase 12 — Persistence

- [ ] **12.1 Save/load projects.** Serialize `Document` (+ interpolation data) to file (File System Access API) and/or localStorage; open existing.
  - Done when: a project survives reload and reopen.

---

## Working agreements for agents

- **Pick the lowest unchecked step.** Do that step only, unless it's trivially small. Update the checkbox + a one-line note in your PR/commit.
- **Respect the invariants** in [`architecture.md`](architecture.md). If a step tempts you to store style/structure state outside the buffers, stop and reconsider.
- **Test the `model/` core.** The hard logic (cascade, animation parsing, matcher) is pure — cover it with unit tests; that's where bugs hide.
- **Don't pull future phases forward.** Stubs/placeholders are fine; speculative architecture is not.
- **Surface ambiguity, don't hide it** — wire warnings as you build, not later.
