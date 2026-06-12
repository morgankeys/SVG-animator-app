/**
 * Build the srcdoc for the sandbox iframe: the user's markup + compiled CSS,
 * nothing of the app's own chrome (docs/architecture.md — style isolation).
 */
export function buildSandboxHtml(markup: string, css: string): string {
  return `<!doctype html>
<html>
<head>
<style>
html, body { margin: 0; height: 100%; }
body { display: grid; place-items: center; }
</style>
<style>
${escapeStyleClose(css)}
</style>
</head>
<body>
${markup}
</body>
</html>`;
}

/** Prevent user CSS from closing our <style> tag and escaping into the document. */
function escapeStyleClose(css: string): string {
  return css.replace(/<\/style/gi, '<\\/style');
}
