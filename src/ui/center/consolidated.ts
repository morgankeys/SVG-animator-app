/**
 * The consolidated source shown in the center Code tab: everything that will be
 * in the final export — the markup plus ALL styles as compiled CSS (docs/ui-spec.md).
 * Phase 11 formalizes actual export; this is the read-only preview of it.
 */
export function buildConsolidatedSource(markup: string, compiledCss: string): string {
  const trimmedCss = compiledCss.trim();
  if (!trimmedCss) return markup;
  return `${markup.trimEnd()}\n\n<style>\n${trimmedCss}\n</style>\n`;
}
