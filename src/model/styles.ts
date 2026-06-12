/**
 * Style pipeline (docs/css-engine.md): SCSS buffer --sass--> CSS for rendering,
 * and CSS --postcss--> AST for inspection/editing.
 *
 * Two distinct parses, two purposes:
 * - compileStyles: the renderable CSS injected into the sandbox. Sass reformats
 *   its output, so this is NOT the editing surface.
 * - parseStyles/serializeStyles: the canonical editing AST, parsed straight from
 *   the buffer so untouched raws (whitespace, comments) round-trip exactly
 *   (architecture invariant 3). While the buffer is plain CSS (Phases 1-7) this
 *   AST also matches what renders; the SCSS authoring layer revisits that in
 *   Phase 8.
 */
import { compileScss, isSassException } from '../lib/sass';
import { parseCss, stringifyCss } from '../lib/postcss';
import type { Root } from '../lib/postcss';

export interface StyleError {
  message: string;
  line?: number;
  column?: number;
}

export type CompileResult = { ok: true; css: string } | { ok: false; error: StyleError };

/** Compile the styles buffer (SCSS) to renderable CSS. Errors are surfaced, not thrown. */
export function compileStyles(scss: string): CompileResult {
  try {
    return { ok: true, css: compileScss(scss) };
  } catch (error) {
    if (isSassException(error)) {
      const start = error.span.start;
      return {
        ok: false,
        // sass spans are 0-based; report 1-based like editors do.
        error: { message: error.sassMessage, line: start.line + 1, column: start.column + 1 },
      };
    }
    return { ok: false, error: { message: String(error) } };
  }
}

/** Parse CSS into the canonical editing AST. */
export function parseStyles(css: string): Root {
  return parseCss(css);
}

/** Serialize the AST back to the buffer. Exact round-trip for untouched nodes. */
export function serializeStyles(ast: Root): string {
  return stringifyCss(ast);
}
