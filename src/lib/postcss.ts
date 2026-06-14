import postcss from 'postcss';
import * as scss from 'postcss-scss';
import type { Root, Rule } from 'postcss';

export type { Root, Rule, AtRule, Declaration } from 'postcss';

/** Create a detached rule for insertion. Raws are inferred from the tree on stringify. */
export function createCssRule(selector: string): Rule {
  return postcss.rule({ selector });
}

/** Parse plain CSS into the canonical AST. PostCSS preserves raws (whitespace, comments). */
export function parseCss(css: string): Root {
  return postcss.parse(css);
}

/** Serialize a plain-CSS AST back to text. Untouched nodes keep their exact raws. */
export function stringifyCss(root: Root): string {
  return root.toString();
}

/**
 * Parse the SCSS authoring buffer (Phase 8): the styles buffer is SCSS, a CSS
 * superset, so plain `postcss.parse` chokes on `//` comments, `$variables`,
 * nesting, and `&`. The postcss-scss syntax parses all of it into the same AST
 * shape with byte-exact raws — but it must be paired with `stringifyScss`, since
 * the default stringifier doesn't know how to re-emit SCSS-only nodes.
 */
export function parseScss(source: string): Root {
  return scss.parse(source);
}

/** Serialize an AST parsed by `parseScss` back to text (byte-exact for untouched nodes). */
export function stringifyScss(root: Root): string {
  let out = '';
  scss.stringify(root, (part) => {
    out += part;
  });
  return out;
}
