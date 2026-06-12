import postcss from 'postcss';
import type { Root } from 'postcss';

export type { Root, Rule, AtRule, Declaration } from 'postcss';

/** Parse CSS into the canonical AST. PostCSS preserves raws (whitespace, comments). */
export function parseCss(css: string): Root {
  return postcss.parse(css);
}

/** Serialize the AST back to text. Untouched nodes keep their exact original raws. */
export function stringifyCss(root: Root): string {
  return root.toString();
}
