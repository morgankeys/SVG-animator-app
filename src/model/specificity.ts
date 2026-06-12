/**
 * Selector specificity (a=ids, b=classes/attrs/pseudo-classes, c=types).
 * The one piece of cascade arithmetic the browser can't report — matching
 * itself is delegated to element.matches() (docs/css-engine.md).
 *
 * Known simplifications: `:where()` is treated as zero by dropping it; the
 * arguments of `:not()/:is()/:has()` are counted directly rather than taking
 * the max branch. Fine for the selectors this tool authors; revisit if needed.
 */
export type Specificity = readonly [number, number, number];

export function specificity(selector: string): Specificity {
  let s = selector
    .replace(/(['"]).*?\1/g, '') // string literals (e.g. in attr selectors)
    .replace(/:where\([^)]*\)/gi, '')
    .replace(/:(not|is|has)\(/gi, '('); // count inner args, drop the wrapper itself

  let a = 0;
  let b = 0;
  let c = 0;

  s = s.replace(/\[[^\]]*\]/g, () => ((b += 1), ' '));
  s = s.replace(/#[\w-]+/g, () => ((a += 1), ' '));
  s = s.replace(/\.[\w-]+/g, () => ((b += 1), ' '));
  s = s.replace(/::[\w-]+/g, () => ((c += 1), ' '));
  s = s.replace(/:[\w-]+/g, () => ((b += 1), ' '));
  for (const token of s.split(/[\s>+~(),*]+/)) {
    if (/^[a-zA-Z][\w-]*$/.test(token)) c += 1;
  }

  return [a, b, c];
}

/** Negative if a < b, positive if a > b, 0 if equal. */
export function compareSpecificity(x: Specificity, y: Specificity): number {
  return x[0] - y[0] || x[1] - y[1] || x[2] - y[2];
}
