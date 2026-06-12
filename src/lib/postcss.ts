import postcss from 'postcss';
import type { Root, Rule } from 'postcss';

export type { Root, Rule, AtRule, Declaration } from 'postcss';

/** Create a detached rule for insertion. Raws are inferred from the tree on stringify. */
export function createCssRule(selector: string): Rule {
  return postcss.rule({ selector });
}

/** Parse CSS into the canonical AST. PostCSS preserves raws (whitespace, comments). */
export function parseCss(css: string): Root {
  return postcss.parse(css);
}

/** Serialize the AST back to text. Untouched nodes keep their exact original raws. */
export function stringifyCss(root: Root): string {
  return root.toString();
}
